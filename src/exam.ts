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
  /** Section of the exam this question belongs to (see Bank.sections), e.g. "bezpieczenstwo". */
  section?: string;
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
  /**
   * Optional exam sections drawn separately, e.g. the hunter exam's 30 safety + 70 general questions.
   * Each section gets its own quota and may have its own minimum score.
   */
  sections?: Section[];
  /** Where the questions come from (shown in the UI). */
  origin?: { name: string; url?: string };
  questions: Question[];
}

export interface Section {
  id: string;
  name: { pl: string; en: string };
  /** Number of questions from this section in a full-length exam. */
  count: number;
  /** Minimum score (%) required in this section, on top of the overall pass mark. */
  minPct?: number;
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

export interface SectionScore {
  id: string;
  correct: number;
  total: number;
  pct: number;
  minPct: number | undefined;
  passed: boolean;
}

export interface ExamResult {
  correct: number;
  total: number;
  pct: number;
  /** Overall pass mark met and every section minimum met. */
  passed: boolean;
  byTopic: TopicScore[];
  bySection: SectionScore[];
}

export function scoreExam(
  drawn: DrawnQuestion[],
  answers: (number[] | undefined)[],
  passPct: number,
  sections: Section[] = [],
): ExamResult {
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
  const bySection: SectionScore[] = sections
    .map((sec) => {
      const idx = drawn.map((d, i) => (d.question.section === sec.id ? i : -1)).filter((i) => i >= 0);
      const ok = idx.filter((i) => isCorrect(drawn[i], answers[i])).length;
      const p = idx.length ? (ok / idx.length) * 100 : 0;
      return { id: sec.id, correct: ok, total: idx.length, pct: p, minPct: sec.minPct, passed: sec.minPct == null || p >= sec.minPct };
    })
    .filter((x) => x.total > 0);
  return {
    correct,
    total,
    pct,
    passed: total > 0 && pct >= passPct && bySection.every((x) => x.passed),
    byTopic: [...topics.values()].sort((a, b) => a.topic.localeCompare(b.topic, 'pl')),
    bySection,
  };
}

/**
 * Draws an exam that respects the bank's sections: each section contributes its quota, scaled
 * when the user picks a shorter or longer test. Questions without a section are drawn as one extra pool.
 */
export function drawSectionedExam(bank: Bank, count: number, rng: Rng = Math.random, topics?: string[]): DrawnQuestion[] {
  const pool = topics?.length ? bank.questions.filter((q) => topics.includes(q.topic)) : bank.questions;
  const secs = (bank.sections ?? []).filter((s) => pool.some((q) => q.section === s.id));
  if (!secs.length) return drawExam(pool, count, rng);
  const known = new Set(secs.map((s) => s.id));
  const groups = secs.map((s) => ({ qs: pool.filter((q) => q.section === s.id), weight: s.count }));
  const rest = pool.filter((q) => !q.section || !known.has(q.section));
  if (rest.length) groups.push({ qs: rest, weight: 0 });
  const totalWeight = secs.reduce((s, x) => s + x.count, 0);
  const n = Math.min(count, pool.length);
  // Quotas follow the section weights; leftover slots (rounding, small sections) go to whatever has questions left.
  const take = groups.map((g) => Math.min(g.qs.length, Math.round((g.weight / totalWeight) * n)));
  let left = n - take.reduce((s, x) => s + x, 0);
  while (left < 0) {
    const i = take.indexOf(Math.max(...take));
    take[i]--;
    left++;
  }
  for (let i = 0; left > 0 && i < groups.length * n; i++) {
    const g = i % groups.length;
    if (take[g] < groups[g].qs.length) {
      take[g]++;
      left--;
    }
  }
  const picked = groups.flatMap((g, i) => drawExam(g.qs, take[i], rng));
  // Keep sections in their bank order (the PZŁ test starts with the safety block), shuffled within.
  return picked;
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
    if (q.section && b.sections && !b.sections.some((x) => x.id === q.section)) errors.push(`${q.id}: unknown section ${q.section}`);
    if (new Set(q.answers.map((a) => `${answerText(a).toLowerCase()}|${answerImage(a) ?? ''}`)).size !== q.answers.length)
      errors.push(`${q.id}: duplicate answers`);
  }
  return errors;
}

export const answerText = (a: Answer): string => (typeof a === 'string' ? a : a.text ?? '').trim();
export const answerImage = (a: Answer): string | undefined => (typeof a === 'string' ? undefined : a.image || undefined);
