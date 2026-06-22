import { NextRequest, NextResponse } from "next/server";
import { search, resolveByTmdb } from "@/lib/titles";
import { checkAvailability, type FoundPlatform } from "@/lib/availabilityCheck";
import { logSearch } from "@/lib/searchLog";

// Races a promise against a timeout so a slow/exhausted key pool never
// holds up the response — resolves to null instead of rejecting.
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    p,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

function clientIp(req: NextRequest): string | null {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

// GET /api/search?q=jawan
// Returns the top matches with India watch-providers attached.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json({ error: "missing ?q" }, { status: 400 });
  }

  try {
    const candidates = await search(q);
    if (candidates.length === 0) {
      return NextResponse.json({ query: q, results: [] });
    }

    const top = candidates.slice(0, 5);

    // TMDB resolution and the open-web LLM search run AT THE SAME TIME, both
    // starting from the raw search candidate — the LLM never looks at TMDB's
    // data, it does its own independent search. allSettled so one dropped
    // connection doesn't sink the whole search; the AI call is raced against
    // a timeout so a slow/exhausted key pool never holds up the response.
    const [settled, aiFound] = await Promise.all([
      Promise.allSettled(top.map((t) => resolveByTmdb(t))),
      withTimeout(checkAvailability(top[0].title, top[0].year), 9000),
    ]);

    const results = settled
      .filter((s) => s.status === "fulfilled")
      .map((s) => (s as PromiseFulfilledResult<Awaited<ReturnType<typeof resolveByTmdb>>>).value);

    // Always surfaced as its own separate section — regardless of what TMDB
    // found — so the two sources stay clearly distinct for the user.
    const top0 = results[0] as (typeof results)[0] & {
      ai_platforms?: FoundPlatform[];
      ai_poster_url?: string;
      ai_synopsis?: string;
    };
    let aiProvider: "gemini" | "openai" | null = null;
    let aiPlatformsFound = 0;
    if (top0 && aiFound) {
      top0.ai_platforms = aiFound.platforms;
      if (aiFound.posterUrl) top0.ai_poster_url = aiFound.posterUrl;
      if (aiFound.synopsis) top0.ai_synopsis = aiFound.synopsis;
      aiProvider = aiFound.provider;
      aiPlatformsFound = aiFound.platforms.length;
    }

    // Audit log: what was searched, what matched, and how — for the admin panel.
    try {
      await logSearch({
        query: q,
        title: top0?.title ?? null,
        year: top0?.year ?? null,
        tmdbId: top0?.tmdb_id ?? null,
        dataSource: top0?.method ?? null,
        resultCount: results.length,
        aiPlatformsFound,
        aiProvider,
        ip: clientIp(req),
      });
    } catch (logErr) {
      console.error("search log error:", logErr);
    }

    return NextResponse.json({ query: q, results });
  } catch (err) {
    console.error("search error:", err);
    return NextResponse.json({ error: "lookup failed" }, { status: 500 });
  }
}
