// TMDB access — server only (uses TMDB_API_KEY, never exposed to browser).
// Includes retry because we measured the connection to TMDB as flaky.

const BASE = "https://api.themoviedb.org/3";
const KEY = process.env.TMDB_API_KEY!;

export type Providers = {
  stream: string[]; // flatrate / subscription
  ads: string[]; // free with ads
  rent: string[];
  buy: string[];
  link: string | null; // TMDB/JustWatch attribution link for this title+region
};

export type TmdbTitle = {
  tmdb_id: number;
  media_type: "movie" | "tv";
  title: string;
  original_title: string | null;
  language: string | null;
  year: number | null;
  overview: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  popularity: number;
  vote_average: number;
  genres: string[];
};

// TMDB's movie genre list is small and effectively static — mapping ids to
// names here avoids a second API call per title just for genre names.
const GENRE_MAP: Record<number, string> = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Science Fiction",
  10770: "TV Movie",
  53: "Thriller",
  10752: "War",
  37: "Western",
};

// fetch with up to 3 attempts — the connection drops intermittently
async function tmdbFetch(path: string, params: Record<string, string> = {}) {
  const qs = new URLSearchParams({ api_key: KEY, ...params }).toString();
  const url = `${BASE}${path}?${qs}`;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error(`TMDB ${res.status}`);
      return await res.json();
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 500 * attempt)); // backoff
    }
  }
  throw lastErr;
}

function toTitle(r: any): TmdbTitle {
  const date = r.release_date || r.first_air_date || "";
  return {
    tmdb_id: r.id,
    media_type: r.title ? "movie" : "tv",
    title: r.title || r.name,
    original_title: r.original_title || r.original_name || null,
    language: r.original_language || null,
    year: date ? Number(date.slice(0, 4)) : null,
    overview: r.overview || null,
    poster_path: r.poster_path || null,
    backdrop_path: r.backdrop_path || null,
    popularity: r.popularity ?? 0,
    vote_average: r.vote_average ?? 0,
    genres: ((r.genre_ids as number[] | undefined) ?? [])
      .map((id) => GENRE_MAP[id])
      .filter((name): name is string => Boolean(name)),
  };
}

/**
 * Search movies by title, RANKED for disambiguation.
 * Fixes the "Drishyam → Drishyam 3" bug: exact-title matches rank first,
 * then by popularity. Returns several candidates so the UI can show a picker.
 */
export async function searchTitles(query: string): Promise<TmdbTitle[]> {
  const data = await tmdbFetch("/search/movie", { query, include_adult: "false" });
  const q = query.trim().toLowerCase();
  return (data.results || [])
    .map(toTitle)
    .sort((a: TmdbTitle, b: TmdbTitle) => {
      const aExact = a.title.toLowerCase() === q ? 1 : 0;
      const bExact = b.title.toLowerCase() === q ? 1 : 0;
      if (aExact !== bExact) return bExact - aExact; // exact title wins
      return b.popularity - a.popularity; // then most popular
    });
}

/** India watch providers for a movie. */
export async function getProvidersIN(tmdbId: number): Promise<Providers> {
  const data = await tmdbFetch(`/movie/${tmdbId}/watch/providers`);
  const inn = data?.results?.IN ?? {};
  const names = (arr: any[]) => (arr || []).map((p) => p.provider_name);
  return {
    stream: names(inn.flatrate),
    ads: names(inn.ads),
    rent: names(inn.rent),
    buy: names(inn.buy),
    link: inn.link ?? null,
  };
}
