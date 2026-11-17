import { JURY_RUBRIC, RUBRICS, CUSTOM_TOPIC_CHECKS, TIEBREAK } from '@/lib/rubrics';

export const metadata = { title: 'Rubrics | STEM Fusion Challenge' };

export default function Rubrics() {
  return (
    <>
      <h1>Evaluation rubrics</h1>
      <p><a className="btn" href="/api/rulebook" download>Download the full Rule Book (PDF)</a></p>
      <p className="mut">Each online phase is scored out of 20 against the rubric below. The AI-assisted evaluation is subject to admin review, and you can request one re-evaluation.</p>
      {([1, 2, 3] as const).map((n) => (
        <div className="card" key={n}>
          <h2 style={{ marginTop: 0 }}>Phase {n}: {RUBRICS[n].subject} ({RUBRICS[n].total} marks)</h2>
          <table><thead><tr><th>Criterion</th><th>Marks</th><th>Full marks look like</th></tr></thead>
            <tbody>{RUBRICS[n].criteria.map((c) => <tr key={c.key}><td>{c.label}</td><td>{c.max}</td><td>{c.desc}</td></tr>)}</tbody></table>
        </div>
      ))}
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Final jury evaluation ({JURY_RUBRIC.total} marks)</h2>
        <table><thead><tr><th>Criterion</th><th>Marks</th><th>Looks like</th></tr></thead>
          <tbody>{JURY_RUBRIC.criteria.map((c) => <tr key={c.key}><td>{c.label}</td><td>{c.max}</td><td>{c.desc}</td></tr>)}</tbody></table>
      </div>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Custom topic validation (pass/fail)</h2>
        <p className="small">A team-proposed topic is approved only if all four conditions are met.</p>
        <table><tbody>{CUSTOM_TOPIC_CHECKS.map((c) => <tr key={c.key}><td><b>{c.label}</b></td><td>{c.desc}</td></tr>)}</tbody></table>
      </div>
      <p className="small mut">{TIEBREAK}</p>
    </>
  );
}
