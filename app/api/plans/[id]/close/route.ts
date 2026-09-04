import { NextRequest, NextResponse } from "next/server";
import { withUser } from "../../../../../lib/db";
import { getIdentity } from "../../../../../lib/identity";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const identity = getIdentity(req);
  if (!identity) return NextResponse.json({ error: "未登入" }, { status: 401 });

  try {
    const row = await withUser(identity.userId, async (query) => {
      const res = await query(
        `update budget_plans
         set status = 'closed', closed_at = now(), closed_by = $2
         where id = $1
         returning *`,
        [params.id, identity.userId]
      );
      return res.rows[0];
    });
    if (!row) {
      // RLS silently filtered the row out rather than raising — not this
      // department's plan, or it doesn't exist.
      return NextResponse.json({ error: "找不到這個計畫，或沒有權限關帳" }, { status: 404 });
    }
    return NextResponse.json(row);
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "關帳失敗" }, { status: 400 });
  }
}
