-- Individually imported, private inspection evidence. No archive migration,
-- public upload endpoint, reviewer bootstrap, or automatic approval.
begin;

alter table public.discovery_parking
  add column source_observation_id text,
  add column official_name text check (official_name is null or length(btrim(official_name)) between 1 and 200),
  add column descriptive_label text check (descriptive_label is null or length(btrim(descriptive_label)) between 1 and 200),
  add column review_expires_at timestamptz check (review_expires_at is null or isfinite(review_expires_at)),
  add column navigation_approval jsonb,
  add constraint discovery_reviewed_identity check (source_observation_id is null or (
    source_record_id = source_observation_id and review_expires_at is not null
    and num_nonnulls(official_name, descriptive_label) = 1
  ));

-- Restrictive policy composes with the existing published-only policy. Existing
-- legacy rows are unchanged; every record imported by this workflow expires.
create policy discovery_review_expiry on public.discovery_parking as restrictive
  for select to anon, authenticated using (
    source_observation_id is null or review_expires_at > now()
  );

create table parkey_private.discovery_evidence_packages (
  import_sequence bigint generated always as identity primary key,
  package_hash text not null unique check (package_hash ~ '^[a-f0-9]{64}$'),
  package_text text not null,
  candidate_id text not null,
  record_hash text not null check (record_hash ~ '^[a-f0-9]{64}$'),
  imported_by uuid not null references auth.users(id) on delete restrict,
  imported_at timestamptz not null default now()
);
create index discovery_evidence_candidate_idx on parkey_private.discovery_evidence_packages(candidate_id, import_sequence desc);
create table parkey_private.discovery_evidence_targets (
  candidate_id text primary key,
  parking_id uuid not null unique references public.discovery_parking(id) on delete restrict
);
create table parkey_private.discovery_evidence_decisions (
  sequence bigint primary key,
  event_hash text not null unique check (event_hash ~ '^[a-f0-9]{64}$'),
  package_hash text not null references parkey_private.discovery_evidence_packages(package_hash) on delete restrict,
  event_text text not null,
  reviewer_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
alter table parkey_private.discovery_evidence_packages enable row level security;
alter table parkey_private.discovery_evidence_targets enable row level security;
alter table parkey_private.discovery_evidence_decisions enable row level security;
revoke all on parkey_private.discovery_evidence_packages, parkey_private.discovery_evidence_targets,
  parkey_private.discovery_evidence_decisions from public, anon, authenticated, service_role;
revoke all on sequence parkey_private.discovery_evidence_packages_import_sequence_seq from public, anon, authenticated, service_role;

create function parkey_private.reject_evidence_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'Evidence and reviewer decisions are append-only'; end;
$$;
revoke all on function parkey_private.reject_evidence_mutation() from public, anon, authenticated, service_role;
create trigger immutable_discovery_evidence before update or delete on parkey_private.discovery_evidence_packages
  for each row execute function parkey_private.reject_evidence_mutation();
create trigger immutable_discovery_decisions before update or delete on parkey_private.discovery_evidence_decisions
  for each row execute function parkey_private.reject_evidence_mutation();

create function parkey_private.evidence_references(value jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(jsonb_typeof(value) = 'array' and jsonb_array_length(value) > 0
    and not exists (select 1 from jsonb_array_elements(value) item where
      jsonb_typeof(item) <> 'string' or length(btrim(item #>> '{}')) not between 1 and 1000), false);
$$;
revoke all on function parkey_private.evidence_references(jsonb) from public, anon, authenticated, service_role;

create function parkey_private.evidence_point(value jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(value) = 'array' and jsonb_array_length(value) = 2
      and jsonb_typeof(value->0) = 'number' and jsonb_typeof(value->1) = 'number'
    then (value->>0)::numeric between -180 and 180 and (value->>1)::numeric between -85.051129 and 85.051129
    else false end;
$$;
revoke all on function parkey_private.evidence_point(jsonb) from public, anon, authenticated, service_role;

alter table public.discovery_parking add constraint discovery_navigation_authority check (
  navigation_approval is null or coalesce((
    source_observation_id is not null and jsonb_typeof(navigation_approval) = 'object'
    and navigation_approval->'entranceConfirmed' = 'true'::jsonb
    and navigation_approval->'visitorAccessConfirmed' = 'true'::jsonb
    and navigation_approval->'operatorAuthorized' = 'true'::jsonb
    and parkey_private.evidence_point(navigation_approval->'entrance')
    and navigation_approval->'entrance' = entrances->0
    and navigation_approval->>'expiresAt' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$'
    and (navigation_approval->>'expiresAt')::timestamptz = review_expires_at
  ), false)
);

create function parkey_private.preserve_reviewed_source_identity()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.source_observation_id is not null and
    (new.source_id,new.source_record_id,new.source_observation_id,new.source_url)
      is distinct from (old.source_id,old.source_record_id,old.source_observation_id,old.source_url) then
    raise exception 'Original reviewed parking source identity is immutable';
  end if;
  return new;
end;
$$;
revoke all on function parkey_private.preserve_reviewed_source_identity() from public, anon, authenticated, service_role;
create trigger preserve_reviewed_source_identity before update on public.discovery_parking
  for each row execute function parkey_private.preserve_reviewed_source_identity();

-- Same trust boundary as moderate_discovery: only the credential-bearing
-- controlled operator/server may call; it must establish the human's identity.
-- Clients cannot nominate themselves or appoint a reviewer. The private role
-- registry is checked on every call, including approval and revocation.
create function public.import_discovery_evidence(reviewer uuid, package_text text, package_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  evidence jsonb;
  candidate jsonb;
  submission jsonb;
  imported parkey_private.discovery_evidence_packages%rowtype;
begin
  if not exists (select 1 from parkey_private.discovery_reviewers where user_id = reviewer) then
    raise insufficient_privilege using message = 'Reviewer access required';
  end if;
  perform pg_advisory_xact_lock(514527304);
  if octet_length(package_text) > 12582912 or package_hash is null
    or encode(extensions.digest(package_text, 'sha256'), 'hex') is distinct from package_hash then
    raise invalid_parameter_value using message = 'Evidence package hash mismatch';
  end if;
  evidence := package_text::jsonb;
  candidate := (evidence->>'candidateText')::jsonb;
  submission := (evidence->>'submissionText')::jsonb;
  if evidence->>'schemaVersion' is distinct from '1'
    or jsonb_typeof(candidate->'id') is distinct from 'string'
    or length(btrim(candidate->>'id')) not between 1 and 200
    or candidate->>'id' is null
    or encode(extensions.digest(evidence->>'candidateText', 'sha256'), 'hex') is distinct from evidence->>'recordHash'
    or encode(extensions.digest(evidence->>'submissionText', 'sha256'), 'hex') is distinct from evidence->>'submissionHash'
    or submission->>'candidateId' is distinct from candidate->>'id'
    or submission->>'status' is distinct from 'submitted_unreviewed'
    or submission->'sourceHashes' is distinct from evidence->'sourceHashes'
    or submission->>'attestedOnSite' is distinct from 'true'
    or submission->>'privacyReviewed' is distinct from 'true'
    or (submission->>'observedAt')::timestamptz > now()
    or (submission->>'observedAt')::timestamptz < (evidence->>'sourceAsOf')::timestamptz
    or evidence->>'sourceAsOf' is null
    or not isfinite((submission->>'observedAt')::timestamptz)
    or submission->>'observedAt' is null
    or evidence->'reviewSubmissionEvent'->>'action' is distinct from 'record_field_submission'
    or evidence->'reviewSubmissionEvent'->>'payloadHash' is distinct from evidence->>'submissionHash'
    or not exists (select 1 from jsonb_array_elements(evidence->'reviewIssues') issue
      where issue->>'id' = evidence->'reviewSubmissionEvent'->>'issueId'
        and issue->'candidateIds' ? (candidate->>'id')) then
    raise invalid_parameter_value using message = 'Original source identity and reconciled observation required';
  end if;
  select * into imported from parkey_private.discovery_evidence_packages p where p.package_hash = import_discovery_evidence.package_hash;
  if found then
    if imported.package_text is distinct from package_text then raise invalid_parameter_value using message = 'Conflicting archive bytes'; end if;
    return jsonb_build_object('packageHash', package_hash, 'status', 'imported_unreviewed', 'publicationApproved', false);
  end if;
  insert into parkey_private.discovery_evidence_packages(package_hash,package_text,candidate_id,record_hash,imported_by)
    values (package_hash,package_text,candidate->>'id',evidence->>'recordHash',reviewer);
  -- A newly imported revision invalidates stale approval without rewriting the
  -- previous source archive or its human decision history.
  update public.discovery_parking set published = false where id in (
    select parking_id from parkey_private.discovery_evidence_targets where candidate_id = candidate->>'id'
  );
  return jsonb_build_object('packageHash', package_hash, 'status', 'imported_unreviewed', 'publicationApproved', false);
end;
$$;
revoke all on function public.import_discovery_evidence(uuid,text,text) from public, anon, authenticated;
grant execute on function public.import_discovery_evidence(uuid,text,text) to service_role;

create function public.decide_discovery_evidence(reviewer uuid, package_hash text, event_text text, event_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  publisher boolean;
  imported parkey_private.discovery_evidence_packages%rowtype;
  evidence jsonb;
  candidate jsonb;
  submission jsonb;
  event jsonb;
  decisions jsonb;
  previous_event parkey_private.discovery_evidence_decisions%rowtype;
  parking uuid;
  source uuid;
  label text;
  due timestamptz;
  point jsonb;
begin
  select can_publish into publisher from parkey_private.discovery_reviewers where user_id = reviewer;
  if not found then raise insufficient_privilege using message = 'Reviewer access required'; end if;
  -- Serialize the global original-format publication chain before reading head.
  perform pg_advisory_xact_lock(514527304);
  select * into imported from parkey_private.discovery_evidence_packages p where p.package_hash = decide_discovery_evidence.package_hash;
  if not found then raise no_data_found using message = 'Import the private evidence package first'; end if;
  if event_hash is null or encode(extensions.digest(event_text, 'sha256'), 'hex') is distinct from event_hash then
    raise invalid_parameter_value using message = 'Publication event hash mismatch';
  end if;
  evidence := imported.package_text::jsonb;
  candidate := (evidence->>'candidateText')::jsonb;
  submission := (evidence->>'submissionText')::jsonb;
  event := event_text::jsonb;
  decisions := event->'reviewDecisions';
  select * into previous_event from parkey_private.discovery_evidence_decisions order by sequence desc limit 1;
  if event->>'actorId' is distinct from reviewer::text
    or jsonb_typeof(event->'sequence') is distinct from 'number'
    or jsonb_typeof(event->'eventId') is distinct from 'string'
    or jsonb_typeof(event->'reason') is distinct from 'string'
    or event->>'actorKind' is distinct from 'human_reviewer'
    or event->>'recordId' is distinct from imported.candidate_id
    or (event->>'sequence')::bigint is distinct from coalesce(previous_event.sequence,0) + 1
    or event->>'previousHash' is distinct from previous_event.event_hash
    or length(btrim(event->>'eventId')) not between 1 and 200
    or event->>'eventId' is null
    or exists (select 1 from parkey_private.discovery_evidence_decisions d where d.event_text::jsonb->>'eventId' = event->>'eventId')
    or event->>'recordedAt' is null
    or event->>'recordedAt' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$'
    or to_char((event->>'recordedAt')::timestamptz at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') is distinct from event->>'recordedAt'
    or not isfinite((event->>'recordedAt')::timestamptz)
    or (event->>'recordedAt')::timestamptz > now()
    or (event->>'recordedAt')::timestamptz < (previous_event.event_text::jsonb->>'recordedAt')::timestamptz
    or length(btrim(event->>'reason')) not between 3 and 2000
    or event->>'reason' is null
    or not parkey_private.evidence_references(event->'evidenceReferences')
    or not (event->'evidenceReferences' ? ('internal:field-submission/' || (evidence->>'submissionHash')))
    or event ?| array['evidenceKind','observedAt','facts'] then
    raise invalid_parameter_value using message = 'Invalid or stale accountable publication audit event';
  end if;
  select parking_id into parking from parkey_private.discovery_evidence_targets where candidate_id = imported.candidate_id;
  if event->>'action' = 'approve_publication' then
    if not publisher then raise insufficient_privilege using message = 'Publisher access required'; end if;
    if exists (select 1 from parkey_private.discovery_evidence_packages p where p.candidate_id = imported.candidate_id and p.import_sequence > imported.import_sequence) then
      raise invalid_parameter_value using message = 'New source revision requires review';
    end if;
    due := (event->>'reviewDueAt')::timestamptz;
    if event->>'recordHash' is distinct from imported.record_hash
      or event->>'scope' is distinct from 'unverified_discovery'
      or event->'licenseApproved' is distinct from 'true'::jsonb
      or event->'accessApproved' is distinct from 'true'::jsonb
      or event->'safetyApproved' is distinct from 'true'::jsonb
      or event->>'accessDecision' is distinct from 'public_visitor_access'
      or not (event->'approvedFields' @> '["name","geometry","source","evidence","access"]'::jsonb)
      or event->'approvedFields' is null
      or jsonb_typeof(event->'approvedFields') is distinct from 'array'
      or event->>'reviewDueAt' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$'
      or to_char(due at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') is distinct from event->>'reviewDueAt'
      or due is null or not isfinite(due) or due <= now()
      or due > (event->>'recordedAt')::timestamptz + interval '90 days'
      or decisions->'identity'->>'decision' is distinct from 'confirmed_original_source'
      or decisions->'access'->>'decision' is distinct from 'public_visitors'
      or decisions->'entrance'->>'decision' is distinct from 'safe_visitor_entrance_confirmed'
      or decisions->'operatorPermission'->>'decision' is distinct from 'confirmed'
      or decisions->'operatorPermission'->>'scope' is distinct from 'unverified_discovery_only'
      or (decisions->'operatorPermission' ? 'visitorNavigationAuthorized'
        and jsonb_typeof(decisions->'operatorPermission'->'visitorNavigationAuthorized') is distinct from 'boolean')
      or decisions->'license'->>'decision' is distinct from 'approved'
      or decisions->'license'->>'scope' is distinct from 'public_discovery_display'
      or length(btrim(decisions->'license'->>'publicAttribution')) not between 1 and 500
      or decisions->'license'->>'publicAttribution' is null
      or not (decisions ?& array['identity','access','entrance','operatorPermission','license','label'])
      or decisions is null
      or exists (select 1 from jsonb_each(decisions) d where not parkey_private.evidence_references(d.value->'evidenceReferences'))
      or decisions->'label'->>'kind' not in ('official_name','descriptive_label')
      or decisions->'label'->>'kind' is null
      or length(btrim(decisions->'label'->>'text')) not between 1 and 200
      or decisions->'label'->>'text' is null
      or submission->'facts'->>'existence' is distinct from 'exists'
      or submission->'facts'->>'access' is distinct from 'public_visitors'
      or submission->'facts'->>'operation' is distinct from 'open_observed'
      or length(btrim(submission->'facts'->>'operatorEvidence')) < 1
      or submission->'facts'->>'operatorEvidence' is null
      or decisions->'entrance'->'coordinates' is distinct from submission->'facts'->'entranceCoordinates'
      or not parkey_private.evidence_point(decisions->'entrance'->'coordinates') then
      raise invalid_parameter_value using message = 'Explicit field, identity, access, safe entrance, operator permission, license, label and expiry decisions required';
    end if;
    if jsonb_typeof(event->'issueResolutions') is distinct from 'array' or exists (
      select 1 from jsonb_array_elements(evidence->'reviewIssues') issue
      where issue->>'blockingPublicDisplay' = 'true' and not exists (
        select 1 from jsonb_array_elements(event->'issueResolutions') resolution
        where resolution->>'issueId' = issue->>'id' and resolution->>'outcome' = 'human_resolved'
          and length(btrim(resolution->>'reason')) > 0 and parkey_private.evidence_references(resolution->'evidenceReferences')
      )
    ) then raise invalid_parameter_value using message = 'Every blocking issue needs an explicit human resolution'; end if;
    -- Preserve research exclusions; new evidence does not rewrite mapped facts.
    if candidate->>'type' not in ('lot','garage','facility_unspecified') or candidate->>'type' is null
      or candidate->>'restrictedAccess' = 'true'
      or candidate->>'accessClass' in ('private','no','permit','residents','military','emergency','delivery','destination','psv','designated','customers')
      or candidate->>'operatingStatus' in ('closed','permanently_closed','temporarily_closed','disused','construction')
      or candidate->'flags' ?| array['mapped_restricted_access','mapped_closed_or_disused','prior_human_exclusion_requires_resolution','invalid_geometry_requires_review','unsafe','prohibited']
      or candidate->>'requiresLicenseReview' = 'true'
      or candidate->>'sourceLicense' is null
      or exists (select 1 from regexp_split_to_table(candidate->>'sourceLicense', ',') license
        where btrim(license) not in ('ODbL-1.0','CDLA-Permissive-2.0','Apache-2.0'))
      or jsonb_typeof(candidate->'sourceProviders') is distinct from 'array'
      or jsonb_array_length(candidate->'sourceProviders') < 1
      or exists (select 1 from jsonb_array_elements(candidate->'sourceProviders') provider
        where provider->>'license' not in ('ODbL-1.0','CDLA-Permissive-2.0','Apache-2.0') or provider->>'license' is null
          or coalesce(length(btrim(provider->>'dataset')),0) = 0 or coalesce(length(btrim(provider->>'record_id')),0) = 0)
      or candidate->>'sourceRecordUrl' !~ '^https://[^[:space:]]+$'
      or candidate->>'sourceRecordUrl' is null then
      raise invalid_parameter_value using message = 'Source safety, access, type or license exclusions block publication';
    end if;
    label := btrim(decisions->'label'->>'text');
    point := candidate->'representativePoint';
    if not parkey_private.evidence_point(point) then
      raise invalid_parameter_value using message = 'Original representative point required';
    end if;
    if parking is not null and exists (
      select 1 from public.discovery_parking p join public.discovery_sources s on s.id = p.source_id
      where p.id = parking and (p.source_url is distinct from candidate->>'sourceRecordUrl'
        or s.license is distinct from candidate->>'sourceLicense')
    ) then raise invalid_parameter_value using message = 'Correction cannot replace original source identity or license'; end if;
    if parking is null then
      insert into public.discovery_sources(kind,label,url,license,attribution)
        values (case when candidate->>'sourceLicense' = 'ODbL-1.0' then 'osm' else 'parkey' end,
          'Individually reviewed source observation', candidate->>'sourceRecordUrl',candidate->>'sourceLicense',
          decisions->'license'->>'publicAttribution')
        returning id into source;
      insert into public.discovery_parking(source_id,source_record_id,source_observation_id,source_url,name,kind,geometry,
        official_name,descriptive_label,review_expires_at,verification,published,entrances,navigation_approval)
        values (source,imported.candidate_id,imported.candidate_id,candidate->>'sourceRecordUrl',label,
          case when candidate->>'type' = 'garage' then 'garage' else 'lot' end,
          extensions.st_setsrid(extensions.st_makepoint((point->>0)::double precision,(point->>1)::double precision),4326),
          case when decisions->'label'->>'kind' = 'official_name' then label end,
          case when decisions->'label'->>'kind' = 'descriptive_label' then label end,
          due,'unverified',true,jsonb_build_array(decisions->'entrance'->'coordinates'),
          case when decisions->'operatorPermission'->'visitorNavigationAuthorized' = 'true'::jsonb then
            jsonb_build_object('entrance',decisions->'entrance'->'coordinates', 'entranceConfirmed',true,
              'visitorAccessConfirmed',true,'operatorAuthorized',true,'expiresAt',event->>'reviewDueAt') end)
        returning id into parking;
      insert into parkey_private.discovery_evidence_targets(candidate_id,parking_id) values (imported.candidate_id,parking);
    else
      -- Correction publishes a reviewed label/expiry revision on the same source
      -- identity; original source bytes and prior decisions remain append-only.
      update public.discovery_parking set name = label,
        geometry = extensions.st_setsrid(extensions.st_makepoint((point->>0)::double precision,(point->>1)::double precision),4326),
        official_name = case when decisions->'label'->>'kind' = 'official_name' then label end,
        descriptive_label = case when decisions->'label'->>'kind' = 'descriptive_label' then label end,
        review_expires_at = due, published = true,
        navigation_approval = case when decisions->'operatorPermission'->'visitorNavigationAuthorized' = 'true'::jsonb then
          jsonb_build_object('entrance',decisions->'entrance'->'coordinates', 'entranceConfirmed',true,
            'visitorAccessConfirmed',true,'operatorAuthorized',true,'expiresAt',event->>'reviewDueAt') end,
        entrances = jsonb_build_array(decisions->'entrance'->'coordinates')
        where id = parking;
    end if;
  elsif event->>'action' in ('reject','revoke_publication') then
    if event->>'action' = 'revoke_publication' and not publisher then raise insufficient_privilege using message = 'Publisher access required'; end if;
    if event->>'action' = 'reject' and (event->>'outcome' is null or event->>'outcome' not in ('rejected','correction_requested')) then
      raise invalid_parameter_value using message = 'Explicit rejection or correction request required';
    end if;
    update public.discovery_parking set published = false where id = parking;
  else raise invalid_parameter_value using message = 'Unsupported reviewer decision'; end if;
  insert into parkey_private.discovery_evidence_decisions(sequence,event_hash,package_hash,event_text,reviewer_id)
    values ((event->>'sequence')::bigint,event_hash,package_hash,event_text,reviewer);
  return jsonb_build_object('parkingId',parking,'publicationEvent',event || jsonb_build_object('eventHash',event_hash));
end;
$$;
revoke all on function public.decide_discovery_evidence(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.decide_discovery_evidence(uuid,text,text,text) to service_role;

create function public.export_discovery_publication_ledger(reviewer uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from parkey_private.discovery_reviewers where user_id = reviewer) then
    raise insufficient_privilege using message = 'Reviewer access required';
  end if;
  return jsonb_build_object('schemaVersion',1,'events',coalesce((select jsonb_agg(
    event_text::jsonb || jsonb_build_object('eventHash',event_hash) order by sequence
  ) from parkey_private.discovery_evidence_decisions),'[]'::jsonb));
end;
$$;
revoke all on function public.export_discovery_publication_ledger(uuid) from public, anon, authenticated;
grant execute on function public.export_discovery_publication_ledger(uuid) to service_role;

-- Preserve the existing response and add an optional, explicitly authorized
-- entrance navigation object. Legacy mapped entrances grant no navigation.
create or replace function public.discover_parking(west double precision, south double precision, east double precision, north double precision)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare result jsonb;
begin
  if west is null or south is null or east is null or north is null
    or not (west >= -180 and east <= 180 and south >= -85.051129 and north <= 85.051129
      and west < east and south < north and east - west <= 0.5 and north - south <= 0.5) then
    raise exception 'Expected a viewport at most 0.5 degrees wide and high, without a dateline crossing' using errcode = '22023';
  end if;
  with candidates as materialized (
    select p.* from public.discovery_parking p
    where p.published and extensions.st_intersects(p.geometry, extensions.st_makeenvelope(west, south, east, north, 4326))
    order by p.id limit 251
  ), limited as (
    select * from candidates order by id limit 250
  )
  select jsonb_build_object(
    'truncated', (select count(*) > 250 from candidates),
    'records', coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id, 'name', p.name, 'kind', p.kind,
      'geometry', extensions.st_asgeojson(p.geometry)::jsonb,
      'osmTags', p.osm_tags, 'osmEditedAt', p.osm_edited_at, 'entrances', p.entrances,
      'navigationApproval', case when p.source_observation_id is not null and p.review_expires_at > now()
        then p.navigation_approval else null end,
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
commit;
