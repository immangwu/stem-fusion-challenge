import { createHash } from 'node:crypto';
import { allow, getSession } from '@/lib/auth';
import { db, audit } from '@/lib/db';
import { getPhases, phaseState } from '@/lib/phases';
import { saveBlob } from '@/lib/storage';
import { back, sameOrigin } from '@/lib/web';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX = 4 * 1024 * 1024; // Vercel functions accept at most ~4.5 MB per request

function sniff(buf: Buffer): 'pdf' | 'jpg' | 'png' | null {
  if (buf.subarray(0, 5).toString('latin1') === '%PDF-') return 'pdf';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  return null;
}

export async function POST(req: Request) {
  const fail = (m: string) => back(req, '/dashboard', 'err', m);
  if (!sameOrigin(req)) return new Response('Forbidden', { status: 403 });
  const s = await getSession();
  if (!s || s.role !== 'student') return new Response('Unauthorized', { status: 401 });

  let fd: FormData;
  try { fd = await req.formData(); } catch { return fail('Upload failed. The file may be too large (limit 4 MB).'); }
  const phase = Number(fd.get('phase'));
  const kind = fd.get('kind') === 'image' ? 'image' : 'pdf';
  const file = fd.get('file');
  if (![1, 2, 3].includes(phase)) return fail('Invalid phase.');
  if (!(file instanceof File) || !file.size) return fail('Choose a file first.');
  if (file.size > MAX) return fail('File is larger than 4 MB. Compress it and try again.');
  if (kind === 'image' && fd.get('declare') !== 'on') return fail('Please confirm the photo is real and not AI-generated.');

  const sql = await db();
  const team = (await sql`select t.id from teams t where t.leader_roll = ${s.sub}`)[0];
  if (!team) return fail('Only the team leader can upload. Create a team first.');
  const p = (await getPhases()).find((x) => x.n === phase)!;
  const st = phaseState(p);
  if (st !== 'open') return fail(st === 'upcoming' ? `Phase ${phase} has not opened yet.` : `Phase ${phase} is closed.`);
  if (!(await allow(`upload:${team.id}:${phase}`, 12, 86400))) return fail('Upload limit reached for today. Contact the organisers if you need help.');

  const buf = Buffer.from(await file.arrayBuffer());
  const type = sniff(buf);
  if (kind === 'pdf' && type !== 'pdf') return fail('The report must be a PDF file.');
  if (kind === 'image' && type !== 'jpg' && type !== 'png') return fail('The prototype photo must be a JPG or PNG image.');

  const sha256 = createHash('sha256').update(buf).digest('hex');
  const ext = type!;
  const contentType = type === 'pdf' ? 'application/pdf' : type === 'png' ? 'image/png' : 'image/jpeg';
  const path = `submissions/${team.id}/phase${phase}-${kind}.${ext}`;
  const safeName = file.name.replace(/[^\w.\- ]+/g, '_').slice(0, 100) || `${kind}.${ext}`;
  try {
    const stored = await saveBlob(path, buf, contentType);
    await sql`insert into files(team_id, phase, kind, blob_path, filename, size, sha256, declared, uploaded_by)
              values (${team.id}, ${phase}, ${kind}, ${stored}, ${safeName}, ${buf.length}, ${sha256}, ${kind === 'image'}, ${s.sub})`;
    await audit(s.sub, 'upload', { phase, kind, size: buf.length });
  } catch (e) {
    console.error('upload failed', e);
    return fail('Storage error. Please try again in a minute.');
  }
  return back(req, '/dashboard', 'msg', `${kind === 'pdf' ? 'Report' : 'Prototype photo'} uploaded for Phase ${phase}.`);
}
