import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { fmt, getPhases, phaseState } from '@/lib/phases';
import { Flash, StateBadge, type SP } from '@/components/ui';

export const metadata = { title: 'Admin | STEM Fusion Challenge' };

export default async function Admin({ searchParams }: { searchParams: SP }) {
  await requireAdmin();
  const sp = await searchParams;
  const sql = await db();
  const [c] = await sql`
    select (select count(*)::int from students) as students,
           (select count(*)::int from team_members) as registered,
           (select count(*)::int from teams) as teams,
           (select count(*)::int from teams t where exists (select 1 from topics where claimed_by = t.id) or t.custom_status = 'approved') as with_topic`;
  const phases = await getPhases();
  const sub = await sql`select phase, count(distinct team_id)::int as n from files where kind = 'pdf' group by phase`;
  const unreg = await sql`
    select s.roll_no, s.name, s.dept, s.section from students s left join team_members m on m.roll_no = s.roll_no
    where m.roll_no is null order by s.dept, s.section, s.roll_no limit 200`;
  const closed = phases.filter((p) => phaseState(p) === 'closed').map((p) => p.n);
  const inc = await sql`
    select t.name, t.leader_roll, coalesce((select array_agg(distinct phase) from files where team_id = t.id and kind = 'pdf'), '{}') as have
    from teams t order by t.name`;
  const incomplete = inc
    .map((t) => ({ name: t.name as string, leader_roll: t.leader_roll as string, miss: closed.filter((p) => !(t.have as number[]).includes(p)) }))
    .filter((t) => t.miss.length);
  const noTopic = Number(c.teams) - Number(c.with_topic);

  return (
    <>
      <h1>Admin overview</h1>
      <Flash sp={sp} />
      {Number(c.students) === 0 && <div className="flash err">No students imported yet. <Link href="/admin/settings">Import the roster</Link> so students can log in.</div>}
      <div className="grid g3">
        <div className="card"><div className="mut small">Students on roster</div><div className="big">{c.students}</div></div>
        <div className="card"><div className="mut small">Registered (in a team)</div><div className="big">{c.registered}</div><div className="small mut">{Number(c.students) - Number(c.registered)} not registered</div></div>
        <div className="card"><div className="mut small">Teams</div><div className="big">{c.teams}</div><div className="small mut">{noTopic} without a topic</div></div>
      </div>
      <h2>Phases</h2>
      <div className="grid g3">
        {phases.map((p) => (
          <div className="card" key={p.n}><h3>Phase {p.n}: {p.subject} <StateBadge s={phaseState(p)} /></h3>
            <p className="small mut">Closes {fmt(p.closes)}</p>
            <p>{sub.find((x) => x.phase === p.n)?.n ?? 0} of {c.teams} teams submitted a PDF</p></div>))}
      </div>
      <h2>Exports</h2>
      <p>
        <a className="btn sec" href="/api/admin/export?type=unregistered">Unregistered students (CSV)</a>{' '}
        <a className="btn sec" href="/api/admin/export?type=incomplete">Incomplete teams (CSV)</a>{' '}
        <a className="btn sec" href="/api/admin/export?type=teams">All teams (CSV)</a>{' '}
        <a className="btn sec" href="/api/admin/export?type=marks">Marks (CSV)</a>
      </p>
      <h2>Students not registered ({Number(c.students) - Number(c.registered)})</h2>
      <div className="card"><table><thead><tr><th>Roll no</th><th>Name</th><th>Dept</th><th>Section</th></tr></thead><tbody>
        {unreg.map((s) => <tr key={s.roll_no}><td>{s.roll_no}</td><td>{s.name}</td><td>{s.dept}</td><td>{s.section}</td></tr>)}
        {!unreg.length && <tr><td colSpan={4} className="mut">Everyone on the roster is registered.</td></tr>}
      </tbody></table>
        {unreg.length === 200 && <p className="small mut">Showing the first 200. Download the CSV for the full list.</p>}</div>
      <h2>Teams that missed a closed phase ({incomplete.length})</h2>
      <div className="card"><table><thead><tr><th>Team</th><th>Leader</th><th>Missing PDF for phase</th></tr></thead><tbody>
        {incomplete.slice(0, 200).map((t) => <tr key={t.name}><td>{t.name}</td><td>{t.leader_roll}</td><td>{t.miss.join(', ')}</td></tr>)}
        {!incomplete.length && <tr><td colSpan={3} className="mut">{closed.length ? 'None.' : 'No phase has closed yet.'}</td></tr>}
      </tbody></table></div>
    </>
  );
}
