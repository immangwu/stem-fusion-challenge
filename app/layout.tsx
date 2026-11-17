import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { logoutAction } from './actions';

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
        <header className="top">
          <Link href="/" className="brand">STEM Fusion Challenge</Link>
          <nav>
            {!s && <Link href="/rubrics">Rubrics</Link>}
            {!s && <Link href="/login">Login</Link>}
            {s?.role === 'student' && (<><Link href="/dashboard">Dashboard</Link><Link href="/topics">Topics</Link><Link href="/leaderboard">Leaderboard</Link><Link href="/rubrics">Rubrics</Link></>)}
            {s?.role === 'admin' && (<><Link href="/admin">Overview</Link><Link href="/admin/teams">Teams</Link><Link href="/admin/evaluations">Evaluation</Link><Link href="/admin/settings">Settings</Link><Link href="/jury">Jury</Link><Link href="/leaderboard">Leaderboard</Link></>)}
            {s?.role === 'jury' && (<><Link href="/jury">Jury marks</Link><Link href="/leaderboard">Leaderboard</Link></>)}
            {s && (<form action={logoutAction}><button type="submit">Logout ({s.name.split(' ')[0]})</button></form>)}
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
