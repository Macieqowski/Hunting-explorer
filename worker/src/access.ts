// Who may use AI grading. In "passphrase" mode only people who gave the club passphrase (the one
// used for group hunts): the app writes it to club/members/<uid> in the Realtime Database, whose
// rules accept only the right passphrase. The rules also let such a user (and nobody else) read
// the empty node club/access/<uid>. The Worker tries that read with the user's own token: allowed
// means "gave the current passphrase". The Worker never sees or holds the passphrase.

export interface AccessEnv {
  /** "passphrase" (default) or "open" (anyone signed in). */
  ACCESS_MODE?: string;
  FIREBASE_DATABASE_URL?: string;
}

/** Thrown when the database cannot be asked (not a "no"). */
export class AccessUnavailable extends Error {}

const TTL_MS = 10 * 60_000;
const MAX_CACHED = 5000;
const known = new Map<string, number>();

export const passphraseRequired = (env: AccessEnv): boolean => env.ACCESS_MODE !== 'open';

/** True when the signed-in user has given the passphrase (or none is required). */
export async function hasAccess(env: AccessEnv, uid: string, token: string, fetcher: typeof fetch = fetch, now = Date.now()): Promise<boolean> {
  if (!passphraseRequired(env)) return true;
  const base = (env.FIREBASE_DATABASE_URL ?? '').replace(/\/+$/, '');
  // Without a database to ask, nobody gets in.
  if (!/^https:\/\//.test(base)) return false;
  if ((known.get(uid) ?? 0) > now) return true;
  let res: Response;
  try {
    res = await fetcher(`${base}/club/access/${encodeURIComponent(uid)}.json?auth=${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(8000) });
  } catch {
    throw new AccessUnavailable('database not reachable');
  }
  // 401/403: the rules refused the read (no passphrase given, or the rules are older than this check).
  if (res.status === 401 || res.status === 403) return false;
  if (!res.ok) throw new AccessUnavailable(`database ${res.status}`);
  if (known.size >= MAX_CACHED) known.clear();
  known.set(uid, now + TTL_MS);
  return true;
}

/** For tests. */
export const forgetAccess = () => known.clear();
