import Link from 'next/link';
import { requireStudent } from '@/lib/auth';
import { db } from '@/lib/db';
import { latestFiles, leaderboard, myTeam, rankRows, teamEvals } from '@/lib/data';
import { templateHref } from '@/lib/templates';
import { fmt, getEvent, getPhases, phaseState } from '@/lib/phases';
import { RUBRICS, JURY_RUBRIC, type PhaseNo } from '@/lib/rubrics';
import UploadForm from '@/components/UploadForm';
import ShareCard from '@/components/ShareCard';
import { Flash, StateBadge, n1, type SP } from '@/components/ui';
import { addMemberAction, createTeamAction, removeMemberAction, requestReevalAction } from '../actions';

export const metadata = { title: 'Dashboard | STEM Fusion Challenge' };

export default async function Dashboard({ searchParams }: { searchParams: SP }) {
  const me = await requireStudent();
  const sp = await searchParams;
  const data = await myTeam(me.sub);

  if (!data) {
    return (
      <>
        <h1>Welcome, {me.name}</h1>
        <Flash sp={sp} />
        <p className="mut">You are not in a team yet. A team leader creates the team here and can add up to 3 more members by roll number (they must be on the student list and not in another team). Solo participation is allowed.</p>
        <form className="card" action={createTeamAction}>
          <h2 style={{ marginTop: 0 }}>Create your team</h2>
          <label htmlFor="name">Team name</label>
          <input id="name" name="name" required minLength={3} maxLength={40} />
          <div className="grid g3">
            {[1, 2, 3].map((i) => (
              <div key={i}><label htmlFor={`m${i}`}>Member {i + 1} roll number (optional)</label><input id={`m${i}`} name={`m${i}`} maxLength={40} /></div>
            ))}
          </div>
          <p><button type="submit">Create team (I am the leader)</button></p>
        </form>
        <p className="small mut">Were you added to a team by your leader? You will see it here automatically once they add you.</p>
      </>
    );
  }

  const { team, members, topic, isLeader } = data;
  const [phases, ev, files, evals, lb] = await Promise.all([getPhases(), getEvent(), latestFiles(team.id), teamEvals(team.id), leaderboard()]);
  const sql = await db();
  const jury = ev.juryPublished ? (await sql`select avg(total) as a, count(*)::int as n from jury_marks where team_id = ${team.id}`)[0] : null;
  const ranked = rankRows(lb, ev.juryPublished);
  const rank = ranked.find((r) => r.id === team.id);
  const locked = phaseState(phases[0]) === 'closed';
  const hasTopic = !!topic || team.custom_status === 'approved';

  return (
    <>
      <h1>{team.name}</h1>
      <Flash sp={sp} />
      <div className="grid g3">
        <div className="card"><div className="mut small">Total marks</div><div className="big">{n1(rank?.total ?? 0)} <span className="mut small">/ 100</span></div></div>
        <div className="card"><div className="mut small">Rank</div><div className="big">#{rank?.rank ?? '–'} <span className="mut small">of {ranked.length}</span></div><Link href="/leaderboard" className="small">View leaderboard</Link></div>
        <div className="card"><div className="mut small">Jury round</div><div><b>{ev.juryDate}</b></div>
          <div className="small mut">{jury && Number(jury.n) > 0 ? `Jury score: ${n1(Number(jury.a))} / ${JURY_RUBRIC.total}` : 'Bring your physical model to college.'}</div></div>
      </div>

      <h2>Share your journey</h2>
      <ShareCard teamName={team.name} caption={`Proud to be part of the STEM Fusion Challenge: Think, Build, Prove, organised by Science Club, SRIT with HIVE and ASME SRIT as Technical Partners. Team ${team.name} is turning Maths, Physics and Chemistry into a working model. #STEMFusionChallenge #SRIT #ScienceClub #InstitutionsInnovationCouncil`} />

      <h2>Team</h2>
      <div className="card">
        <table><thead><tr><th>Roll no</th><th>Name</th><th>Dept</th><th>Role</th><th></th></tr></thead><tbody>
          {members.map((m) => (
            <tr key={m.roll_no}><td>{m.roll_no}</td><td>{m.name}</td><td>{m.dept ?? ''} {m.section ?? ''}</td>
              <td>{m.roll_no === team.leader_roll ? 'Leader' : 'Member'}</td>
              <td>{isLeader && !locked && m.roll_no !== team.leader_roll && (
                <form action={removeMemberAction}><input type="hidden" name="roll" value={m.roll_no} /><button className="sec" type="submit">Remove</button></form>)}</td></tr>
          ))}</tbody></table>
        {isLeader && !locked && members.length < 4 && (
          <form action={addMemberAction} className="row" style={{ marginTop: 10 }}>
            <div><label htmlFor="roll">Add member (roll number)</label><input id="roll" name="roll" required maxLength={40} /></div>
            <button type="submit">Add</button>
          </form>)}
        {!isLeader && <p className="small mut">Only the team leader can upload files and change the team.</p>}
      </div>

      <h2>Topic</h2>
      <div className="card">
        {topic ? (<><b>{topic.title}</b> <span className="badge">{topic.category}</span></>)
          : team.custom_status === 'approved' ? (<><b>{team.custom?.title}</b> <span className="badge b-open">Custom topic approved</span></>)
          : team.custom ? (<><b>{team.custom.title}</b> <span className="badge b-up">Custom topic: {team.custom_status}</span>
              {team.custom_review?.note && <p className="small">Reviewer note: {team.custom_review.note}</p>}</>)
          : <span className="mut">No topic chosen yet.</span>}
        {isLeader && !locked && (<p><Link className="btn sec" href="/topics">{hasTopic ? 'Change topic' : 'Choose a topic'}</Link> <Link className="btn sec" href="/topics/custom">Propose our own topic</Link></p>)}
        {locked && <p className="small mut">Topics are locked now that Phase 1 has closed.</p>}
      </div>

      <h2>Phases</h2>
      {phases.map((p) => {
        const st = phaseState(p);
        const pdf = files.find((f) => f.phase === p.n && f.kind === 'pdf');
        const img = files.find((f) => f.phase === p.n && f.kind === 'image');
        const e = evals.find((x) => x.phase === p.n);
        const rubric = RUBRICS[p.n as PhaseNo];
        const score = e?.override_total ?? e?.total;
        return (
          <div className="card" key={p.n}>
            <h3>Phase {p.n}: {p.subject} <StateBadge s={st} /></h3>
            <p className="small mut">Opens {fmt(p.opens)} · Closes {fmt(p.closes)}</p>
            <p className="small"><a className="btn ghost" href={templateHref(p.n as PhaseNo)} download>Download report template (Word)</a> <span className="mut">Fill it in, export as PDF, then upload below.</span></p>
            <div className="grid g2">
              <div>
                <b>PDF report</b> (required){' '}
                {pdf ? <span className="small">✓ <a href={`/api/files/${pdf.id}`} target="_blank">{pdf.filename}</a> · {fmt(pdf.created_at)}</span> : <span className="mut small">not uploaded</span>}
                {isLeader && st === 'open' && <UploadForm phase={p.n} kind="pdf" button={pdf ? 'Replace PDF' : 'Upload PDF'} hint="max 4 MB" />}
              </div>
              <div>
                <b>Prototype photo</b> (required{p.n === 1 ? ', no marks' : ''}){' '}
                {img ? <span className="small">✓ <a href={`/api/files/${img.id}`} target="_blank">{img.filename}</a></span> : <span className="mut small">not uploaded</span>}
                {isLeader && st === 'open' && <UploadForm phase={p.n} kind="image" button={img ? 'Replace photo' : 'Upload photo'} hint="large photos are shrunk automatically" />}
              </div>
            </div>

            {e?.status === 'done' && (
              <div style={{ marginTop: 12 }}>
                <hr style={{ border: 0, borderTop: '1px solid var(--line)' }} />
                <div><b>Result: {n1(score)} / {rubric.total}</b> <span className="small mut">AI-assisted evaluation, subject to admin review</span></div>
                {e.override_note && <p className="small">Admin adjustment: {e.override_note}</p>}
                {e.scores && (
                  <table><thead><tr><th>Criterion</th><th>Score</th><th>Reason</th></tr></thead><tbody>
                    {rubric.criteria.map((c) => (<tr key={c.key}><td>{c.label}</td><td>{n1(e.scores?.[c.key]?.score)} / {c.max}</td><td>{e.scores?.[c.key]?.reason}</td></tr>))}
                  </tbody></table>)}
                {e.summary && <p><b>Overall feedback:</b> {e.summary}</p>}
                {e.reeval_requested ? <p className="small mut">Re-evaluation requested. The organisers will review it.</p>
                  : isLeader && (
                    <details><summary className="small">Request a re-evaluation (once)</summary>
                      <form action={requestReevalAction}><input type="hidden" name="phase" value={p.n} />
                        <label htmlFor={`r${p.n}`}>Reason</label><textarea id={`r${p.n}`} name="reason" required minLength={10} maxLength={600} />
                        <p><button type="submit" className="sec">Send request</button></p></form></details>)}
              </div>)}
            {e?.status === 'needs_review' && <p className="small">Your report is under manual review by the organisers (for example, the file was unreadable). Please check the notice from the organisers.</p>}
            {!e && st === 'closed' && (pdf ? <p className="small mut">Submitted. Evaluation in progress.</p> : <p className="small" style={{ color: 'var(--bad)' }}>No PDF was submitted for this phase (0 marks).</p>)}
          </div>
        );
      })}
    </>
  );
}
