import { NextRequest, NextResponse } from "next/server";
import { destroyAdminSession } from "@/lib/adminAuth";

export async function POST(req: NextRequest) {
  const token = req.cookies.get("admin_session")?.value;
  await destroyAdminSession(token);
  const res = NextResponse.json({ ok: true });
  res.cookies.delete("admin_session");
  return res;
}
