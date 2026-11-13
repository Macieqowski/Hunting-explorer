/**
 * Oral exam: open questions answered in the candidate's own words, 0-5 points each.
 * Pure logic, no DOM, so it can be unit-tested. The bank lives in public/exams/ustny.json.
 */
import { weightedSample, type Rng } from './exam';

export interface OralQuestion {
  /** "u<nr>", unique across all banks (progress is stored per id). */
  id: string;
  /** Number in the original list of questions. */
  nr: number;
  /** Topic id, see OralBank.topics. */
  topic: string;
  q: string;
  /** Reference answer. Lines starting with "- " are bullets, "1." a numbered list, the rest paragraphs. */
  answer: string;
  /** 3-8 things a full answer has to contain; grading counts how many were covered. */
  points: string[];
  /** Legal basis or other source of the answer. */
  source: string;
  /** Caveat shown under the answer (e.g. sources disagree). */
  note?: string;
}

export interface OralBank {
  id: string;
  kind: 'oral';
  title: { pl: string; en: string };
  description: { pl: string; en: string };
  /** Questions per exam. */
  count: number;
  maxPerQuestion: number;
  /** Points needed to pass (out of count × maxPerQuestion). */
  passPoints: number;
  minutesPerQuestion: number;
  /** Date the answers were last checked against the law (YYYY-MM-DD). */
  checked: string;
  topics: { id: string; name: { pl: string; en: string } }[];
  questions: OralQuestion[];
}

/** A score of this many points or more counts as "knew it" for the repetition schedule. */
export const OK_SCORE = 3;
/** Longest answer sent for grading (characters); about three minutes of speech is 2,000-2,500. */
export const MAX_ANSWER = 3000;

/** Problems in a bank, empty when it is well formed. */
export function validateOralBank(b: OralBank): string[] {
  const errs: string[] = [];
  if (b.kind !== 'oral') errs.push('kind must be "oral"');
  if (!(b.count > 0)) errs.push('count must be positive');
  if (!(b.maxPerQuestion > 0)) errs.push('maxPerQuestion must be positive');
  if (!(b.passPoints > 0 && b.passPoints <= b.count * b.maxPerQuestion)) errs.push('passPoints out of range');
  const topics = new Set(b.topics.map((t) => t.id));
  if (topics.size !== b.topics.length) errs.push('duplicate topic id');
  const ids = new Set<string>();
  const nrs = new Set<number>();
  for (const q of b.questions) {
    const at = `question ${q.nr}`;
    if (q.id !== `u${q.nr}`) errs.push(`${at}: id must be "u${q.nr}"`);
    if (ids.has(q.id)) errs.push(`${at}: duplicate id`);
    if (nrs.has(q.nr)) errs.push(`${at}: duplicate number`);
    ids.add(q.id);
    nrs.add(q.nr);
    if (!topics.has(q.topic)) errs.push(`${at}: unknown topic "${q.topic}"`);
    if (!q.q?.trim()) errs.push(`${at}: empty question`);
    if ((q.answer?.trim().length ?? 0) < 40) errs.push(`${at}: answer too short`);
    if (!Array.isArray(q.points) || q.points.length < 3 || q.points.length > 8) errs.push(`${at}: needs 3-8 key points`);
    else if (q.points.some((p) => !p?.trim())) errs.push(`${at}: empty key point`);
    if (!q.source?.trim()) errs.push(`${at}: no source`);
  }
  return errs;
}

/**
 * Draws `count` questions, each from a different topic while topics last (an examiner does not
 * ask three questions about the same thing). `weight` makes some questions more likely.
 */
export function drawOral<T extends { id: string; topic: string }>(
  questions: readonly T[],
  count: number,
  rng: Rng = Math.random,
  weight: (q: T) => number = () => 1,
): T[] {
  const out: T[] = [];
  const used = new Set<string>();
  let pool = [...questions];
  while (out.length < count && pool.length) {
    const fresh = pool.filter((q) => !used.has(q.topic));
    const [pick] = weightedSample(fresh.length ? fresh : pool, 1, weight, rng);
    if (!pick) break;
    out.push(pick);
    used.add(pick.topic);
    pool = pool.filter((q) => q.id !== pick.id);
  }
  return out;
}

export interface OralResult {
  points: number;
  max: number;
  passed: boolean;
}

/** Sum of the per-question scores (a missing score counts as 0) against the pass mark. */
export function oralResult(scores: readonly (number | null | undefined)[], bank: Pick<OralBank, 'maxPerQuestion' | 'passPoints'>): OralResult {
  const points = scores.reduce<number>((s, x) => s + clampScore(x ?? 0, bank.maxPerQuestion), 0);
  return { points, max: scores.length * bank.maxPerQuestion, passed: points >= bank.passPoints };
}

export const clampScore = (x: number, max = 5): number => (Number.isFinite(x) ? Math.min(max, Math.max(0, Math.round(x))) : 0);

/** How far a key point was covered: fully, partly or not at all. */
export type Coverage = 'yes' | 'partial' | 'no';

/** Score suggested by the covered key points: the covered share of the maximum (partly covered counts half). */
export function suggestScore(coverage: readonly Coverage[], max = 5): number {
  if (!coverage.length) return 0;
  const got = coverage.reduce((s, c) => s + (c === 'yes' ? 1 : c === 'partial' ? 0.5 : 0), 0);
  return clampScore((got / coverage.length) * max, max);
}

export type AnswerBlock = { type: 'p'; text: string } | { type: 'ul' | 'ol'; items: string[] };

/** Splits a reference answer into paragraphs, bullet lists ("- ") and numbered lists ("1. "). */
export function answerBlocks(text: string): AnswerBlock[] {
  const out: AnswerBlock[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const bullet = /^[-•]\s+(.*)$/.exec(line);
    const numbered = /^\d+[.)]\s+(.*)$/.exec(line);
    const type = bullet ? 'ul' : numbered ? 'ol' : 'p';
    if (type === 'p') {
      out.push({ type, text: line });
      continue;
    }
    const item = (bullet ?? numbered)![1];
    const last = out[out.length - 1];
    if (last && last.type === type) last.items.push(item);
    else out.push({ type, items: [item] });
  }
  return out;
}

/** Words in an answer (used to tell an empty or one-word answer from a real one). */
export const wordCount = (s: string): number => (s.trim().match(/\S+/g) ?? []).length;
