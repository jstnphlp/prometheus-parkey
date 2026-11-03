begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();
select ok(not has_function_privilege('anon', 'public.moderate_discovery(uuid,text,uuid,text,text,text,text,text,integer)', 'execute'), 'anonymous cannot use moderation RPC');
select ok(not has_function_privilege('authenticated', 'public.moderate_discovery(uuid,text,uuid,text,text,text,text,text,integer)', 'execute'), 'authenticated cannot bypass Edge MFA checks');
select ok(has_function_privilege('service_role', 'public.moderate_discovery(uuid,text,uuid,text,text,text,text,text,integer)', 'execute'), 'trusted server may invoke moderation');
select ok(not has_table_privilege('authenticated', 'parkey_private.discovery_reviewers', 'insert'), 'users cannot appoint reviewers');
select ok(not has_table_privilege('anon', 'parkey_private.discovery_review_audit', 'select'), 'review reasons are private');
select throws_like($$select public.moderate_discovery('d3000000-0000-4000-8000-000000000001','list')$$, '%Reviewer access required%', 'unknown reviewer denied');

insert into auth.users(id) values ('d3000000-0000-4000-8000-000000000001'), ('d3000000-0000-4000-8000-000000000002');
insert into parkey_private.discovery_reviewers(user_id,can_publish) values
 ('d3000000-0000-4000-8000-000000000001',true), ('d3000000-0000-4000-8000-000000000002',false);
insert into parkey_private.community_reports(id,intent,name,kind,geometry,observed_at) values
 ('d4000000-0000-4000-8000-000000000001','add','Test new lot','lot',st_point(121.03,14.56,4326),now() - interval '1 day');
select is(jsonb_array_length(public.moderate_discovery('d3000000-0000-4000-8000-000000000001','list')->'reports'), 1, 'reviewer can load the real private queue');
select throws_like($$select public.moderate_discovery('d3000000-0000-4000-8000-000000000001','published','d4000000-0000-4000-8000-000000000001','Reviewed')$$, '%Accept the report%', 'pending report cannot publish');
select lives_ok($$select public.moderate_discovery('d3000000-0000-4000-8000-000000000002','accepted','d4000000-0000-4000-8000-000000000001','Location reviewed')$$, 'reviewer can accept');
select is((select count(*)::int from public.discovery_parking where source_record_id = 'd4000000-0000-4000-8000-000000000001'), 0, 'acceptance does not publish');
select throws_like($$select public.moderate_discovery('d3000000-0000-4000-8000-000000000002','published','d4000000-0000-4000-8000-000000000001','Reviewed')$$, '%Publisher access required%', 'review-only member cannot publish');
select throws_like($$select public.moderate_discovery('d3000000-0000-4000-8000-000000000001','published','d4000000-0000-4000-8000-000000000001','Reviewed')$$, '%Public provenance%', 'publication requires provenance');
select lives_ok($$select public.moderate_discovery('d3000000-0000-4000-8000-000000000001','published','d4000000-0000-4000-8000-000000000001','Reviewed facts and license','https://example.org/source','CC BY 4.0','Test author')$$, 'publisher can explicitly publish accepted addition');
select is((select verification from public.discovery_parking where source_record_id = 'd4000000-0000-4000-8000-000000000001'), 'unverified', 'publication never asserts independent verification');
select is((select count(*)::int from parkey_private.discovery_review_audit where report_id = 'd4000000-0000-4000-8000-000000000001'), 2, 'decision and publication are separately audited');
select throws_like($$select public.moderate_discovery('d3000000-0000-4000-8000-000000000001','published','d4000000-0000-4000-8000-000000000001','Reviewed facts and license','https://example.org/source','CC BY 4.0','Test author')$$, '%already published%', 'replay cannot create duplicate parking');
insert into parkey_private.community_reports(intent,name,kind,geometry)
select 'add', 'Pending test ' || n, 'lot', st_point(121.03,14.56,4326) from generate_series(1,101) n;
insert into parkey_private.community_reports(intent,name,kind,geometry,status,reviewed_at)
select 'add', 'Accepted test ' || n, 'lot', st_point(121.03,14.56,4326), 'accepted', now() from generate_series(1,101) n;
select is(jsonb_array_length(public.moderate_discovery('d3000000-0000-4000-8000-000000000001','list')->'reports'), 100, 'pending queue is bounded and independent of accepted backlog');
select is(public.moderate_discovery('d3000000-0000-4000-8000-000000000001','list')->>'hasMore', 'true', 'queue signals another page');
select is(jsonb_array_length(public.moderate_discovery('d3000000-0000-4000-8000-000000000001','list',null,null,null,null,null,'pending_review',1)->'reports'), 1, 'next page exposes remaining pending reports');
select is(jsonb_array_length(public.moderate_discovery('d3000000-0000-4000-8000-000000000001','list',null,null,null,null,null,'accepted',1)->'reports'), 1, 'publication queue has independent pagination');
select * from finish();
rollback;
