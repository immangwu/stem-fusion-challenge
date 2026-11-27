'use client';
import { useState } from 'react';

type C = { key: string; label: string; max: number; desc: string };

export default function JuryForm({ action, teamId, back, criteria, initial, juror, total, submitLabel }: {
  action: (fd: FormData) => void | Promise<void>; teamId: string; back: string; criteria: C[];
  initial: Record<string, number> | null; juror?: string; total: number; submitLabel: string;
}) {
  const [v, setV] = useState<Record<string, string>>(() => Object.fromEntries(criteria.map((c) => [c.key, initial?.[c.key] !== undefined ? String(initial[c.key]) : ''])));
  const sum = criteria.reduce((a, c) => a + (Number(v[c.key]) || 0), 0);
  return (
    <form action={action}>
      <input type="hidden" name="teamId" value={teamId} /><input type="hidden" name="back" value={back} />
      {juror && <input type="hidden" name="juror" value={juror} />}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 10 }}>
        {criteria.map((c) => (
          <div key={c.key}>
            <label htmlFor={`${teamId}-${juror ?? 'me'}-${c.key}`}>{c.label} <span className="mut">/ {c.max}</span></label>
            <input id={`${teamId}-${juror ?? 'me'}-${c.key}`} name={`c_${c.key}`} type="number" step="0.5" min="0" max={c.max} required
              value={v[c.key]} onChange={(e) => setV({ ...v, [c.key]: e.target.value })} />
          </div>))}
      </div>
      <p><b>Total: {Math.round(sum * 10) / 10} / {total}</b> {sum > total && <span className="badge">too high</span>}</p>
      <p><button type="submit">{submitLabel}</button></p>
    </form>
  );
}
