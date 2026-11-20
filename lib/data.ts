import { unstable_cache } from 'next/cache';
import { db } from './db';

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Member = { roll_no: string; name: string; dept: string | null; section: string | null };
export type Team = {
  id: string; name: string; leader_roll: string; custom: any; custom_status: string | null; custom_review: any; created_at: string;
};
export type FileRow = { id: string; team_id: string; phase: number; kind: 'pdf' | 'image'; filename: string; size: number; created_at: string };
export type EvalRow = {
  team_id: string; phase: number; status: string; scores: Record<string, { score: number; reason: string }> | null;
  total: number | null; summary: string | null; flags: string[]; override_total: number | null; override_note: string | null;
  reeval_requested: boolean; updated_at: string;
};

export async function getStudent(roll: string) {
  const sql = await db();
  const r = await sql`select roll_no, name, email, dept, section, dob_hash from students where roll_no = ${roll}`;
  return r[0] as { roll_no: string; name: string; email: string | null; dept: string | null; section: string | null; dob_hash: string | null } | undefined;
}

export async function myTeam(roll: string) {
  const sql = await db();
  const t = await sql<Team[]>`select t.* from teams t join team_members m on m.team_id = t.id where m.roll_no = ${roll}`;
  const team = t[0];
  if (!team) return null;
  const members = await sql<Member[]>`
    select s.roll_no, s.name, s.dept, s.section from team_members m join students s on s.roll_no = m.roll_no
    where m.team_id = ${team.id} order by (s.roll_no = ${team.leader_roll}) desc, s.name`;
  const topic = (await sql`select id, title, category from topics where claimed_by = ${team.id}`)[0] as
    | { id: number; title: string; category: string } | undefined;
  return { team, members: [...members], topic, isLeader: team.leader_roll === roll };
}

export async function latestFiles(teamId: string) {
  const sql = await db();
  const r = await sql<FileRow[]>`
    select distinct on (phase, kind) id, team_id, phase, kind, filename, size, created_at
    from files where team_id = ${teamId} order by phase, kind, created_at desc`;
  return [...r];
}

export async function teamEvals(teamId: string) {
  const sql = await db();
  const r = await sql<EvalRow[]>`select * from evaluations where team_id = ${teamId} order by phase`;
  return [...r];
}

export type LbRow = {
  id: string; name: string; leader?: string | null; members?: string[]; p1: number | null; p2: number | null; p3: number | null; jury: number | null; total: number; rank: number;
};

export function rankRows(rows: LbRow[], withJury: boolean): LbRow[] {
  const list = rows.map((r) => ({ ...r, jury: withJury ? r.jury : null, total: (r.p1 ?? 0) + (r.p2 ?? 0) + (r.p3 ?? 0) + (withJury ? r.jury ?? 0 : 0), rank: 0 }));
  const key = (r: LbRow) => [r.total, r.jury ?? 0, r.p3 ?? 0, r.p2 ?? 0, r.p1 ?? 0];
  list.sort((a, b) => {
    const ka = key(a), kb = key(b);
    for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return kb[i] - ka[i];
    return a.name.localeCompare(b.name);
  });
  let rank = 0;
  list.forEach((r, i) => {
    const prev = list[i - 1];
    if (!prev || key(prev).join() !== key(r).join()) rank = i + 1;
    r.rank = rank;
  });
  return list;
}

const compute = async (): Promise<LbRow[]> => {
  const sql = await db();
  const rows = await sql`
    select t.id, t.name,
      max(case when e.phase = 1 then coalesce(e.override_total, e.total) end) as p1,
      max(case when e.phase = 2 then coalesce(e.override_total, e.total) end) as p2,
      max(case when e.phase = 3 then coalesce(e.override_total, e.total) end) as p3,
      (select avg(total) from jury_marks j where j.team_id = t.id) as jury
    from teams t left join evaluations e on e.team_id = t.id and e.status = 'done'
    group by t.id, t.name`;
  const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  const mem = await sql`
    select m.team_id, s.name, (s.roll_no = t.leader_roll) as is_leader
    from team_members m join teams t on t.id = m.team_id join students s on s.roll_no = m.roll_no
    order by m.team_id, (s.roll_no = t.leader_roll) desc, s.name`;
  const by = new Map<string, { leader: string | null; members: string[] }>();
  for (const m of mem) {
    const e = by.get(m.team_id as string) ?? { leader: null, members: [] };
    if (m.is_leader) e.leader = m.name as string; else e.members.push(m.name as string);
    by.set(m.team_id as string, e);
  }
  return rows.map((r) => ({ id: r.id as string, name: r.name as string, leader: by.get(r.id as string)?.leader ?? null, members: by.get(r.id as string)?.members ?? [], p1: n(r.p1), p2: n(r.p2), p3: n(r.p3), jury: n(r.jury), total: 0, rank: 0 }));
};

export const leaderboard = unstable_cache(compute, ['leaderboard-v2'], { revalidate: 60, tags: ['leaderboard'] });

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'team';
