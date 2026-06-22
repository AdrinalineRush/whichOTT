import { NextRequest, NextResponse } from "next/server";
import { isValidAdminSession } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabase";

async function requireAuth(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get("admin_session")?.value;
  return isValidAdminSession(token);
}

export async function GET(req: NextRequest) {
  if (!(await requireAuth(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = supabaseAdmin();
  const [logins, keyActivity, searches] = await Promise.all([
    db
      .from("admin_login_log")
      .select("id, success, ip, user_agent, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
    db
      .from("key_pool_log")
      .select("id, provider, key_preview, outcome, context, error_message, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    db
      .from("search_log")
      .select(
        "id, query, matched_title, matched_year, tmdb_id, data_source, result_count, ai_platforms_found, ai_provider, ip, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  return NextResponse.json({
    logins: logins.data ?? [],
    keyActivity: keyActivity.data ?? [],
    searches: searches.data ?? [],
  });
}
