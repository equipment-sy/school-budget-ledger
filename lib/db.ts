import { Pool } from "@neondatabase/serverless";

// DATABASE_URL must point at the `app_leader` role (NOBYPASSRLS).
// Never use the Neon project's owner role here — it bypasses RLS entirely.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Runs `fn` inside a transaction with `app.current_user_id` set for the
 * duration of that transaction only (SET LOCAL semantics via set_config's
 * third argument = true). Every RLS policy in the schema reads this value
 * through the `auth_role()` / `auth_department()` helper functions, so this
 * is the single choke point that makes "who is asking" travel with every
 * query issued inside `fn`.
 */
export async function withUser<T>(
  userId: string,
  fn: (query: (text: string, params?: any[]) => Promise<any>) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select set_config('app.current_user_id', $1, true)", [userId]);
    const query = (text: string, params?: any[]) => client.query(text, params);
    const result = await fn(query);
    await client.query("commit");
    return result;
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * For the one pre-authentication query the app needs: looking up a user's
 * password hash by email during login. This goes through the
 * `login_lookup` SQL function, which is SECURITY DEFINER (owned by the
 * project owner, which bypasses RLS) so it can find the row before we know
 * who is asking. It intentionally exposes nothing beyond what login needs.
 */
export async function loginLookup(email: string) {
  const client = await pool.connect();
  try {
    const res = await client.query("select * from login_lookup($1)", [email]);
    return res.rows[0] ?? null;
  } finally {
    client.release();
  }
}
