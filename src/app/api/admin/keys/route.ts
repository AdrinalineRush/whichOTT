import { NextRequest, NextResponse } from "next/server";
import { isValidAdminSession } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabase";
import { mask } from "@/lib/keyPool";

async function requireAuth(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get("admin_session")?.value;
  return isValidAdminSession(token);
}

export async function GET(req: NextRequest) {
  if (!(await requireAuth(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("api_key_pool")
    .select("id, provider, label, is_active, cooldown_until, fail_count, key_value, created_at")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const keys = (data ?? []).map((k) => ({ ...k, key_value: mask(k.key_value) }));
  return NextResponse.json({ keys });
}

export async function POST(req: NextRequest) {
  if (!(await requireAuth(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const { provider, key_value, label } = body as {
    provider?: string;
    key_value?: string;
    label?: string | null;
  };

  if (!provider || !["gemini", "openai"].includes(provider) || !key_value?.trim()) {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { error } = await db
    .from("api_key_pool")
    .insert({ provider, key_value: key_value.trim(), label: label?.trim() || null });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!(await requireAuth(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const { id } = body as { id?: string };
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const db = supabaseAdmin();
  const { error } = await db.from("api_key_pool").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
