begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
insert into auth.users(id) values('b5100000-0000-4000-8000-000000000001'),('b5100000-0000-4000-8000-000000000002');
insert into parkey_private.discovery_reviewers(user_id,can_publish,can_candidate_research) values
  ('b5100000-0000-4000-8000-000000000001',true,false),('b5100000-0000-4000-8000-000000000002',false,false);
-- Isolate flag scenarios inside this rollback-only transaction. Preserve any
-- concurrently established real private QA catalog and founder config outside it.
update parkey_private.pilot_city_config set candidate_research_enabled=false,public_destinations_enabled=false;
update parkey_private.pilot_activation set active=false;

create function pg_temp.pilot_bbox(city text)
returns jsonb language sql as $$ select jsonb_build_object('west',st_xmin(box3d(geometry)),'south',st_ymin(box3d(geometry)),
  'east',st_xmax(box3d(geometry)),'north',st_ymax(box3d(geometry))) from parkey_private.pilot_lgu_boundaries
  where scope_version='manila-mandaluyong-v1' and pilot_lgu_boundaries.city=pilot_bbox.city $$;
create function pg_temp.pilot_point(city text)
returns jsonb language sql as $$ select st_asgeojson(st_pointonsurface(geometry))::jsonb->'coordinates' from parkey_private.pilot_lgu_boundaries
  where scope_version='manila-mandaluyong-v1' and pilot_lgu_boundaries.city=pilot_point.city $$;
create function pg_temp.pilot_package(city text,id text,kind text default 'candidates',patch jsonb default '{}'::jsonb,context jsonb default '[]'::jsonb)
returns text language sql as $$
with source as (select parkey_private.canonical_review_json(jsonb_build_object('id',id,'name','Synthetic source '||id,'type','lot','category','tourism:museum',
  'geometry',jsonb_build_object('type','Point','coordinates',pg_temp.pilot_point(city)), 'representativePoint',pg_temp.pilot_point(city),
  'sourceKind','osm','sourceRecordUrl','https://example.org/source/'||id,'sourceLicense','ODbL-1.0','sourceAttribution','Synthetic OSM attribution',
  'accessClass','unknown','restrictedAccess',false,'flags','[]'::jsonb)||patch) value)
select jsonb_build_object('schemaVersion',1,'scopeVersion','manila-mandaluyong-v1','kind',kind,'city',city,
  'boundaryHash','ea7864d00557f64de39981ccefca370c2d47eb82ceb98c55f554d21601e4ede7',
  'sourceHashes','{"boundaries":"ea7864d00557f64de39981ccefca370c2d47eb82ceb98c55f554d21601e4ede7","osm":"5ae2654e12d0ec47c33da193004e009fd628ea9b408b953b37b2fb24fa26335d","overture":"203a4847b0fa9f8129374442089f4722ddfd49e601bb172c41df02688236cb25","reviews":"68e702bb733c0134fb505ec5d551c21dd27ac95dbb99a468ea98ae9077511a0b"}'::jsonb,
  'destinationReportHash','0ac2a6d1505ee5121812b1c82aa2169908cc88bb1340441d24375e66ea523086','destinationSourceHash','cf4def65ee3d6ca15206d29f533ceae90df74f0cebe8fd9d0af80c292f6b93d5',
  'records',jsonb_build_array(jsonb_build_object('id',id,'recordText',value,'recordHash',encode(digest(value,'sha256'),'hex'),
    'contextText',context::text,'contextHash',encode(digest(context::text,'sha256'),'hex'))))::text from source;
$$;
create function pg_temp.pilot_import(city text,id text,kind text default 'candidates',patch jsonb default '{}'::jsonb,context jsonb default '[]'::jsonb)
returns jsonb language sql as $$ select public.import_pilot_catalog('b5100000-0000-4000-8000-000000000001',value,encode(digest(value,'sha256'),'hex'))
  from (select pg_temp.pilot_package(city,id,kind,patch,context) value) p $$;

