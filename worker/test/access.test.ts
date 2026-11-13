import { beforeEach, describe, expect, it } from 'vitest';
import { AccessUnavailable, forgetAccess, hasAccess } from '../src/access';

const DB = 'https://demo-default-rtdb.europe-west1.firebasedatabase.app';
const env = { FIREBASE_DATABASE_URL: `${DB}/` };

/** A database that answers every read with `status`, and remembers what was asked. */
function database(status: number, body = 'null') {
  const urls: string[] = [];
  const fetcher = (async (url: RequestInfo | URL) => {
    urls.push(String(url));
    return new Response(body, { status });
  }) as typeof fetch;
  return { urls, fetcher };
}

beforeEach(forgetAccess);

describe('access by the club passphrase', () => {
  it('lets in a user the database rules allow to read club/access/<uid>', async () => {
    const db = database(200);
    expect(await hasAccess(env, 'u 1', 'tok/en', db.fetcher)).toBe(true);
    expect(db.urls).toEqual([`${DB}/club/access/u%201.json?auth=tok%2Fen`]);
  });

  it('keeps out a user the rules refuse (no passphrase given, or rules without this check)', async () => {
    for (const status of [401, 403]) {
      const db = database(status, '{"error":"Permission denied"}');
      expect(await hasAccess(env, 'u1', 't', db.fetcher)).toBe(false);
    }
  });

  it('remembers a yes for a while, but asks again after a no', async () => {
    const no = database(401);
    expect(await hasAccess(env, 'u1', 't', no.fetcher, 1000)).toBe(false);
    const yes = database(200);
    expect(await hasAccess(env, 'u1', 't', yes.fetcher, 2000)).toBe(true);
    expect(await hasAccess(env, 'u1', 't', no.fetcher, 3000)).toBe(true);
    expect(no.urls).toHaveLength(1);
    // Ten minutes later the database is asked again (the passphrase may have changed).
    expect(await hasAccess(env, 'u1', 't', no.fetcher, 2000 + 11 * 60_000)).toBe(false);
    // Someone else is not covered by it.
    expect(await hasAccess(env, 'u2', 't', no.fetcher, 3000)).toBe(false);
  });

  it('does not take a database failure for an answer', async () => {
    await expect(hasAccess(env, 'u1', 't', database(500).fetcher)).rejects.toBeInstanceOf(AccessUnavailable);
    const down = (async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;
    await expect(hasAccess(env, 'u1', 't', down)).rejects.toBeInstanceOf(AccessUnavailable);
  });

  it('lets nobody in when no database is set, and everybody in "open" mode', async () => {
    const db = database(200);
    expect(await hasAccess({}, 'u1', 't', db.fetcher)).toBe(false);
    expect(await hasAccess({ FIREBASE_DATABASE_URL: 'not a url' }, 'u1', 't', db.fetcher)).toBe(false);
    expect(await hasAccess({ ACCESS_MODE: 'open' }, 'u1', 't', db.fetcher)).toBe(true);
    expect(db.urls).toHaveLength(0);
  });
});
