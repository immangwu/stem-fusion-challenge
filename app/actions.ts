'use server';

import { redirect } from 'next/navigation';
import { revalidatePath, revalidateTag } from 'next/cache';
import { db, audit, setSetting } from '../lib/db';
import {
  allow, checkOtp, clearPre, clientIp, createSession, destroySession, dobHash, dobMatches, issueOtp, normEmail, normRoll,
  parseDob, readPre, requireAdmin, requireJury, requireStudent, setPre, staffRole,
} from '../lib/auth';
import { getStudent } from '../lib/data';
import { fromLocalInput, getEvent, getPhases, phaseState } from '../lib/phases';
import { JURY_RUBRIC } from '../lib/rubrics';
import { importResults } from '../lib/results';
import { parseCsv } from '../lib/csv';
import { deleteBlobs } from '../lib/storage';

class UserError extends Error {}
const str = (v: FormDataEntryValue | null, max = 500) => String(v ?? '').trim().slice(0, max);

function go(path: string, kind: 'msg' | 'err', text: string): never {
  const sep = path.includes('?') ? '&' : '?';
  redirect(`${path}${sep}${kind}=${encodeURIComponent(text)}`);
}

async function guard(path: string, fn: () => Promise<string | void>) {
  let ok: string | void;
  try {
    ok = await fn();
  } catch (e) {
    if (e instanceof UserError) go(path, 'err', e.message);
    const code = (e as { code?: string })?.code;
    if (code === '23505') go(path, 'err', 'That value is already taken. Please choose another.');
    console.error(e);
    go(path, 'err', 'Something went wrong. Please try again.');
  }
  if (ok) go(path, 'msg', ok);
}

/* ------------------------------ authentication ------------------------------ */

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Step 1. Students: register number + date of birth. Staff: email. */
export async function requestOtpAction(fd: FormData) {
  const kind = str(fd.get('kind'), 10) === 'staff' ? 'staff' : 'student';
  const raw = str(fd.get('identifier'), 200);
  const id = kind === 'staff' ? normEmail(raw) : normRoll(raw);
  const back = `/login${kind === 'staff' ? '?as=staff' : ''}`;
  if (!id) go(back, 'err', 'Enter your ' + (kind === 'staff' ? 'email' : 'register number'));

  const ip = await clientIp();
  // Campus Wi-Fi shares one public IP, so the per-IP limit is generous; the per-account limit is the strict one.
  if (!(await allow(`otp-ip:${ip}`, 400, 900)) || !(await allow(`otp-id:${id}`, kind === 'staff' ? 4 : 30, kind === 'staff' ? 600 : 3600))) {
    go(back, 'err', 'Too many attempts. Please wait a few minutes and try again.');
  }

  if (kind === 'staff') {
    try {
      const r = await staffRole(id);
      if (r) await issueOtp(`a:${id}`, id, r.name);
    } catch (e) {
      console.error('OTP send failed', e);
      go(back, 'err', 'Could not send the code right now. Please contact the organisers.');
    }
    redirect(`/login/verify?k=staff&id=${encodeURIComponent(id)}`);
  }

  const dob = parseDob(fd.get('dob'));
  const s = await getStudent(id);
  if (!dob || !s || !dobMatches(s.dob_hash, id, dob)) {
    go(back, 'err', 'Register number or date of birth is incorrect. If it keeps failing, contact the organisers.');
  }
  if (!s.email) {
    await setPre(id); // proof that the DOB step passed; lets the student attach their own email
    redirect('/login/email');
  }
  try {
    await issueOtp(`s:${id}`, s.email, s.name);
  } catch (e) {
    console.error('OTP send failed', e);
    go(back, 'err', 'Could not send the code right now. Please contact the organisers.');
  }
  redirect(`/login/verify?k=student&id=${encodeURIComponent(id)}`);
}

