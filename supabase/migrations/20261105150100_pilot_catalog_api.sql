-- Private, explicit-ID catalogs and server-enforced two-city discovery.
begin;
create table parkey_private.pilot_catalog_batches (
  package_hash text primary key check(package_hash ~ '^[a-f0-9]{64}$'),
  package_text text not null,
  imported_by uuid not null references auth.users(id) on delete restrict,
  imported_at timestamptz not null default now()
);
create table parkey_private.pilot_catalog_records (
  sequence bigint generated always as identity primary key,
  package_hash text not null references parkey_private.pilot_catalog_batches(package_hash),
  kind text not null check(kind in ('candidates','destinations')),
  city text not null check(city in ('Manila','Mandaluyong')),
  record_id text not null check(length(record_id) between 1 and 200),
  record_hash text not null check(record_hash ~ '^[a-f0-9]{64}$'),
  record_text text not null,
  context_hash text not null check(context_hash ~ '^[a-f0-9]{64}$'),
  context_text text not null,
  geometry extensions.geometry(Geometry,4326) not null check(extensions.st_isvalid(geometry)),
  anchor extensions.geometry(Point,4326) not null,
  unique(package_hash,record_id)
);
create index pilot_catalog_city_kind_idx on parkey_private.pilot_catalog_records(city,kind,record_id,sequence desc);
create index pilot_catalog_latest_idx on parkey_private.pilot_catalog_records(kind,record_id,sequence desc);
create index pilot_catalog_geometry_idx on parkey_private.pilot_catalog_records using gist(geometry);
create table parkey_private.pilot_destination_publications (
  record_id text primary key,
  record_sequence bigint not null references parkey_private.pilot_catalog_records(sequence),
  review_due_at timestamptz not null check(isfinite(review_due_at)),
  published boolean not null default false
);
create table parkey_private.pilot_destination_audit (
  id bigint generated always as identity primary key,
  record_id text not null,
  record_hash text not null,
  reviewer_id uuid not null references auth.users(id) on delete restrict,
  operation text not null check(operation in ('publish','revoke')),
  reason text not null,
  license_scope text,
  review_due_at timestamptz,
  recorded_at timestamptz not null default now()
);
create table parkey_private.pilot_cursor_secret (
  singleton boolean primary key default true check(singleton),
  secret bytea not null default extensions.gen_random_bytes(32)
);
insert into parkey_private.pilot_cursor_secret default values;
alter table parkey_private.pilot_catalog_batches enable row level security;
alter table parkey_private.pilot_catalog_records enable row level security;
alter table parkey_private.pilot_destination_publications enable row level security;
alter table parkey_private.pilot_destination_audit enable row level security;
alter table parkey_private.pilot_cursor_secret enable row level security;
revoke all on parkey_private.pilot_catalog_batches,parkey_private.pilot_catalog_records,
  parkey_private.pilot_destination_publications,parkey_private.pilot_destination_audit,parkey_private.pilot_cursor_secret
  from public,anon,authenticated,service_role;
revoke all on sequence parkey_private.pilot_catalog_records_sequence_seq,parkey_private.pilot_destination_audit_id_seq from public,anon,authenticated,service_role;
create trigger immutable_pilot_batches before update or delete on parkey_private.pilot_catalog_batches for each row execute function parkey_private.reject_evidence_mutation();
create trigger immutable_pilot_records before update or delete on parkey_private.pilot_catalog_records for each row execute function parkey_private.reject_evidence_mutation();
create trigger immutable_pilot_destination_audit before update or delete on parkey_private.pilot_destination_audit for each row execute function parkey_private.reject_evidence_mutation();

create function parkey_private.pilot_source_geometry(value jsonb)
returns extensions.geometry language plpgsql immutable set search_path='' as $$
declare result extensions.geometry;
begin
  result:=extensions.st_setsrid(extensions.st_geomfromgeojson(value),4326);
  if extensions.st_isempty(result) or not extensions.st_isvalid(result) then return null; end if;
  return result;
