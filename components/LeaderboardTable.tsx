import type { LbRow } from '@/lib/data';
import { n1 } from '@/components/ui';

export default function LeaderboardTable({ rows, showJury, mine, limit }: { rows: LbRow[]; showJury: boolean; mine?: string | null; limit?: number }) {
  const list = limit ? rows.slice(0, limit) : rows;
  return (
    <div className="card" style={{ overflowX: 'auto' }}>
      <table>
        <thead><tr><th>Rank</th><th>Team</th><th>Team leader</th><th>Team members</th><th>Maths</th><th>Chem</th><th>Physics</th>{showJury && <th>Jury</th>}<th>Total</th></tr></thead>
        <tbody>
          {list.map((r) => (
            <tr key={r.id} className={r.id === mine ? 'me' : ''}>
              <td>{r.rank}</td>
              <td>{r.name}{r.id === mine ? ' (you)' : ''}</td>
              <td>{r.leader ?? '–'}</td>
              <td className="small">{r.members && r.members.length ? r.members.join(', ') : '–'}</td>
              <td>{n1(r.p1)}</td><td>{n1(r.p2)}</td><td>{n1(r.p3)}</td>{showJury && <td>{n1(r.jury)}</td>}
              <td><b>{n1(r.total)}</b></td>
            </tr>))}
          {!list.length && <tr><td colSpan={showJury ? 9 : 8} className="mut">No teams yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
