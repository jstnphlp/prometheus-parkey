-- Additive only: no existing records, policies or seeds are changed.
begin;
create table parkey_private.discovery_publication_approvals (
  parking_id uuid primary key references public.discovery_parking(id) on delete restrict,
  fingerprint text not null,
  reviewer_id uuid not null references auth.users(id) on delete restrict,
  physical_evidence text not null check (physical_evidence ~ '^https://[^[:space:]]+$'),
  license_evidence text not null check (license_evidence ~ '^https://[^[:space:]]+$'),
  access_evidence text not null check (access_evidence ~ '^https://[^[:space:]]+$'),
  deduplication_evidence text not null check (deduplication_evidence ~ '^https://[^[:space:]]+$'),
  approved_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '90 days',
  check (isfinite(approved_at) and isfinite(expires_at) and expires_at > approved_at)
);
alter table parkey_private.discovery_publication_approvals enable row level security;
revoke all on parkey_private.discovery_publication_approvals from public, anon, authenticated, service_role;

-- Includes all parking facts, parent attribution and every rule/attribution.
-- Publication bit is excluded so approval can precede visibility.
create function parkey_private.discovery_fingerprint(parking uuid)
returns text language sql stable security definer set search_path = '' as $$
  select encode(sha256(convert_to(jsonb_build_object(
    'parking', to_jsonb(p) - 'published', 'source', to_jsonb(s),
    'rules', coalesce((select jsonb_agg(jsonb_build_object('rule', to_jsonb(r), 'source', to_jsonb(rs)) order by r.id)
      from public.discovery_regulations r join public.discovery_sources rs on rs.id = r.source_id
      where r.parking_id = p.id), '[]'::jsonb)
  )::text, 'UTF8')), 'hex')
  from public.discovery_parking p join public.discovery_sources s on s.id = p.source_id where p.id = parking;
$$;
revoke all on function parkey_private.discovery_fingerprint(uuid) from public, anon, authenticated, service_role;

-- Boolean only; private evidence and reviewer identity never leave the database.
create function public.has_discovery_approval(parking uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from parkey_private.discovery_publication_approvals a
    join public.discovery_parking p on p.id = a.parking_id
    where a.parking_id = parking and a.expires_at > now()
      and p.published and p.verification = 'verified' and p.verified_at <= now()
      and a.fingerprint = parkey_private.discovery_fingerprint(parking));
$$;
revoke all on function public.has_discovery_approval(uuid) from public, anon, authenticated;
grant execute on function public.has_discovery_approval(uuid) to anon, authenticated;
commit;
