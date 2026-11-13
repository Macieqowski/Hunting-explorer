import { beforeAll, describe, expect, it } from 'vitest';
import { verifyFirebaseToken } from '../src/auth';
import { claims, makeSigner, NOW, PROJECT, type Signer } from './helpers';

let signer: Signer;
let other: Signer;
const keys = async () => [signer.jwk];

beforeAll(async () => {
  signer = await makeSigner();
  other = await makeSigner('test-key');
});

describe('verifyFirebaseToken', () => {
  it('accepts a valid token and returns the user id', async () => {
    expect(await verifyFirebaseToken(await signer.sign(claims()), PROJECT, keys, NOW)).toBe('user-1');
  });

  it('rejects a token for another project, from another issuer, expired or from the future', async () => {
    for (const bad of [{ aud: 'other' }, { iss: 'https://securetoken.google.com/other' }, { exp: NOW / 1000 - 3600 }, { iat: NOW / 1000 + 3600 }, { sub: '' }, { sub: 42 }])
      expect(await verifyFirebaseToken(await signer.sign(claims(bad)), PROJECT, keys, NOW)).toBeNull();
  });

  it('rejects a token signed with a key Google does not publish', async () => {
    expect(await verifyFirebaseToken(await other.sign(claims()), PROJECT, keys, NOW)).toBeNull();
    expect(await verifyFirebaseToken(await signer.sign(claims(), { kid: 'unknown' }), PROJECT, keys, NOW)).toBeNull();
  });

  it('rejects unsigned and tampered tokens', async () => {
    const good = await signer.sign(claims());
    const [h, , s] = good.split('.');
    const forged = Buffer.from(JSON.stringify(claims({ sub: 'someone-else' }))).toString('base64url');
    expect(await verifyFirebaseToken(`${h}.${forged}.${s}`, PROJECT, keys, NOW)).toBeNull();
    expect(await verifyFirebaseToken(await signer.sign(claims(), { alg: 'none' }), PROJECT, keys, NOW)).toBeNull();
    expect(await verifyFirebaseToken('not-a-token', PROJECT, keys, NOW)).toBeNull();
    expect(await verifyFirebaseToken(good, '', keys, NOW)).toBeNull();
  });

  it('fails closed when the keys cannot be fetched', async () => {
    const down = async () => {
      throw new Error('offline');
    };
    expect(await verifyFirebaseToken(await signer.sign(claims()), PROJECT, down, NOW)).toBeNull();
  });
});
