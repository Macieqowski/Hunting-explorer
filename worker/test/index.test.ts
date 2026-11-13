import { beforeAll, describe, expect, it } from 'vitest';
import { handle, providersOf, type Deps, type Env } from '../src/index';
import { AccessUnavailable } from '../src/access';
import { applyTake } from '../src/limits';
import { ProviderError, type Provider } from '../src/providers/types';
import { claims, makeSigner, NOW, PROJECT, type Signer } from './helpers';

let signer: Signer;
let token: string;
beforeAll(async () => {
  signer = await makeSigner();
  token = await signer.sign(claims());
});

const env = { FIREBASE_PROJECT_ID: PROJECT, ALLOWED_ORIGINS: 'https://www.polowanie.org,https://localhost', LIMIT_USER: '2' } as Env;
const ORIGIN = 'https://www.polowanie.org';
const ANSWER = 'Broń załadowana to taka, w której nabój jest w komorze albo w magazynku.';

const good: Provider = async () => ({ raw: { points: Array.from({ length: 8 }, () => ({ said: 'x', coverage: 'yes' as const })), errors: [], feedback: 'Dobrze.', score: 5 }, usage: null });
const failing = (code: 'busy' | 'failed'): Provider => async () => {
  throw new ProviderError(code);
};

function deps(over: Partial<Deps> = {}) {
  const counts = new Map<string, number>();
  const seen: string[] = [];
  const d: Deps = {
    keys: async () => [signer.jwk],
    access: async () => true,
    providers: () => [{ name: 'anthropic', grade: good }],
    take: async (_e, _day, takes) => applyTake(counts, takes),
    refund: async (_e, _day, keys) => {
      for (const k of keys) counts.set(k, Math.max(0, (counts.get(k) ?? 0) - 1));
    },
    now: () => NOW,
    ...over,
  };
  return { d, counts, seen };
}

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('https://oral.example/grade', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: ORIGIN, authorization: `Bearer ${token}`, 'cf-connecting-ip': '203.0.113.7', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

describe('grading service', () => {
  it('grades an answer and reports what is left of the daily limit', async () => {
    const { d } = deps();
    const res = await handle(post({ nr: 1, answer: ANSWER }), env, d);
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe(ORIGIN);
    const body = (await res.json()) as { score: number; points: string[]; left: number; feedback: string };
    expect(body.score).toBe(5);
    expect(body.left).toBe(1);
    expect(body.points.every((p) => p === 'yes')).toBe(true);
    expect(body.points.length).toBeGreaterThanOrEqual(3);
  });

  it('grades only for people who gave the club passphrase, and spends nothing of the limit on the others', async () => {
    const asked: string[] = [];
    const { d, counts } = deps({
      access: async (_e, uid, tok) => {
        asked.push(`${uid}:${tok === token}`);
        return false;
      },
    });
    const res = await handle(post({ nr: 1, answer: ANSWER }), env, d);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'locked' });
    expect(res.headers.get('access-control-allow-origin')).toBe(ORIGIN);
    expect(asked).toHaveLength(1);
    expect(asked[0].endsWith(':true')).toBe(true);
    expect(counts.size).toBe(0);
  });

  it('says "unavailable", not "locked", when the passphrase cannot be checked', async () => {
    const { d, counts } = deps({
      access: async () => {
        throw new AccessUnavailable('database 500');
      },
    });
    const res = await handle(post({ nr: 1, answer: ANSWER }), env, d);
    expect(res.status).toBe(503);
    expect(((await res.json()) as { error: string }).error).toBe('unavailable');
    expect(counts.size).toBe(0);
  });

  it('answers the browser preflight and refuses unknown pages', async () => {
    const { d } = deps();
    const pre = await handle(new Request('https://oral.example/grade', { method: 'OPTIONS', headers: { origin: 'https://localhost' } }), env, d);
    expect(pre.status).toBe(204);
    expect(pre.headers.get('access-control-allow-origin')).toBe('https://localhost');
    const evil = await handle(post({ nr: 1, answer: ANSWER }, { origin: 'https://evil.example' }), env, d);
    expect(evil.status).toBe(403);
    expect(evil.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('needs a valid sign-in token', async () => {
    const { d, counts } = deps();
    expect((await handle(post({ nr: 1, answer: ANSWER }, { authorization: '' }), env, d)).status).toBe(401);
    expect((await handle(post({ nr: 1, answer: ANSWER }, { authorization: 'Bearer abc.def.ghi' }), env, d)).status).toBe(401);
    const expired = await signer.sign(claims({ exp: NOW / 1000 - 4000 }));
    expect((await handle(post({ nr: 1, answer: ANSWER }, { authorization: `Bearer ${expired}` }), env, d)).status).toBe(401);
    expect(counts.size).toBe(0);
  });

  it('rejects malformed requests before spending anything', async () => {
    const { d, counts } = deps();
    for (const body of ['{', { nr: 'x', answer: ANSWER }, { nr: 1 }, { nr: 1, answer: 'nie wiem' }, { nr: 1, answer: 'a '.repeat(2000) }, { nr: 1.5, answer: ANSWER }])
      expect((await handle(post(body), env, d)).status).toBe(400);
    expect((await handle(post({ nr: 191, answer: ANSWER }), env, d)).status).toBe(404);
    expect((await handle(new Request('https://oral.example/other', { method: 'POST' }), env, d)).status).toBe(404);
    expect(counts.size).toBe(0);
  });

  it('stops at the daily limit', async () => {
    const { d } = deps();
    expect((await handle(post({ nr: 1, answer: ANSWER }), env, d)).status).toBe(200);
    expect((await handle(post({ nr: 2, answer: ANSWER }), env, d)).status).toBe(200);
    const res = await handle(post({ nr: 3, answer: ANSWER }), env, d);
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: 'quota', scope: 'user' });
  });

  it('falls back to the second model and charges once', async () => {
    const { d, counts } = deps({
      providers: () => [
        { name: 'anthropic', grade: failing('busy') },
        { name: 'openai', grade: good },
      ],
    });
    expect((await handle(post({ nr: 1, answer: ANSWER }), env, d)).status).toBe(200);
    expect(counts.get('all')).toBe(1);
  });

  it('gives the charge back when no model answers', async () => {
    const { d, counts } = deps({ providers: () => [{ name: 'anthropic', grade: failing('busy') }] });
    const res = await handle(post({ nr: 1, answer: ANSWER }), env, d);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'unavailable', reason: 'busy' });
    expect(counts.get('all')).toBe(0);
    const none = deps({ providers: () => [] });
    expect((await handle(post({ nr: 1, answer: ANSWER }), env, none.d)).status).toBe(503);
  });

  it('reports health without a token', async () => {
    const { d } = deps();
    const res = await handle(new Request('https://oral.example/health'), env, d);
    expect(await res.json()).toMatchObject({ ok: true, questions: 209, provider: 'anthropic' });
  });

  it('orders the models by MODEL_PROVIDER and skips those without a key', () => {
    const both = { ANTHROPIC_API_KEY: 'a', OPENAI_API_KEY: 'o' } as Env;
    expect(providersOf(both).map((p) => p.name)).toEqual(['anthropic', 'openai']);
    expect(providersOf({ ...both, MODEL_PROVIDER: 'openai' }).map((p) => p.name)).toEqual(['openai', 'anthropic']);
    expect(providersOf({ OPENAI_API_KEY: 'o' } as Env).map((p) => p.name)).toEqual(['openai']);
    expect(providersOf({} as Env)).toEqual([]);
  });
});
