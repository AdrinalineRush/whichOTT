-- WhichOTT · search history log
-- Records what was searched, what matched, and HOW the answer was produced
-- (verified data, a fresh cache hit, a live TMDB refetch, or manual-only),
-- plus whether the YouTube key-pool enrichment found anything and which
-- provider answered. Same lockdown as the other admin tables: RLS enabled,
-- zero policies — only the server's service_role key can touch this.

create table if not exists public.search_log (
  id               uuid primary key default gen_random_uuid(),
  query            text not null,
  matched_title    text,
  matched_year     int,
  tmdb_id          int,
  data_source      text, -- 'verified' | 'cache_hit' | 'live_fetch' | 'manual'
  result_count     int not null default 0,
  youtube_found    boolean not null default false,
  youtube_provider text, -- 'gemini' | 'openai' | null
  ip               text,
  created_at       timestamptz not null default now()
);

create index if not exists search_log_created_at
  on public.search_log (created_at desc);

alter table public.search_log enable row level security;
-- No policies on purpose — server-only access.
