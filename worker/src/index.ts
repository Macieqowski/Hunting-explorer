// Grading service of the oral exam. POST /grade { nr, answer } with a Firebase ID token returns
// { score, points, errors, feedback, left }. The reference answers stay here; the app sends only
// the question number and the candidate's text. Nothing about the answer is stored or logged.
import bankJson from '../../public/exams/ustny.json';
import { MAX_ANSWER, wordCount, type OralBank, type OralQuestion } from '../../src/oral';
import { verifyFirebaseToken, googleKeys, type KeySource } from './auth';
import { Counters } from './counters';
import { dayOf, readLimits, takesFor, type Take, type TakeResult } from './limits';
import { buildUserPrompt, normalizeGrade, SYSTEM_PROMPT } from './prompt';
import { anthropicProvider } from './providers/anthropic';
import { openaiProvider } from './providers/openai';
import { ProviderError, type Provider } from './providers/types';

export { Counters };

export interface Env {
  COUNTERS: DurableObjectNamespace<Counters>;
  MODEL_PROVIDER?: string;
  ANTHROPIC_MODEL?: string;
  OPENAI_MODEL?: string;
  ANTHROPIC_API_KEY?: string;
  OPENAI_API_KEY?: string;
  FIREBASE_PROJECT_ID?: string;
  ALLOWED_ORIGINS?: string;
  LIMIT_USER?: string;
  LIMIT_IP?: string;
  LIMIT_GLOBAL?: string;
}

const bank = bankJson as OralBank;
const byNr = new Map<number, OralQuestion>(bank.questions.map((q) => [q.nr, q]));
const MIN_WORDS = 3;
const MAX_BODY = 16_000;

/** What the handler needs from outside, replaceable in tests. */
export interface Deps {
  keys: KeySource;
  providers(env: Env): { name: string; grade: Provider }[];
  take(env: Env, day: string, takes: Take[]): Promise<TakeResult>;
  refund(env: Env, day: string, keys: string[]): Promise<void>;
  now(): number;
}

const counters = (env: Env) => env.COUNTERS.get(env.COUNTERS.idFromName('global'));

/** The configured model first, the other one after it as a fallback when it has a key. */
export function providersOf(env: Env): { name: string; grade: Provider }[] {
  const all = [
    env.ANTHROPIC_API_KEY ? { name: 'anthropic', grade: anthropicProvider(env.ANTHROPIC_API_KEY, env.ANTHROPIC_MODEL || 'claude-haiku-5-5') } : null,
    env.OPENAI_API_KEY ? { name: 'openai', grade: openaiProvider(env.OPENAI_API_KEY, env.OPENAI_MODEL || 'gpt-6-luna') } : null,
  ].filter((p) => p !== null);
  const first = env.MODEL_PROVIDER === 'openai' ? 'openai' : 'anthropic';
  return all.sort((a, b) => Number(b.name === first) - Number(a.name === first));
}

const realDeps: Deps = {
  keys: googleKeys,
  providers: providersOf,
  take: async (env, day, takes) => counters(env).take(day, takes),
  refund: async (env, day, keys) => counters(env).refund(day, keys),
  now: () => Date.now(),
};

const allowedOrigin = (origin: string | null, env: Env): string | null =>
  origin &&
  (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .includes(origin)
    ? origin
    : null;

function reply(body: unknown, status: number, origin: string | null): Response {
  const headers: Record<string, string> = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', vary: 'Origin' };
  if (origin) {
    headers['access-control-allow-origin'] = origin;
    headers['access-control-allow-headers'] = 'authorization, content-type';
    headers['access-control-allow-methods'] = 'POST, GET, OPTIONS';
    headers['access-control-max-age'] = '86400';
  }
  return new Response(status === 204 ? null : JSON.stringify(body), { status, headers });
}

const SCOPES = ['user', 'ip', 'global'] as const;

export async function handle(req: Request, env: Env, deps: Deps = realDeps): Promise<Response> {
  const url = new URL(req.url);
  const from = req.headers.get('origin');
  const origin = allowedOrigin(from, env);
  if (req.method === 'OPTIONS') return reply(null, 204, origin);
  // A browser page we do not know may not use the service (other clients still need a valid token).
  if (from && !origin) return reply({ error: 'origin' }, 403, null);
  if (req.method === 'GET' && url.pathname === '/health')
    return reply({ ok: true, questions: bank.questions.length, checked: bank.checked, provider: deps.providers(env)[0]?.name ?? null }, 200, origin);
  if (req.method !== 'POST' || url.pathname !== '/grade') return reply({ error: 'not_found' }, 404, origin);

  const text = await req.text().catch(() => '');
  if (!text || text.length > MAX_BODY) return reply({ error: 'bad_request' }, 400, origin);
  let body: { nr?: unknown; answer?: unknown };
  try {
    body = JSON.parse(text);
  } catch {
    return reply({ error: 'bad_request' }, 400, origin);
  }
  const answer = typeof body?.answer === 'string' ? body.answer.trim() : '';
  if (!Number.isInteger(body?.nr) || !answer || answer.length > MAX_ANSWER || wordCount(answer) < MIN_WORDS) return reply({ error: 'bad_request' }, 400, origin);
  const q = byNr.get(body.nr as number);
  if (!q) return reply({ error: 'unknown_question' }, 404, origin);

  const token = /^Bearer (.+)$/.exec(req.headers.get('authorization') ?? '')?.[1];
  const uid = token ? await verifyFirebaseToken(token, env.FIREBASE_PROJECT_ID ?? '', deps.keys, deps.now()) : null;
  if (!uid) return reply({ error: 'auth' }, 401, origin);

  const providers = deps.providers(env);
  if (!providers.length) return reply({ error: 'unavailable' }, 503, origin);

  const day = dayOf(deps.now());
  const takes = await takesFor(uid, req.headers.get('cf-connecting-ip') ?? '', day, readLimits(env));
  const quota = await deps.take(env, day, takes);
  if (!quota.ok) return reply({ error: 'quota', scope: SCOPES[quota.blocked ?? 0] }, 429, origin);

  const prompt = { system: SYSTEM_PROMPT, user: buildUserPrompt(q, answer) };
  const started = deps.now();
  let failure: ProviderError | null = null;
  for (const p of providers) {
    try {
      const { raw } = await p.grade(prompt);
      const grade = normalizeGrade(raw, q.points.length, bank.maxPerQuestion);
      // Metadata only: never the answer, the user or the address.
      console.log(JSON.stringify({ ev: 'graded', nr: q.nr, provider: p.name, ms: deps.now() - started, score: grade.score }));
      return reply({ ...grade, left: quota.left[0] }, 200, origin);
    } catch (e) {
      failure = e instanceof ProviderError ? e : new ProviderError('failed', 'unexpected');
      console.log(JSON.stringify({ ev: 'provider_error', nr: q.nr, provider: p.name, code: failure.code, detail: failure.message }));
    }
  }
  // Our failure, not the user's: the charge is given back.
  await deps.refund(
    env,
    day,
    takes.map((t) => t.key),
  );
  return reply({ error: 'unavailable', reason: failure?.code ?? 'failed' }, failure?.code === 'busy' ? 503 : 502, origin);
}

export default {
  fetch: (req: Request, env: Env) => handle(req, env),
} satisfies ExportedHandler<Env>;
