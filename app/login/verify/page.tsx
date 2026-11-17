import Link from 'next/link';
import { Flash, first, type SP } from '@/components/ui';
import { verifyOtpAction } from '../../actions';

export const metadata = { title: 'Enter code | STEM Fusion Challenge' };

export default async function Verify({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const kind = first(sp.k) === 'staff' ? 'staff' : 'student';
  const id = first(sp.id).slice(0, 200);
  return (
    <div style={{ maxWidth: 440, margin: '30px auto' }}>
      <h1>Enter your code</h1>
      <Flash sp={sp} />
      <p className="mut small">If <b>{id}</b> is registered, a 6-digit code has been emailed. It expires in 10 minutes.</p>
      <form className="card" action={verifyOtpAction}>
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="id" value={id} />
        <label htmlFor="code">6-digit code</label>
        <input id="code" name="code" required inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} autoFocus />
        <p><button type="submit">Verify and log in</button></p>
      </form>
      <p className="small"><Link href={kind === 'staff' ? '/login?as=staff' : '/login'}>Use a different account / resend</Link></p>
    </div>
  );
}
