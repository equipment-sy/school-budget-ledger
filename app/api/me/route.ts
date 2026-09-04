import { NextRequest, NextResponse } from "next/server";
import { withUser } from "../../../lib/db";
import { getIdentity } from "../../../lib/identity";

export async function GET(req: NextRequest) {
  const identity = getIdentity(req);
  if (!identity) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const row = await withUser(identity.userId, async (query) => {
    const res = await query(
      `select u.id, u.name, u.role, u.department_id, d.name as department_name
       from users u left join departments d on d.id = u.department_id
       where u.id = $1`,
      [identity.userId]
    );
    return res.rows[0];
  });
  return NextResponse.json(row);
}
