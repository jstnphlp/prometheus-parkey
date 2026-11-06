import { writeFileSync } from 'node:fs'

import {
  loadPilotGeography,
  PILOT_CITIES,
  PILOT_SCOPE_VERSION,
} from './pilot-catalog.mjs'

const quote = (value) => "'" + value.replaceAll("'", "''") + "'"
const geography = loadPilotGeography()
const prefix = `-- Retained, licensed OSM 17-LGU polygons. All 17 participate in rejecting
-- ambiguous overlaps/border touches; only Manila and Mandaluyong are enabled.
begin;
alter table parkey_private.discovery_reviewers add column can_candidate_research boolean not null default false;
create table parkey_private.pilot_lgu_boundaries (
  scope_version text not null,
  city text not null,
  source_hash text not null check(source_hash ~ '^[a-f0-9]{64}$'),
  source_id text not null,
  geometry extensions.geometry(MultiPolygon,4326) not null check(extensions.st_isvalid(geometry)),
  primary key(scope_version,city)
);
create index pilot_boundary_geometry_idx on parkey_private.pilot_lgu_boundaries using gist(geometry);
create table parkey_private.pilot_city_config (
  scope_version text not null default 'manila-mandaluyong-v1' check(scope_version = 'manila-mandaluyong-v1'),
  city text not null check(city in ('Manila','Mandaluyong')),
  candidate_research_enabled boolean not null default false,
  public_destinations_enabled boolean not null default false,
  primary key(scope_version,city),
  foreign key(scope_version,city) references parkey_private.pilot_lgu_boundaries(scope_version,city)
);
alter table parkey_private.pilot_lgu_boundaries enable row level security;
alter table parkey_private.pilot_city_config enable row level security;
revoke all on parkey_private.pilot_lgu_boundaries,parkey_private.pilot_city_config from public,anon,authenticated,service_role;
create trigger immutable_pilot_boundaries before update or delete on parkey_private.pilot_lgu_boundaries
  for each row execute function parkey_private.reject_evidence_mutation();
`
const inserts = geography.collection.features
  .map(
    (feature) =>
      `insert into parkey_private.pilot_lgu_boundaries(scope_version,city,source_hash,source_id,geometry) values (${quote(PILOT_SCOPE_VERSION)},${quote(feature.properties.lgu)},${quote(geography.sourceHash)},${quote(feature.properties.sourceId)},extensions.st_geomfromgeojson(${quote(JSON.stringify(feature.geometry))}));`,
  )
  .join('\n')
const suffix = `
insert into parkey_private.pilot_city_config(city) values ('Manila'),('Mandaluyong');
create function parkey_private.pilot_inside_city(p_city text,p_geometry extensions.geometry)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(exists(select 1 from parkey_private.pilot_lgu_boundaries b
    where b.scope_version='manila-mandaluyong-v1' and b.city=p_city and b.city in ('Manila','Mandaluyong')
      and extensions.st_containsproperly(b.geometry,p_geometry)
      and not exists(select 1 from parkey_private.pilot_lgu_boundaries other
        where other.scope_version=b.scope_version and other.city<>b.city
          and extensions.st_intersects(other.geometry,p_geometry))),false);
$$;
revoke all on function parkey_private.pilot_inside_city(text,extensions.geometry) from public,anon,authenticated,service_role;
commit;
`
writeFileSync(
  'supabase/migrations/20261105150000_pilot_geography.sql',
  prefix + inserts + suffix,
  { flag: 'wx' },
)
writeFileSync(
  'data/pilot-geography.v1.json',
  JSON.stringify(
    {
      schemaVersion: 1,
      scopeVersion: PILOT_SCOPE_VERSION,
      allowedCities: PILOT_CITIES,
      source: {
        archive: 'data/ncr-research/ncr-lgus-osm.geojson.gz',
        sha256: geography.sourceHash,
        license: geography.metadata.license,
        attribution: geography.metadata.attribution,
        sourceUrl: geography.metadata.sourceUrl,
        caveat: geography.metadata.boundaryCaveat,
      },
      policy:
        'Whole source geometry must be strictly inside one selected city and intersect no other retained LGU. Border touches, overlaps and crossing geometry are excluded; records are never clipped or reassigned.',
      type: 'FeatureCollection',
      features: geography.collection.features.filter((feature) =>
        PILOT_CITIES.includes(feature.properties.lgu),
      ),
    },
    null,
    2,
  ) + '\n',
  { flag: 'wx' },
)
