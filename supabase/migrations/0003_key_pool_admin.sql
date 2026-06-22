-- WhichOTT · API key pool + hidden admin panel
-- Lets the app rotate across multiple free-tier LLM API keys (Gemini, OpenAI)
-- so a single quota/rate-limit doesn't take the feature down. Keys and admin
-- sessions are NEVER exposed to the browser — RLS is enabled with ZERO
-- policies on these tables, so anon/authenticated roles get no access at
-- all. Only the server's service_role key (which bypasses RLS) can touch them.

create table if not exists public.api_key_pool (
  id             uuid primary key default gen_random_uuid(),
  provider       text not null check (provider in ('gemini', 'openai')),
  key_value      text not null,
  label          text,
  is_active      boolean not null default true,
  cooldown_until timestamptz,
  last_used_at   timestamptz,
  fail_count     int not null default 0,
  created_at     timestamptz not null default now()
);

create index if not exists api_key_pool_provider_active
  on public.api_key_pool (provider, is_active);

alter table public.api_key_pool enable row level security;
-- No policies on purpose — see header note.

create table if not exists public.admin_sessions (
  token      text primary key,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

alter table public.admin_sessions enable row level security;
-- No policies on purpose — see header note.
