// Compares the grading models on the control set (eval/control.json): answers scored by hand.
// Run: ANTHROPIC_API_KEY=… OPENAI_API_KEY=… npm run eval   (either key alone runs that model only)
// Prints a Markdown report (also to $GITHUB_STEP_SUMMARY) and writes eval/report.md.
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { OralBank } from '../../src/oral';
import { OK_SCORE } from '../../src/oral';
import { buildUserPrompt, normalizeGrade, SYSTEM_PROMPT } from '../src/prompt';
import { anthropicProvider } from '../src/providers/anthropic';
import { openaiProvider } from '../src/providers/openai';
import { ProviderError, type Provider } from '../src/providers/types';

interface Item {
  nr: number;
  kind: string;
  score: number;
  answer: string;
}

interface Outcome {
  got: number | null;
  raw: number | null;
  ms: number;
  input: number;
  output: number;
  error: string | null;
}

const here = (p: string) => join(dirname(fileURLToPath(import.meta.url)), p);
const bank = JSON.parse(readFileSync(here('../../public/exams/ustny.json'), 'utf8')) as OralBank;
const items = (JSON.parse(readFileSync(here('./control.json'), 'utf8')) as { items: Item[] }).items;
const byNr = new Map(bank.questions.map((q) => [q.nr, q]));

/** USD per million tokens (input, output), for the cost column. */
const PRICE: Record<string, [number, number]> = { anthropic: [0.1, 0.5], openai: [0.1, 0.5] };

const env = process.env;
const models: { name: string; model: string; grade: Provider }[] = [];
if (env.ANTHROPIC_API_KEY) {
  const model = env.ANTHROPIC_MODEL || 'claude-haiku-5-5';
  models.push({ name: 'anthropic', model, grade: anthropicProvider(env.ANTHROPIC_API_KEY, model) });
}
if (env.OPENAI_API_KEY) {
  const model = env.OPENAI_MODEL || 'gpt-6-luna';
  models.push({ name: 'openai', model, grade: openaiProvider(env.OPENAI_API_KEY, model) });
}
if (!models.length) {
  console.error('No API key: set ANTHROPIC_API_KEY and/or OPENAI_API_KEY.');
  process.exit(1);
}

async function gradeOne(grade: Provider, it: Item): Promise<Outcome> {
  const q = byNr.get(it.nr);
  if (!q) return { got: null, raw: null, ms: 0, input: 0, output: 0, error: 'unknown question' };
  const t0 = Date.now();
  // One retry: a single overloaded response should not decide the comparison.
  for (let attempt = 0; ; attempt++) {
    try {
      const { raw, usage } = await grade({ system: SYSTEM_PROMPT, user: buildUserPrompt(q, it.answer) });
      const g = normalizeGrade(raw, q.points.length, bank.maxPerQuestion);
      return { got: g.score, raw: Math.round(raw.score), ms: Date.now() - t0, input: usage?.input ?? 0, output: usage?.output ?? 0, error: null };
    } catch (e) {
      const code = e instanceof ProviderError ? `${e.code}: ${e.message}` : String(e);
      if (attempt >= 1 || !(e instanceof ProviderError) || e.code !== 'busy') return { got: null, raw: null, ms: Date.now() - t0, input: 0, output: 0, error: code };
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

async function runAll(grade: Provider): Promise<Outcome[]> {
  const out: Outcome[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await gradeOne(grade, items[i]);
      }
    }),
  );
  return out;
}

const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : '–');
const f2 = (x: number) => x.toFixed(2);

const results = new Map<string, Outcome[]>();
for (const m of models) results.set(m.name, await runAll(m.grade));

let md = `## Egzamin ustny: porównanie modeli na zestawie kontrolnym\n\n${items.length} odpowiedzi ocenionych ręcznie (0-5). Ocena modelu po normalizacji, czyli taka, jaką zobaczy użytkownik.\n\n`;
md += '| Model | Ocenione | Średni błąd | Zgodne co do punktu | Różnica ≤ 1 | Zgodne zal./nie zal. (≥3) | Skłonność | Śr. czas | Najdłuższy | Tokeny wej./wyj. (śr.) | Koszt 1000 ocen |\n|---|---|---|---|---|---|---|---|---|---|---|\n';
for (const m of models) {
  const r = results.get(m.name)!;
  const done = r.map((o, i) => ({ o, it: items[i] })).filter((x) => x.o.got != null);
  const n = done.length;
  const diff = done.map((x) => x.o.got! - x.it.score);
  const mae = n ? diff.reduce((s, d) => s + Math.abs(d), 0) / n : NaN;
  const bias = n ? diff.reduce((s, d) => s + d, 0) / n : NaN;
  const sameSide = done.filter((x) => x.o.got! >= OK_SCORE === x.it.score >= OK_SCORE).length;
  const ms = done.map((x) => x.o.ms);
  const tin = n ? done.reduce((s, x) => s + x.o.input, 0) / n : 0;
  const tout = n ? done.reduce((s, x) => s + x.o.output, 0) / n : 0;
  const [pi, po] = PRICE[m.name];
  md += `| ${m.model} | ${n}/${items.length} | ${n ? f2(mae) : '–'} | ${pct(diff.filter((d) => d === 0).length, n)} | ${pct(diff.filter((d) => Math.abs(d) <= 1).length, n)} | ${pct(sameSide, n)} | ${n ? (bias >= 0 ? '+' : '') + f2(bias) : '–'} | ${n ? (ms.reduce((s, x) => s + x, 0) / n / 1000).toFixed(1) : '–'} s | ${n ? (Math.max(...ms) / 1000).toFixed(1) : '–'} s | ${Math.round(tin)} / ${Math.round(tout)} | $${f2(((tin * pi + tout * po) / 1e6) * 1000)} |\n`;
}
md += '\nSkłonność: średnia różnica ocena modelu minus ocena ręczna (plus = model zawyża).\n\n### Poszczególne odpowiedzi\n\n';
md += `| Pyt. | Rodzaj | Ręcznie | ${models.map((m) => m.model).join(' | ')} | Odpowiedź |\n|---|---|---|${models.map(() => '---').join('|')}|---|\n`;
items.forEach((it, i) => {
  const cells = models.map((m) => {
    const o = results.get(m.name)![i];
    if (o.got == null) return `błąd (${o.error})`;
    const mark = Math.abs(o.got - it.score) >= 2 ? ' ⚠' : '';
    return `${o.got}${o.raw !== o.got ? ` (model: ${o.raw})` : ''}${mark}`;
  });
  md += `| ${it.nr} | ${it.kind} | ${it.score} | ${cells.join(' | ')} | ${it.answer.slice(0, 90).replace(/\|/g, '/')}${it.answer.length > 90 ? '…' : ''} |\n`;
});

console.log(md);
writeFileSync(here('./report.md'), md);
if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, md);
