import { getSession, staffRole, normRoll } from '@/lib/auth';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

/** Admin only: clears the login rate-limit counters for one register number. */
export async function POST(req: Request) {
  const s = await getSession();
  if (!s || s.role !== 'admin' || (await staffRole(s.sub))?.role !== 'admin') return new Response('Forbidden', { status: 403 });
  const roll = normRoll(new URL(req.url).searchParams.get('roll'));
  if (!/^[A-Z0-9]{6,40}$/.test(roll)) return new Response('Bad request', { status: 400 });
  const sql = await db();
  const r = await sql`delete from rate_limits where key like ${'%' + roll} returning key`;
  return Response.json({ cleared: r.length });
}
