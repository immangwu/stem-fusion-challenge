import LogoBar from '@/components/LogoBar';
import { getSession } from '@/lib/auth';
import { leaderboard, myTeam, rankRows } from '@/lib/data';
import { getEvent } from '@/lib/phases';
import { TIEBREAK } from '@/lib/rubrics';
import LeaderboardTable from '@/components/LeaderboardTable';

export const metadata = { title: 'Leaderboard | STEM Fusion Challenge' };
export const dynamic = 'force-dynamic';

export default async function Leaderboard() {
  const s = await getSession();
  const [raw, ev] = await Promise.all([leaderboard(), getEvent()]);
  const mine = s?.role === 'student' ? (await myTeam(s.sub))?.team.id : null;
  const showJury = ev.juryPublished || (!!s && s.role !== 'student');
  const rows = rankRows(raw, showJury);
  return (
    <>
      <LogoBar />
      <h1>Leaderboard</h1>
      <p className="small mut">Updated every minute. Maths (20) + Chemistry (20) + Physics (20){showJury ? ' + Jury (40)' : ''}. {TIEBREAK}</p>
      <LeaderboardTable rows={rows} showJury={showJury} mine={mine} />
    </>
  );
}
