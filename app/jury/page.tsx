import { requireJury } from '@/lib/auth';
import { db } from '@/lib/db';
import { JURY_RUBRIC } from '@/lib/rubrics';
import { Flash, first, n1, type SP } from '@/components/ui';
import { saveJuryMarksAction } from '../actions';

export const metadata = { title: 'Jury | STEM Fusion Challenge' };
const PAGE = 15;

export default async function Jury({ searchParams }: { searchParams: SP }) {
  const me = await requireJury();
  const sp = await searchParams;
  const q = first(sp.q).trim().slice(0, 60);
  const page = Math.max(0, Number(first(sp.page)) || 0);
  const like = '%' + q.replace(/[%_\\]/g, '\\$&') + '%';
  const sql = await db();
  const teams = await sql`
    select t.id, t.name, coalesce((select title from topics where claimed_by = t.id), case when t.custom_status = 'approved' then t.custom->>'title' end) as topic,
      (select string_agg(s.name, ', ' order by s.name) from team_members m join students s using (roll_no) where m.team_id = t.id) as members,
      (select id from files where team_id = t.id and kind = 'image' order by phase desc, created_at desc limit 1) as img,
      (select id from files where team_id = t.id and kind = 'pdf' order by phase desc, created_at desc limit 1) as pdf,
      (select scores from jury_marks where team_id = t.id and juror = ${me.sub}) as mine,
      (select total from jury_marks where team_id = t.id and juror = ${me.sub}) as mine_total
    from teams t where (${q} = '' or t.name ilike ${like}) order by t.name limit ${PAGE} offset ${page * PAGE}`;
  const total = Number((await sql`select count(*)::int as n from teams t where (${q} = '' or t.name ilike ${like})`)[0].n);
  const back = `/jury?q=${encodeURIComponent(q)}&page=${page}`;
  return (
    <>
      <h1>Jury marks ({JURY_RUBRIC.total})</h1>
      <Flash sp={sp} />
      <p className="small mut">Enter marks per criterion (steps of 0.5). Each team's final jury score is the average across jurors. You can edit your marks until the admin publishes.</p>
      <form className="row card" method="get"><div><label htmlFor="q">Find team</label><input id="q" name="q" defaultValue={q} /></div><button type="submit">Search</button></form>
      {teams.map((t) => (
        <div className="card" key={t.id}>
          <h3>{t.name} {t.mine_total !== null && <span className="badge b-open">Your mark: {n1(Number(t.mine_total))}</span>}</h3>
          <p className="small mut">{t.topic ?? 'No topic'} · {t.members}</p>
          <p className="small">{t.pdf && <a href={`/api/files/${t.pdf}`} target="_blank">Latest report</a>} {t.img && <> · <a href={`/api/files/${t.img}`} target="_blank">Prototype photo</a></>}</p>
          <form action={saveJuryMarksAction}>
            <input type="hidden" name="teamId" value={t.id} /><input type="hidden" name="back" value={back} />
            <div className="grid g3">
              {JURY_RUBRIC.criteria.map((c) => (
                <div key={c.key}><label htmlFor={`${t.id}${c.key}`}>{c.label} (0–{c.max})</label>
                  <input id={`${t.id}${c.key}`} name={c.key} type="number" step="0.5" min="0" max={c.max} required defaultValue={t.mine?.[c.key] ?? ''} /></div>))}
            </div>
            <p><button type="submit">Save marks</button></p>
          </form>
        </div>))}
      {!teams.length && <div className="card mut">No teams found.</div>}
      <p>{page > 0 && <a className="btn sec" href={`/jury?q=${encodeURIComponent(q)}&page=${page - 1}`}>Previous</a>}{' '}
        {(page + 1) * PAGE < total && <a className="btn sec" href={`/jury?q=${encodeURIComponent(q)}&page=${page + 1}`}>Next</a>}</p>
    </>
  );
}