/** First login only: the student links their own email address, verified by a one-time code. */
export async function bindEmailAction(fd: FormData) {
  const roll = await readPre();
  if (!roll) go('/login', 'err', 'Your session expired. Please start again.');
  const email = normEmail(fd.get('email'));
  if (!EMAIL_RE.test(email)) go('/login/email', 'err', 'Enter a valid email address.');
  if (!(await allow(`bind:${roll}`, 6, 3600))) go('/login/email', 'err', 'Too many attempts. Please wait and try again.');
  const s = await getStudent(roll);
  if (!s || s.email) go('/login', 'err', 'Please log in again.');
  const sql = await db();
  if ((await sql`select 1 from students where lower(email) = ${email}`).length) {
    go('/login/email', 'err', 'That email is already linked to another student. Use your own email address.');
  }
  try {
    await issueOtp(`s:${roll}`, email, s.name, email);
  } catch (e) {
    console.error('OTP send failed', e);
    go('/login/email', 'err', 'Could not send the code right now. Please contact the organisers.');
  }
  redirect(`/login/verify?k=student&id=${encodeURIComponent(roll)}&bind=1`);
}

export async function verifyOtpAction(fd: FormData) {
  const kind = str(fd.get('kind'), 10) === 'staff' ? 'staff' : 'student';
  const id = kind === 'staff' ? normEmail(fd.get('id')) : normRoll(fd.get('id'));
  const code = str(fd.get('code'), 12).replace(/\s/g, '');
  const back = `/login/verify?k=${kind}&id=${encodeURIComponent(id)}${fd.get('bind') ? '&bind=1' : ''}`;
  const ip = await clientIp();
  if (!(await allow(`ver-ip:${ip}`, 800, 900)) || !(await allow(`ver-id:${id}`, 12, 900))) go(back, 'err', 'Too many attempts. Please wait and try again.');
  if (!/^\d{6}$/.test(code)) go(back, 'err', 'Enter the 6-digit code.');

  const res = await checkOtp(`${kind === 'staff' ? 'a' : 's'}:${id}`, code);
  if (!res.ok) go(back, 'err', 'Invalid or expired code.');

  if (kind === 'student') {
    const s = await getStudent(id);
    if (!s) go('/login', 'err', 'Account not found.');
    if (res.meta) {
      // First-time email binding: the code proved ownership of this address.
      const pre = await readPre();
      if (pre !== id) go('/login', 'err', 'Your session expired. Please start again.');
      const sql = await db();
      try {
        const r = await sql`update students set email = ${res.meta} where roll_no = ${id} and email is null returning roll_no`;
        if (!r.length) go('/login', 'err', 'This account is already set up. Please log in again.');
      } catch (e) {
        if ((e as { code?: string })?.code === '23505') go('/login/email', 'err', 'That email is already linked to another student.');
        throw e;
      }
      await audit(id, 'email_bound');
    }
    await clearPre();
    await createSession({ sub: s.roll_no, role: 'student', name: s.name });
    redirect('/dashboard');
  }
  const r = await staffRole(id);
  if (!r) go('/login?as=staff', 'err', 'Account not found.');
  await createSession({ sub: id, role: r.role, name: r.name });
  await audit(id, 'staff_login');
  redirect(r.role === 'admin' ? '/admin' : '/jury');
}

export async function logoutAction() {
  await destroySession();
  redirect('/');
}

/* ---------------------------------- teams ---------------------------------- */

async function lockedAfterPhase1() {
  const p = (await getPhases())[0];
  return phaseState(p) === 'closed';
}

