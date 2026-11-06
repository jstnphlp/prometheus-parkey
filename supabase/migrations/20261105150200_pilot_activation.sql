-- Explicit release activation closes legacy/direct-table scope bypasses. Default
-- inactive preserves the existing development experience until founder release.
begin;
create table parkey_private.pilot_activation (
  scope_version text primary key check(scope_version='manila-mandaluyong-v1'),
  active boolean not null default false
);
insert into parkey_private.pilot_activation values('manila-mandaluyong-v1',false);
create table parkey_private.pilot_configuration_audit (
  id bigint generated always as identity primary key,
  relation_name text not null,
  before_value jsonb,
  after_value jsonb,
  database_actor text not null,
  recorded_at timestamptz not null default now()
);
alter table parkey_private.pilot_activation enable row level security;
alter table parkey_private.pilot_configuration_audit enable row level security;
revoke all on parkey_private.pilot_activation,parkey_private.pilot_configuration_audit from public,anon,authenticated,service_role;
revoke all on sequence parkey_private.pilot_configuration_audit_id_seq from public,anon,authenticated,service_role;
create function parkey_private.audit_pilot_configuration()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into parkey_private.pilot_configuration_audit(relation_name,before_value,after_value,database_actor)
    values(tg_table_name,to_jsonb(old),to_jsonb(new),session_user);
  return new;
end;
$$;
revoke all on function parkey_private.audit_pilot_configuration() from public,anon,authenticated,service_role;
create trigger audit_pilot_activation after update on parkey_private.pilot_activation for each row execute function parkey_private.audit_pilot_configuration();
create trigger audit_pilot_city_config after update on parkey_private.pilot_city_config for each row execute function parkey_private.audit_pilot_configuration();
create trigger immutable_pilot_configuration_audit before update or delete on parkey_private.pilot_configuration_audit for each row execute function parkey_private.reject_evidence_mutation();
create trigger preserve_pilot_activation before delete on parkey_private.pilot_activation for each row execute function parkey_private.reject_evidence_mutation();

create function parkey_private.pilot_source_access_allowed(source jsonb)
returns boolean language sql immutable set search_path='' as $$
  select coalesce(lower(btrim(source->>'accessClass')),'unknown') in ('unknown','yes','public','permissive')
    and coalesce(lower(btrim(source#>>'{sourceTags,access}')),'unknown') in ('unknown','yes','public','permissive')
    and coalesce(lower(btrim(source#>>'{sourceTags,parking:access}')),'unknown') in ('unknown','yes','public','permissive');
$$;
revoke all on function parkey_private.pilot_source_access_allowed(jsonb) from public,anon,authenticated,service_role;

create function parkey_private.pilot_reviewed_row_visible(parking_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select coalesce(exists(
    select 1 from public.discovery_parking p
    join parkey_private.discovery_evidence_targets t on t.parking_id=p.id
    cross join lateral(
      select d.event_text::jsonb event,(e.package_text::jsonb->>'candidateText')::jsonb source
      from parkey_private.discovery_evidence_decisions d join parkey_private.discovery_evidence_packages e on e.package_hash=d.package_hash
      where d.event_text::jsonb->>'recordId'=t.candidate_id order by d.sequence desc limit 1
    ) review
    where p.id=$1 and p.published and p.review_expires_at>now()
      and p.source_observation_id=t.candidate_id and review.event->>'action'='approve_publication'
      and review.source->>'type' in ('lot','garage') and p.kind=review.source->>'type'
      and coalesce(review.source->>'restrictedAccess','false')<>'true'
      and parkey_private.pilot_source_access_allowed(review.source)
      and coalesce(review.source->>'operatingStatus','unknown') not in ('closed','permanently_closed','temporarily_closed','disused','construction')
      and not coalesce(review.source->'flags' ?| array['mapped_restricted_access','mapped_closed_or_disused','prior_human_exclusion_requires_resolution','invalid_geometry_requires_review','unsafe','prohibited'],false)
      and exists(select 1 from (values('Manila'),('Mandaluyong')) selected(city)
        where parkey_private.pilot_inside_city(selected.city,parkey_private.pilot_source_geometry(review.source->'geometry'))
          and parkey_private.pilot_inside_city(selected.city,p.geometry)
          and parkey_private.pilot_inside_city(selected.city,parkey_private.pilot_source_geometry(
            jsonb_build_object('type','Point','coordinates',review.source->'representativePoint')))
          and (p.navigation_approval is null or parkey_private.pilot_inside_city(selected.city,parkey_private.pilot_source_geometry(
            jsonb_build_object('type','Point','coordinates',p.navigation_approval->'entrance')))))
  ),false);
$$;
revoke all on function parkey_private.pilot_reviewed_row_visible(uuid) from public,anon,authenticated,service_role;
create function parkey_private.pilot_public_policy(parking_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select not exists(select 1 from parkey_private.pilot_activation where scope_version='manila-mandaluyong-v1' and active)
    or parkey_private.pilot_reviewed_row_visible(parking_id);
$$;
revoke all on function parkey_private.pilot_public_policy(uuid) from public,anon,authenticated,service_role;
grant execute on function parkey_private.pilot_public_policy(uuid) to anon,authenticated;
create policy discovery_pilot_scope on public.discovery_parking as restrictive for select to anon,authenticated
  using(parkey_private.pilot_public_policy(id));

-- Source URLs can themselves identify an out-of-scope observation. Restrict
-- attribution rows as well, including sources used by visible regulations.
create function parkey_private.pilot_public_source_policy(source_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select not exists(select 1 from parkey_private.pilot_activation where scope_version='manila-mandaluyong-v1' and active)
    or exists(select 1 from public.discovery_parking p where p.source_id=$1 and parkey_private.pilot_reviewed_row_visible(p.id))
    or exists(select 1 from public.discovery_regulations r where r.source_id=$1 and r.published and parkey_private.pilot_reviewed_row_visible(r.parking_id));
$$;
revoke all on function parkey_private.pilot_public_source_policy(uuid) from public,anon,authenticated,service_role;
grant execute on function parkey_private.pilot_public_source_policy(uuid) to anon,authenticated;
create policy discovery_pilot_source_scope on public.discovery_sources as restrictive for select to anon,authenticated
  using(parkey_private.pilot_public_source_policy(id));
commit;
