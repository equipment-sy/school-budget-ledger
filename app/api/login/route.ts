import { NextRequest, NextResponse } from "next/server";
import { loginLookup } from "../../../lib/db";
import { verifyPassword } from "../../../lib/password";
import { createSessionCookie } from "../../../lib/session";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  if (!email || !password) {
    return NextResponse.json({ error: "請輸入帳號與密碼" }, { status: 400 });
  }

  const user = await loginLookup(email);
  if (!user || !user.password_hash || !verifyPassword(password, user.password_hash)) {
    // Same message either way — don't reveal whether the email exists.
    return NextResponse.json({ error: "帳號或密碼錯誤" }, { status: 401 });
  }
  if (!user.active) {
    return NextResponse.json({ error: "此帳號已被停用，請聯絡教務主任" }, { status: 403 });
  }

  const cookie = await createSessionCookie({
    sub: user.id,
    role: user.role,
    department_id: user.department_id,
    name: user.name,
  });

  const res = NextResponse.json({ ok: true, name: user.name, role: user.role });
  res.cookies.set(cookie.name, cookie.value, cookie.options);
  return res;
}
