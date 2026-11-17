import type { PhaseState } from '@/lib/phases';

export type SP = Promise<Record<string, string | string[] | undefined>>;
export const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

export function Flash({ sp }: { sp: Record<string, string | string[] | undefined> }) {
  const msg = first(sp.msg), err = first(sp.err);
  return (
    <>
      {msg && <div className="flash msg" role="status">{msg.slice(0, 600)}</div>}
      {err && <div className="flash err" role="alert">{err.slice(0, 600)}</div>}
    </>
  );
}

export function StateBadge({ s }: { s: PhaseState }) {
  const cls = s === 'open' ? 'b-open' : s === 'closed' ? 'b-closed' : 'b-up';
  return <span className={`badge ${cls}`}>{s === 'open' ? 'Open' : s === 'closed' ? 'Closed' : 'Opens soon'}</span>;
}

export const n1 = (v: number | null | undefined) => (v === null || v === undefined ? '–' : String(Math.round(Number(v) * 100) / 100));