select is((select count(*)::integer from parkey_private.pilot_lgu_boundaries),17,'all retained 17-LGU geometries participate in scope decisions');
select is((select count(*)::integer from parkey_private.pilot_city_config),2,'only two exact pilot cities configured');
select ok(not exists(select 1 from parkey_private.pilot_city_config where candidate_research_enabled or public_destinations_enabled),'candidate access and public destination publication default disabled');
select ok(not exists(select 1 from parkey_private.pilot_activation where active),'global release activation defaults inactive');
select ok(not has_table_privilege('anon','parkey_private.pilot_catalog_records','select'),'anonymous clients cannot inspect private candidate catalog');
select ok(not has_table_privilege('authenticated','parkey_private.pilot_catalog_records','select'),'authenticated clients cannot bypass candidate authorization with table reads');
select ok(not has_table_privilege('service_role','parkey_private.pilot_city_config','update'),'service credential cannot activate city research flags');
select ok(not has_function_privilege('authenticated','public.import_pilot_catalog(uuid,text,text)','execute'),'clients cannot import research candidates');
select ok(not has_function_privilege('anon','public.moderate_pilot_destination(uuid,text,text,timestamptz,text,text)','execute'),'public cannot publish destinations');
select ok(parkey_private.pilot_inside_city('Manila',st_geomfromgeojson(jsonb_build_object('type','Point','coordinates',pg_temp.pilot_point('Manila')))),'real Manila interior is in scope');
select ok(not parkey_private.pilot_inside_city('Manila',st_geomfromgeojson(jsonb_build_object('type','Point','coordinates',pg_temp.pilot_point('Makati')))),'Makati is outside Manila even within coarse NCR extent');
select ok(not parkey_private.pilot_inside_city('Manila',(select st_startpoint(st_exteriorring(st_geometryn(geometry,1))) from parkey_private.pilot_lgu_boundaries where city='Manila')),'exact boundary touches are excluded');
select ok(not parkey_private.pilot_inside_city('Manila',st_makeline(st_geomfromgeojson(jsonb_build_object('type','Point','coordinates',pg_temp.pilot_point('Manila'))),st_geomfromgeojson(jsonb_build_object('type','Point','coordinates',pg_temp.pilot_point('Mandaluyong'))))),'cross-city line is never clipped or reassigned');
select throws_like($$select pg_temp.pilot_import('Manila','test:wrongcity',patch:=jsonb_build_object('geometry',jsonb_build_object('type','Point','coordinates',pg_temp.pilot_point('Makati'))))$$,'%strictly within the selected pilot city%','private import rejects source geometry outside the selected city');
select lives_ok($$select pg_temp.pilot_import('Manila','test:manila:a')$$,'bounded original source candidate imports privately');
select lives_ok($$select pg_temp.pilot_import('Manila','test:manila:b',patch:='{"type":"facility_unspecified","publicationApproved":true}'::jsonb)$$,'unknown subtype and submitted approval claims remain private source evidence');
select lives_ok($$select pg_temp.pilot_import('Mandaluyong','test:mandaluyong:a')$$,'second city imports independently');
select is((select count(*)::integer from public.discovery_parking where source_observation_id like 'test:%'),0,'private catalog import never creates public parking rows');
select lives_ok($$select pg_temp.pilot_import('Manila','test:manila:a')$$,'identical catalog package is idempotent');
select is((select count(*)::integer from parkey_private.pilot_catalog_records where record_id='test:manila:a'),1,'retry retains one frozen record version');
select throws_like($$update parkey_private.pilot_catalog_records set record_text='{}' where record_id='test:manila:a'$$,'%append-only%','original catalog snapshots are immutable');
select throws_like($$select public.import_pilot_catalog('b5100000-0000-4000-8000-000000000001','{}',repeat('0',64))$$,'%package hash mismatch%','tampered import bytes are refused');

