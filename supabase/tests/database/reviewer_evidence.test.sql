begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into auth.users(id) values ('a3100000-0000-4000-8000-000000000001'),('a3100000-0000-4000-8000-000000000002');
insert into parkey_private.discovery_reviewers(user_id,can_publish) values
  ('a3100000-0000-4000-8000-000000000001',true),('a3100000-0000-4000-8000-000000000002',false);

create temporary table reviewer_fixture(package_text text,package_hash text,record_hash text,submission_hash text);
insert into reviewer_fixture(package_text)
select jsonb_build_object('schemaVersion',1,'candidateText',candidate_text,
  'recordHash',encode(digest(candidate_text,'sha256'),'hex'),
  'sourceHashes','{"osm":"synthetic-test-only"}'::jsonb,'sourceAsOf',now()-interval '2 days',
  'submissionText',submission_text,'submissionHash',encode(digest(submission_text,'sha256'),'hex'),
  'reviewCatalogHash','synthetic-test-catalog',
  'reviewIssues','[{"id":"synthetic-gap","candidateIds":["osm:node/991:Point"],"blockingPublicDisplay":true}]'::jsonb,
  'reviewSubmissionEvent',jsonb_build_object('action','record_field_submission','issueId','synthetic-gap',
    'payloadHash',encode(digest(submission_text,'sha256'),'hex')))::text
from (select parkey_private.canonical_review_json(jsonb_build_object(
  'id','osm:node/991:Point','name','Unnamed parking facility','type','lot',
  'representativePoint','[121.03,14.567]'::jsonb,'sourceRecordUrl','https://www.openstreetmap.org/node/991',
  'sourceLicense','ODbL-1.0','sourceProviders','[{"dataset":"OpenStreetMap","record_id":"node/991","license":"ODbL-1.0"}]'::jsonb,
  'accessClass','unknown','flags','[]'::jsonb)) candidate_text,
  jsonb_build_object('schemaVersion',1,'status','submitted_unreviewed','candidateId','osm:node/991:Point',
  'sourceHashes','{"osm":"synthetic-test-only"}'::jsonb,'attestedOnSite',true,'privacyReviewed',true,'observedAt',now()-interval '1 day',
  'facts','{"existence":"exists","access":"public_visitors","operation":"open_observed","entranceCoordinates":[121.0301,14.5671],"operatorEvidence":"Synthetic operator evidence"}'::jsonb)::text submission_text) fixture;
update reviewer_fixture set package_hash = encode(digest(package_text,'sha256'),'hex'),
  record_hash = package_text::jsonb->>'recordHash',submission_hash = package_text::jsonb->>'submissionHash';

