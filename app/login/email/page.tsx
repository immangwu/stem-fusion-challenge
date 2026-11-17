import Link from 'next/link';
import { redirect } from 'next/navigation';
import { readPre } from '@/lib/auth';
import { Flash, type SP } from '@/components/ui';
import { bindEmailAction } from '../../actions';

export const metadata = { title: 'Link your email | STEM Fusion Challenge' };

export default async function LinkEmail({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  if (!(await readPre())) redirect('/login');
  return (
    <div style={{ maxWidth: 460, margin: '30px auto' }}>
      <h1>Link your email</h1>
      <Flash sp={sp} />
      <p className="mut small">This is a one-time step. Enter an email address that only you can access (personal or college). We will send a 6-digit code to confirm it, and every future login code goes to this address.</p>
      <form className="card" action={bindEmailAction}>
        <label htmlFor="email">Your email</label>
        <input id="email" name="email" type="email" required maxLength={200} autoComplete="email" />
        <p><button type="submit">Send verification code</button></p>
      </form>
      <p className="small"><Link href="/login">Start over</Link></p>
    </div>
  );
}
