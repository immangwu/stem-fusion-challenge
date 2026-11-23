import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getSession } from '@/lib/auth';
import { leaderboard, myTeam, rankRows } from '@/lib/data';
import { getEvent } from '@/lib/phases';
import { shareCardJsx } from '@/lib/shareCard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';


async function dataUri(file: string) {
  const b = await readFile(path.join(process.cwd(), 'public', file));
  return `data:image/png;base64,${b.toString('base64')}`;
}

export async function GET(req: Request) {
  const s = await getSession();
  if (!s || s.role !== 'student') return new Response('Please log in as a student.', { status: 401 });
  const data = await myTeam(s.sub);
  if (!data) return new Response('Create or join a team first.', { status: 404 });
  const url = new URL(req.url);
  const story = url.searchParams.get('format') === 'story';
  const dl = url.searchParams.get('dl') === '1';
  const W = 1080, H = story ? 1920 : 1080;

  const font = (f: string) => readFile(path.join(process.cwd(), 'public', 'fonts', f));
  const [ev, lb, sc, iic, fb, fx] = await Promise.all([getEvent(), leaderboard(), dataUri('science-club-logo.png'), dataUri('iic-logo.png'), font('Inter-Bold.otf'), font('Inter-ExtraBold.otf')]);
  const rows = rankRows(lb, ev.juryPublished, ev.published);
  const me = rows.find((r) => r.id === data.team.id);
  const scored = !!me && me.p1 !== null;
  const names = [data.members.find((m) => m.roll_no === data.team.leader_roll), ...data.members.filter((m) => m.roll_no !== data.team.leader_roll)]
    .filter(Boolean).map((m) => m!.name.replace(/\s*[(\[].*$/, '').trim());
  const topic = data.topic?.title ?? (data.team.custom_status === 'approved' ? (data.team.custom?.title as string | undefined) : undefined) ?? 'Topic selection in progress';
  const img = shareCardJsx({ W, H, story, sc, iic, names, topic, teamName: data.team.name, score: scored && me ? { p1: me.p1 as number, rank: me.rank } : null });

  const res = new ImageResponse(img, { width: W, height: H, fonts: [{ name: 'Inter', data: fb, weight: 700, style: 'normal' }, { name: 'Inter', data: fx, weight: 800, style: 'normal' }] });
  const headers = new Headers(res.headers);
  headers.set('Cache-Control', 'private, no-store');
  if (dl) headers.set('Content-Disposition', `attachment; filename="STEM-Fusion-${story ? 'story' : 'post'}.png"`);
  return new Response(res.body, { headers });
}
