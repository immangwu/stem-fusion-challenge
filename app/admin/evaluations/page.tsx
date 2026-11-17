import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { fmt, getPhases, phaseState } from '@/lib/phases';
import { RUBRICS, type PhaseNo } from '@/lib/rubrics';
import { ZIP_BATCH } from '@/lib/const';
import { Flash, StateBadge, n1, type SP } from '@/components/ui';
import { importResultsAction, overrideScoreAction, reviewCustomTopicAction } from '../../actions';

export const metadata = { title: 'Evaluation | Admin' };

export default async function Evaluations({ searchParams }: { searchParams: SP }) {
  await requireAdmin();
  const sp = await searchParams;
  const sql = await db();
  const phases = await getPhases();
  const teams = Number((await sql`select count(*)::int as n from teams`)[0].n);

  const stats = await sql`
    select p.phase, count(distinct p.team_id)::int as submitted,
      count(distinct e.team_id) filter (where e.status = 'done')::int as done,
      count(distinct e.team_id) filter (where e.status = 'needs_review')::int as review
    from files p left join evaluations e on e.team_id = p.team_id and e.phase = p.phase
    where p.kind = 'pdf' group by p.phase`;
  const reevals = await sql`
    select t.id, t.name, e.phase, coalesce(e.override_total, e.total) as score,
      (select detail->>'reason' from audit_log where action = 'reeval_requested' and detail->>'phase' = e.phase::text
         and actor = t.leader_roll order by id desc limit 1) as reason
    from evaluations e join teams t on t.id = e.team_id where e.reeval_requested order by e.updated_at`;
  const review = await sql`select t.id, t.name, e.phase, e.summary, e.flags from evaluations e join teams t on t.id = e.team_id where e.status = 'needs_review' order by t.name limit 100`;
  const flagged = await sql`select t.name, e.phase, e.flags from evaluations e join teams t on t.id = e.team_id where e.status = 'done' and jsonb_array_length(e.flags) > 0 order by t.name limit 100`;
  const customs = await sql`select id, name, custom, custom_status, custom_review from teams where custom is not null order by (custom_status = 'pending') desc, name limit 100`;

  return (
    <>
      <h1>Evaluation</h1>
      <Flash sp={sp} />
      <div className="card">
        <b>Workflow:</b> after a phase closes, download the submissions below (ZIP batches of {ZIP_BATCH} teams plus a manifest), give them to Claude in chat to evaluate against the rubric,
        then import the results file Claude produces. Scores and the reason for every criterion appear on each team's dashboard and in the leaderboard immediately.
      </div>

      {phases.map((p) => {
        const st = stats.find((x) => x.phase === p.n);
        const submitted = Number(st?.submitted ?? 0);
        const batches = Math.ceil(submitted / ZIP_BATCH);
        const r = RUBRICS[p.n as PhaseNo];
        return (
          <div className="card" key={p.n}>
            <h2 style={{ marginTop: 0 }}>Phase {p.n}: {r.subject} <StateBadge s={phaseState(p)} /></h2>
            <p className="small mut">Closes {fmt(p.closes)} · {submitted} of {teams} teams submitted · {st?.done ?? 0} evaluated · {st?.review ?? 0} need review</p>
            {phaseState(p) !== 'closed' && submitted > 0 && <p className="small" style={{ color: 'var(--warn)' }}>This phase is still open. Teams may replace their file until it closes, so download after the deadline.</p>}
            <p><a className="btn sec" href={`/api/admin/export?type=manifest${p.n}`}>Manifest CSV</a>{' '}
              {Array.from({ length: batches }, (_, i) => (
                <a key={i} className="btn" style={{ marginRight: 6 }} href={`/api/admin/zip?phase=${p.n}&batch=${i}`}>ZIP {i + 1}/{batches}</a>))}
              {!batches && <span className="mut small">No submissions yet.</span>}</p>
          </div>
        );
      })}

      <h2>Import results</h2>
      <form className="card" action={importResultsAction} encType="multipart/form-data">
        <p className="small">Upload the results JSON produced by the evaluator, or paste it below. Re-importing a team replaces its earlier result.</p>
        <label htmlFor="file">Results file (.json)</label><input id="file" type="file" name="file" accept="application/json,.json" />
        <label htmlFor="json">…or paste JSON</label><textarea id="json" name="json" style={{ minHeight: 120, fontFamily: 'monospace' }} />
        <details><summary className="small">Expected format</summary>
          <pre className="small" style={{ overflowX: 'auto' }}>{`{
  "phase": 1,
  "evaluator": "claude-chat",
  "results": [
    {
      "team_id": "<uuid from manifest>",
      "scores": {
${RUBRICS[1].criteria.map((c) => `        "${c.key}": { "score": 0-${c.max}, "reason": "..." }`).join(',\n')}
      },
      "summary": "Overall feedback...",
      "flags": []
    }
  ]
}
Phase 2 keys: ${RUBRICS[2].criteria.map((c) => c.key).join(', ')}
Phase 3 keys: ${RUBRICS[3].criteria.map((c) => c.key).join(', ')}
Use "status": "needs_review" (no scores) for unreadable files.`}</pre></details>
        <p><button type="submit">Import results</button></p>
      </form>

      <h2>Re-evaluation requests ({reevals.length})</h2>
      <div className="card"><table><thead><tr><th>Team</th><th>Phase</th><th>Score</th><th>Reason</th></tr></thead><tbody>
        {reevals.map((x) => <tr key={`${x.id}${x.phase}`}><td>{x.name}</td><td>{x.phase}</td><td>{n1(x.score)}</td><td>{x.reason}</td></tr>)}
        {!reevals.length && <tr><td colSpan={4} className="mut">None.</td></tr>}</tbody></table>
        <p className="small mut">Re-evaluate in chat and import the new result (this clears the request), or use the override below.</p></div>

      <h2>Needs manual review ({review.length})</h2>
      <div className="card"><table><tbody>
        {review.map((x) => <tr key={`${x.id}${x.phase}`}><td>{x.name}</td><td>Phase {x.phase}</td><td>{x.summary}</td></tr>)}
        {!review.length && <tr><td className="mut">None.</td></tr>}</tbody></table></div>

      <h2>Flagged by evaluator ({flagged.length})</h2>
      <div className="card"><table><tbody>
        {flagged.map((x, i) => <tr key={i}><td>{x.name}</td><td>Phase {x.phase}</td><td>{(x.flags as string[]).join(', ')}</td></tr>)}
        {!flagged.length && <tr><td className="mut">None.</td></tr>}</tbody></table>
        <p className="small mut">Flags are visible only to admins and never reduce marks automatically.</p></div>

      <h2>Manual score override</h2>
      <form className="card" action={overrideScoreAction}>
        <div className="row">
          <div><label htmlFor="teamId">Team ID</label><input id="teamId" name="teamId" required placeholder="uuid from the manifest" /></div>
          <div><label htmlFor="phase">Phase</label><select id="phase" name="phase"><option>1</option><option>2</option><option>3</option></select></div>
          <div><label htmlFor="total">Total (0–20)</label><input id="total" name="total" type="number" step="0.5" min="0" max="20" required /></div>
        </div>
        <label htmlFor="note">Reason (shown to the team)</label><input id="note" name="note" required minLength={5} maxLength={600} />
        <p><button type="submit">Save override</button></p>
      </form>

      <h2>Custom topic proposals ({customs.length})</h2>
      {customs.map((t) => (
        <div className="card" key={t.id}>
          <h3>{t.custom.title} <span className="badge">{t.custom_status}</span> <span className="small mut">· team {t.name}</span></h3>
          <p className="small">{t.custom.description}</p>
          <table><tbody>{(['math', 'physics', 'chemistry', 'materials', 'measurable', 'safety'] as const).map((k) => <tr key={k}><th style={{ width: 110 }}>{k}</th><td>{t.custom[k]}</td></tr>)}</tbody></table>
          <form action={reviewCustomTopicAction} className="row" style={{ marginTop: 8 }}>
            <input type="hidden" name="teamId" value={t.id} />
            <div><label htmlFor={`d${t.id}`}>Decision</label><select id={`d${t.id}`} name="decision"><option value="approved">Approve</option><option value="revise">Ask to revise</option><option value="rejected">Reject</option></select></div>
            <div style={{ flex: 3 }}><label htmlFor={`n${t.id}`}>Note (required unless approving)</label><input id={`n${t.id}`} name="note" maxLength={600} defaultValue={t.custom_review?.note ?? ''} /></div>
            <button type="submit">Save</button>
          </form>
        </div>))}
      {!customs.length && <div className="card mut">No custom topics proposed.</div>}
    </>
  );
}
