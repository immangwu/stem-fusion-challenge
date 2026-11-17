import Link from 'next/link';
import { requireStudent } from '@/lib/auth';
import { db } from '@/lib/db';
import { myTeam } from '@/lib/data';
import { getPhases, phaseState } from '@/lib/phases';
import { TOPIC_CATEGORIES } from '@/lib/topics';
import { Flash, first, type SP } from '@/components/ui';
import { claimTopicAction } from '../actions';

export const metadata = { title: 'Topics | STEM Fusion Challenge' };

export default async function Topics({ searchParams }: { searchParams: SP }) {
  const me = await requireStudent();
  const sp = await searchParams;
  const q = first(sp.q).trim().slice(0, 60), cat = first(sp.cat);
  const [data, phases] = await Promise.all([myTeam(me.sub), getPhases()]);
  const locked = phaseState(phases[0]) === 'closed';
  const sql = await db();
  const rows = await sql`
    select id, title, category, claimed_by is not null as taken from topics
    where (${q} = '' or title ilike ${'%' + q.replace(/[%_\\]/g, '\\$&') + '%'}) and (${cat} = '' or category = ${cat})
    order by id`;
  const mine = data?.topic?.id;
  const canPick = !!data?.isLeader && !locked;

  return (
    <>
      <h1>Choose a topic</h1>
      <Flash sp={sp} />
      {!data && <div className="flash err">Create your team on the dashboard first. Only the team leader chooses the topic.</div>}
      {data && !data.isLeader && <p className="mut">Only your team leader can choose the topic.</p>}
      {locked && <p className="mut">Topic selection is locked (Phase 1 has closed).</p>}
      <p className="small">First come, first served: once a team takes a topic it is gone for everyone else. Want something different? <Link href="/topics/custom">Propose your own topic</Link>.</p>
      <form className="row card" method="get">
        <div><label htmlFor="q">Search</label><input id="q" name="q" defaultValue={q} maxLength={60} /></div>
        <div><label htmlFor="cat">Category</label><select id="cat" name="cat" defaultValue={cat}><option value="">All</option>{TOPIC_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
        <button type="submit">Filter</button>
      </form>
      <p className="small mut">{rows.filter((r) => !r.taken).length} of {rows.length} shown are available.</p>
      <div className="card"><table><thead><tr><th>#</th><th>Topic</th><th>Category</th><th></th></tr></thead><tbody>
        {rows.map((r) => (
          <tr key={r.id} className={r.id === mine ? 'me' : ''}>
            <td>{r.id}</td><td>{r.title}</td><td className="small mut">{r.category}</td>
            <td>{r.id === mine ? <span className="badge b-open">Your topic</span>
              : r.taken ? <span className="badge b-closed">Taken</span>
              : canPick ? <form action={claimTopicAction}><input type="hidden" name="topicId" value={r.id} /><button type="submit">Choose</button></form> : ''}</td>
          </tr>))}
      </tbody></table></div>
    </>
  );
}
