import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { leaderboard, myTeam, rankRows } from '@/lib/data';
import { getEvent } from '@/lib/phases';
import { n1 } from '@/components/ui';
import { TIEBREAK } from '@/lib/rubrics';

export const metadata = { title: 'Leaderboard | STEM Fusion Challenge' };

export default async function Leaderboard() {
  const s = await getSession();
  if (!s) redirect('/login');
  const [raw, ev] = await Promise.all([leaderboard(), getEvent()]);
  const mine = s.role === 'student' ? (await myTeam(s.sub))?.team.id : null;
  const showJury = ev.juryPublished || s.role !== 'student';
  const rows = rankRows(raw, showJury);
  return (
    <>
      <h1>Leaderboard</h1>
      <p className="small mut">Updated every minute. Maths (20) + Chemistry (20) + Physics (20){showJury ? ' + Jury (40)' : ''}. {TIEBREAK}</p>
      <div className="card"><table><thead><tr><th>Rank</th><th>Team</th><th>Maths</th><th>Chem</th><th>Physics</th>{showJury && <th>Jury</th>}<th>Total</th></tr></thead><tbody>
        {rows.map((r) => (
          <tr key={r.id} className={r.id === mine ? 'me' : ''}><td>{r.rank}</td><td>{r.name}{r.id === mine ? ' (you)' : ''}</td>
            <td>{n1(r.p1)}</td><td>{n1(r.p2)}</td><td>{n1(r.p3)}</td>{showJury && <td>{n1(r.jury)}</td>}
            <td><b>{n1(r.total)}</b></td></tr>))}
        {!rows.length && <tr><td colSpan={7} className="mut">No teams yet.</td></tr>}
      </tbody></table></div>
    </>
  );
}
