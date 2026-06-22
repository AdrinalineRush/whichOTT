import { NextRequest, NextResponse } from "next/server";
import { createAdminSession, logLoginAttempt } from "@/lib/adminAuth";

function clientIp(req: NextRequest): string | null {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const password = typeof body.password === "string" ? body.password : "";
  const ip = clientIp(req);
  const userAgent = req.headers.get("user-agent");

  if (!password || password !== process.env.ADMIN_PASSWORD) {
    await logLoginAttempt(false, ip, userAgent);
    return NextResponse.json({ error: "invalid password" }, { status: 401 });
  }

  await logLoginAttempt(true, ip, userAgent);

  const token = await createAdminSession();
  const res = NextResponse.json({ ok: true });
  res.cookies.set("admin_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 4,
  });
  return res;
}