-- Public requests cannot switch themselves into reviewer mode.
set local role anon;
select is(jsonb_array_length(public.discover_pilot_parking('Manila','public','{"west":120.9,"south":14.5,"east":121.1,"north":14.7}')->'records'),0,'public pilot never copies private queue rows');
select throws_like($$select public.discover_pilot_parking('Manila','candidate_research','{"west":120.9,"south":14.5,"east":121.1,"north":14.7}')$$,'%authorized MFA reviewer%','anonymous candidate switch denied');
select throws_like($$select public.get_pilot_parking('Manila','candidate_research','test:manila:a')$$,'%authorized MFA reviewer%','by-ID lookup has identical candidate authorization');
select throws_like($$select public.discover_pilot_parking('Makati','public','{"west":120.9,"south":14.5,"east":121.1,"north":14.7}')$$,'%allowlisted pilot city%','unsupported city denied server-side');
select throws_like($$select public.discover_pilot_parking('Manila','all','{"west":120.9,"south":14.5,"east":121.1,"north":14.7}')$$,'%allowlisted pilot city%','unknown mode denied server-side');
select throws_like($$select public.discover_pilot_parking('Manila','public','{"west":120.9,"south":14.5,"east":121.1,"north":14.7}',101)$$,'%limit 1-100%','oversized page denied');
select throws_like($$select public.discover_pilot_parking('Manila','public','{"west":120.9,"south":14.5,"east":121.1,"north":14.7,"all":true}')$$,'%Bounded viewport%','unrecognized bbox fields denied');
select throws_like($$select public.discover_pilot_parking('Manila','public','{"west":"120.9","south":14.5,"east":121.1,"north":14.7}')$$,'%Bounded viewport%','string coordinates denied');
select throws_like($$select public.discover_pilot_parking('Manila','public','{"west":120,"south":14,"east":122,"north":16}')$$,'%at most 0.5 degrees%','unbounded viewport denied');
select throws_like($$select public.discover_pilot_parking('Manila','public','{"west":0,"south":0,"east":0.1,"north":0.1}')$$,'%intersect selected city%','unrelated viewport denied');
reset role;
set local request.jwt.claims='{"sub":"b5100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}';
set local role authenticated;
select throws_like($$select public.discover_pilot_parking('Manila','candidate_research','{"west":120.9,"south":14.5,"east":121.1,"north":14.7}')$$,'%authorized MFA reviewer%','existing reviewer has no implicit candidate privilege');
reset role;
update parkey_private.discovery_reviewers set can_candidate_research=true where user_id='b5100000-0000-4000-8000-000000000001';
set local role authenticated;
select throws_like($$select public.discover_pilot_parking('Manila','candidate_research','{"west":120.9,"south":14.5,"east":121.1,"north":14.7}')$$,'%authorized MFA reviewer%','reviewer privilege does not enable disabled city');
reset role;
update parkey_private.pilot_city_config set candidate_research_enabled=true where city='Manila';
set local request.jwt.claims='{"sub":"b5100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select throws_like($$select public.discover_pilot_parking('Manila','candidate_research','{"west":120.9,"south":14.5,"east":121.1,"north":14.7}')$$,'%authorized MFA reviewer%','MFA assurance remains required after role/city enablement');
reset role;
set local request.jwt.claims='{"sub":"b5100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}';
set local role authenticated;
select is((select count(*)::integer from jsonb_array_elements(public.discover_pilot_parking('Manila','candidate_research','{"west":120.9,"south":14.5,"east":121.1,"north":14.7}')->'records') r where r->>'id' like 'test:manila:%'),2,'authorized MFA reviewer can read selected city synthetic candidates alongside retained QA records');
select ok(not exists(select 1 from jsonb_array_elements(public.discover_pilot_parking('Manila','candidate_research','{"west":120.9,"south":14.5,"east":121.1,"north":14.7}')->'records') r where r->'navigationApproval'<>'null'::jsonb or r->'evidence'->>'publicationApproved'<>'false'),'candidate source claims grant neither approval nor navigation');
select is(jsonb_array_length(public.get_pilot_parking('Manila','candidate_research','test:mandaluyong:a')->'records'),0,'by-ID lookup cannot bypass selected city');
select is(jsonb_array_length(public.discover_pilot_parking('Manila','candidate_research','{"west":120.9,"south":14.5,"east":121.1,"north":14.7}',1)->'records'),1,'candidate pagination is bounded');
do $$begin perform set_config('test.pilot_cursor',public.discover_pilot_parking('Manila','candidate_research','{"west":120.9,"south":14.5,"east":121.1,"north":14.7}',1)->>'nextCursor',true); end$$;
select ok((public.discover_pilot_parking('Manila','candidate_research','{"west":120.9,"south":14.5,"east":121.1,"north":14.7}',1,current_setting('test.pilot_cursor'))->'records'->0->>'id')>
  (public.discover_pilot_parking('Manila','candidate_research','{"west":120.9,"south":14.5,"east":121.1,"north":14.7}',1)->'records'->0->>'id'),'signed cursor advances to another stable source identity without replaying the previous record');
