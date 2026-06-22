"use client";

import { useEffect, useState } from "react";

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
    <main
      className={`mx-auto flex min-h-screen w-full max-w-xl flex-col px-6 transition-all duration-500 ${
        active ? "pt-16" : "justify-center pb-32"
      }`}
    >
      {/* Masthead — cycling badge + static region */}
      <header
        className={`text-center transition-all duration-500 ${
          active ? "mb-8" : "mb-10"
        }`}
      >
        <h1
          className={`flex flex-wrap items-center justify-center gap-x-3 gap-y-2 font-semibold tracking-tight transition-all duration-500 ${
            active ? "text-2xl" : "text-4xl sm:text-5xl"
          }`}
        >
          <CyclingWord />
          <span className="text-[0.5em] font-normal text-neutral-400">in</span>
          <RegionPicker />
        </h1>
      </header>

      {/* Search */}
      <form onSubmit={onSearch} className="relative">
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search a movie…"
          className="w-full rounded-2xl border border-neutral-200/80 bg-neutral-50 px-5 py-4 text-lg outline-none transition focus:border-neutral-400 focus:bg-white focus:ring-4 focus:ring-neutral-100 dark:border-neutral-800 dark:bg-neutral-900 dark:focus:border-neutral-600 dark:focus:bg-neutral-900 dark:focus:ring-neutral-800/50"
        />
      </form>

      {/* States */}
      {loading && (
        <p className="mt-10 text-center text-sm text-neutral-400">Searching…</p>
      )}

      {!loading && searched && results.length === 0 && (
        <p className="mt-10 text-center text-sm text-neutral-400">
          Nothing found. Try another title.
        </p>
      )}

      <div className="mt-8 space-y-3 pb-24">
        {!loading &&
          results.map((r) => <Card key={r.id} r={r} />)}
      </div>
    </main>
  );
}

const PHRASES = ["WhichOTT", "Where to watch", "Find any film"];

function CyclingWord() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((p) => (p + 1) % PHRASES.length), 2800);
    return () => clearInterval(t);
  }, []);

  // All phrases stacked in one grid cell → container sizes to the widest,
  // so nothing beside it shifts. Soft blur + fade crossfade between them.
  return (
    <span className="grid">
      {PHRASES.map((p, idx) => (
        <span
          key={p}
          aria-hidden={idx !== i}
          className={`col-start-1 row-start-1 whitespace-nowrap bg-gradient-to-br from-neutral-900 to-neutral-500 bg-clip-text text-transparent transition-all duration-700 ease-out dark:from-white dark:to-neutral-400 ${
            idx === i
              ? "opacity-100 blur-0 translate-y-0"
              : "pointer-events-none -translate-y-1 opacity-0 blur-[3px]"
          }`}
        >
          {p}
        </span>
      ))}
    </span>
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
    <span className="relative inline-block align-middle">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="group inline-flex items-center gap-1.5 rounded-full border border-neutral-200/60 bg-neutral-50/60 px-3 py-1 text-[0.5em] font-medium text-neutral-600 transition hover:border-neutral-300 hover:bg-neutral-100 dark:border-white/10 dark:bg-white/[0.04] dark:text-neutral-300 dark:hover:bg-white/[0.08]"
      >
        <span className="leading-none">🇮🇳</span>
        India
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          className={`text-neutral-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
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
          <div className="absolute left-1/2 z-20 mt-2 w-64 -translate-x-1/2 rounded-2xl border border-neutral-200/70 bg-white p-1.5 text-left shadow-xl dark:border-white/10 dark:bg-neutral-900">
            <div className="flex items-center justify-between rounded-xl bg-neutral-100 px-3 py-2 dark:bg-white/10">
              <span className="flex items-center gap-2 text-sm font-medium text-neutral-900 dark:text-white">
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

            <div className="px-3 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wide text-neutral-400">
              More countries
            </div>

            {SOON_COUNTRIES.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => pokeSoon(c.name)}
                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm text-neutral-500 transition hover:bg-neutral-50 dark:text-neutral-400 dark:hover:bg-white/5"
              >
                <span className="flex items-center gap-2">
                  <span className="text-base leading-none">{c.flag}</span>
                  {c.name}
                </span>
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
                  Soon
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {teaser && (
        <div className="absolute left-1/2 top-full z-30 mt-2 w-max max-w-[260px] -translate-x-1/2 animate-[fadeIn_0.2s_ease-out] rounded-xl bg-neutral-900 px-3 py-2 text-xs font-medium text-white shadow-lg dark:bg-white dark:text-neutral-900">
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
    <div className="group flex gap-4 rounded-2xl border border-neutral-200/60 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] dark:border-white/[0.06] dark:bg-neutral-900/60 dark:shadow-none dark:hover:bg-neutral-900">
      {/* Poster */}
      <div className="relative h-[108px] w-[72px] shrink-0 overflow-hidden rounded-xl bg-neutral-100 ring-1 ring-black/5 dark:bg-neutral-800 dark:ring-white/10">
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={poster}
            alt={r.title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-2xl opacity-40">
            🎬
          </div>
        )}
      </div>

      {/* Details */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="truncate text-[17px] font-semibold tracking-tight">
              {r.title}
            </h2>
            <p className="mt-0.5 text-[13px] text-neutral-400">
              {[r.year, r.language ? LANG[r.language] ?? r.language.toUpperCase() : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          {r.verified && (
            <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
              verified
            </span>
          )}
        </div>

        {nothing ? (
          <p className="mt-3 text-[13px] text-neutral-400">
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
                    className="rounded-lg bg-neutral-900 px-2.5 py-1 text-[13px] font-medium text-white dark:bg-white dark:text-neutral-900"
                  >
                    {name}
                  </span>
                ))}
              </div>
            )}

            {/* Free / ads — green accent */}
            {free.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-medium uppercase tracking-wide text-emerald-500">
                  Free
                </span>
                {free.map((name) => (
                  <span
                    key={name}
                    className="rounded-lg bg-emerald-50 px-2.5 py-1 text-[13px] font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                  >
                    {name}
                  </span>
                ))}
              </div>
            )}

            {/* Rent / buy — quiet secondary line */}
            {uniqSecondary.length > 0 && (
              <p className="text-[12px] text-neutral-400">
                Rent / buy · {uniqSecondary.join(", ")}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
