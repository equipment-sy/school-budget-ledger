import { NextRequest, NextResponse } from "next/server";
import { withUser } from "../../../../../lib/db";
import { getIdentity } from "../../../../../lib/identity";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const identity = getIdentity(req);
  if (!identity) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const { reason } = await req.json();
  if (!reason || !reason.trim()) {
    return NextResponse.json({ error: "作廢時必須填寫原因" }, { status: 400 });
  }

  try {
    const row = await withUser(identity.userId, async (query) => {
      const res = await query(
        `update transactions
         set voided = true, voided_reason = $2, voided_by = $3, voided_at = now()
         where id = $1
         returning *`,
        [params.id, reason.trim(), identity.userId]
      );
      return res.rows[0];
    });
    if (!row) return NextResponse.json({ error: "找不到這筆紀錄，或沒有權限作廢" }, { status: 404 });
    return NextResponse.json(row);
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "作廢失敗" }, { status: 400 });
  }
}
