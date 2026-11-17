import { SignJWT, jwtVerify } from 'jose';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { db } from './db';
import { sendOtpEmail } from './email';

export type Role = 'student' | 'admin' | 'jury';
export type Session = { sub: string; role: Role; name: string };

const prod = process.env.NODE_ENV === 'production';
const COOKIE = prod ? '__Host-sfc' : 'sfc';

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('SESSION_SECRET must be set to a random string of 32+ characters');
  return s;
}
const key = () => new TextEncoder().encode(secret());

export const normRoll = (v: unknown) => String(v ?? '').toUpperCase().replace(/\s+/g, '').slice(0, 40);
export const normEmail = (v: unknown) => String(v ?? '').trim().toLowerCase().slice(0, 200);

export async function clientIp() {
  const h = await headers();
  return (h.get('x-forwarded-for')?.split(',')[0] || h.get('x-real-ip') || 'unknown').trim();
}

/** Fixed-window rate limiter stored in Postgres. Returns true when the call is allowed. */
export async function allow(k: string, max: number, windowSec: number) {
  const sql = await db();
  const now = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(now / windowSec);
  const r = await sql`
    insert into rate_limits(key, bucket, count, exp) values (${k}, ${bucket}, 1, ${now + windowSec * 2})
    on conflict (key, bucket) do update set count = rate_limits.count + 1 returning count`;
  if (Math.random() < 0.02) await sql`delete from rate_limits where exp < ${now}`;
  return Number(r[0].count) <= max;
}

const hash = (identifier: string, code: string) => createHmac('sha256', secret()).update(`${identifier}:${code}`).digest('hex');

export async function issueOtp(identifier: string, to: string, name: string, meta: string | null = null) {
  const sql = await db();
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await sql`update otps set used = true where identifier = ${identifier} and not used`;
  await sql`insert into otps(identifier, code_hash, expires_at, meta) values (${identifier}, ${hash(identifier, code)}, now() + interval '10 minutes', ${meta})`;
  await sendOtpEmail(to, name, code);
}

export async function checkOtp(identifier: string, code: string): Promise<{ ok: boolean; meta: string | null }> {
  const sql = await db();
  const rows = await sql`
    select id, code_hash, attempts, meta from otps
    where identifier = ${identifier} and not used and expires_at > now()
    order by created_at desc limit 1`;
  const row = rows[0];
  if (!row || row.attempts >= 5) return { ok: false, meta: null };
  await sql`update otps set attempts = attempts + 1 where id = ${row.id}`;
  const a = Buffer.from(row.code_hash as string, 'hex');
  const b = Buffer.from(hash(identifier, code.trim()), 'hex');
  const ok = a.length === b.length && timingSafeEqual(a, b);
  if (ok) await sql`update otps set used = true where id = ${row.id}`;
  return { ok, meta: ok ? (row.meta as string | null) : null };
}

/* ---- date of birth: stored only as a keyed hash (never in plain text) ---- */

/** Accepts yyyy-mm-dd, dd.mm.yyyy, dd/mm/yyyy, dd-mm-yyyy or a JS Date; returns yyyy-mm-dd or null. */
export function parseDob(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  const t = String(v ?? '').trim();
  let y = '', m = '', d = '';
  let x = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t);
  if (x) [, y, m, d] = x;
  else if ((x = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(t))) [, d, m, y] = x;
  else return null;
  const dt = new Date(Date.UTC(+y, +m - 1, +d));
  if (dt.getUTCFullYear() !== +y || dt.getUTCMonth() !== +m - 1 || dt.getUTCDate() !== +d) return null;
  return `${y}-${String(+m).padStart(2, '0')}-${String(+d).padStart(2, '0')}`;
}

export const dobHash = (roll: string, dobIso: string) => createHmac('sha256', secret()).update(`dob:${roll}:${dobIso}`).digest('hex');

export function dobMatches(stored: string | null | undefined, roll: string, dobIso: string) {
  if (!stored) return false;
  const a = Buffer.from(stored, 'hex'), b = Buffer.from(dobHash(roll, dobIso), 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

/* ---- short-lived proof that the DOB step passed (used only for first-time email binding) ---- */
const PRE = prod ? '__Host-sfc-pre' : 'sfc-pre';
export async function setPre(roll: string) {
  const t = await new SignJWT({ purpose: 'bind' }).setProtectedHeader({ alg: 'HS256' }).setSubject(roll).setIssuedAt().setExpirationTime('15m').sign(key());
  (await cookies()).set(PRE, t, { httpOnly: true, secure: prod, sameSite: 'lax', path: '/', maxAge: 900 });
}
export async function readPre(): Promise<string | null> {
  const t = (await cookies()).get(PRE)?.value;
  if (!t) return null;
  try {
    const { payload } = await jwtVerify(t, key(), { algorithms: ['HS256'] });
    return payload.purpose === 'bind' && payload.sub ? String(payload.sub) : null;
  } catch { return null; }
}
export async function clearPre() { (await cookies()).delete(PRE); }

export async function staffRole(email: string): Promise<{ role: 'admin' | 'jury'; name: string } | null> {
  const e = normEmail(email);
  const admins = (process.env.ADMIN_EMAILS || '').split(',').map(normEmail).filter(Boolean);
  if (admins.includes(e)) return { role: 'admin', name: e };
  const sql = await db();
  const r = await sql`select role, name from staff where email = ${e}`;
  return r[0] ? { role: r[0].role, name: r[0].name || e } : null;
}

export async function createSession(s: Session) {
  const ttl = s.role === 'student' ? 3 * 24 * 3600 : 4 * 3600;
  const token = await new SignJWT({ ...s }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime(`${ttl}s`).sign(key());
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure: prod, sameSite: 'lax', path: '/', maxAge: ttl });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export async function getSession(): Promise<Session | null> {
  const t = (await cookies()).get(COOKIE)?.value;
  if (!t) return null;
  try {
    const { payload } = await jwtVerify(t, key(), { algorithms: ['HS256'] });
    const role = payload.role as Role;
    if (!['student', 'admin', 'jury'].includes(role)) return null;
    return { sub: String(payload.sub ?? ''), role, name: String(payload.name ?? '') };
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect('/login');
  return s;
}

export async function requireStudent() {
  const s = await requireSession();
  if (s.role !== 'student') redirect(s.role === 'admin' ? '/admin' : '/jury');
  return s;
}

/** Admin pages; also re-checks that the account still has staff access (so removal takes effect immediately). */
export async function requireAdmin() {
  const s = await requireSession();
  if (s.role !== 'admin') redirect(s.role === 'jury' ? '/jury' : '/dashboard');
  const r = await staffRole(s.sub);
  if (r?.role !== 'admin') redirect('/login');
  return s;
}

export async function requireJury() {
  const s = await requireSession();
  if (s.role === 'student') redirect('/dashboard');
  const r = await staffRole(s.sub);
  if (!r) redirect('/login');
  return s;
}
