import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { rankRows, leaderboard } from '@/lib/data';
import { n1, first, Flash, type SP } from '@/components/ui';
import { deleteTeamAction } from '../../actions';

export const metadata = { title: 'Teams | Admin' };
const PAGE = 100;

export default async function Teams({ searchParams }: { searchParams: SP }) {
  await requireAdmin();
  const sp = await searchParams;
  const q = first(sp.q).trim().slice(0, 60);
  const page = Math.max(0, Number(first(sp.page)) || 0);
  const sql = await db();
  const like = '%' + q.replace(/[%_\\]/g, '\\$&') + '%';
  const rows = await sql`
    select t.id, t.name, t.leader_roll, t.custom->>'title' as custom_title, t.custom_status,
      (select title from topics where claimed_by = t.id) as topic,
      (select count(*)::int from team_members where team_id = t.id) as size,
      coalesce((select array_agg(distinct phase::text || kind) from files where team_id = t.id), '{}') as f
    from teams t where (${q} = '' or t.name ilike ${like} or t.leader_roll ilike ${like})
    order by t.name limit ${PAGE} offset ${page * PAGE}`;
  const total = (await sql`select count(*)::int as n from teams t where (${q} = '' or t.name ilike ${like} or t.leader_roll ilike ${like})`)[0].n as number;
  const rank = new Map(rankRows(await leaderboard(), true).map((r) => [r.id, r]));
  const tick = (f: string[], k: string) => (f.includes(k) ? '✓' : '·');
  return (
    <>
      <h1>Teams ({total})</h1>
      <Flash sp={sp} />
      <form className="row card" method="get"><div><label htmlFor="q">Search team or leader roll no</label><input id="q" name="q" defaultValue={q} /></div><button type="submit">Search</button></form>
      <div className="card" style={{ overflowX: 'auto' }}><table><thead><tr><th>Team</th><th>Leader</th><th>Size</th><th>Topic</th><th>P1</th><th>P2</th><th>P3</th><th>Photos</th><th>Maths</th><th>Chem</th><th>Phys</th><th>Jury</th><th>Total</th><th>Delete</th></tr></thead><tbody>
        {rows.map((t) => {
          const f = t.f as string[]; const r = rank.get(t.id);
          return (<tr key={t.id}><td>{t.name}</td><td>{t.leader_roll}</td><td>{t.size}</td>
            <td>{t.topic ?? (t.custom_title ? `${t.custom_title} (${t.custom_status})` : <span className="mut">none</span>)}</td>
            <td>{tick(f, '1pdf')}</td><td>{tick(f, '2pdf')}</td><td>{tick(f, '3pdf')}</td>
            <td>{[1, 2, 3].map((p) => tick(f, `${p}image`)).join(' ')}</td>
            <td>{n1(r?.p1)}</td><td>{n1(r?.p2)}</td><td>{n1(r?.p3)}</td><td>{n1(r?.jury)}</td><td><b>{n1(r?.total)}</b></td>
            <td><form action={deleteTeamAction} style={{ display: 'flex', gap: 4 }}>
              <input type="hidden" name="team_id" value={t.id} />
              <input name="confirm" placeholder="type DELETE" size={10} aria-label={`Type DELETE to remove ${t.name}`} />
              <button type="submit" className="danger">Delete</button></form></td></tr>);
        })}
      </tbody></table></div>
      <p>
        {page > 0 && <a className="btn sec" href={`?q=${encodeURIComponent(q)}&page=${page - 1}`}>Previous</a>}{' '}
        {(page + 1) * PAGE < total && <a className="btn sec" href={`?q=${encodeURIComponent(q)}&page=${page + 1}`}>Next</a>}
      </p>
    </>
  );
}
