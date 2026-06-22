import { NextRequest, NextResponse } from "next/server";
import { search, resolveByTmdb } from "@/lib/titles";

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

    // Resolve providers for the top few candidates (the disambiguation list).
    // allSettled so one dropped connection doesn't sink the whole search.
    const top = candidates.slice(0, 5);
    const settled = await Promise.allSettled(top.map((t) => resolveByTmdb(t)));
    const results = settled
      .filter((s) => s.status === "fulfilled")
      .map((s) => (s as PromiseFulfilledResult<Awaited<ReturnType<typeof resolveByTmdb>>>).value);

    return NextResponse.json({ query: q, results });
  } catch (err) {
    console.error("search error:", err);
    return NextResponse.json({ error: "lookup failed" }, { status: 500 });
  }
}
