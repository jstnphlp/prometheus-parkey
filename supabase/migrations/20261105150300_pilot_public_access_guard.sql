-- Close the historical members/unrecognized-access gap for all future Stage A
-- publication actions, independently of pilot activation. Historical archives
-- and human decisions remain untouched and unsafe public reads fail closed.
begin;
create function parkey_private.guard_publication_source_access()
returns trigger language plpgsql security definer set search_path='' as $$
declare source jsonb;
begin
  if new.event_text::jsonb->>'action'='approve_publication' then
    select (p.package_text::jsonb->>'candidateText')::jsonb into source
      from parkey_private.discovery_evidence_packages p where p.package_hash=new.package_hash;
    if not parkey_private.pilot_source_access_allowed(source) then
      raise invalid_parameter_value using message='Mapped source access is restricted or unsupported; source correction is required before publication';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function parkey_private.guard_publication_source_access() from public,anon,authenticated,service_role;
create trigger pilot_source_access_guard before insert on parkey_private.discovery_evidence_decisions
  for each row execute function parkey_private.guard_publication_source_access();
commit;