select throws_like($$select public.discover_pilot_parking('Manila','candidate_research','{"west":120.9,"south":14.5,"east":121.1,"north":14.7}',1,current_setting('test.pilot_cursor')||'x')$$,'%Invalid pilot cursor%','cursor tampering denied');
select throws_like($$select public.discover_pilot_parking('Manila','public','{"west":120.9,"south":14.5,"east":121.1,"north":14.7}',1,current_setting('test.pilot_cursor'))$$,'%another pilot query%','candidate cursor cannot be replayed as public cursor');
select throws_like($$select public.discover_pilot_parking('Manila','candidate_research','{"west":120.91,"south":14.5,"east":121.1,"north":14.7}',1,current_setting('test.pilot_cursor'))$$,'%another pilot query%','cursor binds viewport');
reset role;

-- Destinations are independently sourced and approved; never parking identities.
select lives_ok($$select pg_temp.pilot_import('Manila','test:destination:a','destinations')$$,'independent destination imports privately');
select lives_ok($$select pg_temp.pilot_import('Manila','test:destination:b','destinations')$$,'second destination imports privately');
set local role authenticated;
select is(jsonb_array_length(public.discover_pilot_destinations('Manila','candidate_research','{"west":120.9,"south":14.5,"east":121.1,"north":14.7}',50,null,'destination:a')->'records'),1,'authorized destination name search is server-filtered');
select throws_like($$select public.discover_pilot_destinations('Manila','candidate_research','{"west":120.9,"south":14.5,"east":121.1,"north":14.7}',50,null,repeat('x',101))$$,'%query up to 100%','destination search bounded');
reset role;
select lives_ok($$select public.moderate_pilot_destination('b5100000-0000-4000-8000-000000000001','test:destination:a','publish',now()+interval '7 days','Synthetic destination-only licensing approval fixture','public_destination_only')$$,'separate destination-only publisher approval is explicit');
set local role anon;
select is(jsonb_array_length(public.discover_pilot_destinations('Manila','public','{"west":120.9,"south":14.5,"east":121.1,"north":14.7}')->'records'),0,'destination publication still requires founder city license enablement');
reset role;
update parkey_private.pilot_city_config set public_destinations_enabled=true where city='Manila';
set local role anon;
select is(jsonb_array_length(public.discover_pilot_destinations('Manila','public','{"west":120.9,"south":14.5,"east":121.1,"north":14.7}')->'records'),1,'public destination mode exposes separately published record only');
select is(public.discover_pilot_destinations('Manila','public','{"west":120.9,"south":14.5,"east":121.1,"north":14.7}')->'records'->0->>'parkingAccessConfirmed','false','named destination grants no parking access');
reset role;
select lives_ok($$select public.moderate_pilot_destination('b5100000-0000-4000-8000-000000000001','test:destination:a','revoke',null,'Synthetic destination revocation fixture',null)$$,'destination publication can be revoked independently');
set local role anon;
select is(jsonb_array_length(public.discover_pilot_destinations('Manila','public','{"west":120.9,"south":14.5,"east":121.1,"north":14.7}')->'records'),0,'destination revocation is effective on the next server read');
reset role;
select ok((select count(*) from parkey_private.pilot_configuration_audit)>=2,'founder city configuration changes retain append-only old/new audit');

