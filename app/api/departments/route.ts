import { NextRequest, NextResponse } from "next/server";
import { withUser } from "../../../lib/db";
import { getIdentity } from "../../../lib/identity";

export async function GET(req: NextRequest) {
  const identity = getIdentity(req);
  if (!identity) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const rows = await withUser(identity.userId, async (query) => {
    const res = await query(`select id, code, name from departments order by code`);
    return res.rows;
  });
  return NextResponse.json(rows);
}
