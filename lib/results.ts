import { z } from 'zod';
import { db } from './db';
import { RUBRICS, RUBRIC_VERSION, type PhaseNo } from './rubrics';

const ScoreItem = z.object({ score: z.coerce.number().min(0), reason: z.string().trim().min(1).max(1500) });
const Result = z.object({
  team_id: z.string().uuid().optional(),
  team_name: z.string().trim().optional(),
  scores: z.record(z.string(), ScoreItem).optional(),
  summary: z.string().trim().max(3000).optional(),
  flags: z.array(z.string().max(80)).max(10).optional(),
  status: z.enum(['done', 'needs_review']).optional(),
});
export const ImportSchema = z.object({
  phase: z.coerce.number().int().min(1).max(3),
  evaluator: z.string().max(80).optional(),
  results: z.array(Result).min(1).max(1500),
});

const half = (n: number) => Math.round(n * 2) / 2;

/**
 * Imports evaluation results (scores + reasons per rubric criterion) produced by the evaluator
 * (Claude in chat). Scores are validated against the rubric and clamped to each criterion's maximum.
 */
export async function importResults(raw: unknown, actor: string) {
  const parsed = ImportSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, error: 'Invalid format: ' + parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') };
  }
  const { phase, results, evaluator } = parsed.data;
  const rubric = RUBRICS[phase as PhaseNo];
  const sql = await db();
  const report = { imported: 0, needsReview: 0, errors: [] as string[] };

  for (const [i, r] of results.entries()) {
    const label = r.team_id || r.team_name || `row ${i + 1}`;
    const t = r.team_id
      ? await sql`select id from teams where id = ${r.team_id}`
      : r.team_name
        ? await sql`select id from teams where lower(name) = lower(${r.team_name})`
        : [];
    if (!t[0]) { report.errors.push(`${label}: team not found`); continue; }
    const teamId = t[0].id as string;
    const file = (await sql`select id from files where team_id = ${teamId} and phase = ${phase} and kind = 'pdf' order by created_at desc limit 1`)[0];
    const flags = r.flags ?? [];

    if (r.status === 'needs_review') {
      await sql`
        insert into evaluations(team_id, phase, file_id, status, summary, flags, model, rubric_version, reeval_requested, updated_at)
        values (${teamId}, ${phase}, ${file?.id ?? null}, 'needs_review', ${r.summary ?? null}, ${sql.json(flags)}, ${evaluator ?? 'claude-chat'}, ${RUBRIC_VERSION}, false, now())
        on conflict (team_id, phase) do update set status = 'needs_review', summary = excluded.summary, flags = excluded.flags,
          file_id = excluded.file_id, reeval_requested = false, updated_at = now()`;
      report.needsReview++;
      continue;
    }

    const scores: Record<string, { score: number; reason: string }> = {};
    let total = 0, bad = '';
    for (const c of rubric.criteria) {
      const s = r.scores?.[c.key];
      if (!s) { bad = `missing criterion "${c.key}"`; break; }
      const v = Math.min(c.max, half(s.score));
      scores[c.key] = { score: v, reason: s.reason };
      total += v;
    }
    if (bad) { report.errors.push(`${label}: ${bad}`); continue; }

    await sql`
      insert into evaluations(team_id, phase, file_id, status, scores, total, summary, flags, model, rubric_version, attempts, reeval_requested, error, updated_at)
      values (${teamId}, ${phase}, ${file?.id ?? null}, 'done', ${sql.json(scores)}, ${total}, ${r.summary ?? null}, ${sql.json(flags)},
              ${evaluator ?? 'claude-chat'}, ${RUBRIC_VERSION}, 1, false, null, now())
      on conflict (team_id, phase) do update set status = 'done', scores = excluded.scores, total = excluded.total,
        summary = excluded.summary, flags = excluded.flags, file_id = excluded.file_id, model = excluded.model,
        rubric_version = excluded.rubric_version, attempts = evaluations.attempts + 1, reeval_requested = false,
        error = null, updated_at = now()`;
    report.imported++;
  }
  await sql`insert into audit_log(actor, action, detail) values (${actor}, 'import_results', ${sql.json({ phase, ...report })})`;
  return { ok: true as const, ...report };
}
