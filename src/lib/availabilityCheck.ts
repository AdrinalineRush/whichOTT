// Broad "where can I watch this in India" web search — not scoped to any one
// platform. Runs independently of TMDB, in parallel with it, every search.
// Also asks for a poster image and a short synopsis it finds along the way,
// so the result can stand fully on its own even when TMDB has nothing.
//
// Two-step per attempt: first let the model investigate FREELY in prose
// (search, retry alternate spellings, reason about what it finds) — forcing
// strict JSON output up front measurably suppresses that exploratory
// behavior. Then a second, tool-free call extracts structured JSON from its
// own findings, which LLMs do reliably.
//
// Uses the rotating key pool: Gemini (free tier) first, OpenAI as a fallback
// if every Gemini key is in cooldown.

import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { tryProviderPool } from "./keyPool";
import { supabaseAdmin } from "./supabase";

export type PlatformType = "stream" | "free" | "rent" | "buy";

export type FoundPlatform = {
  name: string;
  type: PlatformType;
  url: string | null;
};

export type AvailabilityCheckResult = {
  platforms: FoundPlatform[];
  posterUrl: string | null;
  synopsis: string | null;
  provider: "gemini" | "openai";
} | null;

type Parsed = { platforms: FoundPlatform[]; posterUrl: string | null; synopsis: string | null };

const VALID_TYPES: PlatformType[] = ["stream", "free", "rent", "buy"];

function extractJson(text: string): Parsed | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed: unknown = JSON.parse(match[0]);
    const obj = parsed as { platforms?: unknown; poster_url?: unknown; synopsis?: unknown };
    if (!Array.isArray(obj.platforms)) return null;

    type RawPlatform = { name: string; type: string; url?: unknown };
    const isRawPlatform = (p: unknown): p is RawPlatform =>
      typeof p === "object" &&
      p !== null &&
      typeof (p as { name?: unknown }).name === "string" &&
      VALID_TYPES.includes((p as { type?: string }).type as PlatformType);

    const platforms: FoundPlatform[] = (obj.platforms as unknown[])
      .filter(isRawPlatform)
      .map((p: RawPlatform) => ({
        name: p.name,
        type: p.type as PlatformType,
        url: typeof p.url === "string" ? p.url : null,
      }));

    return {
      platforms,
      posterUrl: typeof obj.poster_url === "string" ? obj.poster_url : null,
      synopsis: typeof obj.synopsis === "string" ? obj.synopsis : null,
    };
  } catch {
    return null; // unparseable — caller treats this as a failed attempt and moves on
  }
}

function buildSearchPrompt(title: string, year: number | null): string {
  return [
    `I need to know where the movie "${title}"${year ? ` (${year})` : ""} can currently be`,
    `watched online in India. Do a fresh, independent web search — don't rely on any`,
    `pre-existing movie database or prior knowledge. Check subscription streaming (Netflix,`,
    `Amazon Prime Video, JioHotstar, Zee5, SonyLIV, etc.), free-with-ads platforms (MX Player,`,
    `YouTube, JioCinema, etc.), and rent/buy stores (Google Play Movies, Apple TV, Amazon Video).`,
    `Regional film titles are often listed with a different spelling or transliteration than the`,
    `one I gave you — if your first search comes up empty or thin, retry with alternate spellings`,
    `(extra or missing letters, "and" vs "&", etc.) before concluding it isn't available.`,
    `Also note any poster/thumbnail image URL and a short synopsis you come across.`,
    `Report your findings in plain language: which platform(s), what type of access (subscription,`,
    `free, rent, or buy), any direct URLs you found, and call out explicitly if you had to use an`,
    `alternate spelling to find it. If you genuinely find nothing after trying multiple searches,`,
    `say so plainly.`,
  ].join(" ");
}

function buildExtractionPrompt(title: string, research: string): string {
  return [
    `From the research notes below about where to watch "${title}", extract ONLY the platforms`,
    `reported with real confidence (ignore hedged/uncertain mentions). Output ONLY this JSON,`,
    `no other text:`,
    `{"platforms": [{"name": "...", "type": "stream"|"free"|"rent"|"buy", "url": "..."|null}],`,
    `"poster_url": "..."|null, "synopsis": "..."|null}`,
    `If the notes found nothing with confidence, set "platforms": [].`,
    `\n\nResearch notes:\n"""\n${research}\n"""`,
  ].join(" ");
}

