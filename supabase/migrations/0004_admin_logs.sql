-- WhichOTT · admin audit logs
-- Two append-only logs surfaced in the hidden admin panel: every attempt to
-- log into the panel, and every time a pooled API key gets used (or fails).
-- Same lockdown as the rest of the admin tables: RLS enabled, zero policies
-- — only the server's service_role key can read or write these.

create table if not exists public.admin_login_log (
  id         uuid primary key default gen_random_uuid(),
  success    boolean not null,
  ip         text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists admin_login_log_created_at
  on public.admin_login_log (created_at desc);

alter table public.admin_login_log enable row level security;
-- No policies on purpose — server-only access.

create table if not exists public.key_pool_log (
  id            uuid primary key default gen_random_uuid(),
  key_id        uuid references public.api_key_pool(id) on delete set null,
  provider      text not null,
  key_preview   text,
  outcome       text not null check (outcome in ('success', 'fail', 'cooldown')),
  context       text,
  error_message text,
  created_at    timestamptz not null default now()
);

create index if not exists key_pool_log_created_at
  on public.key_pool_log (created_at desc);

alter table public.key_pool_log enable row level security;
-- No policies on purpose — server-only access.
