begin;
-- Trusted operator only: caller validates Auth/MFA before supplying reviewer.
-- Not wired to mobile or the existing moderation publication action.
create function public.approve_discovery_publication(parking uuid, reviewer uuid,
  physical_evidence text, license_evidence text, access_evidence text, deduplication_evidence text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  item public.discovery_parking%rowtype;
  source public.discovery_sources%rowtype;
  existing parkey_private.discovery_publication_approvals%rowtype;
  signature text;
begin
  if not exists (select 1 from parkey_private.discovery_reviewers where user_id = reviewer and can_publish) then
    raise insufficient_privilege using message = 'Manual publisher access required';
  end if;
  if physical_evidence is null or physical_evidence !~ '^https://[^[:space:]]+$'
    or license_evidence is null or license_evidence !~ '^https://[^[:space:]]+$'
    or access_evidence is null or access_evidence !~ '^https://[^[:space:]]+$'
    or deduplication_evidence is null or deduplication_evidence !~ '^https://[^[:space:]]+$' then
    raise invalid_parameter_value using message = 'All four manual evidence references are required';
  end if;
  select * into item from public.discovery_parking where id = parking for update;
  if not found then raise no_data_found using message = 'Parking unavailable'; end if;
  select * into source from public.discovery_sources where id = item.source_id for share;
  if item.published or item.verification <> 'verified' or item.verified_at > now()
    or item.verified_at < now() - interval '90 days'
    or item.verification_url is distinct from physical_evidence
    or item.source_url is null or lower(btrim(source.license)) in ('unknown', 'pending', 'none') then
    raise invalid_parameter_value using message = 'Current physical verification and reviewed provenance required';
  end if;
  signature := parkey_private.discovery_fingerprint(parking);
  select * into existing from parkey_private.discovery_publication_approvals where parking_id = parking;
  if found then
    if existing.fingerprint = signature and existing.reviewer_id = reviewer
      and existing.physical_evidence = physical_evidence and existing.license_evidence = license_evidence
      and existing.access_evidence = access_evidence and existing.deduplication_evidence = deduplication_evidence
      and existing.expires_at > now() then return; end if;
    raise invalid_parameter_value using message = 'Approval drift or expiry requires explicit reconciliation';
  end if;
  insert into parkey_private.discovery_publication_approvals
    (parking_id, fingerprint, reviewer_id, physical_evidence, license_evidence, access_evidence, deduplication_evidence)
  values (parking, signature, reviewer, physical_evidence, license_evidence, access_evidence, deduplication_evidence);
end;
$$;
revoke all on function public.approve_discovery_publication(uuid,uuid,text,text,text,text) from public, anon, authenticated;
grant execute on function public.approve_discovery_publication(uuid,uuid,text,text,text,text) to service_role;
commit;
