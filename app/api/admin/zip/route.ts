import { Zip, ZipPassThrough } from 'fflate';
import { getSession, staffRole } from '@/lib/auth';
import { db } from '@/lib/db';
import { slug } from '@/lib/data';
import { readBlobBuffer } from '@/lib/storage';
import { ZIP_BATCH as BATCH } from '@/lib/const';

export const runtime = 'nodejs';
export const maxDuration = 300;


/** Streams one batch of submissions (PDF + prototype photo per team) as a ZIP so they can be evaluated offline. */
export async function GET(req: Request) {
  const s = await getSession();
  if (!s || s.role !== 'admin' || (await staffRole(s.sub))?.role !== 'admin') return new Response('Forbidden', { status: 403 });
  const u = new URL(req.url);
  const phase = Number(u.searchParams.get('phase'));
  const batch = Math.max(0, Number(u.searchParams.get('batch') || 0));
  if (![1, 2, 3].includes(phase) || !Number.isInteger(batch)) return new Response('Bad request', { status: 400 });

  const sql = await db();
  const teams = await sql`
    select t.id, t.name, t.leader_roll,
      coalesce((select title from topics where claimed_by = t.id), t.custom->>'title') as topic,
      p.blob_path as pdf_path, p.filename as pdf_name,
      i.blob_path as img_path, i.filename as img_name
    from teams t
    join lateral (select blob_path, filename from files where team_id = t.id and phase = ${phase} and kind = 'pdf' order by created_at desc limit 1) p on true
    left join lateral (select blob_path, filename from files where team_id = t.id and phase = ${phase} and kind = 'image' order by created_at desc limit 1) i on true
    order by t.name, t.id limit ${BATCH} offset ${batch * BATCH}`;
  if (!teams.length) return new Response('No more submissions', { status: 404 });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const zip = new Zip((err, chunk, final) => {
        if (err) controller.error(err);
        else { controller.enqueue(chunk); if (final) controller.close(); }
      });
      const add = (name: string, data: Uint8Array) => {
        const f = new ZipPassThrough(name);
        zip.add(f);
        f.push(data, true);
      };
      const enc = new TextEncoder();
      try {
        add('manifest.json', enc.encode(JSON.stringify({
          phase, batch,
          teams: teams.map((t) => ({ team_id: t.id, team_name: t.name, leader_roll: t.leader_roll, topic: t.topic, folder: `${slug(t.name)}__${String(t.id).slice(0, 8)}` })),
        }, null, 2)));
        for (const t of teams) {
          const dir = `${slug(t.name)}__${String(t.id).slice(0, 8)}`;
          const pdf = await readBlobBuffer(t.pdf_path);
          if (pdf) add(`${dir}/report.pdf`, new Uint8Array(pdf));
          if (t.img_path) {
            const img = await readBlobBuffer(t.img_path);
            if (img) add(`${dir}/prototype.${String(t.img_path).split('.').pop()}`, new Uint8Array(img));
          }
        }
        zip.end();
      } catch (e) {
        controller.error(e);
      }
    },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="phase${phase}-batch${String(batch + 1).padStart(2, '0')}.zip"`,
      'Cache-Control': 'no-store',
    },
  });
}