async function geminiAttempt(apiKey: string, title: string, year: number | null): Promise<Parsed> {
  const ai = new GoogleGenAI({ apiKey });

  const research = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: buildSearchPrompt(title, year),
    config: { tools: [{ googleSearch: {} }] },
  });

  const extraction = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: buildExtractionPrompt(title, research.text ?? ""),
  });

  const parsed = extractJson(extraction.text ?? "");
  if (!parsed) throw new Error("gemini: unparseable response");
  return parsed;
}

async function openaiAttempt(apiKey: string, title: string, year: number | null): Promise<Parsed> {
  const client = new OpenAI({ apiKey });

  const research = await client.responses.create({
    model: "gpt-5.5",
    tools: [{ type: "web_search" }],
    input: buildSearchPrompt(title, year),
  });

  const extraction = await client.responses.create({
    model: "gpt-5.5",
    input: buildExtractionPrompt(title, research.output_text ?? ""),
  });

  const parsed = extractJson(extraction.output_text ?? "");
  if (!parsed) throw new Error("openai: unparseable response");
  return parsed;
}

// How long a cached AI result is trusted before we re-search. Streaming
// availability shifts slowly enough that re-querying the LLM on every
// repeat search is pure quota waste, not freshness.
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function cacheKey(title: string, year: number | null): string {
  return `${title.trim().toLowerCase()}::${year ?? ""}`;
}

async function readCache(
  title: string,
  year: number | null
): Promise<AvailabilityCheckResult> {
  const db = supabaseAdmin();
  const { data } = await db
    .from("ai_availability_cache")
    .select("provider, platforms, poster_url, synopsis, created_at")
    .eq("cache_key", cacheKey(title, year))
    .maybeSingle();
  if (!data) return null;
  if (Date.now() - new Date(data.created_at).getTime() > CACHE_TTL_MS) return null;

  return {
    platforms: data.platforms as FoundPlatform[],
    posterUrl: data.poster_url,
    synopsis: data.synopsis,
    provider: data.provider as "gemini" | "openai",
  };
}

async function writeCache(
  title: string,
  year: number | null,
  result: NonNullable<AvailabilityCheckResult>
): Promise<void> {
  const db = supabaseAdmin();
  await db.from("ai_availability_cache").upsert(
    {
      cache_key: cacheKey(title, year),
      title,
      year,
      provider: result.provider,
      platforms: result.platforms,
      poster_url: result.posterUrl,
      synopsis: result.synopsis,
      created_at: new Date().toISOString(),
    },
    { onConflict: "cache_key" }
  );
}

// OpenAI fallback is disabled — free-tier Gemini only, by design. OpenAI's
// web_search-tool calls bill real money per call (and bill even on a failed
// attempt), which doesn't fit a free-tier-only project. The openaiAttempt
// function stays in this file, unused, in case that decision changes.
const USE_OPENAI_FALLBACK = false;

export async function checkAvailability(
  title: string,
  year: number | null
): Promise<AvailabilityCheckResult> {
  const cached = await readCache(title, year);
  if (cached) return cached;

  const context = `${title}${year ? ` (${year})` : ""}`;

  const gemini = await tryProviderPool(
    "gemini",
    (key) => geminiAttempt(key, title, year),
    context
  );
  if (gemini) {
    const result: NonNullable<AvailabilityCheckResult> = { ...gemini, provider: "gemini" };
    await writeCache(title, year, result);
    return result;
  }

  if (!USE_OPENAI_FALLBACK) return null;

  const openai = await tryProviderPool(
    "openai",
    (key) => openaiAttempt(key, title, year),
    context
  );
  if (openai) {
    const result: NonNullable<AvailabilityCheckResult> = { ...openai, provider: "openai" };
    await writeCache(title, year, result);
    return result;
  }

  return null;
}
