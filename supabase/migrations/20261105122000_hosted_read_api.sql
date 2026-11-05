-- Reuse the V1 serializer and bounds; gate before limiting results.
begin;
create function public.discover_approved_parking(west double precision, south double precision, east double precision, north double precision)
returns jsonb language plpgsql stable security invoker set search_path = ''
as $$
declare result jsonb;
begin
  -- Limit cost and reject NaN/infinity, inverted bounds, and dateline crossings.
  if west is null or south is null or east is null or north is null
    or not (west >= -180 and east <= 180 and south >= -85.051129 and north <= 85.051129
      and west < east and south < north and east - west <= 0.5 and north - south <= 0.5) then
    raise exception 'Expected a viewport at most 0.5 degrees wide and high, without a dateline crossing' using errcode = '22023';
  end if;
  with candidates as materialized (
    select p.* from public.discovery_parking p
    where p.published and public.has_discovery_approval(p.id) and extensions.st_intersects(p.geometry, extensions.st_makeenvelope(west, south, east, north, 4326))
    order by p.id limit 251
  ), limited as (
    select * from candidates order by id limit 250
  )
  select jsonb_build_object(
    'contractVersion', 1, 'truncated', (select count(*) > 250 from candidates),
    'records', coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id, 'name', p.name, 'kind', p.kind,
      'geometry', extensions.st_asgeojson(p.geometry)::jsonb,
      'osmTags', p.osm_tags, 'osmEditedAt', p.osm_edited_at, 'entrances', p.entrances,
      'address', p.address, 'side', p.side, 'fees', p.fees, 'hours', p.hours,
      'sourceKind', s.kind, 'sourceLabel', s.label, 'sourceUrl', p.source_url,
      'license', s.license, 'sourceUpdatedAt', p.source_updated_at,
      'verification', p.verification, 'verifiedAt', p.verified_at,
      'regulations', coalesce((select jsonb_agg(jsonb_build_object(
        'description', r.description, 'sourceLabel', rs.label, 'sourceUrl', r.source_url, 'observedAt', r.observed_at
      ) order by r.id) from public.discovery_regulations r join public.discovery_sources rs on rs.id = r.source_id
        where r.parking_id = p.id and r.published), '[]'::jsonb)
    ) order by p.id), '[]'::jsonb)
  ) into result from limited p join public.discovery_sources s on s.id = p.source_id;
  return result;
end;
$$;
revoke all on function public.discover_approved_parking(double precision, double precision, double precision, double precision) from public, anon, authenticated;
grant execute on function public.discover_approved_parking(double precision, double precision, double precision, double precision) to anon, authenticated;

commit;