export async function createTeamAction(fd: FormData) {
  const me = await requireStudent();
  await guard('/dashboard', async () => {
    if (!(await allow(`team:${me.sub}`, 10, 3600))) throw new UserError('Too many attempts.');
    if (await lockedAfterPhase1()) throw new UserError('Team creation is closed.');
    const name = str(fd.get('name'), 60);
    if (name.length < 3 || name.length > 40 || !/^[\p{L}\p{N} _\-.&']+$/u.test(name)) {
      throw new UserError('Team name must be 3–40 characters (letters, numbers, spaces and - _ . & \' only).');
    }
    const extra = [...new Set([1, 2, 3].map((i) => normRoll(fd.get('m' + i))).filter(Boolean))].filter((r) => r !== me.sub);
    const sql = await db();
    await sql.begin(async (tx) => {
      if ((await tx`select 1 from team_members where roll_no = ${me.sub}`).length) throw new UserError('You are already in a team.');
      const t = await tx`insert into teams(name, leader_roll) values (${name}, ${me.sub}) returning id`;
      const teamId = t[0].id as string;
      await tx`insert into team_members(roll_no, team_id) values (${me.sub}, ${teamId})`;
      for (const r of extra) {
        if (!(await tx`select 1 from students where roll_no = ${r}`).length) throw new UserError(`Roll number ${r} is not on the student list.`);
        if ((await tx`select 1 from team_members where roll_no = ${r}`).length) throw new UserError(`${r} is already in another team.`);
        await tx`insert into team_members(roll_no, team_id) values (${r}, ${teamId})`;
      }
    });
    await audit(me.sub, 'team_created', { name });
    revalidateTag('leaderboard');
    return 'Team created. Now choose a topic.';
  });
}

export async function addMemberAction(fd: FormData) {
  const me = await requireStudent();
  await guard('/dashboard', async () => {
    if (await lockedAfterPhase1()) throw new UserError('Team changes are locked.');
    const roll = normRoll(fd.get('roll'));
    const sql = await db();
    await sql.begin(async (tx) => {
      const t = (await tx`select id from teams where leader_roll = ${me.sub} for update`)[0];
      if (!t) throw new UserError('Only the team leader can add members.');
      const n = (await tx`select count(*)::int as n from team_members where team_id = ${t.id}`)[0].n as number;
      if (n >= 4) throw new UserError('A team can have at most 4 members.');
      if (!(await tx`select 1 from students where roll_no = ${roll}`).length) throw new UserError(`Roll number ${roll || '(blank)'} is not on the student list.`);
      if ((await tx`select 1 from team_members where roll_no = ${roll}`).length) throw new UserError(`${roll} is already in a team.`);
      await tx`insert into team_members(roll_no, team_id) values (${roll}, ${t.id})`;
    });
    return 'Member added.';
  });
}

export async function removeMemberAction(fd: FormData) {
  const me = await requireStudent();
  await guard('/dashboard', async () => {
    if (await lockedAfterPhase1()) throw new UserError('Team changes are locked.');
    const roll = normRoll(fd.get('roll'));
    if (roll === me.sub) throw new UserError('The leader cannot be removed.');
    const sql = await db();
    const r = await sql`
      delete from team_members where roll_no = ${roll}
      and team_id = (select id from teams where leader_roll = ${me.sub}) returning roll_no`;
    if (!r.length) throw new UserError('Member not found.');
    return 'Member removed.';
  });
}

/* ---------------------------------- topics ---------------------------------- */

export async function claimTopicAction(fd: FormData) {
  const me = await requireStudent();
  await guard('/topics', async () => {
    if (await lockedAfterPhase1()) throw new UserError('Topic selection is locked.');
    const id = Number(fd.get('topicId'));
    if (!Number.isInteger(id)) throw new UserError('Invalid topic.');
    const sql = await db();
    await sql.begin(async (tx) => {
      const t = (await tx`select id from teams where leader_roll = ${me.sub} for update`)[0];
      if (!t) throw new UserError('Only a team leader can choose the topic. Create a team first.');
      await tx`update topics set claimed_by = null where claimed_by = ${t.id}`;
      const r = await tx`update topics set claimed_by = ${t.id} where id = ${id} and claimed_by is null returning id`;
      if (!r.length) throw new UserError('Sorry, that topic was just taken by another team. Please pick another.');
      await tx`update teams set custom = null, custom_status = null, custom_review = null where id = ${t.id}`;
    });
    await audit(me.sub, 'topic_claimed', { id });
    return 'Topic assigned to your team.';
  });
}

export async function submitCustomTopicAction(fd: FormData) {
  const me = await requireStudent();
  await guard('/topics/custom', async () => {
    if (await lockedAfterPhase1()) throw new UserError('Topic selection is locked.');
    const f = {
      title: str(fd.get('title'), 120), description: str(fd.get('description'), 1500),
      math: str(fd.get('math'), 400), physics: str(fd.get('physics'), 400), chemistry: str(fd.get('chemistry'), 400),
      materials: str(fd.get('materials'), 400), measurable: str(fd.get('measurable'), 400), safety: str(fd.get('safety'), 400),
    };
    if (f.title.length < 5) throw new UserError('Please give a descriptive title.');
    if (f.description.length < 30) throw new UserError('Description must be at least 30 characters.');
    for (const k of ['math', 'physics', 'chemistry', 'materials', 'measurable', 'safety'] as const) {
      if (f[k].length < 10) throw new UserError(`Please fill in "${k}" (at least 10 characters).`);
    }
    const sql = await db();
    await sql.begin(async (tx) => {
      const t = (await tx`select id from teams where leader_roll = ${me.sub} for update`)[0];
      if (!t) throw new UserError('Only a team leader can propose a topic. Create a team first.');
      if ((await tx`select 1 from topics where lower(title) = lower(${f.title})`).length) throw new UserError('That title is already in the topic list. Pick it from the list instead.');
      if ((await tx`select 1 from teams where id <> ${t.id} and lower(custom->>'title') = lower(${f.title})`).length) throw new UserError('Another team proposed the same title.');
      await tx`update teams set custom = ${tx.json(f)}, custom_status = 'pending', custom_review = null where id = ${t.id}`;
    });
    await audit(me.sub, 'custom_topic_submitted', { title: f.title });
    return 'Submitted for validation. You will see the decision on your dashboard.';
  });
}

/* ------------------------------ student: re-evaluation ------------------------------ */

export async function requestReevalAction(fd: FormData) {
  const me = await requireStudent();
  await guard('/dashboard', async () => {
    const phase = Number(fd.get('phase'));
    const reason = str(fd.get('reason'), 600);
    if (![1, 2, 3].includes(phase)) throw new UserError('Invalid phase.');
    if (reason.length < 10) throw new UserError('Please explain why you want a re-evaluation (at least 10 characters).');
    const sql = await db();
    const r = await sql`
      update evaluations e set reeval_requested = true, updated_at = now()
      from teams t where t.id = e.team_id and t.leader_roll = ${me.sub} and e.phase = ${phase}
        and e.status = 'done' and e.attempts <= 1 and not e.reeval_requested returning e.team_id`;
    if (!r.length) throw new UserError('A re-evaluation can be requested only once, by the leader, after the result is published.');
    await audit(me.sub, 'reeval_requested', { phase, reason });
    return 'Re-evaluation requested.';
  });
}

/* ---------------------------------- jury ---------------------------------- */

export async function saveJuryMarksAction(fd: FormData) {
  const me = await requireJury();
  const teamId = str(fd.get('teamId'), 50);
  const back = str(fd.get('back'), 200).startsWith('/jury') ? str(fd.get('back'), 200) : '/jury';
  await guard(back, async () => {
    // Only the final mark (out of 40) is entered; the per-criterion breakdown stays on the paper sheets.
    const total = Math.round(Number(fd.get('total')) * 2) / 2;
    if (!str(fd.get('total'), 10) || !Number.isFinite(total) || total < 0 || total > JURY_RUBRIC.total) throw new UserError(`Enter the final mark from 0 to ${JURY_RUBRIC.total}.`);
    const scores: Record<string, number> = {};
    const sql = await db();
    if (!(await sql`select 1 from teams where id = ${teamId}`).length) throw new UserError('Team not found.');
    await sql`
      insert into jury_marks(team_id, juror, scores, total) values (${teamId}, ${me.sub}, ${sql.json(scores)}, ${total})
      on conflict (team_id, juror) do update set scores = excluded.scores, total = excluded.total, updated_at = now()`;
    await audit(me.sub, 'jury_marks', { teamId, total });
    revalidateTag('leaderboard');
    return `Saved ${total}/${JURY_RUBRIC.total}.`;
  });
}

/* ---------------------------------- admin ---------------------------------- */

const HEADERS: Record<string, string[]> = {
  roll_no: ['rollno', 'roll', 'rollnumber', 'registerno', 'registrationno', 'regno', 'registernumber', 'registrationnumber'],
  name: ['name', 'studentname', 'fullname'],
  dob: ['dob', 'dateofbirth', 'birthdate'],
  email: ['email', 'emailid', 'collegeemail', 'mail'],
  dept: ['dept', 'department', 'branch'],
  section: ['section', 'sec', 'class'],
};

/** Only register number, name, DOB (stored as a keyed hash) and department are used; every other column is ignored. */
export async function importRosterAction(fd: FormData) {
  const me = await requireAdmin();
  await guard('/admin/settings', async () => {
    const file = fd.get('file');
    const text = file instanceof File && file.size ? await file.text() : str(fd.get('csv'), 2_000_000);
    if (!text.trim()) throw new UserError('Upload a CSV file or paste the CSV text.');
    const rows = parseCsv(text);
    if (rows.length < 2) throw new UserError('The CSV needs a header row and at least one student.');
    const head = rows[0].map((h) => h.toLowerCase().replace(/[^a-z]/g, ''));
    const idx: Record<string, number> = {};
    for (const [k, alts] of Object.entries(HEADERS)) idx[k] = head.findIndex((h) => alts.includes(h));
    if (idx.roll_no < 0 || idx.name < 0 || idx.dob < 0) throw new UserError('Header must include register number, student name and DOB columns.');
    const out: { roll_no: string; name: string; email: string | null; dept: string | null; section: string | null; dob_hash: string }[] = [];
    let skipped = 0;
    const seen = new Set<string>();
    for (const r of rows.slice(1)) {
      const roll = normRoll(r[idx.roll_no]);
      const dob = parseDob(r[idx.dob]);
      const name = String(r[idx.name] ?? '').trim().slice(0, 120);
      const email = idx.email >= 0 ? normEmail(r[idx.email]) : '';
      if (!roll || !name || !dob || seen.has(roll)) { skipped++; continue; }
      seen.add(roll);
      out.push({
        roll_no: roll, name, dob_hash: dobHash(roll, dob), email: EMAIL_RE.test(email) ? email : null,
        dept: idx.dept >= 0 ? String(r[idx.dept] ?? '').trim().slice(0, 80) || null : null,
        section: idx.section >= 0 ? String(r[idx.section] ?? '').trim().slice(0, 40) || null : null,
      });
    }
    if (!out.length) throw new UserError('No valid rows found.');
    const sql = await db();
    for (let i = 0; i < out.length; i += 300) {
      const chunk = out.slice(i, i + 300);
      await sql`insert into students ${sql(chunk, 'roll_no', 'name', 'email', 'dept', 'section', 'dob_hash')}
        on conflict (roll_no) do update set name = excluded.name, dept = excluded.dept, section = excluded.section,
          dob_hash = excluded.dob_hash, email = coalesce(students.email, excluded.email)`;
    }
    await audit(me.sub, 'roster_import', { imported: out.length, skipped });
    return `Imported ${out.length} students (${skipped} rows skipped). Date of birth is stored only as a hash.`;
  });
}

export async function resetStudentLoginAction(fd: FormData) {
  const me = await requireAdmin();
  await guard('/admin/settings', async () => {
    const roll = normRoll(fd.get('roll'));
    const sql = await db();
    const r = await sql`update students set email = null where roll_no = ${roll} returning roll_no`;
    if (!r.length) throw new UserError('Register number not found.');
    await sql`update otps set used = true where identifier = ${'s:' + roll}`;
    await audit(me.sub, 'student_login_reset', { roll });
    return `Login reset for ${roll}. The student can log in again with register number + date of birth and link their email.`;
  });
}

export async function deleteTeamAction(fd: FormData) {
  const me = await requireAdmin();
  await guard('/admin/teams', async () => {
    const id = str(fd.get('team_id'), 60);
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new UserError('Invalid team.');
    if (str(fd.get('confirm'), 10).toLowerCase() !== 'delete') throw new UserError('Type DELETE to confirm.');
    const sql = await db();
    const t = (await sql`select id, name, leader_roll from teams where id = ${id}`)[0];
    if (!t) throw new UserError('Team not found.');
    const blobs = (await sql`select blob_path from files where team_id = ${id}`).map((r) => String(r.blob_path));
    const rolls = (await sql`select roll_no from team_members where team_id = ${id}`).map((r) => String(r.roll_no));
    if (!rolls.includes(t.leader_roll)) rolls.push(t.leader_roll as string);
    await sql.begin(async (tx) => {
      await tx`update topics set claimed_by = null where claimed_by = ${id}`;
      await tx`delete from teams where id = ${id}`; // cascades members, files, evaluations, marks
      await tx`update students set email = null where roll_no in ${sql(rolls)}`;
      await tx`update otps set used = true where identifier in ${sql(rolls.map((r) => 's:' + r))}`;
    });
    await deleteBlobs(blobs);
    await audit(me.sub, 'team_deleted', { team: t.name, leader: t.leader_roll, members: rolls.length, files: blobs.length });
    return `Team "${t.name}" deleted. Its members' logins were reset: they can log in again with register number + date of birth and create a new team.`;
  });
}

export async function addStaffAction(fd: FormData) {
  const me = await requireAdmin();
  await guard('/admin/settings', async () => {
    const email = normEmail(fd.get('email'));
    const role = str(fd.get('role'), 10) === 'admin' ? 'admin' : 'jury';
    const name = str(fd.get('name'), 80) || null;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new UserError('Enter a valid email.');
    const sql = await db();
    await sql`insert into staff(email, role, name) values (${email}, ${role}, ${name})
      on conflict (email) do update set role = excluded.role, name = excluded.name`;
    await audit(me.sub, 'staff_added', { email, role });
    return `${role} added: ${email}`;
  });
}

export async function removeStaffAction(fd: FormData) {
  const me = await requireAdmin();
  await guard('/admin/settings', async () => {
    const email = normEmail(fd.get('email'));
    if (email === me.sub) throw new UserError('You cannot remove yourself.');
    const sql = await db();
    await sql`delete from staff where email = ${email}`;
    await audit(me.sub, 'staff_removed', { email });
    return 'Removed.';
  });
}

export async function savePhasesAction(fd: FormData) {
  const me = await requireAdmin();
  await guard('/admin/settings', async () => {
    const cur = await getPhases();
    const next = cur.map((p) => ({
      ...p,
      opens: fromLocalInput(str(fd.get(`opens${p.n}`), 20)),
      closes: fromLocalInput(str(fd.get(`closes${p.n}`), 20)),
    }));
    for (const p of next) {
      if (Number.isNaN(new Date(p.opens).getTime()) || Number.isNaN(new Date(p.closes).getTime())) throw new UserError('Invalid date.');
      if (new Date(p.closes) <= new Date(p.opens)) throw new UserError(`Phase ${p.n}: closing time must be after opening time.`);
    }
    await setSetting('phases', next);
    await audit(me.sub, 'phases_saved', { next });
    revalidatePath('/', 'layout');
    return 'Phase schedule saved.';
  });
}

export async function saveEventAction(fd: FormData) {
  const me = await requireAdmin();
  await guard('/admin/settings', async () => {
    const cur = await getEvent();
    await setSetting('event', { ...cur, juryDate: str(fd.get('juryDate'), 120) || 'To be announced', juryPublished: fd.get('juryPublished') === 'on' });
    await audit(me.sub, 'event_saved');
    revalidatePath('/', 'layout');
    revalidateTag('leaderboard');
    return 'Saved.';
  });
}

/** Admin approval gate: a phase's marks appear to students and on the public leaderboard only after this. */
export async function publishPhaseAction(fd: FormData) {
  const me = await requireAdmin();
  await guard('/admin/evaluations', async () => {
    const phase = Number(fd.get('phase'));
    const publish = fd.get('publish') === '1';
    if (![1, 2, 3].includes(phase)) throw new UserError('Invalid phase.');
    const cur = await getEvent();
    await setSetting('event', { ...cur, published: { ...cur.published, [phase]: publish } });
    await audit(me.sub, publish ? 'phase_published' : 'phase_unpublished', { phase });
    revalidatePath('/', 'layout');
    revalidateTag('leaderboard');
    return publish ? `Phase ${phase} results are now published.` : `Phase ${phase} results are hidden again.`;
  });
}

export async function reviewCustomTopicAction(fd: FormData) {
  const me = await requireAdmin();
  await guard('/admin/evaluations', async () => {
    const teamId = str(fd.get('teamId'), 50);
    const decision = str(fd.get('decision'), 10);
    const note = str(fd.get('note'), 600);
    if (!['approved', 'revise', 'rejected'].includes(decision)) throw new UserError('Invalid decision.');
    if (decision !== 'approved' && note.length < 5) throw new UserError('Please give a reason for revise/reject.');
    const sql = await db();
    await sql.begin(async (tx) => {
      const r = await tx`update teams set custom_status = ${decision}, custom_review = ${tx.json({ note, by: me.sub, at: new Date().toISOString() })}
        where id = ${teamId} and custom is not null returning id`;
      if (!r.length) throw new UserError('No custom topic for that team.');
      if (decision === 'approved') await tx`update topics set claimed_by = null where claimed_by = ${teamId}`;
    });
    await audit(me.sub, 'custom_topic_review', { teamId, decision });
    return 'Decision saved.';
  });
}

export async function overrideScoreAction(fd: FormData) {
  const me = await requireAdmin();
  await guard('/admin/evaluations', async () => {
    const teamId = str(fd.get('teamId'), 50);
    const phase = Number(fd.get('phase'));
    const total = Math.round(Number(fd.get('total')) * 2) / 2;
    const note = str(fd.get('note'), 600);
    if (![1, 2, 3].includes(phase) || !Number.isFinite(total) || total < 0 || total > 20) throw new UserError('Total must be between 0 and 20.');
    if (note.length < 5) throw new UserError('Please record the reason for the override.');
    const sql = await db();
    if (!(await sql`select 1 from teams where id = ${teamId}`).length) throw new UserError('Team not found.');
    await sql`insert into evaluations(team_id, phase, status, override_total, override_note, model) values (${teamId}, ${phase}, 'done', ${total}, ${note}, 'admin')
      on conflict (team_id, phase) do update set override_total = ${total}, override_note = ${note}, status = 'done', reeval_requested = false, updated_at = now()`;
    await audit(me.sub, 'score_override', { teamId, phase, total, note });
    revalidateTag('leaderboard');
    return 'Override saved.';
  });
}

export async function importResultsAction(fd: FormData) {
  const me = await requireAdmin();
  await guard('/admin/evaluations', async () => {
    const file = fd.get('file');
    const text = file instanceof File && file.size ? await file.text() : str(fd.get('json'), 4_000_000);
    if (!text.trim()) throw new UserError('Upload the results JSON file or paste it.');
    let data: unknown;
    try { data = JSON.parse(text); } catch { throw new UserError('That is not valid JSON.'); }
    const r = await importResults(data, me.sub);
    if (!r.ok) throw new UserError(r.error);
    revalidateTag('leaderboard');
    const extra = r.errors.length ? ` Problems: ${r.errors.slice(0, 5).join(' | ')}${r.errors.length > 5 ? ` (+${r.errors.length - 5} more)` : ''}` : '';
    return `Imported ${r.imported} results, ${r.needsReview} marked for review.${extra}`;
  });
}
