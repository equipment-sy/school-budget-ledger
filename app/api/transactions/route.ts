import { NextRequest, NextResponse } from "next/server";
import { withUser } from "../../../lib/db";
import { getIdentity } from "../../../lib/identity";

export async function GET(req: NextRequest) {
  const identity = getIdentity(req);
  if (!identity) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const budgetItemId = req.nextUrl.searchParams.get("budget_item_id");
  const departmentId = req.nextUrl.searchParams.get("department_id");
  const month = req.nextUrl.searchParams.get("month"); // "YYYY-MM"

  const rows = await withUser(identity.userId, async (query) => {
    if (budgetItemId) {
      const res = await query(`select * from transactions where budget_item_id = $1 order by tx_date, created_at`, [budgetItemId]);
      return res.rows;
    }
    if (departmentId && month) {
      const res = await query(
        `select * from transactions
         where department_id = $1 and to_char(tx_date, 'YYYY-MM') = $2
         order by tx_date desc, created_at desc`,
        [departmentId, month]
      );
      return res.rows;
    }
    if (departmentId) {
      const res = await query(
        `select * from transactions where department_id = $1 order by tx_date, created_at`,
        [departmentId]
      );
      return res.rows;
    }
    const res = await query(`select * from transactions order by tx_date desc, created_at desc`);
    return res.rows;
  });
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const identity = getIdentity(req);
  if (!identity) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const { budget_item_id, department_id, plan_id, tx_date, amount, note, handler_name } = await req.json();
  if (!budget_item_id || !department_id || !plan_id || !tx_date || !amount || !note) {
    return NextResponse.json({ error: "缺少必要欄位" }, { status: 400 });
  }

  try {
    const row = await withUser(identity.userId, async (query) => {
      const res = await query(
        `insert into transactions
           (budget_item_id, department_id, plan_id, tx_date, amount, note, handler_name, created_by)
         values ($1, $2, $3, $4, $5, $6, $7, $8)
         returning *`,
        [budget_item_id, department_id, plan_id, tx_date, amount, note, handler_name ?? null, identity.userId]
      );
      return res.rows[0];
    });
    return NextResponse.json(row, { status: 201 });
  } catch (err: any) {
    // Surfaces both RLS violations and the closed-plan / append-only
    // triggers' Chinese error messages straight to the UI.
    return NextResponse.json({ error: err.message ?? "登記失敗" }, { status: 400 });
  }
}
