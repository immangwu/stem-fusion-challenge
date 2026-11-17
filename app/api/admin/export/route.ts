import { getSession, staffRole } from '@/lib/auth';
import { db } from '@/lib/db';
import { toCsv } from '@/lib/csv';
import { leaderboard, rankRows } from '@/lib/data';
import { getPhases, phaseState } from '@/lib/phases';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(req: Request) {
  const s = await getSession();
  if (!s || s.role !== 'admin' || (await staffRole(s.sub))?.role !== 'admin') return new Response('Forbidden', { status: 403 });
  const type = new URL(req.url).searchParams.get('type') || '';
  const sql = await db();
  let rows: (string | number | null)[][] = [];

  if (type === 'unregistered') {
    rows = [['roll_no', 'name', 'email', 'dept', 'section']];
    const r = await sql`select s.roll_no, s.name, s.email, s.dept, s.section from students s
      left join team_members m on m.roll_no = s.roll_no where m.roll_no is null order by s.dept, s.section, s.roll_no`;
    r.forEach((x) => rows.push([x.roll_no, x.name, x.email, x.dept, x.section]));
  } else if (type === 'teams') {
    rows = [['team', 'leader_roll', 'members', 'topic', 'custom_topic', 'custom_status', 'p1_pdf', 'p2_pdf', 'p3_pdf', 'p1_img', 'p2_img', 'p3_img']];
    const r = await sql`
      select t.name, t.leader_roll, t.custom->>'title' as custom_title, t.custom_status,
        (select string_agg(s.roll_no || ' ' || s.name, '; ' order by s.roll_no) from team_members m join students s using (roll_no) where m.team_id = t.id) as members,
        (select title from topics where claimed_by = t.id) as topic,
        (select array_agg(distinct phase || kind) from files where team_id = t.id) as f
      from teams t order by t.name`;
    r.forEach((x) => {
      const f: string[] = x.f || [];
      rows.push([x.name, x.leader_roll, x.members, x.topic, x.custom_title, x.custom_status,
        ...[1, 2, 3].map((p) => (f.includes(`${p}pdf`) ? 'yes' : 'no')), ...[1, 2, 3].map((p) => (f.includes(`${p}image`) ? 'yes' : 'no'))]);
    });
  } else if (type === 'incomplete') {
    const phases = await getPhases();
    const closed = phases.filter((p) => phaseState(p) === 'closed').map((p) => p.n);
    rows = [['team', 'leader_roll', 'missing_phases_closed']];
    const r = await sql`
      select t.name, t.leader_roll, (select array_agg(distinct phase) from files where team_id = t.id and kind = 'pdf') as have from teams t order by t.name`;
    r.forEach((x) => {
      const have: number[] = x.have || [];
      const miss = closed.filter((p) => !have.includes(p));
      if (miss.length) rows.push([x.name, x.leader_roll, miss.join(' ')]);
    });
  } else if (type === 'marks') {
    rows = [['rank', 'team', 'maths_p1', 'chemistry_p2', 'physics_p3', 'jury_avg', 'total']];
    rankRows(await leaderboard(), true).forEach((x) => rows.push([x.rank, x.name, x.p1, x.p2, x.p3, x.jury === null ? null : Math.round(x.jury * 100) / 100, Math.round(x.total * 100) / 100]));
  } else if (type.startsWith('manifest')) {
    const phase = Number(type.replace('manifest', ''));
    if (![1, 2, 3].includes(phase)) return new Response('Bad request', { status: 400 });
    rows = [['team_id', 'team_name', 'leader_roll', 'topic', 'pdf_file', 'pdf_uploaded', 'has_prototype_photo', 'status']];
    const r = await sql`
      select t.id, t.name, t.leader_roll, coalesce((select title from topics where claimed_by = t.id), t.custom->>'title') as topic,
        f.filename, f.created_at,
        exists(select 1 from files i where i.team_id = t.id and i.phase = ${phase} and i.kind = 'image') as img,
        e.status
      from teams t
      left join lateral (select filename, created_at from files where team_id = t.id and phase = ${phase} and kind = 'pdf' order by created_at desc limit 1) f on true
      left join evaluations e on e.team_id = t.id and e.phase = ${phase}
      order by t.name`;
    r.forEach((x) => rows.push([x.id, x.name, x.leader_roll, x.topic, x.filename, x.created_at ? new Date(x.created_at).toISOString() : null, x.img ? 'yes' : 'no', x.status || (x.filename ? 'not evaluated' : 'no submission')]));
  } else return new Response('Bad request', { status: 400 });

  return new Response('﻿' + toCsv(rows), {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${type}.csv"`, 'Cache-Control': 'no-store' },
  });
}
