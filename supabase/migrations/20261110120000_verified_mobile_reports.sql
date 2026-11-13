begin;

-- Submission credentials never grant reviewer or publication rights.
create table parkey_private.mobile_report_receipts (
  id uuid primary key default gen_random_uuid(),
  actor uuid not null references auth.users(id) on delete cascade,
  client_key text not null check (length(client_key) between 1 and 100 and client_key ~ '^[A-Za-z0-9:_-]+$'),
  payload_hash text not null,
  report_id uuid unique references parkey_private.community_reports(id) on delete set null,
  created_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  unique(actor, client_key)
);
create index mobile_report_receipts_actor_created_idx on parkey_private.mobile_report_receipts(actor,created_at);
create table parkey_private.mobile_report_request_limits (
  actor uuid not null references auth.users(id) on delete cascade,
  bucket timestamptz not null,
  requests integer not null check (requests between 1 and 30),
  primary key(actor,bucket)
);
create index mobile_report_request_limits_bucket_idx on parkey_private.mobile_report_request_limits(bucket);
alter table parkey_private.mobile_report_receipts enable row level security;
alter table parkey_private.mobile_report_request_limits enable row level security;
revoke all on parkey_private.mobile_report_receipts, parkey_private.mobile_report_request_limits from public, anon, authenticated;

-- A separate committed transaction counts attempts even when report validation fails.
create function public.consume_mobile_report_attempt(actor uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  request_count integer;
  instant timestamptz := clock_timestamp();
begin
  if not exists (select 1 from auth.users u where u.id = actor and u.email_confirmed_at is not null and u.email is not null and not coalesce(u.is_anonymous,false)) then
    raise insufficient_privilege using message = 'Verified email required';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text,61110));
  delete from parkey_private.mobile_report_request_limits q where q.bucket < instant - interval '1 day';
  select q.requests into request_count from parkey_private.mobile_report_request_limits q
    where q.actor = consume_mobile_report_attempt.actor and q.bucket = date_trunc('minute',instant);
  if request_count >= 30 then raise sqlstate 'PT429' using message = 'Request limit'; end if;
  insert into parkey_private.mobile_report_request_limits(actor,bucket,requests)
    values (actor,date_trunc('minute',instant),1)
    on conflict on constraint mobile_report_request_limits_pkey do update set requests = parkey_private.mobile_report_request_limits.requests + 1;
end;
$$;
revoke all on function public.consume_mobile_report_attempt(uuid) from public, anon, authenticated;
grant execute on function public.consume_mobile_report_attempt(uuid) to service_role;

