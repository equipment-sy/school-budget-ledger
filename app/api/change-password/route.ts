import { NextRequest, NextResponse } from "next/server";
import { withUser } from "../../../lib/db";
import { getIdentity } from "../../../lib/identity";
import { verifyPassword, hashPassword } from "../../../lib/password";

export async function POST(req: NextRequest) {
  const identity = getIdentity(req);
  if (!identity) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const { current_password, new_password } = await req.json();
  if (!current_password || !new_password) {
    return NextResponse.json({ error: "請輸入目前密碼與新密碼" }, { status: 400 });
  }
  if (String(new_password).length < 6) {
    return NextResponse.json({ error: "新密碼至少需要 6 個字元" }, { status: 400 });
  }

  try {
    const ok = await withUser(identity.userId, async (query) => {
      const res = await query(`select password_hash from users where id = $1`, [identity.userId]);
      const row = res.rows[0];
      if (!row?.password_hash || !verifyPassword(current_password, row.password_hash)) return false;
      await query(`update users set password_hash = $2 where id = $1`, [identity.userId, hashPassword(new_password)]);
      return true;
    });
    if (!ok) return NextResponse.json({ error: "目前密碼不正確" }, { status: 401 });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "更新失敗" }, { status: 400 });
  }
}
