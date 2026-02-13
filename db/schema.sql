-- PostgreSQL Schema für tierpolitik-vorstoesse-db
-- Additiv zur bestehenden JSON-Pipeline (kein Breaking Change)

create extension if not exists pgcrypto;

create table if not exists sources (
  id text primary key,
  label text not null,
  type text not null check (type in ('rss', 'html', 'api', 'user')),
  adapter text,
  url text not null,
  enabled boolean not null default true,
  fallback_path text,
  options jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists motions (
  id uuid primary key default gen_random_uuid(),
  source_id text not null references sources(id) on update cascade,
  external_id text not null,
  source_url text not null,
  language text not null default 'de' check (language in ('de', 'fr', 'it', 'en')),
  published_at timestamptz,
  fetched_at timestamptz not null,
  score numeric(5,4) not null default 0,
  matched_keywords jsonb not null default '[]'::jsonb,
  status text not null default 'new' check (status in ('new', 'queued', 'approved', 'rejected', 'published')),
  review_reason text not null default '',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id, external_id)
);

create index if not exists idx_motions_status on motions(status);
create index if not exists idx_motions_published_at on motions(published_at desc);

create table if not exists motion_versions (
  id uuid primary key default gen_random_uuid(),
  motion_id uuid not null references motions(id) on delete cascade,
  title text not null,
  summary text not null default '',
  body text not null default '',
  content_hash text not null,
  version_no integer not null,
  created_at timestamptz not null default now(),
  unique (motion_id, content_hash),
  unique (motion_id, version_no)
);

create index if not exists idx_motion_versions_motion on motion_versions(motion_id, created_at desc);

create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  motion_id uuid not null references motions(id) on delete cascade,
  status text not null check (status in ('approved', 'rejected', 'queued')),
  reason text not null default '',
  reviewer text not null default 'system',
  decided_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_reviews_motion on reviews(motion_id, decided_at desc);

create table if not exists submissions (
  id text primary key,
  title text not null,
  url text not null,
  summary text not null default '',
  created_at timestamptz not null,
  processed boolean not null default false,
  imported_motion_id uuid references motions(id) on delete set null,
  created_source text not null default 'user-input',
  meta jsonb not null default '{}'::jsonb
);

create table if not exists migration_runs (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
