// Audit trail for the admin panel: what was searched, what matched, and how
// the answer was produced (verified / cache hit / live TMDB fetch / manual),
// plus whether the YouTube key-pool enrichment found anything.

import { supabaseAdmin } from "./supabase";
import type { FetchMethod } from "./titles";

export type SearchLogEntry = {
  query: string;
  title: string | null;
  year: number | null;
  tmdbId: number | null;
  dataSource: FetchMethod | null;
  resultCount: number;
  aiPlatformsFound: number;
  aiProvider: "gemini" | "openai" | null;
  ip: string | null;
};

export async function logSearch(entry: SearchLogEntry): Promise<void> {
  const db = supabaseAdmin();
  await db.from("search_log").insert({
    query: entry.query,
    matched_title: entry.title,
    matched_year: entry.year,
    tmdb_id: entry.tmdbId,
    data_source: entry.dataSource,
    result_count: entry.resultCount,
    ai_platforms_found: entry.aiPlatformsFound,
    ai_provider: entry.aiProvider,
    ip: entry.ip,
  });
}
