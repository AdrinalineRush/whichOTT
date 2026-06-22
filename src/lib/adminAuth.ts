// Session handling for the hidden admin panel. Sessions live in Supabase
// (not in-memory — serverless functions don't persist memory between
// invocations) and are looked up by an opaque random token stored in an
// httpOnly cookie. The admin password itself never leaves the server.

import { supabaseAdmin } from "./supabase";

const SESSION_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

export async function createAdminSession(): Promise<string> {
  const token = crypto.randomUUID();
  const db = supabaseAdmin();
  await db.from("admin_sessions").insert({
    token,
    expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
  });
  return token;
}

export async function isValidAdminSession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const db = supabaseAdmin();
  const { data } = await db
    .from("admin_sessions")
    .select("expires_at")
    .eq("token", token)
    .maybeSingle();
  if (!data) return false;
  return new Date(data.expires_at).getTime() > Date.now();
}

export async function destroyAdminSession(token: string | undefined): Promise<void> {
  if (!token) return;
  const db = supabaseAdmin();
  await db.from("admin_sessions").delete().eq("token", token);
}

export async function logLoginAttempt(
  success: boolean,
  ip: string | null,
  userAgent: string | null
): Promise<void> {
  const db = supabaseAdmin();
  await db.from("admin_login_log").insert({ success, ip, user_agent: userAgent });
}
