// Hunt invitation links: the leader shares a link (or QR code) with a random,
// per-hunt token, so guests can sign up without knowing the club passphrase.
// The token is stored at invites/$hunt/$token (readable only by the leader);
// database.rules.json lets anyone holding an unexpired token register, and the
// leader still confirms each person.

import { huntWindow, type HuntInput } from './hunt';

/** Longest an invitation may stay valid (the rules allow 100 days). */
export const INVITE_MAX_MS = 90 * 24 * 3600e3;
/** If the hunt day is already (nearly) over, a new link still works this long. */
export const INVITE_MIN_MS = 24 * 3600e3;

export interface Invite {
  token: string;
  exp: number;
  createdAt: number;
}

const TOKEN_RE = /^[A-Za-z0-9_-]{20,40}$/;
export const validToken = (t: unknown): t is string => typeof t === 'string' && TOKEN_RE.test(t);

/** 128 random bits, base64url (22 characters). */
export function newInviteToken(rand: (a: Uint8Array) => Uint8Array = (a) => crypto.getRandomValues(a)): string {
  const b = rand(new Uint8Array(16));
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Valid until the end of the hunt day (local time); at least a day from now, at most 90 days. */
export function inviteExpiry(h: Pick<HuntInput, 'date' | 'start' | 'end'>, now: number): number {
  const [y, m, d] = h.date.split('-').map(Number);
  let exp = y && m && d ? new Date(y, m - 1, d, 23, 59, 59).getTime() : huntWindow(h).end;
  if (!isFinite(exp) || exp < now + 3600e3) exp = now + INVITE_MIN_MS;
  return Math.min(exp, now + INVITE_MAX_MS);
}

export function parseInvites(v: unknown): Invite[] {
  if (!v || typeof v !== 'object') return [];
  const out: Invite[] = [];
  for (const [token, r] of Object.entries(v as Record<string, unknown>)) {
    const rec = r as { exp?: unknown; createdAt?: unknown } | null;
    if (!validToken(token) || !rec || typeof rec.exp !== 'number') continue;
    out.push({ token, exp: rec.exp, createdAt: typeof rec.createdAt === 'number' ? rec.createdAt : 0 });
  }
  return out;
}

/** The newest invitation that has not expired. */
export function currentInvite(list: Invite[], now: number): Invite | null {
  return list.filter((i) => i.exp > now).sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
}

/** `#/polowanie/<hunt>/<token>`; base is origin + path of the app. */
export const inviteLink = (base: string, huntId: string, token: string) => `${base}#/polowanie/${encodeURIComponent(huntId)}/${token}`;
