-- Private moderation only. No anonymous submission or media upload grants.
begin;
create table parkey_private.discovery_reviewers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  can_publish boolean not null default false
);
create table parkey_private.discovery_review_audit (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null,
  reviewer_id uuid not null,
  action text not null check (action in ('accepted', 'rejected', 'published')),
  reason text not null check (length(btrim(reason)) between 3 and 500),
  created_at timestamptz not null default now()
);
alter table parkey_private.discovery_reviewers enable row level security;
alter table parkey_private.discovery_review_audit enable row level security;
revoke all on parkey_private.discovery_reviewers, parkey_private.discovery_review_audit from public, anon, authenticated;
alter table parkey_private.community_reports
  add column observed_at timestamptz check (isfinite(observed_at)),
  add column published_parking_id uuid references public.discovery_parking(id) on delete restrict;

-- Only the Edge Function's server credential may call this RPC. It must first
-- validate the user's Auth token and enforce aal2. Never expose that credential.
create function public.moderate_discovery(reviewer uuid, operation text, report uuid default null,
  reason text default null, public_url text default null, public_license text default null,
  public_attribution text default null, queue_status text default 'pending_review', page integer default 0)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  publisher boolean;
  item parkey_private.community_reports%rowtype;
  parking uuid;
  source uuid;
begin
  select can_publish into publisher from parkey_private.discovery_reviewers where user_id = reviewer;
  if not found then raise insufficient_privilege using message = 'Reviewer access required'; end if;
  if operation = 'list' then
    if queue_status not in ('pending_review', 'accepted') or queue_status is null or page is null or page not between 0 and 1000 then
      raise invalid_parameter_value using message = 'Invalid queue selection';
    end if;
    return jsonb_build_object('canPublish', publisher, 'hasMore', (select count(*) > (page + 1) * 100 from parkey_private.community_reports where published_parking_id is null and status = queue_status and ((status = 'pending_review' and created_at > now() - interval '90 days') or (status = 'accepted' and reviewed_at > now() - interval '90 days'))), 'reports', coalesce((
      select jsonb_agg(row_to_json(q)) from (
        select id, intent, target_id, external_target_url, name, kind, side,
          extensions.st_asgeojson(geometry)::jsonb as geometry,
          restrictions, hours, fees, observed_at, status, created_at, reviewed_at, published_parking_id
        from parkey_private.community_reports
        where published_parking_id is null and status = queue_status and
          ((status = 'pending_review' and created_at > now() - interval '90 days') or
           (status = 'accepted' and reviewed_at > now() - interval '90 days'))
        order by created_at, id limit 100 offset page * 100
      ) q), '[]'::jsonb));
  end if;
  if reason is null or length(btrim(reason)) not between 3 and 500 then
    raise invalid_parameter_value using message = 'A review reason is required';
  end if;
  select * into item from parkey_private.community_reports where id = report for update;
  if not found then raise no_data_found using message = 'Report unavailable'; end if;
  if item.published_parking_id is not null then
    raise invalid_parameter_value using message = 'Report already published';
  end if;
  if operation in ('accepted', 'rejected') then
    if item.status <> 'pending_review' or item.created_at <= now() - interval '90 days' then
      raise invalid_parameter_value using message = 'Report is no longer pending';
    end if;
    update parkey_private.community_reports set status = operation, reviewed_at = now() where id = report;
  elsif operation = 'published' then
    if not publisher then raise insufficient_privilege using message = 'Publisher access required'; end if;
    if item.status <> 'accepted' or item.reviewed_at <= now() - interval '90 days' then
      raise invalid_parameter_value using message = 'Accept the report before publication';
    end if;
    -- Corrections need a provenance-preserving merge, never a silent overwrite
    -- of an OSM record or automatic reinterpretation as a new location.
    if item.intent <> 'add' then
      raise invalid_parameter_value using message = 'Corrections require a separate reviewed data merge';
    end if;
    if public_url is null or public_url !~ '^https://[^[:space:]]+$' or length(public_url) > 1000
      or public_license is null or length(btrim(public_license)) not between 3 and 200
      or public_attribution is null or length(btrim(public_attribution)) not between 3 and 500 then
      raise invalid_parameter_value using message = 'Public provenance is required';
    end if;
    if item.observed_at is null or item.observed_at > now() then
      raise invalid_parameter_value using message = 'An observation date is required';
    end if;
    insert into public.discovery_sources(kind, label, url, license, attribution)
      values ('community', 'Reviewed community contribution', public_url, public_license, public_attribution)
      returning id into source;
    insert into public.discovery_parking(source_id, source_record_id, source_url, source_updated_at,
      name, kind, geometry, side, fees, hours, verification, published)
      values (source, report::text, public_url, item.observed_at, item.name, item.kind,
        item.geometry, item.side, item.fees, item.hours, 'unverified', true) returning id into parking;
    if item.restrictions is not null then
      insert into public.discovery_regulations(parking_id, source_id, description, source_url, observed_at, published)
        values (parking, source, item.restrictions, public_url, item.observed_at, true);
    end if;
    update parkey_private.community_reports set published_parking_id = parking where id = report;
  else raise invalid_parameter_value using message = 'Unsupported operation';
  end if;
  insert into parkey_private.discovery_review_audit(report_id, reviewer_id, action, reason)
    values (report, reviewer, operation, btrim(reason));
  return jsonb_build_object('ok', true, 'parkingId', parking);
end;
$$;
revoke all on function public.moderate_discovery(uuid,text,uuid,text,text,text,text,text,integer) from public, anon, authenticated;
grant execute on function public.moderate_discovery(uuid,text,uuid,text,text,text,text,text,integer) to service_role;
commit;
