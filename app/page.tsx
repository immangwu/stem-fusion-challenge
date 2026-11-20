import LogoBar from '@/components/LogoBar';
import Link from 'next/link';
import { getEvent, getPhases, phaseState, fmt } from '@/lib/phases';
import { getSession } from '@/lib/auth';
import { StateBadge } from '@/components/ui';
import Tilt from '@/components/Tilt';
import { leaderboard, rankRows } from '@/lib/data';
import LeaderboardTable from '@/components/LeaderboardTable';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const [phases, ev, s] = await Promise.all([getPhases(), getEvent(), getSession()]);
  const top = rankRows(await leaderboard().catch(() => []), ev.juryPublished);
  const dash = s ? (s.role === 'student' ? '/dashboard' : s.role === 'admin' ? '/admin' : '/jury') : '/login';
  return (
    <>
      <section className="hero3d">
        <div>
          <span className="kicker">Science Club, SRIT &bull; First-year students</span>
          <h1>STEM FUSION<small>CHALLENGE</small></h1>
          <p><b>Think. Build. Prove.</b> Where Maths, Physics and Chemistry meet real-world engineering.</p>
          <p>Teams of 1 to 4 choose a topic, submit a PDF report and prototype photo each phase, and finish with a physical model in front of the jury.</p>
          <div className="cta">
            <Link className="btn gold" href={dash}>{s ? 'Go to my dashboard' : 'Login / Register'}</Link>
            <a className="btn ghost" href="/api/rulebook" download>Download Rule Book (PDF)</a>
            <Link className="btn ghost" href="/rubrics">View marking rubrics</Link>
          </div>
        </div>
        <div className="stage" aria-hidden="true">
          <div className="ring" /><div className="ring r2" />
          <div className="cube"><i>&Sigma;</i><i>F=ma</i><i>H&#8322;O</i><i>&pi;</i><i>E=mc&sup2;</i><i>pH</i></div>
        </div>
      </section>

      <div className="chips">
        <div className="chip" style={{ animationDelay: '.05s' }}><b>200</b><span>topics to choose from</span></div>
        <div className="chip" style={{ animationDelay: '.15s' }}><b>3</b><span>phases + grand finale</span></div>
        <div className="chip" style={{ animationDelay: '.25s' }}><b>1&ndash;4</b><span>members per team</span></div>
        <div className="chip" style={{ animationDelay: '.35s' }}><b>100</b><span>total marks</span></div>
      </div>

      <h2 className="section-title">How to join</h2>
      <div className="grid g3">
        <Tilt><div className="card"><span className="num">1</span><h3>Team captain logs in</h3><p className="small">Only the <b>captain</b> needs to log in. Use your Register Number and Date of Birth, then enter the one-time code sent to your email. Team members do not log in at this stage.</p></div></Tilt>
        <Tilt><div className="card"><span className="num">2</span><h3>Captain forms the team</h3><p className="small">On the dashboard, create the team and add members by their register numbers (up to 4 including the captain). Then pick one of 200 topics, first come first served, or propose your own.</p></div></Tilt>
        <Tilt><div className="card"><span className="num">3</span><h3>Submit and build</h3><p className="small">The captain uploads a PDF report and a prototype photo each phase. Bring the physical model to the jury for the grand finale.</p></div></Tilt>
      </div>

      <h2 className="section-title">Timeline</h2>
      <div className="timeline">
        {phases.map((p) => (
          <Tilt key={p.n}><div className="card">
            <h3>Phase {p.n}: {p.subject} <StateBadge s={phaseState(p)} /></h3>
            <p className="small mut">Opens {fmt(p.opens)}<br />Submission closes {fmt(p.closes)}</p>
            <p className="small">Marked against the {p.subject} rubric (20 marks).</p>
          </div></Tilt>
        ))}
        <Tilt><div className="card"><h3>Grand finale: jury round</h3><p className="small mut">{ev.juryDate}</p><p className="small">Bring your physical model to college. Jury marks: 40.</p></div></Tilt>
      </div>
      <p className="small mut">Total 100 marks: Maths 20 + Chemistry 20 + Physics 20 + Jury 40. <Link href="/rubrics">See the full rubrics</Link>.</p>

      <LogoBar />
      <h2 className="section-title">Leaderboard: top 10</h2>
      <LeaderboardTable rows={top} showJury={ev.juryPublished} limit={10} />
      <p className="small mut"><Link href="/leaderboard">View the full leaderboard</Link> with every team, leader and member.</p>

      <h2 className="section-title">Team rules at a glance</h2>
      <div className="card">
        <ul className="rules">
          <li>Teams have <b>1 to 4 members</b>, all first-year students. Each student can be in only one team.</li>
          <li>The <b>captain</b> creates the team, adds members, chooses the topic and uploads every submission.</li>
          <li>Each topic can be taken by <b>one team only</b> (first come first served).</li>
          <li>Every phase needs a <b>PDF report and a prototype photo</b>. The photo must be real, not AI-generated.</li>
          <li>Submit before the phase deadline. Late submissions are not accepted.</li>
          <li>All work must be your own. Copied or AI-generated reports can be disqualified.</li>
          <li>The jury and organisers&apos; decisions are final.</li>
        </ul>
        <p className="small mut">Read every rule and all 200 topics in the <a href="/api/rulebook" download>Rule Book</a>.</p>
      </div>

      <h2 className="section-title">Challenge poster</h2>
      <div className="card poster-card">
        <img src="/posters/stem-fusion-poster.png" alt="STEM Fusion Challenge poster: Think, Build, Prove" loading="lazy" />
        <div>
          <p>Share the poster with your classmates and put it up on your notice boards.</p>
          <p><a className="btn" href="/posters/stem-fusion-poster.png" download="STEM-Fusion-Challenge-Poster.png">Download poster (PNG)</a></p>
        </div>
      </div>
    </>
  );
}
