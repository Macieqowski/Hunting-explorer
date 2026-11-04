/**
 * Practice-exam engine: question banks, random draws, answer shuffling and scoring.
 * Pure logic, no DOM, so it can be unit-tested.
 */

/** An answer is plain text, or text and/or an image (path relative to the exams folder, or a URL). */
export type Answer = string | { text?: string; image?: string };

export interface Question {
  id: string;
  topic: string;
  q: string;
  /** Optional illustration for the question (path relative to public/exams/, or a URL). */
  image?: string;
  answers: Answer[];
  /** Index (or indices) of the correct answer(s) in `answers`. */
  correct: number | number[];
  explanation?: string;
  /** Link or citation backing the answer. */
  source?: string;
}

export interface Bank {
  id: string;
  title: { pl: string; en: string };
  description?: { pl: string; en: string };
  /** Defaults for an exam attempt. */
  count: number;
  passPct: number;
  minutes: number;
  /** Where the questions come from (shown in the UI). */
  origin?: { name: string; url?: string };
  questions: Question[];
}

/** A question as presented in one attempt: answers shuffled, correct indices remapped. */
export interface DrawnQuestion {
  question: Question;
  answers: Answer[];
  correct: number[];
}

export type Rng = () => number;

/** Small seeded PRNG (mulberry32) so draws are reproducible in tests. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(xs: readonly T[], rng: Rng = Math.random): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const correctList = (q: Question) => (Array.isArray(q.correct) ? q.correct : [q.correct]);

/** Shuffles a question's answers and remaps which ones are correct. */
export function shuffleAnswers(q: Question, rng: Rng = Math.random): DrawnQuestion {
  const order = shuffle(
    q.answers.map((_, i) => i),
    rng,
  );
  const correct = correctList(q);
  return {
    question: q,
    answers: order.map((i) => q.answers[i]),
    correct: order.map((orig, pos) => (correct.includes(orig) ? pos : -1)).filter((x) => x >= 0),
  };
}

/**
 * Draws `count` distinct questions, spread across topics in proportion to their size
 * (largest-remainder rounding), then shuffles question order and answer order.
 */
export function drawExam(questions: Question[], count: number, rng: Rng = Math.random, topics?: string[]): DrawnQuestion[] {
  const pool = topics?.length ? questions.filter((q) => topics.includes(q.topic)) : questions;
  const n = Math.min(count, pool.length);
  const byTopic = new Map<string, Question[]>();
  for (const q of pool) {
    const arr = byTopic.get(q.topic);
    if (arr) arr.push(q);
    else byTopic.set(q.topic, [q]);
  }
  const groups = [...byTopic.values()];
  const quotas = groups.map((g) => (g.length / pool.length) * n);
  const take = quotas.map(Math.floor);
  let left = n - take.reduce((s, x) => s + x, 0);
  // Hand out the remaining slots to the groups with the largest fractional parts (ties broken randomly).
  const order = shuffle(
    groups.map((_, i) => i),
    rng,
  ).sort((a, b) => quotas[b] - take[b] - (quotas[a] - take[a]));
  for (const i of order) {
    if (left <= 0) break;
    if (take[i] < groups[i].length) {
      take[i]++;
      left--;
    }
  }
  const picked = groups.flatMap((g, i) => shuffle(g, rng).slice(0, take[i]));
  return shuffle(picked, rng).map((q) => shuffleAnswers(q, rng));
}

export function isCorrect(d: DrawnQuestion, chosen: number[] | undefined): boolean {
  if (!chosen?.length) return false;
  const a = [...chosen].sort();
  const b = [...d.correct].sort();
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

export interface TopicScore {
  topic: string;
  correct: number;
  total: number;
}

export interface ExamResult {
  correct: number;
  total: number;
  pct: number;
  passed: boolean;
  byTopic: TopicScore[];
}

export function scoreExam(drawn: DrawnQuestion[], answers: (number[] | undefined)[], passPct: number): ExamResult {
  const topics = new Map<string, TopicScore>();
  let correct = 0;
  drawn.forEach((d, i) => {
    const ok = isCorrect(d, answers[i]);
    if (ok) correct++;
    let t = topics.get(d.question.topic);
    if (!t) topics.set(d.question.topic, (t = { topic: d.question.topic, correct: 0, total: 0 }));
    t.total++;
    if (ok) t.correct++;
  });
  const total = drawn.length;
  const pct = total ? (correct / total) * 100 : 0;
  return { correct, total, pct, passed: pct >= passPct, byTopic: [...topics.values()].sort((a, b) => a.topic.localeCompare(b.topic, 'pl')) };
}

/** Basic sanity checks for a question bank (used by tests and the import script). */
export function validateBank(b: Bank): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const q of b.questions) {
    if (ids.has(q.id)) errors.push(`duplicate id ${q.id}`);
    ids.add(q.id);
    if (!q.q.trim() && !q.image) errors.push(`${q.id}: empty question`);
    if (q.answers.some((a) => !answerText(a) && !answerImage(a))) errors.push(`${q.id}: empty answer`);
    if (q.answers.length < 2) errors.push(`${q.id}: fewer than 2 answers`);
    const c = correctList(q);
    if (!c.length || c.some((i) => i < 0 || i >= q.answers.length)) errors.push(`${q.id}: bad correct index`);
    if (new Set(q.answers.map((a) => `${answerText(a).toLowerCase()}|${answerImage(a) ?? ''}`)).size !== q.answers.length)
      errors.push(`${q.id}: duplicate answers`);
  }
  return errors;
}

export const answerText = (a: Answer): string => (typeof a === 'string' ? a : a.text ?? '').trim();
export const answerImage = (a: Answer): string | undefined => (typeof a === 'string' ? undefined : a.image || undefined);
