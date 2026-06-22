"use client";

import { useRef, useState } from "react";
import AdminPanel from "@/components/AdminPanel";

type Providers = {
  stream: string[];
  ads: string[];
  rent: string[];
  buy: string[];
  link: string | null;
};

type AiPlatform = {
  name: string;
  type: "stream" | "free" | "rent" | "buy";
  url: string | null;
};

type Result = {
  id: string;
  slug: string;
  title: string;
  year: number | null;
  language: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string | null;
  vote_average: number;
  genres: string[];
  providers: Providers;
  verified: boolean;
  ai_platforms?: AiPlatform[];
  ai_poster_url?: string;
  ai_synopsis?: string;
};

export default function Home() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const active = searched;

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.results ?? []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-black text-white">
      {/* Brand mark — fixed top-left. Hold for 2s to reveal the admin panel. */}
      <BrandMark />

      {/* Search pill — pinned center-screen pre-search, normal flow once searched */}
      <div
        className={
          active
            ? "relative z-10 mx-auto w-full max-w-2xl px-6 pt-24"
            : "fixed inset-0 z-10 flex items-center justify-center px-6"
        }
      >
        <form onSubmit={onSearch} className="group relative w-full max-w-2xl">
          {/* blurred halo */}
          <div className="pointer-events-none absolute -inset-1.5 rounded-full bg-gradient-to-r from-fuchsia-500 via-purple-500 to-blue-500 opacity-40 blur-2xl transition-opacity duration-300 group-focus-within:opacity-70" />
          {/* gradient ring */}
          <div className="relative rounded-full bg-gradient-to-r from-fuchsia-400/70 via-purple-400/50 to-blue-400/70 p-px">
            <div className="relative flex items-center gap-3 rounded-full bg-black/90 px-5 py-2 backdrop-blur-2xl">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                className="shrink-0 text-white/50"
              >
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                <path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search movies, series, actors…"
                className="min-w-0 flex-1 bg-transparent py-3.5 text-base text-white outline-none placeholder:text-white/35"
              />
              <span className="hidden h-6 w-px bg-white/15 sm:block" />
              <RegionPicker />
            </div>
          </div>
        </form>
      </div>

      {active && (
        <main className="relative z-10 mx-auto w-full max-w-2xl px-6">
          {loading && (
            <p className="mt-10 text-center text-sm text-white/40">Searching…</p>
          )}

          {!loading && results.length === 0 && (
            <p className="mt-10 text-center text-sm text-white/40">
              Nothing found. Try another title.
            </p>
          )}

          <div className="mt-8 space-y-3 pb-24">
            {!loading && results.map((r) => <Card key={r.id} r={r} />)}
          </div>
        </main>
      )}
    </div>
  );
}

// Hold the logo for 2s to reveal a hidden, password-gated admin panel for
// managing the API key pool. Not advertised anywhere in the UI.
function BrandMark() {
  const [showAdmin, setShowAdmin] = useState(false);
  const timerRef = useRef<number | null>(null);

  function startPress() {
    timerRef.current = window.setTimeout(() => setShowAdmin(true), 2000);
  }
  function cancelPress() {
    if (timerRef.current) window.clearTimeout(timerRef.current);
  }

  return (
    <>
      <div
        onMouseDown={startPress}
        onMouseUp={cancelPress}
        onMouseLeave={cancelPress}
        onTouchStart={startPress}
        onTouchEnd={cancelPress}
        className="fixed left-6 top-6 z-20 select-none text-xl font-semibold tracking-tight sm:left-10 sm:top-8"
      >
        <span className="text-white">Which</span>
        <span className="bg-gradient-to-r from-fuchsia-400 to-indigo-400 bg-clip-text text-transparent">
          OTT
        </span>
      </div>
      {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}
    </>
  );
}

