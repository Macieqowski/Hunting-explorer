// Verifies a Firebase ID token (the app's anonymous sign-in) without the Admin SDK:
// RS256 signature against Google's published keys, plus the audience, issuer and time checks
// from https://firebase.google.com/docs/auth/admin/verify-id-tokens.

const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
/** Clock difference tolerated between Google and this Worker. */
const SKEW_S = 300;

export interface Jwk {
  kid: string;
  kty: string;
  n: string;
  e: string;
  alg?: string;
  use?: string;
}

export type KeySource = () => Promise<Jwk[]>;

let cached: { keys: Jwk[]; until: number } | null = null;

/** Google's signing keys, kept in memory for as long as their Cache-Control allows (at most a day). */
export const googleKeys: KeySource = async () => {
  if (cached && cached.until > Date.now()) return cached.keys;
  const res = await fetch(JWKS_URL);
  if (!res.ok) throw new Error(`jwks ${res.status}`);
  const { keys } = (await res.json()) as { keys: Jwk[] };
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get('cache-control') ?? '')?.[1] ?? 3600);
  cached = { keys, until: Date.now() + Math.min(Math.max(maxAge, 60), 86_400) * 1000 };
  return keys;
};

const b64url = (s: string): Uint8Array<ArrayBuffer> => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '='));
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

const json = (part: string): Record<string, unknown> | null => {
  try {
    const v = JSON.parse(new TextDecoder().decode(b64url(part)));
    return v && typeof v === 'object' ? v : null;
  } catch {
    return null;
  }
};

/** The user id of a valid token for `projectId`, or null. */
export async function verifyFirebaseToken(token: string, projectId: string, keys: KeySource = googleKeys, now = Date.now()): Promise<string | null> {
  if (!projectId) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const header = json(parts[0]);
  const claims = json(parts[1]);
  if (!header || !claims || header.alg !== 'RS256' || typeof header.kid !== 'string') return null;
  const t = Math.floor(now / 1000);
  const num = (k: string) => (typeof claims[k] === 'number' ? (claims[k] as number) : NaN);
  if (claims.aud !== projectId || claims.iss !== `https://securetoken.google.com/${projectId}`) return null;
  if (!(num('exp') > t - SKEW_S) || !(num('iat') <= t + SKEW_S)) return null;
  if (typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 128) return null;
  let jwk: Jwk | undefined;
  try {
    jwk = (await keys()).find((k) => k.kid === header.kid);
  } catch {
    return null;
  }
  if (!jwk) return null;
  try {
    const key = await crypto.subtle.importKey('jwk', { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64url(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
    return ok ? claims.sub : null;
  } catch {
    return null;
  }
}
