import type { Jwk } from '../src/auth';

const b64url = (b: ArrayBuffer | Uint8Array | string) =>
  Buffer.from(typeof b === 'string' ? new TextEncoder().encode(b) : b instanceof Uint8Array ? b : new Uint8Array(b))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

export interface Signer {
  jwk: Jwk;
  sign(claims: Record<string, unknown>, header?: Record<string, unknown>): Promise<string>;
}

/** A throwaway RSA key standing in for Google's, and a function that signs tokens with it. */
export async function makeSigner(kid = 'test-key'): Promise<Signer> {
  const pair = (await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
  const pub = (await crypto.subtle.exportKey('jwk', pair.publicKey)) as JsonWebKey;
  return {
    jwk: { kid, kty: 'RSA', n: pub.n!, e: pub.e! },
    async sign(claims, header = {}) {
      const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid, ...header }));
      const body = b64url(JSON.stringify(claims));
      const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(`${head}.${body}`));
      return `${head}.${body}.${b64url(sig)}`;
    },
  };
}

export const PROJECT = 'demo-polowanie';
export const NOW = Date.UTC(2026, 10, 13, 12);

export const claims = (over: Record<string, unknown> = {}) => ({
  aud: PROJECT,
  iss: `https://securetoken.google.com/${PROJECT}`,
  sub: 'user-1',
  iat: NOW / 1000 - 60,
  exp: NOW / 1000 + 3000,
  ...over,
});
