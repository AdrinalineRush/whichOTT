-- WhichOTT · dedicated cache for the LLM "where to watch" web search.
-- This is intentionally separate from titles/availability (TMDB's cache) —
-- the AI result is its own independent source and must not be merged into
-- or read from the TMDB cache. Keyed by title+year since the AI check runs
-- before any TMDB id is resolved.

create table if not exists public.ai_availability_cache (
  id          uuid primary key default gen_random_uuid(),
  cache_key   text unique not null,   -- normalized "title (year)" lookup key
  title       text not null,
  year        integer,
  provider    text not null check (provider in ('gemini','openai')),
  platforms   jsonb not null default '[]'::jsonb,
  poster_url  text,
  synopsis    text,
  created_at  timestamptz not null default now()
);

create index if not exists ai_availability_cache_key
  on public.ai_availability_cache (cache_key);
