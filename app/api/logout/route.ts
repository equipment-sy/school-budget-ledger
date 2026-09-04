import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, cookieOptions } from "../../../lib/session";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE_NAME, "", { ...cookieOptions(), maxAge: 0 });
  return res;
}
