import type { LbRow, LbView } from '@/lib/data';
import { n1 } from '@/components/ui';

export default function LeaderboardTable({ rows, showJury, mine, limit, view = 'overall' }: { rows: LbRow[]; showJury: boolean; mine?: string | null; limit?: number; view?: LbView }) {
  const list = limit ? rows.slice(0, limit) : rows;
  return (
    <div className="card" style={{ overflowX: 'auto' }}>
      <table>
        <thead><tr><th>Rank</th><th>Team</th><th>Team leader</th><th>Team members</th>{view === 'overall' ? <><th>Maths</th><th>Chem</th><th>Physics</th>{showJury && <th>Jury</th>}<th>Total</th></> : <th>{{ maths: 'Maths (20)', chemistry: 'Chemistry (20)', physics: 'Physics (20)', jury: 'Jury (40)' }[view]}</th>}</tr></thead>
        <tbody>
          {list.map((r) => (
            <tr key={r.id} className={r.id === mine ? 'me' : ''}>
              <td>{r.rank}</td>
              <td>{r.name}{r.id === mine ? ' (you)' : ''}</td>
              <td>{r.leader ?? '–'}</td>
              <td className="small">{r.members && r.members.length ? r.members.join(', ') : '–'}</td>
              {view === 'overall' ? <><td>{n1(r.p1)}</td><td>{n1(r.p2)}</td><td>{n1(r.p3)}</td>{showJury && <td>{n1(r.jury)}</td>}<td><b>{n1(r.total)}</b></td></> : <td><b>{n1(r.total)}</b></td>}
            </tr>))}
          {!list.length && <tr><td colSpan={view === 'overall' ? (showJury ? 9 : 8) : 5} className="mut">No teams yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
