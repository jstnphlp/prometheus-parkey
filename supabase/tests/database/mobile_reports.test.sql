begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select ok(not has_function_privilege('anon','public.mobile_report_action(uuid,text,text,jsonb)','execute'),'anonymous cannot call private report writes');
select ok(not has_function_privilege('authenticated','public.mobile_report_action(uuid,text,text,jsonb)','execute'),'user sessions cannot bypass trusted verification');
select ok(has_function_privilege('service_role','public.mobile_report_action(uuid,text,text,jsonb)','execute'),'trusted endpoint can write private reports');
select ok(not has_function_privilege('authenticated','public.consume_mobile_report_attempt(uuid)','execute'),'clients cannot call quota RPC');
select ok(not has_function_privilege('anon','public.cleanup_mobile_reports()','execute'),'clients cannot invoke retention cleanup');
select ok(not has_table_privilege('authenticated','parkey_private.mobile_report_receipts','select'),'delivery receipts cannot be listed directly');
select ok(not has_table_privilege('anon','parkey_private.mobile_report_request_limits','select'),'quota identities are private');
select ok((select relrowsecurity from pg_class where oid = 'parkey_private.mobile_report_receipts'::regclass),'receipts have RLS');

insert into auth.users(id,email,email_confirmed_at) values
 ('e6100000-0000-4000-8000-000000000001','synthetic-one@example.org',now()-interval '1 day'),
 ('e6100000-0000-4000-8000-000000000002','synthetic-unverified@example.org',null),
 ('e6100000-0000-4000-8000-000000000003','synthetic-two@example.org',now()-interval '1 day'),
 ('e6100000-0000-4000-8000-000000000004','synthetic-reviewer@example.org',now()-interval '1 day');
insert into parkey_private.discovery_reviewers(user_id,can_publish) values ('e6100000-0000-4000-8000-000000000004',false);
create temporary table report_fixture as select jsonb_build_object(
 'intent','add','target',null,'name','Synthetic mobile report','kind','lot','side','unknown',
 'geometry',jsonb_build_object('type','Point','coordinates',jsonb_build_array(121.03,14.56)),
 'restrictions',null,'hours',null,'fees',null,'observed_at',now()-interval '1 day') as payload;

select throws_like($$select public.mobile_report_action('e6100000-0000-4000-8000-000000000002','status','tap-one')$$,'%Verified email required%','unverified identities cannot act');
select throws_like($$select public.consume_mobile_report_attempt('e6100000-0000-4000-8000-000000000002')$$,'%Verified email required%','unverified identities cannot consume a submission capability');
create temporary table report_receipt as select public.mobile_report_action('e6100000-0000-4000-8000-000000000001','submit','tap-one',(select payload from report_fixture)) as receipt;
select is((select receipt->>'state' from report_receipt),'received','submission acknowledges private receipt');
select is((select count(*)::int from parkey_private.community_reports where name = 'Synthetic mobile report'),1,'one report exists');
select is(public.mobile_report_action('e6100000-0000-4000-8000-000000000001','submit','tap-one',(select payload from report_fixture)),(select receipt from report_receipt),'a successful retry is idempotent');
select throws_like($$select public.mobile_report_action('e6100000-0000-4000-8000-000000000001','submit','tap-one',(select payload || '{"name":"Changed name"}'::jsonb from report_fixture))$$,'%Idempotency conflict%','changed content never overwrites an existing report');
select is(public.mobile_report_action('e6100000-0000-4000-8000-000000000003','status','tap-one')->>'state','not_sent','another account cannot see the receipt');
select throws_like($$select public.mobile_report_action('e6100000-0000-4000-8000-000000000003','withdraw','tap-one')$$,'%Report unavailable%','another account cannot withdraw it');
select ok(exists(select 1 from jsonb_array_elements(public.moderate_discovery('e6100000-0000-4000-8000-000000000004','list')->'reports') r where r->>'name' = 'Synthetic mobile report'),'existing Console moderation queue includes the private report');
select throws_like($$select public.moderate_discovery('e6100000-0000-4000-8000-000000000001','list')$$,'%Reviewer access required%','submitting never appoints a reviewer');
select is((select count(*)::int from public.discovery_parking where name = 'Synthetic mobile report'),0,'submission does not publish');

