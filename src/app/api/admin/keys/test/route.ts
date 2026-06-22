import { NextRequest, NextResponse } from "next/server";
import { isValidAdminSession } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabase";
import { testProviderKey } from "@/lib/keyPool";

export async function POST(req: NextRequest) {
  const token = req.cookies.get("admin_session")?.value;
  if (!(await isValidAdminSession(token))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { id, provider, key_value } = body as {
    id?: string;
    provider?: string;
    key_value?: string;
  };

  let testProvider = provider;
  let testKey = key_value;

  if (id) {
    const db = supabaseAdmin();
    const { data, error } = await db
      .from("api_key_pool")
      .select("provider, key_value")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return NextResponse.json({ error: "key not found" }, { status: 404 });
    testProvider = data.provider;
    testKey = data.key_value;
  }

  if (!testProvider || !["gemini", "openai"].includes(testProvider) || !testKey?.trim()) {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }

  const result = await testProviderKey(testProvider as "gemini" | "openai", testKey.trim());
  return NextResponse.json(result);
}
