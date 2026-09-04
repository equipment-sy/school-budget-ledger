import { NextRequest, NextResponse } from "next/server";
import { withUser } from "../../../lib/db";
import { getIdentity } from "../../../lib/identity";

// GET  /api/plans            -> plans visible to the caller (RLS decides scope)
// POST /api/plans             -> create a plan (leader only; RLS also enforces this)
export async function GET(req: NextRequest) {
  const identity = getIdentity(req);
  if (!identity) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const rows = await withUser(identity.userId, async (query) => {
    const res = await query(
      `select p.*, coalesce(sum(i.allocated_amount), 0) as allocated_total
       from budget_plans p
       left join budget_items i on i.plan_id = p.id
       group by p.id
       order by p.fiscal_year desc, p.department_id`
    );
    return res.rows;
  });

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const identity = getIdentity(req);
  if (!identity) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const { department_id, name, fiscal_year, period_type } = await req.json();
  if (!department_id || !name || !fiscal_year) {
    return NextResponse.json({ error: "缺少必要欄位" }, { status: 400 });
  }

  try {
    const row = await withUser(identity.userId, async (query) => {
      const res = await query(
        `insert into budget_plans (department_id, name, fiscal_year, period_type, created_by)
         values ($1, $2, $3, $4, $5) returning *`,
        [department_id, name, fiscal_year, period_type === "academic" ? "academic" : "calendar", identity.userId]
      );
      return res.rows[0];
    });
    return NextResponse.json(row, { status: 201 });
  } catch (err: any) {
    // RLS violations and unique-constraint hits both land here.
    return NextResponse.json({ error: err.message ?? "建立失敗" }, { status: 400 });
  }
}