exception when others then return null;
end;
$$;
revoke all on function parkey_private.pilot_source_geometry(jsonb) from public,anon,authenticated,service_role;

create function public.import_pilot_catalog(reviewer uuid,package_text text,package_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare package jsonb; item jsonb; source jsonb; shape extensions.geometry; anchor extensions.geometry; city text; kind text; imported integer:=0;
begin
  if not exists(select 1 from parkey_private.discovery_reviewers where user_id=reviewer) then raise insufficient_privilege using message='Reviewer access required'; end if;
  if package_text is null or octet_length(package_text)>12582912 or package_hash is distinct from encode(extensions.digest(package_text,'sha256'),'hex') then
    raise invalid_parameter_value using message='Private catalog package hash mismatch'; end if;
  package:=package_text::jsonb; city:=package->>'city'; kind:=package->>'kind';
  if package->'schemaVersion' is distinct from '1'::jsonb or package->>'scopeVersion' is distinct from 'manila-mandaluyong-v1'
    or city is null or city not in ('Manila','Mandaluyong') or kind is null or kind not in ('candidates','destinations')
    or package->>'boundaryHash' is distinct from 'ea7864d00557f64de39981ccefca370c2d47eb82ceb98c55f554d21601e4ede7'
    or package->'sourceHashes' is distinct from '{"boundaries":"ea7864d00557f64de39981ccefca370c2d47eb82ceb98c55f554d21601e4ede7","osm":"5ae2654e12d0ec47c33da193004e009fd628ea9b408b953b37b2fb24fa26335d","overture":"203a4847b0fa9f8129374442089f4722ddfd49e601bb172c41df02688236cb25","reviews":"68e702bb733c0134fb505ec5d551c21dd27ac95dbb99a468ea98ae9077511a0b"}'::jsonb
    or package->>'destinationReportHash' is distinct from '0ac2a6d1505ee5121812b1c82aa2169908cc88bb1340441d24375e66ea523086'
    or package->>'destinationSourceHash' is distinct from 'cf4def65ee3d6ca15206d29f533ceae90df74f0cebe8fd9d0af80c292f6b93d5'
    or jsonb_typeof(package->'records') is distinct from 'array' or jsonb_array_length(package->'records') not between 1 and 50 then
    raise invalid_parameter_value using message='Explicit 1-50 record IDs and frozen pilot provenance required'; end if;
  perform pg_advisory_xact_lock(514527305);
  if exists(select 1 from parkey_private.pilot_catalog_batches p where p.package_hash=import_pilot_catalog.package_hash) then
    return jsonb_build_object('status','imported_private','publicationApproved',false,'recordCount',jsonb_array_length(package->'records'));
  end if;
  insert into parkey_private.pilot_catalog_batches values(package_hash,package_text,reviewer,now());
  for item in select value from jsonb_array_elements(package->'records') loop
    source:=(item->>'recordText')::jsonb;
    if source->>'id' is distinct from item->>'id' or jsonb_typeof(source->'id') is distinct from 'string'
      or item->>'recordHash' is distinct from encode(extensions.digest(item->>'recordText','sha256'),'hex')
      or item->>'contextHash' is distinct from encode(extensions.digest(item->>'contextText','sha256'),'hex')
      or jsonb_typeof((item->>'contextText')::jsonb) is distinct from 'array'
      or source->>'sourceLicense' is null or source->>'sourceRecordUrl' !~ '^https://[^[:space:]]+$'
      or source->>'sourceRecordUrl' is null then raise invalid_parameter_value using message='Immutable original record and context hashes required'; end if;
    shape:=parkey_private.pilot_source_geometry(source->'geometry');
    if not parkey_private.pilot_inside_city(city,shape) then raise invalid_parameter_value using message='Whole source geometry must be strictly within the selected pilot city; borders and overlaps excluded'; end if;
    if kind='candidates' then
      if not parkey_private.evidence_point(source->'representativePoint') or source->>'type' not in ('lot','garage','facility_unspecified','street_segment','space','entrance')
        or source->>'type' is null or source->>'sourceKind' not in ('osm','overture') or source->>'sourceKind' is null then raise invalid_parameter_value using message='Original candidate feature type and representative point required'; end if;
      anchor:=extensions.st_setsrid(extensions.st_makepoint((source->'representativePoint'->>0)::double precision,(source->'representativePoint'->>1)::double precision),4326);
    else
      if length(btrim(source->>'name')) not between 1 and 200 or source->>'name' is null or source->>'sourceLicense' is distinct from 'ODbL-1.0'
        or source->>'sourceKind' is distinct from 'osm' then raise invalid_parameter_value using message='Separate named OSM destination provenance required'; end if;
      anchor:=extensions.st_pointonsurface(shape);
    end if;
    if not parkey_private.pilot_inside_city(city,anchor) then raise invalid_parameter_value using message='Source anchor is outside selected city'; end if;
    insert into parkey_private.pilot_catalog_records(package_hash,kind,city,record_id,record_hash,record_text,context_hash,context_text,geometry,anchor)
      values(package_hash,kind,city,item->>'id',item->>'recordHash',item->>'recordText',item->>'contextHash',item->>'contextText',shape,anchor);
    imported:=imported+1;
  end loop;
  return jsonb_build_object('status','imported_private','publicationApproved',false,'recordCount',imported);
end;
$$;
revoke all on function public.import_pilot_catalog(uuid,text,text) from public,anon,authenticated;
grant execute on function public.import_pilot_catalog(uuid,text,text) to service_role;

create function public.moderate_pilot_destination(reviewer uuid,record_id text,operation text,review_due_at timestamptz,reason text,license_scope text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare item parkey_private.pilot_catalog_records%rowtype;
begin
  if not exists(select 1 from parkey_private.discovery_reviewers where user_id=reviewer and can_publish) then raise insufficient_privilege using message='Publisher access required'; end if;
  if operation is null or operation not in ('publish','revoke') or reason is null or length(btrim(reason)) not between 20 and 2000 then raise invalid_parameter_value using message='Explicit destination decision and reason required'; end if;
  select * into item from parkey_private.pilot_catalog_records p where p.record_id=moderate_pilot_destination.record_id and kind='destinations' order by sequence desc limit 1;
  if not found then raise no_data_found using message='Import the independent destination first'; end if;
  if operation='publish' then
    if license_scope is distinct from 'public_destination_only' or review_due_at is null or not isfinite(review_due_at) or review_due_at<=now() or review_due_at>now()+interval '90 days' then
      raise invalid_parameter_value using message='Destination-only public license scope and expiry required'; end if;
    insert into parkey_private.pilot_destination_publications values(record_id,item.sequence,review_due_at,true)
      on conflict on constraint pilot_destination_publications_pkey do update set record_sequence=excluded.record_sequence,review_due_at=excluded.review_due_at,published=true;
  else update parkey_private.pilot_destination_publications p set published=false where p.record_id=moderate_pilot_destination.record_id;
  end if;
  insert into parkey_private.pilot_destination_audit(record_id,record_hash,reviewer_id,operation,reason,license_scope,review_due_at)
    values(record_id,item.record_hash,reviewer,operation,reason,license_scope,review_due_at);
  return jsonb_build_object('status',operation,'parkingIdentity',false,'parkingAccessConfirmed',false);
end;
$$;
revoke all on function public.moderate_pilot_destination(uuid,text,text,timestamptz,text,text) from public,anon,authenticated;
grant execute on function public.moderate_pilot_destination(uuid,text,text,timestamptz,text,text) to service_role;

create function parkey_private.pilot_request(p_city text,p_mode text,p_bbox jsonb,p_limit integer,p_after text,p_kind text,p_query text default '')
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare west double precision; south double precision; east double precision; north double precision; binding text; token text; payload jsonb; secret bytea;
begin
  if p_city is null or p_city not in ('Manila','Mandaluyong') or p_mode is null or p_mode not in ('public','candidate_research') then raise invalid_parameter_value using message='Select an allowlisted pilot city and mode'; end if;
  if p_mode='candidate_research' and (auth.role() is distinct from 'authenticated' or auth.uid() is null or auth.jwt()->>'aal' is distinct from 'aal2'
    or not exists(select 1 from parkey_private.discovery_reviewers where user_id=auth.uid() and can_candidate_research)
    or not exists(select 1 from parkey_private.pilot_city_config where city=p_city and scope_version='manila-mandaluyong-v1' and candidate_research_enabled)) then
    raise insufficient_privilege using message='Candidate research requires an enabled city and authorized MFA reviewer'; end if;
  if p_limit is null or p_limit not between 1 and 100 or p_query is null or length(p_query)>100
    or jsonb_typeof(p_bbox) is distinct from 'object' or not(p_bbox ?& array['west','south','east','north'])
    or (select count(*) from jsonb_object_keys(p_bbox))<>4
    or exists(select 1 from jsonb_each(p_bbox) item where jsonb_typeof(item.value)<>'number') then
    raise invalid_parameter_value using message='Bounded viewport, limit 1-100 and query up to 100 characters required'; end if;
  west:=(p_bbox->>'west')::double precision; south:=(p_bbox->>'south')::double precision; east:=(p_bbox->>'east')::double precision; north:=(p_bbox->>'north')::double precision;
  if not(west>=-180 and east<=180 and south>=-85.051129 and north<=85.051129 and west<east and south<north and east-west<=0.5 and north-south<=0.5)
    or not exists(select 1 from parkey_private.pilot_lgu_boundaries where city=p_city and scope_version='manila-mandaluyong-v1'
      and extensions.st_intersects(geometry,extensions.st_makeenvelope(west,south,east,north,4326))) then raise invalid_parameter_value using message='Viewport must intersect selected city and span at most 0.5 degrees'; end if;
  binding:=encode(extensions.digest(jsonb_build_object('scopeVersion','manila-mandaluyong-v1','city',p_city,'mode',p_mode,'bbox',p_bbox,'limit',p_limit,'kind',p_kind,'query',p_query)::text,'sha256'),'hex');
  if p_after is not null then
    if length(p_after)>4096 or p_after !~ '^[A-Za-z0-9+/=]+\.[a-f0-9]{64}$' then raise invalid_parameter_value using message='Invalid pilot cursor'; end if;
    token:=split_part(p_after,'.',1); select s.secret into secret from parkey_private.pilot_cursor_secret s;
    if split_part(p_after,'.',2) is distinct from encode(extensions.hmac(convert_to(token,'UTF8'),secret,'sha256'),'hex') then raise invalid_parameter_value using message='Invalid pilot cursor signature'; end if;
    payload:=convert_from(decode(token,'base64'),'UTF8')::jsonb;
    if payload->>'binding' is distinct from binding or jsonb_typeof(payload->'after') is distinct from 'string' then raise invalid_parameter_value using message='Cursor belongs to another pilot query'; end if;
  end if;
  return jsonb_build_object('binding',binding,'after',payload->>'after');
end;
$$;
revoke all on function parkey_private.pilot_request(text,text,jsonb,integer,text,text,text) from public,anon,authenticated,service_role;
create function parkey_private.pilot_next_cursor(binding text,after_id text)
returns text language sql stable security definer set search_path='' as $$
  select token || '.' || encode(extensions.hmac(convert_to(token,'UTF8'),s.secret,'sha256'),'hex') from parkey_private.pilot_cursor_secret s
  cross join lateral(select replace(encode(convert_to(jsonb_build_object('binding',binding,'after',after_id)::text,'UTF8'),'base64'),E'\n','') token) encoded;
$$;
revoke all on function parkey_private.pilot_next_cursor(text,text) from public,anon,authenticated,service_role;

create index discovery_decision_record_idx on parkey_private.discovery_evidence_decisions((event_text::jsonb->>'recordId'),sequence desc);
create function parkey_private.pilot_parking_records(p_city text,p_mode text,p_bbox extensions.geometry,p_after_id text,p_limit integer,p_id text default null)
returns setof jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if p_mode='candidate_research' then
    return query with latest as (
      select distinct on(record_id) * from parkey_private.pilot_catalog_records
      where kind='candidates' order by record_id,sequence desc
    ), selected as (
      select *,record_text::jsonb source from latest
      where city=p_city and extensions.st_intersects(geometry,p_bbox) and (p_after_id is null or record_id>p_after_id)
        and (p_id is null or record_id=p_id)
      order by record_id limit p_limit
    ) select jsonb_build_object(
      'id',r.record_id,'sourceObservationId',r.record_id,'name',r.source->>'name',
      'officialName',null,'descriptiveLabel',null,'featureType',r.source->>'type',
      'geometry',r.source->'geometry','representativePoint',r.source->'representativePoint',
      'accessClass',coalesce(r.source->>'accessClass','unknown'),'restrictedAccess',coalesce((r.source->>'restrictedAccess')::boolean,false),
      'source',jsonb_build_object('kind',r.source->>'sourceKind','url',r.source->>'sourceRecordUrl','license',r.source->>'sourceLicense',
        'attribution',coalesce(r.source->>'sourceAttribution','Source attribution retained in frozen archive'),'updatedAt',r.source->>'sourceRecordEditedAt'),
      'evidence',jsonb_build_object('researchStatus',coalesce(r.source->>'researchStatus','researched'),'onlineCorroborated',false,'operatorConfirmed',false,'physicallyVerified',false,'publicationApproved',false),
      'navigationApproval',null,'reviewDueAt',null,'fees',null,'hours',null,
      'destinationContext',coalesce((select jsonb_agg(jsonb_build_object(
        'label',label->>'label','destination',label->>'destination','sourceId',label->>'sourceId','sourceRecordUrl',label->>'sourceRecordUrl','sourceLicense',label->>'sourceLicense',
        'category',label->>'category','approximateStraightLineMeters',label->'approximateStraightLineMeters',
        'insideSourcePropertyFootprint',label->'insideSourcePropertyFootprint','uncertainties',coalesce(label->'uncertainties','[]'::jsonb),
        'status','research_context_only','parkingNameConfirmed',false,'visitorAccessConfirmed',false,'navigationEntranceConfirmed',false,'publicationApproved',false))
        from (select group_item->'destinationReview'->'label' label from jsonb_array_elements(r.context_text::jsonb) group_item) labels
        where jsonb_typeof(label)='object' and label->>'status'='research_context_only'),'[]'::jsonb),
      'warnings',jsonb_build_array('Private unverified source observation. Visitor access, operation, safety, fees and hours require human review. Source anchors are not vehicle entrances.')
    ) from selected r order by r.record_id;
  else
    return query with reviewed as (
      select p.*,s.kind source_kind,s.license,s.attribution,e.record_text,
        (e.package_text::jsonb->>'candidateText')::jsonb source
      from public.discovery_parking p join public.discovery_sources s on s.id=p.source_id
      join parkey_private.discovery_evidence_targets t on t.parking_id=p.id
      cross join lateral (
        select d.event_text,e.package_text,(e.package_text::jsonb->>'candidateText') record_text
        from parkey_private.discovery_evidence_decisions d join parkey_private.discovery_evidence_packages e on e.package_hash=d.package_hash
        where d.event_text::jsonb->>'recordId'=t.candidate_id order by d.sequence desc limit 1
      ) e
      where p.published and p.review_expires_at>now() and p.source_observation_id=t.candidate_id
        and parkey_private.pilot_reviewed_row_visible(p.id)
        and e.event_text::jsonb->>'action'='approve_publication' and p.kind in ('lot','garage')
        and extensions.st_intersects(p.geometry,p_bbox) and (p_after_id is null or p.id::text>p_after_id)
        and (p_id is null or p.id::text=p_id)
    ), selected as (
      select * from reviewed where source->>'type' in ('lot','garage')
        and parkey_private.pilot_inside_city(p_city,parkey_private.pilot_source_geometry(source->'geometry'))
      order by id limit p_limit
    ) select jsonb_build_object(
      'id',p.id,'sourceObservationId',p.source_observation_id,'name',p.source->>'name','officialName',p.official_name,'descriptiveLabel',p.descriptive_label,
      'featureType',p.source->>'type','geometry',p.source->'geometry','representativePoint',p.source->'representativePoint',
      'accessClass',coalesce(p.source->>'accessClass','unknown'),'restrictedAccess',false,
      'source',jsonb_build_object('kind',p.source_kind,'url',p.source_url,'license',p.license,'attribution',p.attribution,'updatedAt',p.source_updated_at),
      'evidence',jsonb_build_object('researchStatus','reviewed_unverified','onlineCorroborated',false,'operatorConfirmed',false,'physicallyVerified',false,'publicationApproved',true),
      'navigationApproval',case when parkey_private.evidence_point(p.navigation_approval->'entrance') and
        parkey_private.pilot_inside_city(p_city,extensions.st_setsrid(extensions.st_makepoint((p.navigation_approval->'entrance'->>0)::double precision,(p.navigation_approval->'entrance'->>1)::double precision),4326))
        then p.navigation_approval else null end,
      'reviewDueAt',p.review_expires_at,'fees',p.fees,'hours',p.hours,'destinationContext','[]'::jsonb,
      'warnings',jsonb_build_array('Reviewed discovery listing. Current vacancy and live availability are unknown.')
    ) from selected p order by p.id;
  end if;
end;
$$;
revoke all on function parkey_private.pilot_parking_records(text,text,extensions.geometry,text,integer,text) from public,anon,authenticated,service_role;

create function public.discover_pilot_parking(p_city text,p_mode text,p_bbox jsonb,p_limit integer default 50,p_after text default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare request jsonb; records jsonb; next_cursor text; bounds extensions.geometry;
begin
  request:=parkey_private.pilot_request(p_city,p_mode,p_bbox,p_limit,p_after,'parking');
  bounds:=extensions.st_makeenvelope((p_bbox->>'west')::double precision,(p_bbox->>'south')::double precision,(p_bbox->>'east')::double precision,(p_bbox->>'north')::double precision,4326);
  select coalesce(jsonb_agg(dto order by dto->>'id'),'[]'::jsonb) into records
    from parkey_private.pilot_parking_records(p_city,p_mode,bounds,request->>'after',p_limit+1) dto;
  if jsonb_array_length(records)>p_limit then
    next_cursor:=parkey_private.pilot_next_cursor(request->>'binding',records->(p_limit-1)->>'id');
    records:=records-p_limit;
  end if;
  return jsonb_build_object('schemaVersion',1,'kind','pilot_discovery','scopeVersion','manila-mandaluyong-v1',
    'city',p_city,'mode',p_mode,'records',records,'nextCursor',next_cursor,
    'notice',case when p_mode='public' then 'Only individually reviewed, unexpired parking records. No live availability claim.'
      else 'Authorized private research only. These source observations grant no visitor access, navigation, verification or publication approval.' end);
end;
$$;
revoke all on function public.discover_pilot_parking(text,text,jsonb,integer,text) from public,anon,authenticated;
grant execute on function public.discover_pilot_parking(text,text,jsonb,integer,text) to anon,authenticated;

create function public.get_pilot_parking(p_city text,p_mode text,p_id text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare bbox jsonb; result jsonb; bounds extensions.geometry;
begin
  if p_id is null or length(p_id) not between 1 and 200 then raise invalid_parameter_value using message='Original pilot record ID required'; end if;
  select extensions.st_envelope(geometry) into bounds from parkey_private.pilot_lgu_boundaries where scope_version='manila-mandaluyong-v1' and city=p_city;
  bbox:=jsonb_build_object('west',extensions.st_xmin(extensions.box3d(bounds)),'south',extensions.st_ymin(extensions.box3d(bounds)),
    'east',extensions.st_xmax(extensions.box3d(bounds)),'north',extensions.st_ymax(extensions.box3d(bounds)));
  perform parkey_private.pilot_request(p_city,p_mode,bbox,1,null,'parking_get');
  select coalesce(jsonb_agg(dto),'[]'::jsonb) into result from parkey_private.pilot_parking_records(p_city,p_mode,bounds,null,1,p_id) dto;
  return jsonb_build_object('schemaVersion',1,'kind','pilot_discovery','scopeVersion','manila-mandaluyong-v1','city',p_city,'mode',p_mode,
    'records',result,'nextCursor',null,'notice','Current server review, geography, expiry and access state; no live availability claim.');
end;
$$;
revoke all on function public.get_pilot_parking(text,text,text) from public,anon,authenticated;
grant execute on function public.get_pilot_parking(text,text,text) to anon,authenticated;

create function public.discover_pilot_destinations(p_city text,p_mode text,p_bbox jsonb,p_limit integer default 50,p_after text default null,p_query text default '')
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare request jsonb; records jsonb; next_cursor text; bounds extensions.geometry;
begin
  request:=parkey_private.pilot_request(p_city,p_mode,p_bbox,p_limit,p_after,'destinations',p_query);
  bounds:=extensions.st_makeenvelope((p_bbox->>'west')::double precision,(p_bbox->>'south')::double precision,(p_bbox->>'east')::double precision,(p_bbox->>'north')::double precision,4326);
  with latest as (
    select distinct on(record_id) * from parkey_private.pilot_catalog_records where kind='destinations' order by record_id,sequence desc
  ), eligible as (
    select r.*,r.record_text::jsonb source,p.review_due_at
    from latest r left join parkey_private.pilot_destination_publications p on p.record_id=r.record_id and p.record_sequence=r.sequence
    where r.city=p_city and extensions.st_intersects(r.geometry,bounds) and (request->>'after' is null or r.record_id>request->>'after')
      and strpos(lower(r.record_text::jsonb->>'name'),lower(btrim(p_query)))>0
      and (p_mode='candidate_research' or (p.published and p.review_due_at>now() and exists(
        select 1 from parkey_private.pilot_city_config where city=p_city and public_destinations_enabled)))
    order by r.record_id limit p_limit+1
  ) select coalesce(jsonb_agg(jsonb_build_object('id',r.record_id,'name',r.source->>'name','category',r.source->>'category',
      'coordinate',extensions.st_asgeojson(r.anchor)::jsonb->'coordinates',
      'source',jsonb_build_object('url',r.source->>'sourceRecordUrl','license',r.source->>'sourceLicense','attribution',r.source->>'sourceAttribution','updatedAt',r.source->>'sourceRecordEditedAt'),
      'publicationApproved',p_mode='public','reviewDueAt',case when p_mode='public' then r.review_due_at end,'parkingIdentity',false,'parkingAccessConfirmed',false)
    order by r.record_id),'[]'::jsonb) into records from eligible r;
  if jsonb_array_length(records)>p_limit then
    next_cursor:=parkey_private.pilot_next_cursor(request->>'binding',records->(p_limit-1)->>'id'); records:=records-p_limit;
  end if;
  return jsonb_build_object('schemaVersion',1,'kind','pilot_destinations','scopeVersion','manila-mandaluyong-v1','city',p_city,'mode',p_mode,
    'records',records,'nextCursor',next_cursor,'notice','Named trip destinations are separate source-attributed places. Their identity grants no parking ownership, visitor rights or vehicle entrance.');
end;
$$;
revoke all on function public.discover_pilot_destinations(text,text,jsonb,integer,text,text) from public,anon,authenticated;
grant execute on function public.discover_pilot_destinations(text,text,jsonb,integer,text,text) to anon,authenticated;
commit;