-- Synthetic pre-reviewed A rows exercise every public path with rollback-only
-- owner fixtures; real source candidates and human decisions are never changed.
create function pg_temp.pilot_public_fixture(city text,parking_id uuid,source_id text,patch jsonb default '{}'::jsonb)
returns void language plpgsql as $$
declare raw_source jsonb; raw_text text; package_text text; package_hash text; event_text text; source_uuid uuid; seq bigint; previous_hash text;
begin
  raw_source:=jsonb_build_object('id',source_id,'name','Original synthetic source name','type','lot','accessClass','unknown',
    'restrictedAccess',false,'flags','[]'::jsonb,'geometry',jsonb_build_object('type','Point','coordinates',pg_temp.pilot_point(city)),
    'representativePoint',pg_temp.pilot_point(city))||patch;
  raw_text:=parkey_private.canonical_review_json(raw_source);
  package_text:=jsonb_build_object('candidateText',raw_text)::text; package_hash:=encode(digest(package_text,'sha256'),'hex');
  insert into parkey_private.discovery_evidence_packages(package_hash,package_text,candidate_id,record_hash,imported_by)
    values(package_hash,package_text,source_id,encode(digest(raw_text,'sha256'),'hex'),'b5100000-0000-4000-8000-000000000001');
  insert into public.discovery_sources(kind,label,url,license,attribution) values('osm','Synthetic source fixture','https://example.org','ODbL-1.0','Synthetic source attribution') returning id into source_uuid;
  insert into public.discovery_parking(id,source_id,source_record_id,source_observation_id,name,kind,geometry,descriptive_label,review_expires_at,published)
    values(parking_id,source_uuid,source_id,source_id,'Reviewed descriptive display label','lot',st_geomfromgeojson(raw_source->'geometry'),'Reviewed descriptive display label',now()+interval '7 days',true);
  insert into parkey_private.discovery_evidence_targets values(source_id,parking_id);
  select coalesce(max(sequence),0)+1 into seq from parkey_private.discovery_evidence_decisions;
  select event_hash into previous_hash from parkey_private.discovery_evidence_decisions order by sequence desc limit 1;
  event_text:=parkey_private.canonical_review_json(jsonb_build_object('sequence',seq,'previousHash',previous_hash,'recordId',source_id,'action','approve_publication'));
  insert into parkey_private.discovery_evidence_decisions(sequence,event_hash,package_hash,event_text,reviewer_id)
    values(seq,encode(digest(event_text,'sha256'),'hex'),package_hash,event_text,'b5100000-0000-4000-8000-000000000001');