create function public.mobile_report_action(actor uuid, operation text, client_key text, payload jsonb default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  receipt parkey_private.mobile_report_receipts%rowtype;
  new_report uuid;
  digest text;
  target uuid;
  external_target text;
  shape extensions.geometry;
  observed timestamptz;
  instant timestamptz := clock_timestamp();
begin
  if not exists (select 1 from auth.users u where u.id = actor and u.email is not null and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false)) then
    raise insufficient_privilege using message = 'Verified email required';
  end if;
  if operation is null or operation not in ('submit','status','withdraw') or client_key is null or length(client_key) not between 1 and 100 or client_key !~ '^[A-Za-z0-9:_-]+$' then
    raise sqlstate 'PT422' using message = 'Invalid request';
  end if;
  -- Serialize account quotas, idempotency, status and withdrawal in one transaction.
  perform pg_advisory_xact_lock(hashtextextended(actor::text,61110));
  select * into receipt from parkey_private.mobile_report_receipts r
    where r.actor = mobile_report_action.actor and r.client_key = mobile_report_action.client_key for update;
  if operation in ('status','withdraw') then
    if receipt.id is null then
      if operation = 'status' then return jsonb_build_object('state','not_sent'); end if;
      raise sqlstate 'PT404' using message = 'Report unavailable';
    end if;
    if operation = 'withdraw' and receipt.report_id is not null and receipt.withdrawn_at is null then
      perform 1 from parkey_private.community_reports r where r.id = receipt.report_id and r.published_parking_id is null for update;
      if not found then raise sqlstate 'PT409' using message = 'Published report requires reviewer assistance'; end if;
      delete from parkey_private.community_reports r where r.id = receipt.report_id;
      update parkey_private.mobile_report_receipts r set withdrawn_at = instant where r.id = receipt.id;
      receipt.withdrawn_at := instant;
      receipt.report_id := null;
    end if;
    return jsonb_build_object('state',case when receipt.withdrawn_at is not null or receipt.report_id is null then 'withdrawn' else 'received' end,'receiptId',receipt.id,'receivedAt',receipt.created_at);
  end if;
  if payload is null or jsonb_typeof(payload) <> 'object' or
     payload - array['intent','target','name','kind','geometry','side','restrictions','hours','fees','observed_at'] <> '{}'::jsonb or
     not (payload ?& array['intent','target','name','kind','geometry','side','restrictions','hours','fees','observed_at']) then
    raise sqlstate 'PT422' using message = 'Invalid report';
  end if;
  digest := encode(extensions.digest(payload::text,'sha256'),'hex');
  if receipt.id is not null then
    if receipt.withdrawn_at is not null or receipt.report_id is null or receipt.payload_hash <> digest then
      raise sqlstate 'PT409' using message = 'Idempotency conflict';
    end if;
    return jsonb_build_object('state','received','receiptId',receipt.id,'receivedAt',receipt.created_at);
  end if;
  if (select count(*) from parkey_private.mobile_report_receipts r where r.actor = mobile_report_action.actor and r.created_at > instant - interval '1 hour') >= 5 or
     (select count(*) from parkey_private.mobile_report_receipts r where r.actor = mobile_report_action.actor and r.created_at > instant - interval '1 day') >= 20 then
    raise sqlstate 'PT429' using message = 'Report limit';
  end if;
  if payload->>'intent' not in ('add','correction') or payload->>'kind' not in ('street','lot','garage') or
     payload->>'side' not in ('left','right','both','unknown') or jsonb_typeof(payload->'name') <> 'string' or
     length(btrim(payload->>'name')) not between 3 and 100 or payload->>'name' ~ '[[:cntrl:]]' then
    raise sqlstate 'PT422' using message = 'Invalid classification';
  end if;
  if payload->>'intent' = 'add' then
    if payload->'target' <> 'null'::jsonb then raise sqlstate 'PT422' using message = 'Unexpected target'; end if;
  else
    if payload->>'target' ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$' then
      target := (payload->>'target')::uuid;
      perform 1 from public.discovery_parking p where p.id = target and p.published for share;
      if not found then raise sqlstate 'PT422' using message = 'Target unavailable'; end if;
    elsif payload->>'target' ~ '^osm:(node|way|relation)/[1-9][0-9]*$' then
      external_target := 'https://www.openstreetmap.org/' || substring(payload->>'target' from 5);
    else raise sqlstate 'PT422' using message = 'Invalid target'; end if;
  end if;
  if jsonb_typeof(payload->'geometry') <> 'object' or (payload->'geometry') - array['type','coordinates'] <> '{}'::jsonb or
     (payload->>'kind' = 'street' and (jsonb_typeof(payload->'geometry'->'coordinates') <> 'array' or jsonb_array_length(payload->'geometry'->'coordinates') < 2 or jsonb_array_length(payload->'geometry'->'coordinates') > case when payload->>'intent' = 'correction' then 500 else 12 end)) then
    raise sqlstate 'PT422' using message = 'Invalid geometry';
  end if;
  begin
    shape := extensions.st_setsrid(extensions.st_geomfromgeojson((payload->'geometry')::text),4326);
    observed := (payload->>'observed_at')::timestamptz;
  exception when others then raise sqlstate 'PT422' using message = 'Invalid geometry or observation'; end;
  if observed is null or not isfinite(observed) or observed > instant or observed < instant - interval '90 days' then
    raise sqlstate 'PT422' using message = 'Observation must be within the last 90 days';
  end if;
  insert into parkey_private.community_reports(intent,target_id,external_target_url,name,kind,geometry,side,restrictions,hours,fees,observed_at)
    values (payload->>'intent',target,external_target,btrim(payload->>'name'),payload->>'kind',shape,payload->>'side',
      payload->>'restrictions',payload->>'hours',payload->>'fees',observed) returning id into new_report;
  insert into parkey_private.mobile_report_receipts(actor,client_key,payload_hash,report_id)
    values (actor,client_key,digest,new_report) returning * into receipt;
  return jsonb_build_object('state','received','receiptId',receipt.id,'receivedAt',receipt.created_at);
end;
$$;
revoke all on function public.mobile_report_action(uuid,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.mobile_report_action(uuid,text,text,jsonb) to service_role;

-- A deployment must schedule and monitor this service-only retention operation.
create function public.cleanup_mobile_reports()
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from parkey_private.community_reports r using parkey_private.mobile_report_receipts s
    where s.report_id = r.id and s.created_at < now() - interval '90 days';
  delete from parkey_private.mobile_report_receipts where created_at < now() - interval '90 days';
  delete from parkey_private.mobile_report_request_limits where bucket < now() - interval '1 day';
end;
$$;
revoke all on function public.cleanup_mobile_reports() from public, anon, authenticated;
grant execute on function public.cleanup_mobile_reports() to service_role;

-- Remove private payloads before Auth's receipt cascade can discard their link.
-- Published parking/provenance and the existing reviewer audit are independent.
create function parkey_private.remove_deleted_account_mobile_reports()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from parkey_private.community_reports r using parkey_private.mobile_report_receipts s
    where s.actor = old.id and s.report_id = r.id;
  return old;
end;
$$;
revoke all on function parkey_private.remove_deleted_account_mobile_reports() from public, anon, authenticated;
create trigger mobile_reports_remove_deleted_account before delete on auth.users
  for each row execute function parkey_private.remove_deleted_account_mobile_reports();
commit;
