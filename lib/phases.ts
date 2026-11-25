import { getSetting } from './db';
import { RUBRICS, type PhaseNo } from './rubrics';

export type Phase = { n: PhaseNo; subject: string; opens: string; closes: string };
export type PhaseState = 'upcoming' | 'open' | 'closed';

// All times are India Standard Time (UTC+05:30). Admin can change them in Settings.
export const DEFAULT_PHASES: Phase[] = [
  { n: 1, subject: RUBRICS[1].subject, opens: '2026-11-17T00:00:00+05:30', closes: '2026-11-20T09:00:00+05:30' },
  { n: 2, subject: RUBRICS[2].subject, opens: '2026-11-20T09:00:00+05:30', closes: '2026-11-23T09:00:00+05:30' },
  { n: 3, subject: RUBRICS[3].subject, opens: '2026-11-23T09:00:00+05:30', closes: '2026-11-25T11:00:00+05:30' },
];

export type PubMap = Record<1 | 2 | 3, boolean>;
export type EventSettings = { juryDate: string; juryPublished: boolean; published: PubMap };
/** Phase results become visible to students and the public only after an admin publishes them. Phase 1 was already public. */
export const DEFAULT_PUBLISHED: PubMap = { 1: true, 2: false, 3: false };
export const DEFAULT_EVENT: EventSettings = { juryDate: 'To be announced', juryPublished: false, published: DEFAULT_PUBLISHED };

export async function getPhases(): Promise<Phase[]> {
  const saved = await getSetting<Phase[] | null>('phases', null);
  const list = saved && saved.length === 3 ? saved : DEFAULT_PHASES;
  // Organiser extension: Phase 3 closes 25 Nov 2026, 11:00 am IST (applies over the old 9:00 am saved value only).
  return list.map((p) => (p.n === 3 && new Date(p.closes).getTime() === new Date('2026-11-25T09:00:00+05:30').getTime() ? { ...p, closes: '2026-11-25T11:00:00+05:30' } : p));
}

export async function getEvent(): Promise<EventSettings> {
  const saved = await getSetting<Partial<EventSettings>>('event', {});
  return { ...DEFAULT_EVENT, ...saved, published: { ...DEFAULT_PUBLISHED, ...(saved.published ?? {}) } };
}

export function phaseState(p: Phase, now = new Date()): PhaseState {
  const t = now.getTime();
  if (t < new Date(p.opens).getTime()) return 'upcoming';
  if (t >= new Date(p.closes).getTime()) return 'closed';
  return 'open';
}

export function fmt(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true,
  }) + ' IST';
}

/** For <input type="datetime-local"> in IST */
export function toLocalInput(iso: string) {
  const d = new Date(new Date(iso).getTime() + 5.5 * 3600 * 1000);
  return d.toISOString().slice(0, 16);
}
export function fromLocalInput(v: string) {
  return new Date(v + ':00+05:30').toISOString();
}
