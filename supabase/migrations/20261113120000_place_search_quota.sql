-- Fixed-size aggregate provider budgets, no search text or user identifiers.
begin;
create table parkey_private.place_search_quota (
  bucket text primary key check (bucket in ('second', 'minute', 'day')),
  starts_at timestamptz not null,
  attempts integer not null check (attempts >= 0)
);
alter table parkey_private.place_search_quota enable row level security;
revoke all on parkey_private.place_search_quota from public, anon, authenticated, service_role;
insert into parkey_private.place_search_quota values
  ('second', '-infinity', 0), ('minute', '-infinity', 0), ('day', '-infinity', 0);

create function public.consume_place_search()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  stamp timestamptz;
  item record;
  bucket_start timestamptz;
  budget integer;
  window_seconds integer;
  retry integer := 0;
begin
  -- Serialize the three counters in a fixed order across all Edge instances.
  perform 1 from parkey_private.place_search_quota order by bucket for update;
  stamp := clock_timestamp();
  for item in select * from parkey_private.place_search_quota order by bucket loop
    budget := case item.bucket when 'second' then 2 when 'minute' then 30 else 1000 end;
    window_seconds := case item.bucket when 'second' then 1 when 'minute' then 60 else 86400 end;
    bucket_start := to_timestamp(floor(extract(epoch from stamp) / window_seconds) * window_seconds);
    if item.starts_at = bucket_start and item.attempts >= budget then
      retry := greatest(retry, ceil(extract(epoch from bucket_start + make_interval(secs => window_seconds) - stamp))::integer);
    end if;
  end loop;
  if retry > 0 then return retry; end if;
  for item in select * from parkey_private.place_search_quota order by bucket loop
    window_seconds := case item.bucket when 'second' then 1 when 'minute' then 60 else 86400 end;
    bucket_start := to_timestamp(floor(extract(epoch from stamp) / window_seconds) * window_seconds);
    update parkey_private.place_search_quota set
      starts_at = bucket_start,
      attempts = case when starts_at = bucket_start then attempts + 1 else 1 end
      where bucket = item.bucket;
  end loop;
  return 0;
end;
$$;
revoke all on function public.consume_place_search() from public, anon, authenticated;
grant execute on function public.consume_place_search() to service_role;
commit;
