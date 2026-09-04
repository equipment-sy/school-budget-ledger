import { NextRequest } from "next/server";

export function getIdentity(req: NextRequest) {
  const userId = req.headers.get("x-user-id");
  const role = req.headers.get("x-user-role") as "director" | "leader" | null;
  const departmentId = req.headers.get("x-user-department") || null;
  if (!userId || !role) return null;
  return { userId, role, departmentId };
}
