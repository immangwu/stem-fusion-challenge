import Link from 'next/link';
import { getEvent, getPhases, phaseState, fmt } from '@/lib/phases';
import { getSession } from '@/lib/auth';
import { StateBadge } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const [phases, ev, s] = await Promise.all([getPhases(), getEvent(), getSession()]);
  return (
    <>
      <section className="hero">
        <h1>STEM Fusion Challenge: Think, Build, Prove</h1>
        <p>Where numbers, forces and reactions collide.</p>
        <p>A first-year project challenge combining Mathematics, Physics and Chemistry. Teams of 1–4 pick a topic, submit reports, and build a working model.</p>
        <Link className="btn" href={s ? (s.role === 'student' ? '/dashboard' : s.role === 'admin' ? '/admin' : '/jury') : '/login'}>
          {s ? 'Go to my dashboard' : 'Login / Register'}
        </Link>{' '}
        <a className="btn" href="/api/rulebook" download>Download Rule Book (PDF)</a>
      </section>

      <h2>How it works</h2>
      <div className="grid g3">
        <div className="card"><h3>1. Register</h3><p className="small">Log in with your roll number and the one-time code sent to your college email. The leader creates the team (1–4 members).</p></div>
        <div className="card"><h3>2. Choose a topic</h3><p className="small">Pick any of 200 topics, first come first served. Or propose your own, which is validated against the rubric.</p></div>
        <div className="card"><h3>3. Submit and build</h3><p className="small">Upload a PDF report each phase (plus a photo of your real prototype), then bring the physical model for the jury.</p></div>
      </div>

      <h2>Timeline</h2>
      <div className="grid g3">
        {phases.map((p) => (
          <div className="card" key={p.n}>
            <h3>Phase {p.n}: {p.subject} <StateBadge s={phaseState(p)} /></h3>
            <p className="small mut">Opens {fmt(p.opens)}<br />Submission closes {fmt(p.closes)}</p>
            <p className="small">Evaluated against the {p.subject} rubric (20 marks).</p>
          </div>
        ))}
        <div className="card"><h3>Final jury round</h3><p className="small mut">{ev.juryDate}</p><p className="small">Bring your physical model to college. Jury marks: 40.</p></div>
      </div>
      <p className="small mut">Total 100 marks: Maths 20 + Chemistry 20 + Physics 20 + Jury 40. <Link href="/rubrics">View the full rubrics</Link> or <a href="/api/rulebook" download>download the Rule Book</a> for all rules and the 200 topics.</p>
    </>
  );
}
