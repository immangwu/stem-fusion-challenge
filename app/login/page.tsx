import Link from 'next/link';
import { Flash, first, type SP } from '@/components/ui';
import { requestOtpAction } from '../actions';

export const metadata = { title: 'Login | STEM Fusion Challenge' };

export default async function Login({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const staff = first(sp.as) === 'staff';
  return (
    <div style={{ maxWidth: 440, margin: '30px auto' }}>
      <h1>{staff ? 'Staff login' : 'Student login'}</h1>
      <Flash sp={sp} />
      <form className="card" action={requestOtpAction}>
        <input type="hidden" name="kind" value={staff ? 'staff' : 'student'} />
        <label htmlFor="identifier">{staff ? 'Staff email' : 'Register number'}</label>
        <input id="identifier" name="identifier" required autoComplete={staff ? 'email' : 'username'} type={staff ? 'email' : 'text'} maxLength={200}
          inputMode={staff ? 'email' : 'numeric'} placeholder={staff ? 'name@college.edu' : '16-digit register number'} />
        {!staff && (<>
          <label htmlFor="dob">Date of birth</label>
          <input id="dob" name="dob" type="date" required autoComplete="bday" />
        </>)}
        <p className="small mut">{staff ? 'A 6-digit code will be sent to this email.' : 'First time? You will be asked to link your own email address. After that, each login sends a 6-digit code to that email.'}</p>
        <button type="submit">{staff ? 'Send code' : 'Continue'}</button>
      </form>
      <p className="small">{staff ? <Link href="/login">Student login</Link> : <Link href="/login?as=staff">Admin / jury login</Link>}</p>
    </div>
  );
}
