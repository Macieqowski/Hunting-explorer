// Daily limits: who is counted and how much they may use. Pure.

export interface Limits {
  user: number;
  ip: number;
  global: number;
}

export interface Take {
  key: string;
  limit: number;
}

const int = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 ? n : fallback;
};

export const readLimits = (env: { LIMIT_USER?: string; LIMIT_IP?: string; LIMIT_GLOBAL?: string }): Limits => ({
  user: int(env.LIMIT_USER, 9),
  ip: int(env.LIMIT_IP, 60),
  global: int(env.LIMIT_GLOBAL, 2000),
});

/** The day limits are counted for: the calendar day in Poland, as YYYY-MM-DD. */
export const dayOf = (now: number): string => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Warsaw' }).format(new Date(now));

/** A short one-way fingerprint, so the counters hold neither user ids nor network addresses. */
export async function fingerprint(kind: string, value: string, day: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${kind}:${day}:${value}`));
  return `${kind}:${[...new Uint8Array(digest).slice(0, 12)].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}

/** The counters one graded answer is charged to; the first is the user's own. */
export async function takesFor(uid: string, ip: string, day: string, limits: Limits): Promise<Take[]> {
  return [
    { key: await fingerprint('u', uid, day), limit: limits.user },
    { key: await fingerprint('i', ip || 'unknown', day), limit: limits.ip },
    { key: 'all', limit: limits.global },
  ];
}

export interface TakeResult {
  ok: boolean;
  /** Index of the first counter that is full, when not ok. */
  blocked: number | null;
  /** What is left on each counter after this call. */
  left: number[];
}

/** Charges every counter by one, or none of them when any is full. `counts` is updated in place. */
export function applyTake(counts: Map<string, number>, takes: readonly Take[]): TakeResult {
  const blocked = takes.findIndex((t) => (counts.get(t.key) ?? 0) >= t.limit);
  if (blocked >= 0) return { ok: false, blocked, left: takes.map((t) => Math.max(0, t.limit - (counts.get(t.key) ?? 0))) };
  for (const t of takes) counts.set(t.key, (counts.get(t.key) ?? 0) + 1);
  return { ok: true, blocked: null, left: takes.map((t) => Math.max(0, t.limit - counts.get(t.key)!)) };
}
