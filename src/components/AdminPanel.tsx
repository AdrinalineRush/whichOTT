"use client";

import { useEffect, useMemo, useState } from "react";

type KeyRow = {
  id: string;
  provider: "gemini" | "openai";
  label: string | null;
  is_active: boolean;
  cooldown_until: string | null;
  fail_count: number;
  key_value: string; // masked server-side, never the real secret
  created_at: string;
};

type LoginLog = {
  id: string;
  success: boolean;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
};

type KeyLog = {
  id: string;
  provider: "gemini" | "openai";
  key_preview: string | null;
  outcome: "success" | "fail" | "cooldown";
  context: string | null;
  error_message: string | null;
  created_at: string;
};

type SearchLog = {
  id: string;
  query: string;
  matched_title: string | null;
  matched_year: number | null;
  tmdb_id: number | null;
  data_source: "verified" | "cache_hit" | "live_fetch" | "manual" | null;
  result_count: number;
  ai_platforms_found: number;
  ai_provider: "gemini" | "openai" | null;
  ip: string | null;
  created_at: string;
};

type Tab = "overview" | "keys" | "search" | "logins" | "activity";

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const OUTCOME_STYLE: Record<KeyLog["outcome"], string> = {
  success: "bg-emerald-400/15 text-emerald-300",
  fail: "bg-red-400/15 text-red-300",
  cooldown: "bg-amber-400/15 text-amber-300",
};

const DATA_SOURCE_LABEL: Record<NonNullable<SearchLog["data_source"]>, string> = {
  verified: "verified",
  cache_hit: "cache",
  live_fetch: "live fetch",
  manual: "manual",
};

const DATA_SOURCE_STYLE: Record<NonNullable<SearchLog["data_source"]>, string> = {
  verified: "bg-emerald-400/15 text-emerald-300",
  cache_hit: "bg-sky-400/15 text-sky-300",
  live_fetch: "bg-purple-400/15 text-purple-300",
  manual: "bg-white/10 text-white/50",
};

const DATA_SOURCE_BAR_FILL: Record<NonNullable<SearchLog["data_source"]>, string> = {
  verified: "bg-emerald-400",
  cache_hit: "bg-sky-400",
  live_fetch: "bg-purple-400",
  manual: "bg-white/40",
};

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "keys", label: "Key pool" },
  { id: "search", label: "Search history" },
  { id: "logins", label: "Login log" },
  { id: "activity", label: "Key activity" },
];

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className={`text-2xl font-semibold ${accent ?? "text-white"}`}>{value}</div>
      <div className="mt-1 text-[11px] uppercase tracking-wide text-white/40">{label}</div>
    </div>
  );
}

function DailyVolumeChart({ logs }: { logs: SearchLog[] }) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d;
  });
  const counts = days.map(
    (d) => logs.filter((l) => new Date(l.created_at).toDateString() === d.toDateString()).length
  );
  const max = Math.max(1, ...counts);

  return (
    <div className="flex h-40 items-end gap-3">
      {days.map((d, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-2">
          <div className="flex h-32 w-full items-end">
            <div
              className="w-full rounded-t-md bg-gradient-to-t from-fuchsia-500/50 to-blue-400/70"
              style={{ height: `${Math.max(4, (counts[i] / max) * 100)}%` }}
            />
          </div>
          <span className="text-[10px] text-white/40">
            {d.toLocaleDateString("en-IN", { weekday: "short" })}
          </span>
        </div>
      ))}
    </div>
  );
}

