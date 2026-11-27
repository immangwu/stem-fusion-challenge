import { requireJury, staffRole } from '@/lib/auth';
import { db } from '@/lib/db';
import { JURY_RUBRIC } from '@/lib/rubrics';
import { ALL_VENUES } from '@/lib/seating';
import { Flash, first, n1, type SP } from '@/components/ui';
import JuryForm from '@/components/JuryForm';
import { saveJuryMarksAction, assignVenuesAction, setTeamVenueAction } from '../actions';

export const metadata = { title: 'Jury | STEM Fusion Challenge' };
const PAGE = 15;

export default async function Jury({ searchParams }: { searchParams: SP }) {
  const me = await requireJury();
  const isAdmin = (await staffRole(me.sub))?.role === 'admin';
  const sp = await searchParams;
  const q = first(sp.q).trim().slice(0, 60);
  const venue = first(sp.venue).slice(0, 60);
  const page = Math.max(0, Number(first(sp.page)) || 0);
  const like = '%' + q.replace(/[%_\\]/g, '\\$&') + '%';
  const sql = await db();
  const where = sql`(${q} = '' or t.name ilike ${like} or t.leader_roll ilike ${like}
      or exists (select 1 from team_members m join students s using (roll_no) where m.team_id = t.id and (s.name ilike ${like} or s.roll_no ilike ${like})))
    and (${venue} = '' or (${venue} = '__none' and t.venue is null) or t.venue = ${venue})`;
  const teams = await sql`
    select t.id, t.name, t.venue, coalesce((select title from topics where claimed_by = t.id), case when t.custom_status = 'approved' then t.custom->>'title' end) as topic,
      (select string_agg(s.name, ', ' order by s.name) from team_members m join students s using (roll_no) where m.team_id = t.id) as members,
      (select id from files where team_id = t.id and kind = 'image' order by phase desc, created_at desc limit 1) as img,
      (select id from files where team_id = t.id and kind = 'pdf' order by phase desc, created_at desc limit 1) as pdf,
      (select scores from jury_marks where team_id = t.id and juror = ${me.sub}) as mine_scores,
      (select total from jury_marks where team_id = t.id and juror = ${me.sub}) as mine_total,
      (select coalesce(json_agg(json_build_object('juror', j.juror, 'scores', j.scores, 'total', j.total) order by j.juror), '[]'::json) from jury_marks j where j.team_id = t.id) as all_marks,
      (select avg(total) from jury_marks j where j.team_id = t.id) as avg
    from teams t where ${where} order by t.venue nulls last, t.name limit ${PAGE} offset ${page * PAGE}`;
  const total = Number((await sql`select count(*)::int as n from teams t where ${where}`)[0].n);
  const venues = (await sql`select venue, count(*)::int as n from teams where venue is not null group by venue order by venue`) as unknown as { venue: string; n: number }[];
  const unassigned = Number((await sql`select count(*)::int as n from teams where venue is null`)[0].n);
  const qs = (p: number) => `/jury?q=${encodeURIComponent(q)}&venue=${encodeURIComponent(venue)}&page=${p}`;
  const back = qs(page);
  return (
    <>
      <h1>Phase 4 · Jury marks ({JURY_RUBRIC.total})</h1>
      <Flash sp={sp} />
      <p className="small mut">Score each criterion from your signed sheet (steps of 0.5) and submit team by team. The total is added automatically. Each team's final jury score is the average across jurors. You can edit your marks at any time{isAdmin ? '; as admin you can also edit any juror’s marks and delete them' : ''}.</p>
      <form className="row card" method="get">
        <div><label htmlFor="q">Search team, leader or member</label><input id="q" name="q" defaultValue={q} placeholder="Team name, student name or roll no" /></div>
        <div><label htmlFor="venue">Location</label>
          <select id="venue" name="venue" defaultValue={venue}>
            <option value="">All locations</option>
            {venues.map((v) => <option key={v.venue} value={v.venue}>{v.venue} ({v.n})</option>)}
            {unassigned > 0 && <option value="__none">No location ({unassigned})</option>}
          </select></div>
        <button type="submit">Filter</button>
        {(q || venue) && <a className="btn sec" href="/jury">Clear</a>}
      </form>
      {isAdmin && (unassigned > 0 || !venues.length) && (
        <form className="card" action={assignVenuesAction}>
          <b>{unassigned} team{unassigned === 1 ? '' : 's'} without a location.</b> <span className="small mut">Fills rooms using the seating plan rule (majority department, 10 per room, rest in Hall 242).</span>
          <p><button type="submit">Assign locations</button> <label style={{ fontWeight: 400, display: 'inline' }}><input type="checkbox" name="force" /> overwrite existing</label></p>
        </form>)}
      <p className="small mut">{total} team{total === 1 ? '' : 's'} shown.</p>
      {teams.map((t) => {
        const marks = t.all_marks as { juror: string; scores: Record<string, number>; total: number }[];
        return (
          <div className="card" key={t.id}>
            <h3>{t.name} {t.venue && <span className="badge">{t.venue}</span>} {t.mine_total !== null && <span className="badge b-open">Your total: {n1(Number(t.mine_total))}</span>} {t.avg !== null && isAdmin && <span className="badge">Average: {n1(Number(t.avg))}</span>}</h3>
            <p className="small mut">{t.topic ?? 'No topic'} · {t.members}</p>
            <p className="small">{t.pdf && <a href={`/api/files/${t.pdf}`} target="_blank">Latest report</a>} {t.img && <> · <a href={`/api/files/${t.img}`} target="_blank">Prototype photo</a></>}</p>
            <JuryForm action={saveJuryMarksAction} teamId={t.id} back={back} criteria={JURY_RUBRIC.criteria} initial={t.mine_scores && Object.keys(t.mine_scores).length ? t.mine_scores : null}
              total={JURY_RUBRIC.total} submitLabel={t.mine_total !== null ? 'Update my marks' : 'Submit marks'} />
            {isAdmin && (
              <details>
                <summary>Admin: all jurors ({marks.length}) and location</summary>
                <form action={setTeamVenueAction} className="row">
                  <input type="hidden" name="teamId" value={t.id} /><input type="hidden" name="back" value={back} />
                  <div><label>Location</label><select name="venue" defaultValue={t.venue ?? ''}><option value="">None</option>{ALL_VENUES.map((v) => <option key={v}>{v}</option>)}</select></div>
                  <button type="submit" className="sec">Set location</button>
                </form>
                {marks.filter((m) => m.juror !== me.sub).map((m) => (
                  <div key={m.juror} style={{ borderTop: '1px solid #ddd', marginTop: 10, paddingTop: 10 }}>
                    <p className="small"><b>{m.juror}</b> · total {n1(m.total)}</p>
                    <JuryForm action={saveJuryMarksAction} teamId={t.id} back={back} criteria={JURY_RUBRIC.criteria} initial={Object.keys(m.scores || {}).length ? m.scores : null} juror={m.juror} total={JURY_RUBRIC.total} submitLabel="Save as this juror" />
                    <form action={saveJuryMarksAction}><input type="hidden" name="teamId" value={t.id} /><input type="hidden" name="back" value={back} /><input type="hidden" name="juror" value={m.juror} /><input type="hidden" name="del" value="1" /><button type="submit" className="sec">Remove these marks</button></form>
                  </div>))}
                {!marks.some((m) => m.juror !== me.sub) && <p className="small mut">No other juror has entered marks for this team.</p>}
              </details>)}
          </div>);
      })}
      {!teams.length && <div className="card mut">No teams found.</div>}
      <p>{page > 0 && <a className="btn sec" href={qs(page - 1)}>Previous</a>}{' '}
        {(page + 1) * PAGE < total && <a className="btn sec" href={qs(page + 1)}>Next</a>}</p>
    </>
  );
}
