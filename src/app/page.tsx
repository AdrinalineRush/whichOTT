"use client";

import { useState } from "react";

type Providers = {
  stream: string[];
  ads: string[];
  rent: string[];
  buy: string[];
};

type Result = {
  id: string;
  slug: string;
  title: string;
  year: number | null;
  language: string | null;
  poster_path: string | null;
  providers: Providers;
  verified: boolean;
};

export default function Home() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

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

  const active = searched;

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-black text-white">
      {/* Brand mark — fixed top-left */}
      <div className="fixed left-6 top-6 z-20 text-xl font-semibold tracking-tight sm:left-10 sm:top-8">
        <span className="text-white">Which</span>
        <span className="bg-gradient-to-r from-fuchsia-400 to-indigo-400 bg-clip-text text-transparent">
          OTT
        </span>
      </div>

      <main
        className={`relative z-10 mx-auto flex min-h-screen w-full max-w-2xl flex-col px-6 transition-all duration-500 ${
          active ? "pt-24" : "justify-center pb-32"
        }`}
      >
        {/* Glass search pill with gradient glow ring */}
        <form onSubmit={onSearch} className="group relative">
          <div className="pointer-events-none absolute -inset-1.5 rounded-full bg-gradient-to-r from-fuchsia-500 via-purple-500 to-blue-500 opacity-40 blur-2xl transition-opacity duration-300 group-focus-within:opacity-70" />
          <div className="relative rounded-full bg-gradient-to-r from-fuchsia-400/70 via-purple-400/50 to-blue-400/70 p-px">
            <div className="flex items-center gap-3 rounded-full bg-black/90 px-5 py-2 backdrop-blur-2xl">
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

        {/* States */}
        {loading && (
          <p className="mt-10 text-center text-sm text-white/40">Searching…</p>
        )}

        {!loading && searched && results.length === 0 && (
          <p className="mt-10 text-center text-sm text-white/40">
            Nothing found. Try another title.
          </p>
        )}

        <div className="mt-8 space-y-3 pb-24">
          {!loading && results.map((r) => <Card key={r.id} r={r} />)}
        </div>
      </main>
    </div>
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

function Card({ r }: { r: Result }) {
  const poster = r.poster_path
    ? `https://image.tmdb.org/t/p/w185${r.poster_path}`
    : null;

  const sub = r.providers.stream; // the headline answer
  const free = r.providers.ads;
  const secondary = [...r.providers.rent, ...r.providers.buy];
  const uniqSecondary = Array.from(new Set(secondary));
  const nothing =
    sub.length === 0 && free.length === 0 && uniqSecondary.length === 0;

  return (
    <div className="group flex gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl transition duration-300 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.07]">
      {/* Poster */}
      <div className="relative h-[108px] w-[72px] shrink-0 overflow-hidden rounded-xl bg-white/5 ring-1 ring-white/10">
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
            <p className="mt-0.5 text-[13px] text-white/40">
              {[r.year, r.language ? LANG[r.language] ?? r.language.toUpperCase() : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          {r.verified && (
            <span className="shrink-0 rounded-full bg-emerald-400/15 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300">
              verified
            </span>
          )}
        </div>

        {nothing ? (
          <p className="mt-3 text-[13px] text-white/40">
            Not available on any India platform.
          </p>
        ) : (
          <div className="mt-3 space-y-2.5">
            {/* Subscription — the headline, bold chips */}
            {sub.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {sub.map((name) => (
                  <span
                    key={name}
                    className="rounded-lg bg-white px-2.5 py-1 text-[13px] font-medium text-black"
                  >
                    {name}
                  </span>
                ))}
              </div>
            )}

            {/* Free / ads — green accent */}
            {free.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-medium uppercase tracking-wide text-emerald-400">
                  Free
                </span>
                {free.map((name) => (
                  <span
                    key={name}
                    className="rounded-lg bg-emerald-400/10 px-2.5 py-1 text-[13px] font-medium text-emerald-300"
                  >
                    {name}
                  </span>
                ))}
              </div>
            )}

            {/* Rent / buy — quiet secondary line */}
            {uniqSecondary.length > 0 && (
              <p className="text-[12px] text-white/35">
                Rent / buy · {uniqSecondary.join(", ")}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
