-- Fix: ON CONFLICT (tmdb_id) needs a real UNIQUE CONSTRAINT, not a partial index.
-- A plain UNIQUE constraint still allows many NULLs (Postgres treats NULLs as
-- distinct), so manual-only titles with tmdb_id = NULL are still fine.

drop index if exists public.titles_tmdb_id_key;

alter table public.titles
  add constraint titles_tmdb_id_unique unique (tmdb_id);
