import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Browser/public client. Uses the anon key. RLS lets it READ titles +
 * availability and INSERT reports — nothing else. Safe to use anywhere.
 */
export const supabase = createClient(url, anonKey);

/**
 * Server-only client. Uses the service_role key, which BYPASSES RLS so it
 * can write titles/availability and read the reports queue.
 *
 * NEVER import this into a Client Component — it would leak the secret key
 * to the browser. Only use it inside API routes / server code.
 */
export function supabaseAdmin() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