select lives_ok($$select public.consume_mobile_report_attempt('e6100000-0000-4000-8000-000000000003')$$,'attempt consumption succeeds independently');
select throws_like($$select public.mobile_report_action('e6100000-0000-4000-8000-000000000003','submit','bad-fields',(select payload || '{"photo_path":"private-path"}'::jsonb from report_fixture))$$,'%Invalid report%','client cannot choose storage or authority fields');
select is((select requests from parkey_private.mobile_report_request_limits where actor = 'e6100000-0000-4000-8000-000000000003'),1,'a failed report does not refund the separate attempt quota');
select throws_like($$select public.mobile_report_action('e6100000-0000-4000-8000-000000000003','submit','future-date',(select payload || jsonb_build_object('observed_at',now()+interval '1 day') from report_fixture))$$,'%Observation must be within%','future observation rejected');
select throws_like($$select public.mobile_report_action('e6100000-0000-4000-8000-000000000003','submit','stale-date',(select payload || jsonb_build_object('observed_at',now()-interval '91 days') from report_fixture))$$,'%Observation must be within%','expired observations cannot resurrect old idempotency keys');

create temporary table street_report_fixture as select payload || jsonb_build_object(
 'intent','correction','target','osm:way/123','name','Synthetic source street correction','kind','street','restrictions','Synthetic correction',
 'geometry',jsonb_build_object('type','LineString','coordinates',(select jsonb_agg(jsonb_build_array(121.03+n*0.00001,14.56) order by n) from generate_series(0,12) n))) as payload from report_fixture;
select lives_ok($$select public.mobile_report_action('e6100000-0000-4000-8000-000000000003','submit','source-street',(select payload from street_report_fixture))$$,'valid source corrections can retain more than twelve coordinates');
select is((select extensions.st_npoints(geometry) from parkey_private.community_reports where name = 'Synthetic source street correction'),13,'source correction geometry is not silently simplified');
select is((select external_target_url from parkey_private.community_reports where name = 'Synthetic source street correction'),'https://www.openstreetmap.org/way/123','OSM correction preserves its canonical source identity');
select throws_like($$select public.mobile_report_action('e6100000-0000-4000-8000-000000000003','submit','too-many-added-points',(select payload || '{"intent":"add","target":null}'::jsonb from street_report_fixture))$$,'%Invalid geometry%','new editor additions retain the twelve-coordinate bound');

select is(public.mobile_report_action('e6100000-0000-4000-8000-000000000001','withdraw','tap-one')->>'state','withdrawn','owner can withdraw a private report');
select is((select count(*)::int from parkey_private.community_reports where name = 'Synthetic mobile report'),0,'withdrawal removes report contents');
select throws_like($$select public.mobile_report_action('e6100000-0000-4000-8000-000000000001','submit','tap-one',(select payload from report_fixture))$$,'%Idempotency conflict%','withdrawn key cannot silently resubmit');
do $$ begin
  for n in 2..5 loop
    perform public.mobile_report_action('e6100000-0000-4000-8000-000000000001','submit','tap-'||n,(select payload from report_fixture));
  end loop;
end $$;
select throws_like($$select public.mobile_report_action('e6100000-0000-4000-8000-000000000001','submit','over-quota',(select payload from report_fixture))$$,'%Report limit%','withdrawal does not refund hourly quota');
select lives_ok($$select public.mobile_report_action('e6100000-0000-4000-8000-000000000001','submit','tap-2',(select payload from report_fixture))$$,'same-payload retry works after new-report quota is full');

do $$ begin
  for n in 2..30 loop perform public.consume_mobile_report_attempt('e6100000-0000-4000-8000-000000000003'); end loop;
end $$;
select throws_like($$select public.consume_mobile_report_attempt('e6100000-0000-4000-8000-000000000003')$$,'%Request limit%','durable per-minute attempt limit is enforced');

update parkey_private.mobile_report_receipts set created_at = now()-interval '91 days' where client_key = 'tap-2';
select lives_ok($$select public.cleanup_mobile_reports()$$,'retention cleanup runs');
select is((select count(*)::int from parkey_private.mobile_report_receipts where client_key = 'tap-2'),0,'old receipts are removed');
select is((select count(*)::int from parkey_private.community_reports where name = 'Synthetic mobile report'),3,'retention removes the old private payload and retains current ones');
delete from auth.users where id = 'e6100000-0000-4000-8000-000000000001';
select is((select count(*)::int from parkey_private.community_reports where name = 'Synthetic mobile report'),0,'Auth deletion cannot orphan private report contents');
select is((select count(*)::int from parkey_private.mobile_report_receipts where actor = 'e6100000-0000-4000-8000-000000000001'),0,'Auth deletion also removes receipts');

select * from finish();
rollback;