end;
$$;
select pg_temp.pilot_public_fixture('Manila','b5200000-0000-4000-8000-000000000001','test:public:manila');
select pg_temp.pilot_public_fixture('Mandaluyong','b5200000-0000-4000-8000-000000000002','test:public:mandaluyong');
select pg_temp.pilot_public_fixture('Makati','b5200000-0000-4000-8000-000000000003','test:public:makati');
select pg_temp.pilot_public_fixture('Manila','b5200000-0000-4000-8000-000000000004','test:public:restricted','{"restrictedAccess":true}');
select pg_temp.pilot_public_fixture('Manila','b5200000-0000-4000-8000-000000000005','test:public:closed','{"operatingStatus":"closed"}');
select pg_temp.pilot_public_fixture('Manila','b5200000-0000-4000-8000-000000000006','test:public:unknown','{"type":"facility_unspecified"}');
-- Model approvals made before the new access guard existed. Only the local
-- owner's synthetic historical fixture setup bypasses this one trigger; no
-- service/client permission changes, and the trigger is restored before reads.
alter table parkey_private.discovery_evidence_decisions disable trigger pilot_source_access_guard;
select pg_temp.pilot_public_fixture('Manila','b5200000-0000-4000-8000-000000000007','test:public:members','{"accessClass":"members"}');
select pg_temp.pilot_public_fixture('Manila','b5200000-0000-4000-8000-000000000008','test:public:unsupported','{"accessClass":"unrecognized_access"}');
select pg_temp.pilot_public_fixture('Manila','b5200000-0000-4000-8000-000000000009','test:public:rawmembers','{"accessClass":"unknown","sourceTags":{"access":"members"}}');
select pg_temp.pilot_public_fixture('Manila','b5200000-0000-4000-8000-000000000010','test:public:rawunsupported','{"accessClass":"unknown","sourceTags":{"access":"unrecognized_access"}}');
select pg_temp.pilot_public_fixture('Manila','b5200000-0000-4000-8000-000000000011','test:public:parkingaccess','{"accessClass":"unknown","sourceTags":{"access":"yes","parking:access":"members"}}');
alter table parkey_private.discovery_evidence_decisions enable trigger pilot_source_access_guard;
select is((select tgenabled::text from pg_trigger where tgrelid='parkey_private.discovery_evidence_decisions'::regclass and tgname='pilot_source_access_guard'),'O','future-approval access trigger is enabled before every public read assertion');
insert into public.discovery_regulations(id,parking_id,source_id,description,published)
  select 'b5300000-0000-4000-8000-000000000001',id,source_id,'Synthetic outside-city restriction',true
    from public.discovery_parking where id='b5200000-0000-4000-8000-000000000003';
set local role anon;
select is((select count(*)::integer from public.discovery_parking where id between 'b5200000-0000-4000-8000-000000000001' and 'b5200000-0000-4000-8000-000000000011'),11,'inactive pilot gate preserves pre-existing public table behavior');
select is(jsonb_array_length(public.discover_pilot_parking('Manila','public','{"west":120.9,"south":14.5,"east":121.1,"north":14.7}')->'records'),1,'new pilot public RPC always excludes closed/restricted/unknown/cross-city sources even before activation');
select ok(not exists(select 1 from jsonb_array_elements(public.discover_pilot_parking('Manila','public','{"west":120.9,"south":14.5,"east":121.1,"north":14.7}')->'records') r
  where r->>'id' in ('b5200000-0000-4000-8000-000000000007','b5200000-0000-4000-8000-000000000008')),'new public RPC excludes historical members and unrecognized explicit access even before activation');
select is(public.discover_pilot_parking('Manila','public','{"west":120.9,"south":14.5,"east":121.1,"north":14.7}')->'records'->0->>'accessClass','unknown','public DTO preserves original source access instead of masking it as public visitors');
select is(jsonb_array_length(public.get_pilot_parking('Manila','public','b5200000-0000-4000-8000-000000000011')->'records'),0,'public by-ID revalidation rejects historical conflicting parking:access members');
select ok(not exists(select 1 from jsonb_array_elements(public.discover_pilot_parking('Manila','public','{"west":120.9,"south":14.5,"east":121.1,"north":14.7}')->'records') r
  where r->>'id' in ('b5200000-0000-4000-8000-000000000009','b5200000-0000-4000-8000-000000000010')),'new public RPC never lets normalized unknown mask restricted or unsupported raw access tags');
