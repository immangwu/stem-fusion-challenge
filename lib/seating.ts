import type { Sql } from './db';

export const ROOMS: Record<string, string[]> = {
  CSE: ['237 (CSE A)', '238 (CSE B)', '239 (CSE C)'], IT: ['240 (IT)'], AIDS: ['244 (AIDS)'], ECE: ['245 (ECE A)', '246 (ECE B)'], EEE: ['247 (EEE)'],
};
export const HALL = '242 (Hall)';
export const ALL_VENUES = [...Object.values(ROOMS).flat(), HALL].sort();

/** Same rule as the seating plan: majority-department teams fill their rooms (10 per room, purest first); the rest go to Hall 242. */
export async function assignVenues(sql: Sql, force: boolean): Promise<number> {
  const r = await sql`
    select t.id, t.venue, (select array_agg(coalesce(s.dept, '?')) from team_members m join students s using (roll_no) where m.team_id = t.id) as depts
    from teams t order by t.leader_roll`;
  const teams = r.map((x) => {
    const d: string[] = x.depts || [];
    const cnt: Record<string, number> = {};
    d.forEach((k) => (cnt[k] = (cnt[k] || 0) + 1));
    const top = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
    return { id: x.id as string, venue: x.venue as string | null, major: top && top[1] * 2 > d.length ? top[0] : null, purity: top ? top[1] / d.length : 0 };
  });
  const room = new Map<string, string>();
  Object.keys(ROOMS).forEach((k) => {
    const list = teams.filter((t) => t.major === k);
    const keep = [...list].sort((a, b) => b.purity - a.purity || list.indexOf(a) - list.indexOf(b)).slice(0, ROOMS[k].length * 10);
    list.filter((t) => keep.includes(t)).forEach((t, i) => room.set(t.id, ROOMS[k][Math.floor(i / 10)]));
  });
  let n = 0;
  for (const t of teams) {
    if (t.venue && !force) continue;
    await sql`update teams set venue = ${room.get(t.id) ?? HALL} where id = ${t.id}`;
    n++;
  }
  return n;
}
