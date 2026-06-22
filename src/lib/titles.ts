// The core "where to watch" resolver.
// Lookup order:  OUR verified data  →  cached TMDB  →  live TMDB (then cache it)
// Our verified data ALWAYS wins. This is the moat + the bug-fix layer.

import { supabaseAdmin } from "./supabase";
import {
  getProvidersIN,
  searchTitles,
  type Providers,
  type TmdbTitle,
} from "./tmdb";

const CACHE_DAYS = 7; // re-pull TMDB availability after this many days

export type ResolvedTitle = {
  id: string;
  slug: string;
  tmdb_id: number | null;
  title: string;
  year: number | null;
  language: string | null;
  poster_path: string | null;
  providers: Providers;
  verified: boolean; // true = a human confirmed this (trust it)
  source: "manual" | "tmdb" | "user_report";
};

function slugify(title: string, year: number | null): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return year ? `${base}-${year}` : base;
}

/** Upsert a TMDB title into our `titles` table; returns its row id + slug. */
async function upsertTitle(t: TmdbTitle) {
  const db = supabaseAdmin();
  const slug = slugify(t.title, t.year);
  const { data, error } = await db
    .from("titles")
    .upsert(
      {
        slug,
        tmdb_id: t.tmdb_id,
        media_type: t.media_type,
        title: t.title,
        original_title: t.original_title,
        language: t.language,
        year: t.year,
        overview: t.overview,
        poster_path: t.poster_path,
        backdrop_path: t.backdrop_path,
        popularity: t.popularity,
      },
      { onConflict: "tmdb_id" }
    )
    .select("id, slug")
    .single();
  if (error) throw error;
  return data as { id: string; slug: string };
}

/** Get availability for a known title id, using cache, refreshing if stale. */
async function resolveAvailability(
  titleId: string,
  tmdbId: number | null
): Promise<{ providers: Providers; verified: boolean; source: ResolvedTitle["source"] }> {
  const db = supabaseAdmin();

  const { data: row } = await db
    .from("availability")
    .select("providers, verified, source, updated_at")
    .eq("title_id", titleId)
    .eq("region", "IN")
    .maybeSingle();

  // 1. Verified human data always wins — return immediately.
  if (row?.verified) {
    return { providers: row.providers as Providers, verified: true, source: row.source };
  }

  // 2. Fresh-enough cached TMDB data — reuse it.
  if (row && tmdbId) {
    const ageMs = Date.now() - new Date(row.updated_at).getTime();
    if (ageMs < CACHE_DAYS * 86_400_000) {
      return { providers: row.providers as Providers, verified: false, source: row.source };
    }
  }

  // 3. No data / stale → fetch live from TMDB and cache it (unverified).
  if (tmdbId) {
    const providers = await getProvidersIN(tmdbId);
    await db.from("availability").upsert(
      {
        title_id: titleId,
        region: "IN",
        providers,
        source: "tmdb",
        verified: false,
      },
      { onConflict: "title_id,region" }
    );
    return { providers, verified: false, source: "tmdb" };
  }

  // manual-only title with no availability yet
  return {
    providers: { stream: [], ads: [], rent: [], buy: [] },
    verified: false,
    source: "manual",
  };
}

/**
 * Search by title. Returns ranked candidates (for the disambiguation picker).
 * Currently sources from TMDB; later we can blend in our own verified titles.
 */
export async function search(query: string): Promise<TmdbTitle[]> {
  return searchTitles(query);
}

/** Full resolve for one TMDB title: ensure it's in our DB, attach availability. */
export async function resolveByTmdb(t: TmdbTitle): Promise<ResolvedTitle> {
  const { id, slug } = await upsertTitle(t);
  const av = await resolveAvailability(id, t.tmdb_id);
  return {
    id,
    slug,
    tmdb_id: t.tmdb_id,
    title: t.title,
    year: t.year,
    language: t.language,
    poster_path: t.poster_path,
    providers: av.providers,
    verified: av.verified,
    source: av.source,
  };
}
