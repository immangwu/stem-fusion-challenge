import Link from 'next/link';
import { requireStudent } from '@/lib/auth';
import { myTeam } from '@/lib/data';
import { CUSTOM_TOPIC_CHECKS } from '@/lib/rubrics';
import { Flash, type SP } from '@/components/ui';
import { submitCustomTopicAction } from '../../actions';

export const metadata = { title: 'Propose a topic | STEM Fusion Challenge' };

export default async function Custom({ searchParams }: { searchParams: SP }) {
  const me = await requireStudent();
  const sp = await searchParams;
  const data = await myTeam(me.sub);
  const c = data?.team.custom ?? {};
  return (
    <>
      <h1>Propose your own topic</h1>
      <Flash sp={sp} />
      {!data?.isLeader ? <div className="flash err">Only a team leader can propose a topic.</div> : (
        <>
          <div className="card"><b>It will be approved only if all four checks pass:</b>
            <ul>{CUSTOM_TOPIC_CHECKS.map((k) => <li key={k.key}><b>{k.label}:</b> {k.desc}</li>)}</ul>
            {data.team.custom_status && <p>Current status: <span className="badge">{data.team.custom_status}</span> {data.team.custom_review?.note && <span className="small">Reviewer: {data.team.custom_review.note}</span>}</p>}
            <p className="small mut">Submitting replaces your earlier proposal. If it is approved, any listed topic you hold is released.</p></div>
          <form className="card" action={submitCustomTopicAction}>
            <label htmlFor="title">Topic title</label><input id="title" name="title" required maxLength={120} defaultValue={c.title} />
            <label htmlFor="description">What will you build and what will it do?</label><textarea id="description" name="description" required maxLength={1500} defaultValue={c.description} />
            <label htmlFor="math">Maths concept used</label><textarea id="math" name="math" required maxLength={400} defaultValue={c.math} />
            <label htmlFor="physics">Physics concept used</label><textarea id="physics" name="physics" required maxLength={400} defaultValue={c.physics} />
            <label htmlFor="chemistry">Chemistry concept used</label><textarea id="chemistry" name="chemistry" required maxLength={400} defaultValue={c.chemistry} />
            <label htmlFor="materials">Materials (low cost) and how you will build it</label><textarea id="materials" name="materials" required maxLength={400} defaultValue={c.materials} />
            <label htmlFor="measurable">What will you measure and compare?</label><textarea id="measurable" name="measurable" required maxLength={400} defaultValue={c.measurable} />
            <label htmlFor="safety">Safety: any chemicals, heat or electricity involved?</label><textarea id="safety" name="safety" required maxLength={400} defaultValue={c.safety} />
            <p><button type="submit">Submit for validation</button></p>
          </form>
        </>
      )}
      <p><Link href="/dashboard">Back to dashboard</Link></p>
    </>
  );
}
