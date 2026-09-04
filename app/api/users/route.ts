import { NextRequest, NextResponse } from "next/server";
import { withUser } from "../../../lib/db";
import { getIdentity } from "../../../lib/identity";
import { hashPassword, randomTempPassword } from "../../../lib/password";

// GET  /api/users  -> director-only user list (RLS: director sees all, leader sees only self)
// POST /api/users  -> director creates a new leader account; returns the
//                     one-time temp password (there is no mail server, so
//                     the director hands it to the group leader directly).
export async function GET(req: NextRequest) {
  const identity = getIdentity(req);
  if (!identity) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const rows = await withUser(identity.userId, async (query) => {
    const res = await query(
      `select id, name, email, role, department_id, active, created_at from users order by role, name`
    );
    return res.rows;
  });
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const identity = getIdentity(req);
  if (!identity) return NextResponse.json({ error: "未登入" }, { status: 401 });
  if (identity.role !== "director") {
    return NextResponse.json({ error: "只有教務主任可以建立帳號" }, { status: 403 });
  }

  const { name, email, department_id } = await req.json();
  if (!name || !email || !department_id) {
    return NextResponse.json({ error: "缺少必要欄位" }, { status: 400 });
  }

  const tempPassword = randomTempPassword();
  const passwordHash = hashPassword(tempPassword);

  try {
    const row = await withUser(identity.userId, async (query) => {
      const res = await query(
        `insert into users (name, email, role, department_id, password_hash)
         values ($1, $2, 'leader', $3, $4)
         returning id, name, email, role, department_id`,
        [name, email, department_id, passwordHash]
      );
      return res.rows[0];
    });
    return NextResponse.json({ ...row, temp_password: tempPassword }, { status: 201 });
  } catch (err: any) {
    const msg = err.message?.includes("users_email_key")
      ? "這個 Email 已經建立過帳號了，不能重複建立。如果密碼遺失，請聯絡系統管理員重設。"
      : err.message ?? "建立失敗";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
