import { NextRequest, NextResponse } from "next/server";
import { withUser } from "../../../lib/db";
import { getIdentity } from "../../../lib/identity";

export async function GET(req: NextRequest) {
  const identity = getIdentity(req);
  if (!identity) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const rows = await withUser(identity.userId, async (query) => {
    const res = await query(`select * from budget_item_balances order by name`);
    return res.rows;
  });
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const identity = getIdentity(req);
  if (!identity) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const { plan_id, department_id, name, allocated_amount } = await req.json();
  if (!plan_id || !department_id || !name || !allocated_amount) {
    return NextResponse.json({ error: "缺少必要欄位" }, { status: 400 });
  }

  try {
    const row = await withUser(identity.userId, async (query) => {
      const res = await query(
        `insert into budget_items (plan_id, department_id, name, allocated_amount, created_by)
         values ($1, $2, $3, $4, $5) returning *`,
        [plan_id, department_id, name, allocated_amount, identity.userId]
      );
      return res.rows[0];
    });
    return NextResponse.json(row, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "建立失敗" }, { status: 400 });
  }
}
