import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { getEvent, getPhases, toLocalInput } from '@/lib/phases';
import { Flash, type SP } from '@/components/ui';
import { addStaffAction, importRosterAction, removeStaffAction, resetStudentLoginAction, saveEventAction, savePhasesAction } from '../../actions';

export const metadata = { title: 'Settings | Admin' };

export default async function Settings({ searchParams }: { searchParams: SP }) {
  const me = await requireAdmin();
  const sp = await searchParams;
  const sql = await db();
  const [phases, ev, staff, cnt] = await Promise.all([
    getPhases(), getEvent(), sql`select email, role, name from staff order by role, email`, sql`select count(*)::int as n from students`,
  ]);
  const bootstrap = (process.env.ADMIN_EMAILS || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
  return (
    <>
      <h1>Settings</h1>
      <Flash sp={sp} />

      <h2>Student roster ({cnt[0].n} students)</h2>
      <form className="card" action={importRosterAction} encType="multipart/form-data">
        <p className="small">CSV with a header row. Required columns: <b>register number, student name, DOB</b>. Optional: department, section, email. Other columns are ignored. Date of birth is stored only as a keyed hash. Re-importing updates existing students and keeps any email they have already linked. Only students on this list can log in.</p>
        <label htmlFor="file">CSV file</label><input id="file" type="file" name="file" accept=".csv,text/csv" />
        <label htmlFor="csv">…or paste CSV</label><textarea id="csv" name="csv" style={{ fontFamily: 'monospace' }} placeholder={'register_number,student_name,dob,department\n2603713810421001,ASHA K,13.09.2008,CSE'} />
        <p><button type="submit">Import roster</button></p>
      </form>

      <h2>Reset a student's login</h2>
      <form className="card row" action={resetStudentLoginAction}>
        <div><label htmlFor="rr">Register number</label><input id="rr" name="roll" required maxLength={40} /></div>
        <button type="submit" className="danger">Reset</button>
        <p className="small mut" style={{ flexBasis: '100%' }}>Use this if a student's account was claimed with the wrong email or they lost access to it. They log in again with register number + date of birth and link a new email.</p>
      </form>

      <h2>Phase schedule (India time)</h2>
      <form className="card" action={savePhasesAction}>
        <p className="small">Phases open and close automatically at these times. Teams cannot upload outside the window.</p>
        {phases.map((p) => (
          <div className="row" key={p.n}>
            <div><label>Phase {p.n} ({p.subject}) opens</label><input type="datetime-local" name={`opens${p.n}`} defaultValue={toLocalInput(p.opens)} required /></div>
            <div><label>Closes</label><input type="datetime-local" name={`closes${p.n}`} defaultValue={toLocalInput(p.closes)} required /></div>
          </div>))}
        <p><button type="submit">Save schedule</button></p>
      </form>

      <h2>Jury round</h2>
      <form className="card" action={saveEventAction}>
        <label htmlFor="juryDate">Jury date / venue (shown to students)</label><input id="juryDate" name="juryDate" defaultValue={ev.juryDate} maxLength={120} />
        <label style={{ fontWeight: 400 }}><input type="checkbox" name="juryPublished" defaultChecked={ev.juryPublished} /> Publish jury marks on student dashboards and the leaderboard</label>
        <p><button type="submit">Save</button></p>
      </form>

      <h2>Admins and jury members</h2>
      <div className="card">
        <table><thead><tr><th>Email</th><th>Role</th><th>Name</th><th></th></tr></thead><tbody>
          {bootstrap.map((e) => <tr key={e}><td>{e}</td><td>admin</td><td className="mut small">set in ADMIN_EMAILS (environment)</td><td></td></tr>)}
          {staff.map((s) => <tr key={s.email}><td>{s.email}</td><td>{s.role}</td><td>{s.name}</td>
            <td>{s.email !== me.sub && <form action={removeStaffAction}><input type="hidden" name="email" value={s.email} /><button className="danger" type="submit">Remove</button></form>}</td></tr>)}
        </tbody></table>
        <form action={addStaffAction} className="row" style={{ marginTop: 12 }}>
          <div><label htmlFor="se">Email</label><input id="se" name="email" type="email" required /></div>
          <div><label htmlFor="sn">Name</label><input id="sn" name="name" /></div>
          <div><label htmlFor="sr">Role</label><select id="sr" name="role"><option value="jury">Jury</option><option value="admin">Admin</option></select></div>
          <button type="submit">Add</button>
        </form>
      </div>
    </>
  );
}
