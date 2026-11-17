import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { readBlob } from '@/lib/storage';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response('Not found', { status: 404 });
  const s = await getSession();
  if (!s) return new Response('Unauthorized', { status: 401 });
  const sql = await db();
  const f = (await sql`select id, team_id, kind, filename, blob_path from files where id = ${id}`)[0];
  if (!f) return new Response('Not found', { status: 404 });

  if (s.role === 'student') {
    const m = await sql`select 1 from team_members where roll_no = ${s.sub} and team_id = ${f.team_id}`;
    if (!m.length) return new Response('Forbidden', { status: 403 });
  }
  const blob = await readBlob(f.blob_path);
  if (!blob) return new Response('File unavailable', { status: 404 });
  const isPdf = f.kind === 'pdf';
  const ext = isPdf ? 'pdf' : String(f.blob_path).split('.').pop();
  return new Response(blob.stream, {
    headers: {
      'Content-Type': isPdf ? 'application/pdf' : ext === 'png' ? 'image/png' : 'image/jpeg',
      'Content-Disposition': `inline; filename="${String(f.filename).replace(/"/g, '')}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:",
    },
  });
}
