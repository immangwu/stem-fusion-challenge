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
  } else if (type === 'seating') {
    rows = [['team', 'leader_roll', 'roll_no', 'name', 'dept', 'section']];
    const r = await sql`
      select t.name, t.leader_roll, s.roll_no, s.name as sname, s.dept, s.section
      from teams t join team_members m on m.team_id = t.id join students s on s.roll_no = m.roll_no
      order by t.name, s.roll_no`;
    r.forEach((x) => rows.push([x.name, x.leader_roll, x.roll_no, x.sname, x.dept, x.section]));
  } else if (type === 'seatingplan') {
    // Room = department with a strict majority of the team's members; otherwise (mixed, tie, MECH) Hall 242.
    const ROOMS: Record<string, string[]> = { CSE: ['237 (CSE A)', '238 (CSE B)', '239 (CSE C)'], IT: ['240 (IT)'], AIDS: ['244 (AIDS)'], ECE: ['245 (ECE A)', '246 (ECE B)'], EEE: ['247 (EEE)'] };
    const r = await sql`
      select t.name, t.leader_roll,         (select array_agg(coalesce(s.dept, '?') order by s.roll_no) from team_members m join students s using (roll_no) where m.team_id = t.id) as depts
      from teams t order by t.leader_roll, t.name`;
    const teams = r.map((x) => {
      const d: string[] = x.depts || [];
      const cnt: Record<string, number> = {};
      d.forEach((k) => (cnt[k] = (cnt[k] || 0) + 1));
      const top = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
      const major = top && top[1] * 2 > d.length ? top[0] : null;
      return { name: x.name as string, leader: x.leader_roll as string, d, major };
    });
    const byDept: Record<string, typeof teams> = {};
    teams.forEach((t) => { if (t.major && ROOMS[t.major]) (byDept[t.major] ||= []).push(t); });
    const room = new Map<string, string>();
    Object.entries(byDept).forEach(([k, list]) => list.forEach((t, i) => room.set(t.name, ROOMS[k][Math.floor((i * ROOMS[k].length) / list.length)])));
    rows = [['room', 'team', 'leader_roll', 'members_depts']];
    teams.forEach((t) => rows.push([room.get(t.name) || '242 (Hall)', t.name, t.leader, t.d.join('/')]));
    rows.sort((a, b) => String(a[0]).localeCompare(String(b[0])) || String(a[1]).localeCompare(String(b[1])));
  } else if (type === 'seatingfull') {
    // 10 teams per classroom; majority-department teams fill their rooms (purest teams first), the rest go to Hall 242.
    const ROOMS: Record<string, string[]> = { CSE: ['237 (CSE A)', '238 (CSE B)', '239 (CSE C)'], IT: ['240 (IT)'], AIDS: ['244 (AIDS)'], ECE: ['245 (ECE A)', '246 (ECE B)'], EEE: ['247 (EEE)'] };
    const r = await sql`
      select t.name, t.leader_roll, coalesce((select title from topics where claimed_by = t.id), t.custom->>'title') as topic,
        (select array_agg(s.name || ' [' || coalesce(s.dept, '?') || ']' || case when s.roll_no = t.leader_roll then ' (Leader)' else '' end order by (s.roll_no = t.leader_roll) desc, s.roll_no)
         from team_members m join students s using (roll_no) where m.team_id = t.id) as members,
        (select array_agg(coalesce(s.dept, '?')) from team_members m join students s using (roll_no) where m.team_id = t.id) as depts
      from teams t order by t.leader_roll`;
    const teams = r.map((x) => {
      const d: string[] = x.depts || [];
      const cnt: Record<string, number> = {};
      d.forEach((k) => (cnt[k] = (cnt[k] || 0) + 1));
      const top = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
      const major = top && top[1] * 2 > d.length ? top[0] : null;
      return { name: x.name as string, topic: (x.topic || '') as string, members: (x.members || []) as string[], major, purity: top ? top[1] / d.length : 0 };
    });
    const room = new Map<string, string>();
    Object.keys(ROOMS).forEach((k) => {
      const list = teams.filter((t) => t.major === k);
      const cap = ROOMS[k].length * 10;
      const keep = [...list].sort((a, b) => b.purity - a.purity || list.indexOf(a) - list.indexOf(b)).slice(0, cap);
      const ordered = list.filter((t) => keep.includes(t));
      ordered.forEach((t, i) => room.set(t.name, ROOMS[k][Math.floor(i / 10)]));
    });
    const lines = teams.map((t) => [room.get(t.name) || '242 (Hall)', t.name, t.topic, t.members.join('; ')].join('|'));
    lines.sort((a, b) => a.localeCompare(b));
    return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
  } else return new Response('Bad request', { status: 400 });

  if (new URL(req.url).searchParams.get('inline') === '1') {
    return new Response(toCsv(rows), { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
  }

  return new Response('﻿' + toCsv(rows), {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${type}.csv"`, 'Cache-Control': 'no-store' },
  });
}
