-- Politics Monitor MVP v1
-- Safe additive migration: creates isolated schema + tables only.

create schema if not exists politics_monitor;

create table if not exists politics_monitor.pm_sources (
  id bigserial primary key,
  source_key text not null unique,
  name text not null,
  level text not null check (level in ('bund','kanton','gemeinde')),
  country text not null default 'CH',
  canton text,
  parser_type text not null check (parser_type in ('export_csv','export_xlsx','api_json','html_list','playwright_dynamic')),
  base_url text not null,
  list_url text,
  is_active boolean not null default true,
  run_interval_minutes integer not null default 1440,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pm_sources_active on politics_monitor.pm_sources (is_active);

create table if not exists politics_monitor.pm_runs (
  id bigserial primary key,
  source_id bigint references politics_monitor.pm_sources(id) on delete set null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running','ok','warn','error')),
  items_fetched integer not null default 0,
  items_inserted integer not null default 0,
  items_updated integer not null default 0,
  items_failed integer not null default 0,
  error_message text,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists idx_pm_runs_source_started on politics_monitor.pm_runs (source_id, started_at desc);

create table if not exists politics_monitor.pm_items_raw (
  id bigserial primary key,
  run_id bigint references politics_monitor.pm_runs(id) on delete cascade,
  source_id bigint not null references politics_monitor.pm_sources(id) on delete cascade,
  external_id text not null,
  fetched_at timestamptz not null default now(),
  raw_payload jsonb not null,
  raw_hash text,
  unique (source_id, external_id, fetched_at)
);

create index if not exists idx_pm_items_raw_source_ext on politics_monitor.pm_items_raw (source_id, external_id);

create table if not exists politics_monitor.pm_items (
  id bigserial primary key,
  source_id bigint not null references politics_monitor.pm_sources(id) on delete cascade,
  external_id text not null,
  title text not null,
  body text,
  item_type text,
  status text,
  submitted_at date,
  published_at date,
  party text,
  persons text[],
  canton text,
  municipality text,
  language text default 'de',
  source_url text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id, external_id)
);

create index if not exists idx_pm_items_submitted_at on politics_monitor.pm_items (submitted_at desc);
create index if not exists idx_pm_items_status on politics_monitor.pm_items (status);
create index if not exists idx_pm_items_type on politics_monitor.pm_items (item_type);

create table if not exists politics_monitor.pm_classification (
  id bigserial primary key,
  item_id bigint not null unique references politics_monitor.pm_items(id) on delete cascade,
  is_animal_related boolean,
  label text not null default 'unsure' check (label in ('yes','no','unsure')),
  confidence numeric(4,3),
  reason text,
  classifier text not null default 'rules_v1',
  classified_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pm_classification_label on politics_monitor.pm_classification (label);

-- optional trigger-free updated_at handling can be done in app layer for now.
