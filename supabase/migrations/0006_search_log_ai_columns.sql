-- WhichOTT · broaden search_log from "YouTube only" to general AI availability search.
-- The key-pool LLM check no longer just checks YouTube — it searches across
-- every platform, so the log needs to record how many it found and which
-- provider answered, not a single YouTube boolean.

alter table public.search_log
  add column if not exists ai_platforms_found int not null default 0,
  add column if not exists ai_provider text;

alter table public.search_log
  drop column if exists youtube_found,
  drop column if exists youtube_provider;
