import { NextRequest, NextResponse } from "next/server";
import { withUser } from "../../../../lib/db";
import { getIdentity } from "../../../../lib/identity";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const identity = getIdentity(req);
  if (!identity) return NextResponse.json({ error: "未登入" }, { status: 401 });
  if (identity.role !== "director") {
    return NextResponse.json({ error: "只有教務主任可以管理帳號" }, { status: 403 });
  }
  if (identity.userId === params.id) {
    return NextResponse.json({ error: "不能停用自己的帳號" }, { status: 400 });
  }

  const { active } = await req.json();
  if (typeof active !== "boolean") {
    return NextResponse.json({ error: "缺少必要欄位" }, { status: 400 });
  }

  try {
    const row = await withUser(identity.userId, async (query) => {
      const res = await query(
        `update users set active = $2 where id = $1 and role = 'leader' returning id, name, email, active`,
        [params.id, active]
      );
      return res.rows[0];
    });
    if (!row) return NextResponse.json({ error: "找不到這個帳號" }, { status: 404 });
    return NextResponse.json(row);
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "更新失敗" }, { status: 400 });
  }
}
