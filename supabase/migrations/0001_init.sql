-- WhichOTT · initial schema
-- Strategy: TMDB is the seed/fallback. OUR data (verified) always wins.
-- Lookup order in app:  verified availability  →  cached TMDB  →  live TMDB fetch
--
-- Three tables:
--   titles        = one row per movie/show (our canonical record + TMDB cache)
--   availability  = where to watch, per title per region (the part TMDB gets wrong)
--   user_reports  = "this is wrong / missing" queue that feeds our corrections
--
-- Run this in Supabase: SQL Editor → paste → Run.  Safe to re-run (IF NOT EXISTS).

-- pg_trgm powers fuzzy title search (typo-tolerant "is X on netflix").
create extension if not exists pg_trgm;

-- ─────────────────────────────────────────────────────────────
-- 1. TITLES  (movies & TV shows)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.titles (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,              -- e.g. 'drishyam-2015' (used in URLs / SEO)
  tmdb_id       integer,                           -- TMDB id; null for manual-only entries
  media_type    text not null default 'movie'
                  check (media_type in ('movie','tv')),
  title         text not null,                     -- English/display title
  original_title text,                             -- e.g. जवान / ദൃശ്യം
  language      text,                              -- ISO code: hi, ml, ta, te, kn, en...
  year          integer,                           -- release year (key for disambiguation)
  overview      text,
  poster_path   text,
  backdrop_path text,
  popularity    numeric default 0,                 -- TMDB popularity (used to rank search results)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- a tmdb_id maps to exactly one title. Plain UNIQUE constraint (not a partial
-- index) so upsert/ON CONFLICT (tmdb_id) works. Multiple NULLs are still allowed
-- (Postgres treats NULLs as distinct), so manual-only titles are fine.
alter table public.titles
  add constraint titles_tmdb_id_unique unique (tmdb_id);

-- fast text search on title / original_title
create index if not exists titles_title_trgm
  on public.titles using gin (title gin_trgm_ops);
create index if not exists titles_original_title_trgm
  on public.titles using gin (original_title gin_trgm_ops);

-- ─────────────────────────────────────────────────────────────
-- 2. AVAILABILITY  (where to watch — per title, per region)
-- ─────────────────────────────────────────────────────────────
-- providers is JSON shaped like:
--   { "stream": ["Netflix"], "ads": ["MX Player"], "rent": ["Amazon Video"], "buy": [] }
create table if not exists public.availability (
  id          uuid primary key default gen_random_uuid(),
  title_id    uuid not null references public.titles(id) on delete cascade,
  region      text not null default 'IN',
  providers   jsonb not null default '{}'::jsonb,
  source      text not null default 'tmdb'
                check (source in ('tmdb','manual','user_report')),
  verified    boolean not null default false,      -- true = a human (you) confirmed it; this row wins
  verified_by text,
  verified_at timestamptz,
  updated_at  timestamptz not null default now(),
  unique (title_id, region)
);

create index if not exists availability_title_region
  on public.availability (title_id, region);

-- ─────────────────────────────────────────────────────────────
-- 3. USER_REPORTS  (corrections queue — feeds your moat)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.user_reports (
  id               uuid primary key default gen_random_uuid(),
  title_id         uuid references public.titles(id) on delete set null,
  region           text not null default 'IN',
  report_type      text not null
                     check (report_type in ('missing','wrong','gone','other')),
  reported_provider text,                          -- "should be on Prime" etc.
  note             text,
  status           text not null default 'open'
                     check (status in ('open','resolved','rejected')),
  created_at       timestamptz not null default now()
);

create index if not exists user_reports_status
  on public.user_reports (status);

-- ─────────────────────────────────────────────────────────────
-- updated_at auto-touch
-- ─────────────────────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists titles_touch on public.titles;
create trigger titles_touch before update on public.titles
  for each row execute function public.touch_updated_at();

drop trigger if exists availability_touch on public.availability;
create trigger availability_touch before update on public.availability
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- Public site = read-only for everyone. Writes happen only from your
-- server (service_role key, which BYPASSES RLS). The one exception:
-- anonymous visitors may INSERT a report, but never read the queue.
-- ─────────────────────────────────────────────────────────────
alter table public.titles       enable row level security;
alter table public.availability enable row level security;
alter table public.user_reports enable row level security;

-- anyone (even logged-out) can READ titles + availability
drop policy if exists "public read titles" on public.titles;
create policy "public read titles"
  on public.titles for select using (true);

drop policy if exists "public read availability" on public.availability;
create policy "public read availability"
  on public.availability for select using (true);

-- anyone can SUBMIT a report, but nobody (anon) can read/edit them
drop policy if exists "anyone can report" on public.user_reports;
create policy "anyone can report"
  on public.user_reports for insert with check (true);

-- NOTE: no insert/update/delete policies on titles/availability and no
-- select policy on user_reports → anon/auth users are blocked from those.
-- Your Next.js API routes use the service_role key and bypass RLS to write.
