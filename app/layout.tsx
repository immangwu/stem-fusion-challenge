import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { logoutAction } from './actions';
import LogoBar from '@/components/LogoBar';

export const metadata: Metadata = {
  title: 'STEM Fusion Challenge: Think, Build, Prove',
  description: 'First-year Maths, Physics and Chemistry project challenge',
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  return (
    <html lang="en">
      <body>
        <div className="logobar"><LogoBar /></div>
        <header className="top">
          <Link href="/" className="brand brandrow"><img src="/science-club-logo.png" alt="" />STEM Fusion Challenge</Link>
          <nav>
            <a href="/api/rulebook" download>Rule Book</a>
            {!s && <Link href="/rubrics">Rubrics</Link>}
            {!s && <Link href="/login">Login</Link>}
            {s?.role === 'student' && (<><Link href="/dashboard">Dashboard</Link><Link href="/topics">Topics</Link><Link href="/leaderboard">Leaderboard</Link><Link href="/rubrics">Rubrics</Link></>)}
            {s?.role === 'admin' && (<><Link href="/admin">Overview</Link><Link href="/admin/teams">Teams</Link><Link href="/admin/evaluations">Evaluation</Link><Link href="/admin/settings">Settings</Link><Link href="/jury">Jury</Link><Link href="/leaderboard">Leaderboard</Link></>)}
            {s?.role === 'jury' && (<><Link href="/jury">Jury marks</Link><Link href="/leaderboard">Leaderboard</Link></>)}
            {s && (<form action={logoutAction}><button type="submit">Logout ({s.name.split(' ')[0]})</button></form>)}
          </nav>
        </header>
        <main>{children}</main>
        <footer className="sitefoot">
          <LogoBar className="small" />
          <div>Organised by Science Club, SRIT &bull; Technical Partners: HIVE &amp; ASME SRIT</div>
          <div>STEM Fusion Challenge: Think, Build, Prove &bull; <a href="/api/rulebook" download>Download Rule Book</a></div>
        </footer>
      </body>
    </html>
  );
}
