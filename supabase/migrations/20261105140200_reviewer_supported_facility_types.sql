-- Preserve original facility classification. Unknown subtypes stay private until
-- a separate reviewed reclassification design exists. No source data is changed.
begin;
create or replace function public.decide_discovery_evidence(reviewer uuid, package_hash text, event_text text, event_hash text)
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
    if candidate->>'type' not in ('lot','garage') or candidate->>'type' is null then
      raise invalid_parameter_value using message = 'Publication requires a supported lot or garage source type; unclassified observations remain private';
    end if;
    if candidate->>'restrictedAccess' = 'true'
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
          candidate->>'type',
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
commit;
