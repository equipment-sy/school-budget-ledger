import { NextRequest, NextResponse } from "next/server";
import { withUser } from "../../../../../lib/db";
import { getIdentity } from "../../../../../lib/identity";
import { hashPassword, randomTempPassword } from "../../../../../lib/password";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const identity = getIdentity(req);
  if (!identity) return NextResponse.json({ error: "未登入" }, { status: 401 });
  if (identity.role !== "director") {
    return NextResponse.json({ error: "只有教務主任可以重設密碼" }, { status: 403 });
  }
  if (identity.userId === params.id) {
    return NextResponse.json({ error: "請用一般方式登入，不能透過這裡重設自己的密碼" }, { status: 400 });
  }

  const tempPassword = randomTempPassword();
  const passwordHash = hashPassword(tempPassword);

  try {
    const row = await withUser(identity.userId, async (query) => {
      const res = await query(
        `update users set password_hash = $2 where id = $1 and role = 'leader' returning id, name, email`,
        [params.id, passwordHash]
      );
      return res.rows[0];
    });
    if (!row) return NextResponse.json({ error: "找不到這個帳號" }, { status: 404 });
    return NextResponse.json({ ...row, temp_password: tempPassword });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "重設失敗" }, { status: 400 });
  }
}