const SOON_COUNTRIES = [
  { code: "US", name: "United States", flag: "🇺🇸" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧" },
  { code: "AE", name: "United Arab Emirates", flag: "🇦🇪" },
  { code: "CA", name: "Canada", flag: "🇨🇦" },
  { code: "AU", name: "Australia", flag: "🇦🇺" },
];

function RegionPicker() {
  const [open, setOpen] = useState(false);
  const [teaser, setTeaser] = useState<string | null>(null);

  function pokeSoon(name: string) {
    setOpen(false);
    setTeaser(`Hang tight — ${name} is on the way! For now we're India-only 🇮🇳`);
    window.clearTimeout((pokeSoon as any)._t);
    (pokeSoon as any)._t = window.setTimeout(() => setTeaser(null), 3000);
  }

  return (
    <span className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-full px-2 py-1 text-sm font-medium text-white/80 transition hover:text-white"
      >
        <span className="text-white/50">in</span>
        <span className="leading-none">🇮🇳</span>
        India
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          className={`text-white/40 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <path
            d="M6 9l6 6 6-6"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-hidden
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div className="absolute right-0 z-20 mt-3 w-64 rounded-2xl border border-white/15 bg-black/80 p-1.5 text-left shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
            <div className="flex items-center justify-between rounded-xl bg-white/10 px-3 py-2">
              <span className="flex items-center gap-2 text-sm font-medium text-white">
                <span className="text-base leading-none">🇮🇳</span> India
              </span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M5 13l4 4L19 7"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <div className="px-3 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wide text-white/30">
              More countries
            </div>

            {SOON_COUNTRIES.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => pokeSoon(c.name)}
                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm text-white/50 transition hover:bg-white/5 hover:text-white/80"
              >
                <span className="flex items-center gap-2">
                  <span className="text-base leading-none">{c.flag}</span>
                  {c.name}
                </span>
                <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                  Soon
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {teaser && (
        <div className="absolute right-0 top-full z-30 mt-2 w-max max-w-[260px] animate-[fadeIn_0.2s_ease-out] rounded-xl border border-white/15 bg-black/90 px-3 py-2 text-xs font-medium text-white shadow-lg backdrop-blur-xl">
          {teaser}
        </div>
      )}
    </span>
  );
}

const LANG: Record<string, string> = {
  hi: "Hindi",
  ml: "Malayalam",
  ta: "Tamil",
  te: "Telugu",
  kn: "Kannada",
  en: "English",
};

// Best-effort deep links: TMDB/JustWatch only gives one generic link per
// title+region, not a per-platform deep link, so we route each chip to that
// platform's own search results for the title — the closest we can get
// without a paid deep-linking API (e.g. Watchmode).
const PROVIDER_LINK: Record<string, (title: string) => string> = {
  Netflix: (t) => `https://www.netflix.com/search?q=${encodeURIComponent(t)}`,
  "Amazon Prime Video": (t) =>
    `https://www.primevideo.com/search/ref=atv_sr_def?phrase=${encodeURIComponent(t)}`,
  "Amazon Prime Video with Ads": (t) =>
    `https://www.primevideo.com/search/ref=atv_sr_def?phrase=${encodeURIComponent(t)}`,
  "Amazon Video": (t) =>
    `https://www.amazon.in/s?k=${encodeURIComponent(t)}&i=instant-video`,
  JioHotstar: (t) => `https://www.hotstar.com/in/search?q=${encodeURIComponent(t)}`,
  Zee5: (t) => `https://www.zee5.com/search?q=${encodeURIComponent(t)}`,
  "Sun Nxt": (t) => `https://www.sunnxt.com/search/${encodeURIComponent(t)}`,
  "VI movies and tv": (t) =>
    `https://www.vimovies.tv/search?q=${encodeURIComponent(t)}`,
  aha: (t) => `https://www.aha.video/search?q=${encodeURIComponent(t)}`,
  "MX Player": (t) => `https://www.mxplayer.in/search?q=${encodeURIComponent(t)}`,
  "Amazon MX Player": (t) =>
    `https://www.mxplayer.in/search?q=${encodeURIComponent(t)}`,
  "Apple TV Store": (t) => `https://tv.apple.com/search?term=${encodeURIComponent(t)}`,
  "Google Play Movies": (t) =>
    `https://play.google.com/store/search?q=${encodeURIComponent(t)}&c=movies`,
  YouTube: (t) =>
    `https://www.youtube.com/results?search_query=${encodeURIComponent(t + " full movie")}`,
};

const PROVIDER_DOT: Record<string, string> = {
  Netflix: "#E50914",
  "Amazon Prime Video": "#00A8E1",
  "Amazon Prime Video with Ads": "#00A8E1",
  "Amazon Video": "#00A8E1",
  JioHotstar: "#1F2DC4",
  Zee5: "#8C2EE4",
  "Sun Nxt": "#F37021",
  "VI movies and tv": "#EE2737",
  aha: "#D2042D",
  "MX Player": "#FF6900",
  "Amazon MX Player": "#FF6900",
  "Apple TV Store": "#A2AAAD",
  "Google Play Movies": "#01875F",
  YouTube: "#FF0000",
};

function providerUrl(name: string, title: string): string {
  const fn = PROVIDER_LINK[name];
  if (fn) return fn(title);
  return `https://www.google.com/search?q=${encodeURIComponent(`watch ${title} on ${name}`)}`;
}

function ProviderChip({
  name,
  title,
  variant,
  hrefOverride,
}: {
  name: string;
  title: string;
  variant: "stream" | "free" | "secondary";
  hrefOverride?: string;
}) {
  const styles = {
    stream:
      "bg-white text-black hover:bg-white/90 text-[13px] font-medium px-3 py-1.5",
    free:
      "bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20 text-[13px] font-medium px-3 py-1.5",
    secondary:
      "bg-white/[0.06] text-white/60 hover:bg-white/[0.1] hover:text-white/85 text-[12px] px-2.5 py-1",
  }[variant];

  return (
    <a
      href={hrefOverride ?? providerUrl(name, title)}
      target="_blank"
      rel="noopener noreferrer"
      className={`group/chip inline-flex items-center gap-1.5 rounded-lg transition ${styles}`}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: PROVIDER_DOT[name] ?? "currentColor" }}
      />
      {name}
      <svg
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
        className="shrink-0 opacity-0 transition-opacity group-hover/chip:opacity-60"
      >
        <path
          d="M7 17L17 7M9 7h8v8"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </a>
  );
}

type WatchPick = { name: string; href: string; type: "stream" | "free" | "rent" | "buy" } | null;

function bestWatchPick(r: Result): WatchPick {
  const ai = r.ai_platforms ?? [];
  if (r.providers.stream[0]) {
    return { name: r.providers.stream[0], href: providerUrl(r.providers.stream[0], r.title), type: "stream" };
  }
  if (r.providers.ads[0]) {
    return { name: r.providers.ads[0], href: providerUrl(r.providers.ads[0], r.title), type: "free" };
  }
  const aiStream = ai.find((p) => p.type === "stream");
  if (aiStream) {
    return { name: aiStream.name, href: aiStream.url ?? providerUrl(aiStream.name, r.title), type: "stream" };
  }
  const aiFree = ai.find((p) => p.type === "free");
  if (aiFree) {
    return { name: aiFree.name, href: aiFree.url ?? providerUrl(aiFree.name, r.title), type: "free" };
  }
  if (r.providers.rent[0]) {
    return { name: r.providers.rent[0], href: providerUrl(r.providers.rent[0], r.title), type: "rent" };
  }
  if (r.providers.buy[0]) {
    return { name: r.providers.buy[0], href: providerUrl(r.providers.buy[0], r.title), type: "buy" };
  }
  const aiRentBuy = ai.find((p) => p.type === "rent" || p.type === "buy");
  if (aiRentBuy) {
    return { name: aiRentBuy.name, href: aiRentBuy.url ?? providerUrl(aiRentBuy.name, r.title), type: aiRentBuy.type };
  }
  return null;
}

function Card({ r }: { r: Result }) {
  const tmdbPoster = r.poster_path ? `https://image.tmdb.org/t/p/w185${r.poster_path}` : null;
  const poster = tmdbPoster ?? r.ai_poster_url ?? null;
  const showAiThumb = Boolean(tmdbPoster) && Boolean(r.ai_poster_url);

  const sub = r.providers.stream;
  const free = r.providers.ads;
  const secondary = Array.from(new Set([...r.providers.rent, ...r.providers.buy]));
  const tmdbEmpty = sub.length === 0 && free.length === 0 && secondary.length === 0;

  const aiPlatforms = r.ai_platforms ?? [];
  const aiStream = aiPlatforms.filter((p) => p.type === "stream");
  const aiFree = aiPlatforms.filter((p) => p.type === "free");
  const aiRentBuy = aiPlatforms.filter((p) => p.type === "rent" || p.type === "buy");
  const nothing = tmdbEmpty && aiPlatforms.length === 0;

  const description = r.overview || r.ai_synopsis || null;
  const pick = bestWatchPick(r);

  return (
    <div className="group flex gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl transition duration-300 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.07]">
      {/* Poster */}
      <div className="relative h-[140px] w-[96px] shrink-0 overflow-hidden rounded-xl bg-white/5 ring-1 ring-white/10">
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={poster}
            alt={r.title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-2xl opacity-30">
            🎬
          </div>
        )}
      </div>

      {/* Details */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="truncate text-[17px] font-semibold tracking-tight text-white">
              {r.title}
            </h2>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-white/40">
              <span>
                {[r.year, r.language ? LANG[r.language] ?? r.language.toUpperCase() : null]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              {r.vote_average > 0 && (
                <span className="inline-flex items-center gap-1 text-amber-300/90">
                  ★ {r.vote_average.toFixed(1)}
                </span>
              )}
            </div>
            {r.genres.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {r.genres.slice(0, 3).map((g) => (
                  <span
                    key={g}
                    className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/40"
                  >
                    {g}
                  </span>
                ))}
              </div>
            )}
          </div>
          {r.verified && (
            <span className="shrink-0 rounded-full bg-emerald-400/15 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300">
              verified
            </span>
          )}
        </div>

        {description && (
          <p className="mt-2 line-clamp-2 text-[12.5px] leading-relaxed text-white/45">
            {description}
          </p>
        )}

        {pick && (
          <a
            href={pick.href}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-blue-500 px-4 py-2 text-[13px] font-semibold text-white shadow-[0_4px_20px_rgba(192,38,211,0.25)] transition hover:brightness-110"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
            Watch now on {pick.name}
          </a>
        )}

        {nothing ? (
          <p className="mt-3 text-[13px] text-white/40">
            Not available on any India platform.
          </p>
        ) : (
          <div className="mt-3 space-y-2.5">
            {sub.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {sub.map((name) => (
                  <ProviderChip key={name} name={name} title={r.title} variant="stream" />
                ))}
              </div>
            )}

            {free.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-medium uppercase tracking-wide text-emerald-400">
                  Free
                </span>
                {free.map((name) => (
                  <ProviderChip key={name} name={name} title={r.title} variant="free" />
                ))}
              </div>
            )}

            {secondary.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-medium uppercase tracking-wide text-white/30">
                  Rent / buy
                </span>
                {secondary.map((name) => (
                  <ProviderChip key={name} name={name} title={r.title} variant="secondary" />
                ))}
              </div>
            )}

            {aiPlatforms.length > 0 && (
              <div className="space-y-2 rounded-xl border border-violet-400/20 bg-violet-400/[0.04] p-2.5">
                <div className="flex items-center gap-2">
                  {showAiThumb && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.ai_poster_url}
                      alt=""
                      className="h-9 w-7 shrink-0 rounded object-cover ring-1 ring-white/10"
                    />
                  )}
                  <p className="text-[10px] font-medium uppercase tracking-wide text-violet-300/70">
                    Found via AI web search
                  </p>
                </div>
                {aiStream.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {aiStream.map((p) => (
                      <ProviderChip
                        key={p.name}
                        name={p.name}
                        title={r.title}
                        variant="stream"
                        hrefOverride={p.url ?? undefined}
                      />
                    ))}
                  </div>
                )}
                {aiFree.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-medium uppercase tracking-wide text-emerald-400">
                      Free
                    </span>
                    {aiFree.map((p) => (
                      <ProviderChip
                        key={p.name}
                        name={p.name}
                        title={r.title}
                        variant="free"
                        hrefOverride={p.url ?? undefined}
                      />
                    ))}
                  </div>
                )}
                {aiRentBuy.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-medium uppercase tracking-wide text-white/30">
                      Rent / buy
                    </span>
                    {aiRentBuy.map((p) => (
                      <ProviderChip
                        key={p.name}
                        name={p.name}
                        title={r.title}
                        variant="secondary"
                        hrefOverride={p.url ?? undefined}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {r.providers.link && (
          <a
            href={r.providers.link}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="mt-3 inline-block text-[11px] text-white/25 underline-offset-2 hover:text-white/45 hover:underline"
          >
            More streaming options via JustWatch
          </a>
        )}
      </div>
    </div>
  );
}