select is(public.discover_pilot_parking('Manila','public','{"west":120.9,"south":14.5,"east":121.1,"north":14.7}')->'records'->0->>'name','Original synthetic source name','public DTO preserves original archived source name separately from display label');
select is(public.discover_pilot_parking('Manila','public','{"west":120.9,"south":14.5,"east":121.1,"north":14.7}')->'records'->0->>'descriptiveLabel','Reviewed descriptive display label','public DTO keeps reviewed descriptive display label separate');
reset role;
update parkey_private.pilot_activation set active=true where scope_version='manila-mandaluyong-v1';
set local role anon;
select is((select count(*)::integer from public.discovery_parking where id between 'b5200000-0000-4000-8000-000000000001' and 'b5200000-0000-4000-8000-000000000011'),2,'active pilot public RLS hides other LGUs and unsafe source states');
select is((select count(*)::integer from public.discovery_parking where id in ('b5200000-0000-4000-8000-000000000007','b5200000-0000-4000-8000-000000000008')),0,'active direct-table reads exclude historical members and unsupported access');
select is((select count(*)::integer from public.discovery_parking where id='b5200000-0000-4000-8000-000000000003'),0,'active direct-table read cannot leak Makati');
select ok(not exists(select 1 from jsonb_array_elements(public.discover_parking(120.9,14.5,121.2,14.8)->'records') r where r->>'id'='b5200000-0000-4000-8000-000000000003'),'active legacy RPC cannot leak Makati');
select ok(not exists(select 1 from jsonb_array_elements(public.discover_parking(120.9,14.5,121.2,14.8)->'records') r
  where r->>'id' in ('b5200000-0000-4000-8000-000000000007','b5200000-0000-4000-8000-000000000008')),'active legacy RPC excludes members and unsupported access');
select is((select count(*)::integer from public.discovery_parking where id in ('b5200000-0000-4000-8000-000000000009','b5200000-0000-4000-8000-000000000010','b5200000-0000-4000-8000-000000000011')),0,'active direct table reads do not let normalized unknown mask unsafe raw access tags');
select ok(not exists(select 1 from jsonb_array_elements(public.discover_parking(120.9,14.5,121.2,14.8)->'records') r
  where r->>'id' in ('b5200000-0000-4000-8000-000000000009','b5200000-0000-4000-8000-000000000010','b5200000-0000-4000-8000-000000000011')),'active legacy RPC does not let normalized unknown mask unsafe raw access tags');
select is((select count(*)::integer from public.discovery_sources where label='Synthetic source fixture'),2,'active source attribution policy exposes only sources attached to eligible pilot records');
select is((select count(*)::integer from public.discovery_regulations where id='b5300000-0000-4000-8000-000000000001'),0,'active regulation reads inherit parent pilot scope');
select is(jsonb_array_length(public.get_pilot_parking('Manila','public','b5200000-0000-4000-8000-000000000001')->'records'),1,'by-ID public revalidation returns current approved in-city row');
select is(jsonb_array_length(public.get_pilot_parking('Mandaluyong','public','b5200000-0000-4000-8000-000000000001')->'records'),0,'by-ID public revalidation cannot bypass city');
reset role;
update public.discovery_parking set review_expires_at=now()-interval '1 second' where id='b5200000-0000-4000-8000-000000000001';
set local role anon;
select is(jsonb_array_length(public.get_pilot_parking('Manila','public','b5200000-0000-4000-8000-000000000001')->'records'),0,'selected cached public record disappears after expiry revalidation');
select is((select count(*)::integer from public.discovery_parking where id='b5200000-0000-4000-8000-000000000001'),0,'expiry also enforced on direct table');
reset role;
update public.discovery_parking set published=false where id='b5200000-0000-4000-8000-000000000002';
set local role anon;
select is(jsonb_array_length(public.discover_pilot_parking('Mandaluyong','public','{"west":120.9,"south":14.5,"east":121.1,"north":14.7}')->'records'),0,'revocation removes the remaining city record from public pilot');
reset role;
select throws_like($$delete from parkey_private.pilot_configuration_audit$$,'%append-only%','configuration audit cannot be erased');

update parkey_private.discovery_reviewers set can_candidate_research=false where user_id='b5100000-0000-4000-8000-000000000001';
set local role authenticated;
select throws_like($$select public.get_pilot_parking('Manila','candidate_research','test:manila:a')$$,'%authorized MFA reviewer%','removing candidate role revokes existing JWT access immediately');
reset role;
select * from finish();
rollback;