function topQueries(logs: SearchLog[]): { query: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const l of logs) {
    const key = l.query.trim();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([query, count]) => ({ query, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

function dataSourceBreakdown(
  logs: SearchLog[]
): { key: NonNullable<SearchLog["data_source"]>; pct: number; count: number }[] {
  const keys: NonNullable<SearchLog["data_source"]>[] = [
    "verified",
    "cache_hit",
    "live_fetch",
    "manual",
  ];
  const total = logs.length || 1;
  return keys.map((key) => {
    const count = logs.filter((l) => l.data_source === key).length;
    return { key, count, pct: Math.round((count / total) * 100) };
  });
}

export default function AdminPanel({ onClose }: { onClose: () => void }) {
  const [authed, setAuthed] = useState<boolean | null>(null); // null = checking
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [loginLogs, setLoginLogs] = useState<LoginLog[]>([]);
  const [keyLogs, setKeyLogs] = useState<KeyLog[]>([]);
  const [searchLogs, setSearchLogs] = useState<SearchLog[]>([]);
  const [provider, setProvider] = useState<"gemini" | "openai">("gemini");
  const [keyValue, setKeyValue] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [testStatus, setTestStatus] = useState<
    Record<string, { state: "testing" | "ok" | "fail"; message?: string }>
  >({});

  async function loadKeys() {
    const res = await fetch("/api/admin/keys");
    if (res.ok) {
      const data = await res.json();
      setKeys(data.keys);
      setAuthed(true);
    } else {
      setAuthed(false);
    }
  }

  async function loadLogs() {
    const res = await fetch("/api/admin/logs");
    if (res.ok) {
      const data = await res.json();
      setLoginLogs(data.logins);
      setKeyLogs(data.keyActivity);
      setSearchLogs(data.searches);
    }
  }

  async function loadAll() {
    await loadKeys();
    await loadLogs();
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(null);
    setBusy(true);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setBusy(false);
    if (res.ok) {
      setPassword("");
      loadAll();
    } else {
      setLoginError("Wrong password.");
    }
  }

  async function addKey() {
    if (!keyValue.trim()) return;
    setBusy(true);
    await fetch("/api/admin/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, key_value: keyValue.trim(), label: label.trim() || null }),
    });
    setKeyValue("");
    setLabel("");
    setTestStatus((s) => {
      const { new: _new, ...rest } = s;
      return rest;
    });
    setBusy(false);
    loadKeys();
  }

  async function testKey(testId: string, payload: { id?: string; provider?: string; key_value?: string }) {
    setTestStatus((s) => ({ ...s, [testId]: { state: "testing" } }));
    try {
      const res = await fetch("/api/admin/keys/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setTestStatus((s) => ({ ...s, [testId]: { state: "ok" } }));
      } else {
        setTestStatus((s) => ({
          ...s,
          [testId]: { state: "fail", message: data.message ?? data.error ?? "Test failed" },
        }));
      }
    } catch {
      setTestStatus((s) => ({ ...s, [testId]: { state: "fail", message: "Network error" } }));
    }
  }

  async function deleteKey(id: string) {
    setBusy(true);
    await fetch("/api/admin/keys", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setBusy(false);
    loadKeys();
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setAuthed(false);
  }

  const coolingKeys = keys.filter(
    (k) => k.cooldown_until && new Date(k.cooldown_until) > new Date()
  ).length;
  const loginSuccesses = loginLogs.filter((l) => l.success).length;
  const searchesLastHour = searchLogs.filter(
    (s) => Date.now() - new Date(s.created_at).getTime() < 3_600_000
  ).length;
  const aiTotalFound = useMemo(
    () => searchLogs.reduce((sum, s) => sum + s.ai_platforms_found, 0),
    [searchLogs]
  );
  const leaderboard = useMemo(() => topQueries(searchLogs), [searchLogs]);
  const breakdown = useMemo(() => dataSourceBreakdown(searchLogs), [searchLogs]);

  // Login-gate screen — small centered card, nothing to show yet.
  if (authed !== true) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-black/95 p-6 text-white shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-white/50">
              Admin
            </h2>
            <button onClick={onClose} className="text-white/40 hover:text-white" aria-label="Close">
              ✕
            </button>
          </div>
          {authed === null ? (
            <p className="text-sm text-white/40">Checking…</p>
          ) : (
            <form onSubmit={login} className="space-y-3">
              <input
                type="password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Admin password"
                className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/30"
              />
              {loginError && <p className="text-xs text-red-400">{loginError}</p>}
              <button
                disabled={busy}
                className="w-full rounded-lg bg-white py-2 text-sm font-medium text-black disabled:opacity-50"
              >
                Unlock
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // Full dashboard — fixed full-screen overlay, scrollable.
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black text-white">
      <div className="mx-auto max-w-5xl px-6 py-8">
        {/* Top bar */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-lg font-semibold tracking-tight">
            Which<span className="text-fuchsia-400">OTT</span>{" "}
            <span className="text-white/40">admin</span>
          </h1>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[11px] font-medium text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> online
            </span>
            <button
              onClick={logout}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/60 hover:bg-white/5 hover:text-white"
            >
              Lock panel
            </button>
            <button onClick={onClose} className="text-white/40 hover:text-white" aria-label="Close">
              ✕
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-2 overflow-x-auto border-b border-white/10 pb-3">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                tab === t.id
                  ? "bg-white text-black"
                  : "text-white/50 hover:bg-white/5 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <StatCard label="Searches logged" value={searchLogs.length} />
              <StatCard label="Active keys" value={keys.filter((k) => k.is_active).length} />
              <StatCard
                label="Keys cooling down"
                value={coolingKeys}
                accent={coolingKeys > 0 ? "text-amber-300" : undefined}
              />
              <StatCard label="AI platforms found" value={aiTotalFound} accent="text-violet-300" />
              <StatCard label="Searches (1h)" value={searchesLastHour} />
              <StatCard
                label="Login success"
                value={`${loginSuccesses}/${loginLogs.length}`}
                accent={loginSuccesses < loginLogs.length ? "text-red-300" : "text-emerald-300"}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-wide text-white/40">
                  Daily search volume (past 7 days)
                </h3>
                <DailyVolumeChart logs={searchLogs} />
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-white/40">
                    Top searches
                  </h3>
                  <div className="space-y-1.5">
                    {leaderboard.length === 0 && (
                      <p className="text-xs text-white/30">No searches yet.</p>
                    )}
                    {leaderboard.map((q, i) => (
                      <div
                        key={q.query}
                        className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-1.5 text-sm"
                      >
                        <span className="truncate text-white/70">
                          <span className="mr-2 text-white/30">#{i + 1}</span>
                          {q.query}
                        </span>
                        <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/50">
                          {q.count}×
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-white/40">
                    Data source breakdown
                  </h3>
                  <div className="space-y-2.5">
                    {breakdown.map((b) => (
                      <div key={b.key}>
                        <div className="mb-1 flex items-center justify-between text-[11px]">
                          <span className="text-white/50">{DATA_SOURCE_LABEL[b.key]}</span>
                          <span className="text-white/30">
                            {b.pct}% ({b.count})
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                          <div
                            className={`h-full rounded-full ${DATA_SOURCE_BAR_FILL[b.key]}`}
                            style={{ width: `${b.pct}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "keys" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-wide text-white/40">
                Add a key
              </h3>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                }}
                className="space-y-3"
              >
                <div className="flex gap-2">
                  <select
                    value={provider}
                    onChange={(e) => setProvider(e.target.value as "gemini" | "openai")}
                    className="rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-white/30"
                  >
                    <option value="gemini">Gemini</option>
                    <option value="openai">OpenAI</option>
                  </select>
                  <input
                    value={keyValue}
                    onChange={(e) => {
                      setKeyValue(e.target.value);
                      setTestStatus((s) => {
                        const { new: _new, ...rest } = s;
                        return rest;
                      });
                    }}
                    placeholder="API key"
                    className="flex-1 rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-sm font-mono outline-none focus:border-white/30"
                  />
                </div>
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Label (optional)"
                  className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-white/30"
                />

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={!keyValue.trim() || testStatus.new?.state === "testing"}
                    onClick={() => testKey("new", { provider, key_value: keyValue.trim() })}
                    className="rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-white/80 transition hover:bg-white/5 disabled:opacity-40"
                  >
                    {testStatus.new?.state === "testing" ? "Testing…" : "Test"}
                  </button>
                  <button
                    type="button"
                    disabled={busy || !keyValue.trim()}
                    onClick={addKey}
                    className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-white/90 disabled:opacity-40"
                  >
                    Save key
                  </button>

                  {testStatus.new?.state === "ok" && (
                    <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Key works
                    </span>
                  )}
                  {testStatus.new?.state === "fail" && (
                    <span
                      className="flex min-w-0 items-center gap-1.5 truncate text-xs font-medium text-red-300"
                      title={testStatus.new.message}
                    >
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                      {testStatus.new.message ?? "Test failed"}
                    </span>
                  )}
                </div>
              </form>
            </div>

            <div>
              <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-white/40">
                Pool ({keys.length})
              </h3>
              <div className="space-y-2">
                {keys.length === 0 && (
                  <p className="text-xs text-white/30">No keys in the pool yet.</p>
                )}
                {keys.map((k) => {
                  const cooling = k.cooldown_until && new Date(k.cooldown_until) > new Date();
                  const status = testStatus[k.id];
                  return (
                    <div
                      key={k.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm transition hover:bg-white/[0.05]"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                            k.provider === "gemini"
                              ? "bg-sky-400/15 text-sky-300"
                              : "bg-fuchsia-400/15 text-fuchsia-300"
                          }`}
                        >
                          {k.provider}
                        </span>
                        <div className="min-w-0 truncate">
                          <span className="font-mono text-white/60">{k.key_value}</span>
                          {k.label && <span className="ml-1.5 text-white/30">· {k.label}</span>}
                        </div>
                        {cooling && (
                          <span className="shrink-0 rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                            cooling
                          </span>
                        )}
                        {!k.is_active && (
                          <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/40">
                            inactive
                          </span>
                        )}
                        {status?.state === "ok" && (
                          <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-emerald-300">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> works
                          </span>
                        )}
                        {status?.state === "fail" && (
                          <span
                            className="flex min-w-0 shrink-0 items-center gap-1.5 truncate text-[11px] font-medium text-red-300"
                            title={status.message}
                          >
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                            {status.message ?? "failed"}
                          </span>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <button
                          onClick={() => testKey(k.id, { id: k.id })}
                          disabled={status?.state === "testing"}
                          className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-white/70 transition hover:bg-white/5 disabled:opacity-40"
                        >
                          {status?.state === "testing" ? "Testing…" : "Test"}
                        </button>
                        <button
                          onClick={() => deleteKey(k.id)}
                          className="text-xs text-white/30 transition hover:text-red-400"
                        >
                          remove
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {tab === "search" && (
          <div className="space-y-1.5">
            <div className="mb-2 flex justify-end">
              <button onClick={loadLogs} className="text-[11px] text-white/30 hover:text-white/60">
                refresh
              </button>
            </div>
            {searchLogs.length === 0 && <p className="text-xs text-white/30">No searches logged yet.</p>}
            {searchLogs.map((s) => (
              <div key={s.id} className="rounded-lg bg-white/[0.03] px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-white/70">
                    “{s.query}”
                    {s.matched_title && (
                      <span className="text-white/40">
                        {" "}
                        → {s.matched_title}
                        {s.matched_year ? ` (${s.matched_year})` : ""}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs text-white/30">{timeAgo(s.created_at)}</span>
                </div>
                <div className="mt-1.5 flex items-center gap-1.5">
                  {s.data_source && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${DATA_SOURCE_STYLE[s.data_source]}`}
                    >
                      {DATA_SOURCE_LABEL[s.data_source]}
                    </span>
                  )}
                  {s.ai_platforms_found > 0 && (
                    <span className="rounded-full bg-violet-400/15 px-1.5 py-0.5 text-[10px] font-medium text-violet-300">
                      AI found {s.ai_platforms_found} via {s.ai_provider}
                    </span>
                  )}
                  <span className="text-[11px] text-white/30">
                    {s.result_count} result{s.result_count === 1 ? "" : "s"}
                    {s.ip ? ` · ${s.ip}` : ""}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "logins" && (
          <div className="space-y-1.5">
            <div className="mb-2 flex justify-end">
              <button onClick={loadLogs} className="text-[11px] text-white/30 hover:text-white/60">
                refresh
              </button>
            </div>
            {loginLogs.length === 0 && (
              <p className="text-xs text-white/30">No login attempts logged yet.</p>
            )}
            {loginLogs.map((l) => (
              <div
                key={l.id}
                className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2 text-sm"
              >
                <span className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                      l.success ? "bg-emerald-400/15 text-emerald-300" : "bg-red-400/15 text-red-300"
                    }`}
                  >
                    {l.success ? "success" : "failed"}
                  </span>
                  <span className="text-white/40">{l.ip ?? "unknown ip"}</span>
                </span>
                <span className="text-xs text-white/30">{timeAgo(l.created_at)}</span>
              </div>
            ))}
          </div>
        )}

        {tab === "activity" && (
          <div className="space-y-1.5">
            <div className="mb-2 flex justify-end">
              <button onClick={loadLogs} className="text-[11px] text-white/30 hover:text-white/60">
                refresh
              </button>
            </div>
            {keyLogs.length === 0 && <p className="text-xs text-white/30">No key activity logged yet.</p>}
            {keyLogs.map((l) => (
              <div
                key={l.id}
                className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-3 py-2 text-sm"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${OUTCOME_STYLE[l.outcome]}`}
                  >
                    {l.outcome}
                  </span>
                  <span className="shrink-0 text-xs uppercase text-white/50">{l.provider}</span>
                  <span className="truncate text-white/40">
                    {l.context ?? l.error_message ?? l.key_preview}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-white/30">{timeAgo(l.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
