// Rotates across several free-tier API keys per provider so one exhausted
// quota doesn't take a feature down. Keys live in Supabase, written only
// through the admin panel — never in env vars, never sent to the browser.
// Every attempt (success, failure, or cooldown) is logged to key_pool_log
// so the admin panel can show exactly what the pool is doing.

import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { supabaseAdmin } from "./supabase";

export type Provider = "gemini" | "openai";

const COOLDOWN_MS = 60 * 60 * 1000; // 1 hour after a quota/rate-limit error

// Minimum gap between attempts to the SAME provider, across all its keys.
// The web_search-tool call burns a large token chunk before the model even
// gets a chance to fail on a rate limit — so back-to-back attempts during a
// rate-limited window each get billed for a guaranteed failure. This skips
// the call entirely (no request sent, nothing billed) if we tried this
// provider too recently, instead of relying solely on per-key cooldown.
const MIN_GAP_MS = 30 * 1000;

export function mask(key: string): string {
  if (key.length <= 8) return "••••";
  return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}

function looksLikeQuotaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const status = (err as { status?: number })?.status;
  return status === 429 || /quota|rate.?limit|resource_exhausted/i.test(msg);
}

type PoolRow = { id: string; key_value: string; fail_count: number };

async function attemptedTooRecently(provider: Provider): Promise<boolean> {
  const db = supabaseAdmin();
  const { data } = await db
    .from("key_pool_log")
    .select("created_at")
    .eq("provider", provider)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return false;
  return Date.now() - new Date(data.created_at).getTime() < MIN_GAP_MS;
}

async function activeKeys(provider: Provider): Promise<PoolRow[]> {
  const db = supabaseAdmin();
  const { data } = await db
    .from("api_key_pool")
    .select("id, key_value, fail_count")
    .eq("provider", provider)
    .eq("is_active", true)
    .or(`cooldown_until.is.null,cooldown_until.lt.${new Date().toISOString()}`)
    .order("last_used_at", { ascending: true, nullsFirst: true });
  return data ?? [];
}

async function logAttempt(
  keyId: string,
  provider: Provider,
  keyValue: string,
  outcome: "success" | "fail" | "cooldown",
  context: string | undefined,
  errorMessage: string | null
) {
  const db = supabaseAdmin();
  await db.from("key_pool_log").insert({
    key_id: keyId,
    provider,
    key_preview: mask(keyValue),
    outcome,
    context: context ?? null,
    error_message: errorMessage,
  });
}

/**
 * Tries every available key for a provider, least-recently-used first, until
 * `attempt` succeeds. A key that fails with a quota/rate-limit error gets a
 * 1-hour cooldown and the pool moves on to the next one. `context` (e.g. the
 * movie title being checked) is purely for the audit log.
 */
export async function tryProviderPool<T>(
  provider: Provider,
  attempt: (key: string) => Promise<T>,
  context?: string
): Promise<T | null> {
  if (await attemptedTooRecently(provider)) return null;

  const db = supabaseAdmin();
  const keys = await activeKeys(provider);

  for (const k of keys) {
    try {
      const result = await attempt(k.key_value);
      await db
        .from("api_key_pool")
        .update({ last_used_at: new Date().toISOString(), fail_count: 0 })
        .eq("id", k.id);
      await logAttempt(k.id, provider, k.key_value, "success", context, null);
      return result;
    } catch (err) {
      const quota = looksLikeQuotaError(err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      await db
        .from("api_key_pool")
        .update({
          last_used_at: new Date().toISOString(),
          fail_count: k.fail_count + 1,
          cooldown_until: quota ? new Date(Date.now() + COOLDOWN_MS).toISOString() : null,
        })
        .eq("id", k.id);
      await logAttempt(
        k.id,
        provider,
        k.key_value,
        quota ? "cooldown" : "fail",
        context,
        errorMessage
      );
      // fall through to the next key in the pool
    }
  }
  return null;
}

/**
 * A minimal REAL generation call (no web-search tool, tiny prompt) against
 * the provider — used by the admin panel's "Test" button. A plain
 * models.list() only proves the key is authentic; it does NOT prove the
 * account has usable quota/billing, since listing models is free but actual
 * completions are billed. This call is cheap (a few tokens) but real,
 * so a "no quota" key fails here instead of silently passing and then
 * 429-ing on the first real search. Does not touch the key pool's
 * cooldown/fail-count state — this is a standalone probe.
 */
export async function testProviderKey(
  provider: Provider,
  key: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    if (provider === "gemini") {
      const ai = new GoogleGenAI({ apiKey: key });
      await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: "Reply with just the word OK.",
      });
    } else {
      const client = new OpenAI({ apiKey: key });
      await client.responses.create({
        model: "gpt-5.5",
        input: "Reply with just the word OK.",
      });
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}
