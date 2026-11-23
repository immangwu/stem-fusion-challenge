import Link from 'next/link';
import LogoBar from '@/components/LogoBar';
import { getSession } from '@/lib/auth';
import { leaderboard, myTeam, rankRows, type LbView } from '@/lib/data';
import { getEvent } from '@/lib/phases';
import { TIEBREAK } from '@/lib/rubrics';
import LeaderboardTable from '@/components/LeaderboardTable';
import { first, type SP } from '@/components/ui';

export const metadata = { title: 'Leaderboard | STEM Fusion Challenge' };
export const dynamic = 'force-dynamic';

const TABS: { v: LbView; label: string; phase?: 1 | 2 | 3 }[] = [
  { v: 'overall', label: 'Overall' }, { v: 'maths', label: 'Maths', phase: 1 }, { v: 'chemistry', label: 'Chemistry', phase: 2 },
  { v: 'physics', label: 'Physics', phase: 3 }, { v: 'jury', label: 'Jury (final round)' },
];

export default async function Leaderboard({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const s = await getSession();
  const [raw, ev] = await Promise.all([leaderboard(), getEvent()]);
  const mine = s?.role === 'student' ? (await myTeam(s.sub))?.team.id : null;
  const admin = s?.role === 'admin';
  const preview = admin && first(sp.preview) === '1';
  const showJury = ev.juryPublished || preview;
  const pub = preview ? { 1: true, 2: true, 3: true } : ev.published;
  const view = (TABS.find((t) => t.v === first(sp.view))?.v ?? 'overall') as LbView;
  const tab = TABS.find((t) => t.v === view)!;
  const hidden = tab.phase ? !pub[tab.phase] : view === 'jury' ? !showJury : false;
  const rows = rankRows(raw, showJury, pub, view);
  const href = (v: LbView) => `/leaderboard?view=${v}${preview ? '&preview=1' : ''}`;
  const outOf = view === 'jury' ? 40 : view === 'overall' ? 60 + (showJury ? 40 : 0) : 20;
  return (
    <>
      <LogoBar />
      <h1>Leaderboard</h1>
      <p style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {TABS.filter((t) => t.v !== 'jury' || showJury).map((t) => (
          <Link key={t.v} href={href(t.v)} className={t.v === view ? 'btn gold' : 'btn sec'}>{t.label}</Link>))}
      </p>
      {preview && <div className="card" style={{ borderColor: 'var(--warn)' }}><b>Admin preview.</b> This view includes results that are not yet published to students.</div>}
      {hidden ? (
        <div className="card mut">{view === 'jury' ? 'Jury marks will be published after the final round.' : `The ${tab.label} results will appear here once they are published.`}</div>
      ) : (<>
        <p className="small mut">
          {view === 'overall' ? `Maths (20) + Chemistry (20) + Physics (20)${showJury ? ' + Jury (40)' : ''}, published phases only. ${TIEBREAK}` : `${tab.label} marks out of ${outOf}. Teams with the same marks share a rank.`}
        </p>
        <LeaderboardTable rows={rows} showJury={showJury} mine={mine} view={view} />
      </>)}
    </>
  );
}