create function pg_temp.review_event(operation text,actor uuid,patch jsonb default '{}'::jsonb)
returns text language sql as $$
select parkey_private.canonical_review_json(jsonb_build_object(
  'eventId',gen_random_uuid(),'sequence',coalesce((select max(sequence) from parkey_private.discovery_evidence_decisions),0)+1,
  'previousHash',(select event_hash from parkey_private.discovery_evidence_decisions order by sequence desc limit 1),
  'recordId','osm:node/991:Point','action',operation,'actorKind','human_reviewer','actorId',actor,
  'recordedAt',to_char(now()-interval '1 minute','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  'reason','Synthetic test decision only; no actual human approval',
  'evidenceReferences',jsonb_build_array('internal:field-submission/' || f.submission_hash),
  'recordHash',f.record_hash,'reviewDueAt',to_char(now()+interval '7 days','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  'scope','unverified_discovery','approvedFields','["name","geometry","source","evidence","access"]'::jsonb,
  'licenseApproved',true,'accessApproved',true,'safetyApproved',true,'accessDecision','public_visitor_access',
  'reviewDecisions',jsonb_build_object(
    'identity',jsonb_build_object('decision','confirmed_original_source','evidenceReferences',jsonb_build_array('test:identity')),
    'access',jsonb_build_object('decision','public_visitors','evidenceReferences',jsonb_build_array('test:access')),
    'entrance',jsonb_build_object('decision','safe_visitor_entrance_confirmed','coordinates','[121.0301,14.5671]'::jsonb,'evidenceReferences',jsonb_build_array('test:entrance')),
    'operatorPermission',jsonb_build_object('decision','confirmed','scope','unverified_discovery_only','visitorNavigationAuthorized',true,'evidenceReferences',jsonb_build_array('test:operator')),
    'license',jsonb_build_object('decision','approved','scope','public_discovery_display','publicAttribution','OpenStreetMap contributors','evidenceReferences',jsonb_build_array('test:license')),
    'label',jsonb_build_object('kind','descriptive_label','text','Synthetic parking beside test street','evidenceReferences',jsonb_build_array('test:label'))
  ),'issueResolutions','[{"issueId":"synthetic-gap","outcome":"human_resolved","reason":"Synthetic human resolution","evidenceReferences":["test:resolution"]}]'::jsonb
) || patch) from reviewer_fixture f;
$$;
create function pg_temp.review_decide(operation text, actor uuid default 'a3100000-0000-4000-8000-000000000001',patch jsonb default '{}'::jsonb)
returns jsonb language sql as $$
  select public.decide_discovery_evidence(actor,f.package_hash,e.event_text,encode(digest(e.event_text,'sha256'),'hex'))
  from reviewer_fixture f cross join lateral (select pg_temp.review_event(operation,actor,patch) event_text) e;
$$;

select ok(not has_function_privilege('anon','public.import_discovery_evidence(uuid,text,text)','execute'),'anonymous evidence import denied');
select ok(not has_function_privilege('authenticated','public.import_discovery_evidence(uuid,text,text)','execute'),'authenticated evidence import denied');
select ok(not has_function_privilege('anon','public.decide_discovery_evidence(uuid,text,text,text)','execute'),'anonymous decisions denied');
select ok(not has_function_privilege('authenticated','public.decide_discovery_evidence(uuid,text,text,text)','execute'),'authenticated decisions denied');
select ok(not has_function_privilege('anon','public.export_discovery_publication_ledger(uuid)','execute'),'anonymous private ledger export denied');
select ok(has_function_privilege('service_role','public.decide_discovery_evidence(uuid,text,text,text)','execute'),'controlled service may invoke reviewer decisions');
select ok(not has_table_privilege('service_role','parkey_private.discovery_evidence_decisions','insert'),'service cannot bypass decision validation');
select ok(not has_table_privilege('authenticated','parkey_private.discovery_evidence_packages','select'),'evidence and photos remain private');
select throws_like($$select public.import_discovery_evidence('a3100000-0000-4000-8000-000000000099',package_text,package_hash) from reviewer_fixture$$,'%Reviewer access required%','unregistered importer denied');
select throws_like($$select public.import_discovery_evidence('a3100000-0000-4000-8000-000000000001',package_text || ' ',package_hash) from reviewer_fixture$$,'%hash mismatch%','tampered package refused');
select lives_ok($$select public.import_discovery_evidence('a3100000-0000-4000-8000-000000000002',package_text,package_hash) from reviewer_fixture$$,'registered reviewer can import one private observation');
select is((select count(*)::integer from public.discovery_parking where source_observation_id = 'osm:node/991:Point'),0,'import never auto-publishes');
select lives_ok($$select public.import_discovery_evidence('a3100000-0000-4000-8000-000000000002',package_text,package_hash) from reviewer_fixture$$,'identical import is retryable');
select is((select count(*)::integer from parkey_private.discovery_evidence_packages where candidate_id = 'osm:node/991:Point'),1,'retry preserves one immutable archive');
select throws_like($$select pg_temp.review_decide('approve_publication','a3100000-0000-4000-8000-000000000002')$$,'%Publisher access required%','review-only role cannot approve');
select throws_like($$select pg_temp.review_decide('approve_publication',patch := '{"actorId":"a3100000-0000-4000-8000-000000000002"}')$$,'%accountable publication audit%','reviewer and event actor must match');
select throws_like($$select pg_temp.review_decide('approve_publication',patch := '{"recordId":"nearby:mall"}')$$,'%accountable publication audit%','nearby destination cannot replace parking source identity');
select throws_like($$select pg_temp.review_decide('approve_publication',patch := '{"reviewDecisions":{}}')$$,'%Explicit field%','missing human field decisions block approval');
select throws_like($$select pg_temp.review_decide('approve_publication',patch := '{"issueResolutions":[]}')$$,'%Every blocking issue%','unresolved inspection issues block publication');
select throws_like($$select pg_temp.review_decide('approve_publication',patch := jsonb_build_object('reviewDueAt',now()-interval '1 day'))$$,'%expiry decisions required%','expired approval refused');
select throws_like($$select pg_temp.review_decide('approve_publication',patch := '{"sequence":9000}')$$,'%accountable publication audit%','stale chain sequence refused');
select throws_like($$select pg_temp.review_decide('approve_publication',patch := '{"sequence":"1"}')$$,'%accountable publication audit%','string sequence cannot corrupt original ledger format');
select throws_like($$select pg_temp.review_decide('approve_publication',patch := '{"eventId":123}')$$,'%accountable publication audit%','numeric event identity cannot corrupt original ledger format');
select throws_like($$select pg_temp.review_decide('approve_publication',patch := '{"reason":123}')$$,'%accountable publication audit%','numeric reason cannot corrupt original ledger format');
select throws_like($$select pg_temp.review_decide('approve_publication',patch := '{"licenseApproved":"true"}')$$,'%Explicit field%','string license flag cannot corrupt original ledger format');
select throws_like($$select pg_temp.review_decide('approve_publication',patch := '{"accessApproved":"true"}')$$,'%Explicit field%','string access flag cannot corrupt original ledger format');
select throws_like($$select pg_temp.review_decide('approve_publication',patch := '{"safetyApproved":"true"}')$$,'%Explicit field%','string safety flag cannot corrupt original ledger format');
select throws_like($$select pg_temp.review_decide('approve_publication',patch := jsonb_build_object('recordedAt',to_char(now()-interval '1 minute','YYYY-MM-DD HH24:MI:SS')))$$,'%accountable publication audit%','noncanonical observation audit date refused');
select throws_like($$select pg_temp.review_decide('approve_publication',patch := jsonb_build_object('reviewDueAt',to_char(now()+interval '7 days','YYYY-MM-DD HH24:MI:SS')))$$,'%expiry decisions required%','noncanonical approval expiry refused');
select throws_like($$select pg_temp.review_decide('approve_publication',patch := jsonb_build_object('recordedAt',to_char(now()-interval '1 day','YYYY-MM-DD"T"HH24:MI:') || '60.000Z'))$$,'%accountable publication audit%','leap-second spelling rejected instead of PostgreSQL normalization');
select throws_like($$select public.decide_discovery_evidence('a3100000-0000-4000-8000-000000000001',f.package_hash,e.value,encode(digest(e.value,'sha256'),'hex')) from reviewer_fixture f cross join lateral (select replace(pg_temp.review_event('approve_publication','a3100000-0000-4000-8000-000000000001'),'"sequence":1','"sequence":1.0') value) e$$,'%invalid input syntax for type bigint%','decimal sequence representation cannot corrupt JS export hash');
select throws_like($$select public.decide_discovery_evidence('a3100000-0000-4000-8000-000000000001',f.package_hash,e.value,encode(digest(e.value,'sha256'),'hex')) from reviewer_fixture f cross join lateral (select replace(pg_temp.review_event('approve_publication','a3100000-0000-4000-8000-000000000001'),'121.0301','121.030100') value) e$$,'%canonical publication event encoding%','coordinate trailing zeros cannot corrupt JS export hash');
select throws_like($$select pg_temp.review_decide('approve_publication',patch := '{"evidenceKind":"physically_verified"}')$$,'%accountable publication audit%','publication cannot fabricate evidence badges');

select lives_ok($$select pg_temp.review_decide('reject',patch := '{"outcome":"correction_requested"}')$$,'explicit correction request is audited');
select is((select count(*)::integer from public.discovery_parking where source_observation_id = 'osm:node/991:Point'),0,'correction request does not publish');
select lives_ok($$select pg_temp.review_decide('reject',patch := '{"outcome":"rejected"}')$$,'explicit rejection is retained separately');
select throws_like($$select pg_temp.review_decide('reject')$$,'%Explicit rejection%','implicit rejection outcome refused');
select lives_ok($$select pg_temp.review_decide('approve_publication')$$,'publisher can explicitly approve all fields of one observation');
select is((select source_record_id from public.discovery_parking where source_observation_id = 'osm:node/991:Point'),'osm:node/991:Point','original parking ID is the immutable public source identity');
select is((select official_name from public.discovery_parking where source_observation_id = 'osm:node/991:Point'),null,'descriptive label never becomes an official name');
select is((select descriptive_label from public.discovery_parking where source_observation_id = 'osm:node/991:Point'),'Synthetic parking beside test street','descriptive label is stored separately');
select is((select verification from public.discovery_parking where source_observation_id = 'osm:node/991:Point'),'unverified','human publication is not physical verification');
select is((select navigation_approval->>'operatorAuthorized' from public.discovery_parking where source_observation_id = 'osm:node/991:Point'),'true','separate explicit operator visitor-navigation grant is stored');
select throws_like($$update public.discovery_parking set source_record_id = 'nearby:mall' where source_observation_id = 'osm:node/991:Point'$$,'%source identity is immutable%','published source identity cannot be rewritten');
select throws_like($$update parkey_private.discovery_evidence_packages set candidate_id = 'nearby:mall' where candidate_id = 'osm:node/991:Point'$$,'%append-only%','source evidence cannot be rewritten');
select throws_like($$delete from parkey_private.discovery_evidence_decisions$$,'%append-only%','human decision history cannot be erased');

set local role anon;
select is((select count(*)::integer from public.discovery_parking where source_observation_id = 'osm:node/991:Point'),1,'approved unexpired record is publicly readable');
select ok(exists(select 1 from jsonb_array_elements(public.discover_parking(121.02,14.56,121.04,14.58)->'records') r where r->>'sourceUrl' = 'https://www.openstreetmap.org/node/991'),'existing discovery RPC exposes individually approved observation');
select is((select r->'navigationApproval'->'entrance' from jsonb_array_elements(public.discover_parking(121.02,14.56,121.04,14.58)->'records') r where r->>'sourceUrl' = 'https://www.openstreetmap.org/node/991'),'[121.0301,14.5671]'::jsonb,'navigation is projected at the explicitly reviewed visitor entrance');
select ok(not exists(select 1 from jsonb_array_elements(public.discover_parking(121.02,14.56,121.04,14.58)->'records') r where r->>'sourceUrl' <> 'https://www.openstreetmap.org/node/991' and r->'navigationApproval' <> 'null'::jsonb),'legacy mapped records receive no inferred navigation approval');
reset role;
select lives_ok($$select pg_temp.review_decide('approve_publication',patch := jsonb_build_object('reviewDecisions',jsonb_set(pg_temp.review_event('approve_publication','a3100000-0000-4000-8000-000000000001')::jsonb->'reviewDecisions','{operatorPermission,visitorNavigationAuthorized}','false'::jsonb)))$$,'discovery approval does not require granting navigation');
select is((select navigation_approval from public.discovery_parking where source_observation_id = 'osm:node/991:Point'),null,'operator discovery-only permission cannot grant navigation');
update public.discovery_parking set review_expires_at = now()-interval '1 second',navigation_approval = null where source_observation_id = 'osm:node/991:Point';
set local role anon;
select is((select count(*)::integer from public.discovery_parking where source_observation_id = 'osm:node/991:Point'),0,'expiry is enforced by public table RLS');
select ok(not exists(select 1 from jsonb_array_elements(public.discover_parking(121.02,14.56,121.04,14.58)->'records') r where r->>'sourceUrl' = 'https://www.openstreetmap.org/node/991'),'expiry is enforced by existing discovery RPC');
reset role;
select lives_ok($$select pg_temp.review_decide('approve_publication')$$,'renewal needs another explicit human approval');
select throws_like($$select pg_temp.review_decide('revoke_publication','a3100000-0000-4000-8000-000000000002')$$,'%Publisher access required%','review-only role cannot revoke a publisher decision');
select lives_ok($$select pg_temp.review_decide('revoke_publication')$$,'publisher may explicitly revoke');
set local role anon;
select is((select count(*)::integer from public.discovery_parking where source_observation_id = 'osm:node/991:Point'),0,'revocation removes public access immediately');
reset role;
select is(jsonb_array_length(public.export_discovery_publication_ledger('a3100000-0000-4000-8000-000000000001')->'events'),6,'original-format export preserves correction, rejection, approvals and revocation');
-- A new private source revision with unknown facility subtype must not be
-- silently coerced into a supported public lot classification.
update reviewer_fixture set package_text = jsonb_set(package_text::jsonb,'{candidateText}',
  to_jsonb(parkey_private.canonical_review_json(jsonb_set((package_text::jsonb->>'candidateText')::jsonb,'{type}','"facility_unspecified"'::jsonb))))::text;
update reviewer_fixture set package_text = jsonb_set(package_text::jsonb,'{recordHash}',
  to_jsonb(encode(digest(package_text::jsonb->>'candidateText','sha256'),'hex')))::text;
update reviewer_fixture set package_hash = encode(digest(package_text,'sha256'),'hex'),record_hash = package_text::jsonb->>'recordHash';
select lives_ok($$select public.import_discovery_evidence('a3100000-0000-4000-8000-000000000001',package_text,package_hash) from reviewer_fixture$$,'unspecified source subtype can be imported as private evidence');
select throws_like($$select pg_temp.review_decide('approve_publication')$$,'%supported lot or garage source type%','explicit publication cannot invent a lot classification for unspecified source type');
select is((select ((p.package_text::jsonb)->>'candidateText')::jsonb->>'type' from parkey_private.discovery_evidence_packages p join reviewer_fixture f using(package_hash)),'facility_unspecified','rejected publication preserves original unspecified source type');
select is((select count(*)::integer from public.discovery_parking where source_observation_id = 'osm:node/991:Point' and published),0,'unclassified revision never becomes public parking');
select is(jsonb_array_length(public.export_discovery_publication_ledger('a3100000-0000-4000-8000-000000000001')->'events'),6,'unsupported classification does not append a successful approval');
update reviewer_fixture set package_text = jsonb_set(package_text::jsonb,'{candidateText}',
  to_jsonb(parkey_private.canonical_review_json(jsonb_set(jsonb_set((package_text::jsonb->>'candidateText')::jsonb,'{type}','"lot"'::jsonb),'{accessClass}','"members"'::jsonb))))::text;
update reviewer_fixture set package_text = jsonb_set(package_text::jsonb,'{recordHash}',
  to_jsonb(encode(digest(package_text::jsonb->>'candidateText','sha256'),'hex')))::text;
update reviewer_fixture set package_hash=encode(digest(package_text,'sha256'),'hex'),record_hash=package_text::jsonb->>'recordHash';
select lives_ok($$select public.import_discovery_evidence('a3100000-0000-4000-8000-000000000001',package_text,package_hash) from reviewer_fixture$$,'members-access observation remains valid private evidence');
select throws_like($$select pg_temp.review_decide('approve_publication')$$,'%Mapped source access is restricted or unsupported%','future A approval cannot publish members access even with public-visitor human fields');
update reviewer_fixture set package_text = jsonb_set(package_text::jsonb,'{candidateText}',
  to_jsonb(parkey_private.canonical_review_json(jsonb_set((package_text::jsonb->>'candidateText')::jsonb,'{accessClass}','"unrecognized_access"'::jsonb))))::text;
update reviewer_fixture set package_text = jsonb_set(package_text::jsonb,'{recordHash}',
  to_jsonb(encode(digest(package_text::jsonb->>'candidateText','sha256'),'hex')))::text;
update reviewer_fixture set package_hash=encode(digest(package_text,'sha256'),'hex'),record_hash=package_text::jsonb->>'recordHash';
select lives_ok($$select public.import_discovery_evidence('a3100000-0000-4000-8000-000000000001',package_text,package_hash) from reviewer_fixture$$,'unsupported explicit source access remains valid private evidence');
select throws_like($$select pg_temp.review_decide('approve_publication')$$,'%Mapped source access is restricted or unsupported%','future A approval cannot publish an unrecognized explicit source access value');
select lives_ok($$select pg_temp.review_decide('reject',patch := '{"outcome":"rejected"}')$$,'unsupported source access can still be explicitly rejected');
select lives_ok($$select pg_temp.review_decide('revoke_publication')$$,'unsupported source access can still be explicitly revoked');
select is((select count(*)::integer from public.discovery_parking where source_observation_id='osm:node/991:Point' and published),0,'rejected source access never leaves a public row after atomic guard failure');
update reviewer_fixture set package_text=jsonb_set(package_text::jsonb,'{candidateText}',to_jsonb(parkey_private.canonical_review_json(
  (package_text::jsonb->>'candidateText')::jsonb || '{"accessClass":"unknown","sourceTags":{"access":"members"}}'::jsonb)))::text;
update reviewer_fixture set package_text=jsonb_set(package_text::jsonb,'{recordHash}',to_jsonb(encode(digest(package_text::jsonb->>'candidateText','sha256'),'hex')))::text;
update reviewer_fixture set package_hash=encode(digest(package_text,'sha256'),'hex'),record_hash=package_text::jsonb->>'recordHash';
select lives_ok($$select public.import_discovery_evidence('a3100000-0000-4000-8000-000000000001',package_text,package_hash) from reviewer_fixture$$,'raw members tag remains preserved as private evidence despite normalized unknown access');
select throws_like($$select pg_temp.review_decide('approve_publication')$$,'%Mapped source access is restricted or unsupported%','normalized unknown access cannot mask original members tag in future A approval');
update reviewer_fixture set package_text=jsonb_set(package_text::jsonb,'{candidateText}',to_jsonb(parkey_private.canonical_review_json(
  (package_text::jsonb->>'candidateText')::jsonb || '{"accessClass":"unknown","sourceTags":{"access":"unrecognized_access"}}'::jsonb)))::text;
update reviewer_fixture set package_text=jsonb_set(package_text::jsonb,'{recordHash}',to_jsonb(encode(digest(package_text::jsonb->>'candidateText','sha256'),'hex')))::text;
update reviewer_fixture set package_hash=encode(digest(package_text,'sha256'),'hex'),record_hash=package_text::jsonb->>'recordHash';
select lives_ok($$select public.import_discovery_evidence('a3100000-0000-4000-8000-000000000001',package_text,package_hash) from reviewer_fixture$$,'unsupported raw access tag remains valid private evidence');
select throws_like($$select pg_temp.review_decide('approve_publication')$$,'%Mapped source access is restricted or unsupported%','normalized unknown access cannot mask an unrecognized original access tag');
update reviewer_fixture set package_text=jsonb_set(package_text::jsonb,'{candidateText}',to_jsonb(parkey_private.canonical_review_json(
  (package_text::jsonb->>'candidateText')::jsonb || '{"accessClass":"unknown","sourceTags":{"access":"yes","parking:access":"members"}}'::jsonb)))::text;
update reviewer_fixture set package_text=jsonb_set(package_text::jsonb,'{recordHash}',to_jsonb(encode(digest(package_text::jsonb->>'candidateText','sha256'),'hex')))::text;
update reviewer_fixture set package_hash=encode(digest(package_text,'sha256'),'hex'),record_hash=package_text::jsonb->>'recordHash';
select lives_ok($$select public.import_discovery_evidence('a3100000-0000-4000-8000-000000000001',package_text,package_hash) from reviewer_fixture$$,'conflicting raw parking access remains preserved as private evidence');
select throws_like($$select pg_temp.review_decide('approve_publication')$$,'%Mapped source access is restricted or unsupported%','unknown normalized access and raw yes cannot mask parking:access members');
delete from parkey_private.discovery_reviewers where user_id = 'a3100000-0000-4000-8000-000000000001';
select throws_like($$select pg_temp.review_decide('approve_publication')$$,'%Reviewer access required%','removed reviewer cannot reuse old access');

select * from finish();
rollback;
