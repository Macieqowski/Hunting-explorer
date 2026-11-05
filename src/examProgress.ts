/**
 * Exam progress: remembers how each question was answered and schedules repetitions
 * with a Leitner system. Pure logic, no DOM or storage, so it can be unit-tested.
 *
 * Boxes: 0 = not seen, 1 = answered wrong (due right away), 2..5 = answered right that many
 * times in a row (2 → 1 day, 3 → 3 days, 4 → 7 days, 5 → 21 days). A right answer moves a
 * question up one box, a wrong or skipped one drops it back to box 1.
 */
import type { Question } from './exam';

export interface QuestionProgress {
  /** Leitner box, 1..5 (0 / missing = never answered). */
  box: number;
  /** When the question is due again (ms since epoch). */
  due: number;
  right: number;
  wrong: number;
  /** Last time it was answered (ms since epoch). */
  last: number;
}

/** Progress per question id. */
export type Progress = Record<string, QuestionProgress>;

export const MAX_BOX = 5;
/** Box at which a question counts as mastered. */
export const MASTERED_BOX = 4;
const DAY = 86_400_000;
/** Gap before a question in box N comes back (box 1 = right away). */
const GAP_DAYS = [0, 0, 1, 3, 7, 21];

export type Status = 'new' | 'wrong' | 'learning' | 'mastered';

export function statusOf(p: QuestionProgress | undefined): Status {
  if (!p?.box) return 'new';
  if (p.box === 1) return 'wrong';
  return p.box >= MASTERED_BOX ? 'mastered' : 'learning';
}

/** Records one answer and returns the question's new progress (does not mutate `prev`). */
export function recordAnswer(prev: QuestionProgress | undefined, ok: boolean, now: number): QuestionProgress {
  const box = ok ? Math.min(MAX_BOX, Math.max(1, prev?.box ?? 0) + 1) : 1;
  return {
    box,
    due: now + GAP_DAYS[box] * DAY,
    right: (prev?.right ?? 0) + (ok ? 1 : 0),
    wrong: (prev?.wrong ?? 0) + (ok ? 0 : 1),
    last: now,
  };
}

/** A question was seen before and is due for repetition. */
export const isDue = (p: QuestionProgress | undefined, now: number): boolean => !!p?.box && p.due <= now;

/**
 * Draw weight for learning modes: due wrong questions most often, other due ones next, unseen
 * ones after that, and questions not yet due (especially mastered ones) rarely.
 */
export function weightOf(p: QuestionProgress | undefined, now: number): number {
  if (!p?.box) return 3;
  if (isDue(p, now)) return p.box === 1 ? 12 : 8 - p.box;
  return p.box >= MASTERED_BOX ? 0.25 : 1;
}

/** Questions due for repetition, most urgent first (wrong ones, then lowest box, then oldest due). */
export function dueQuestions(questions: Question[], progress: Progress, now: number): Question[] {
  return questions
    .filter((q) => isDue(progress[q.id], now))
    .sort((a, b) => {
      const pa = progress[a.id];
      const pb = progress[b.id];
      return pa.box - pb.box || pa.due - pb.due;
    });
}

export interface Counts {
  new: number;
  wrong: number;
  learning: number;
  mastered: number;
  total: number;
  due: number;
}

export interface TopicSummary extends Counts {
  topic: string;
}

export interface Summary extends Counts {
  byTopic: TopicSummary[];
}

const empty = (): Counts => ({ new: 0, wrong: 0, learning: 0, mastered: 0, total: 0, due: 0 });

/** Counts per status for a bank, overall and per topic (only ids in `questions` are counted). */
export function summarize(questions: Question[], progress: Progress, now: number): Summary {
  const all = empty();
  const topics = new Map<string, TopicSummary>();
  for (const q of questions) {
    const p = progress[q.id];
    let t = topics.get(q.topic);
    if (!t) topics.set(q.topic, (t = { topic: q.topic, ...empty() }));
    for (const c of [all, t]) {
      c[statusOf(p)]++;
      c.total++;
      if (isDue(p, now)) c.due++;
    }
  }
  return { ...all, byTopic: [...topics.values()].sort((a, b) => a.topic.localeCompare(b.topic, 'pl')) };
}

/** Questions answered wrong at least once, most often first (ties: worse right/wrong ratio, then most recent). */
export function mostMissed(questions: Question[], progress: Progress, limit = 10): Question[] {
  return questions
    .filter((q) => (progress[q.id]?.wrong ?? 0) > 0)
    .sort((a, b) => {
      const pa = progress[a.id];
      const pb = progress[b.id];
      return pb.wrong - pa.wrong || pa.right - pb.right || pb.last - pa.last;
    })
    .slice(0, limit);
}

/** Validates data from storage or an imported file, keeping only well-formed entries. */
export function parseProgress(data: unknown): Progress {
  const out: Progress = {};
  if (!data || typeof data !== 'object') return out;
  for (const [id, v] of Object.entries(data as Record<string, unknown>)) {
    if (!v || typeof v !== 'object') continue;
    const p = v as Record<string, unknown>;
    const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : NaN);
    const box = num(p.box);
    if (!Number.isInteger(box) || box < 1 || box > MAX_BOX) continue;
    out[id] = {
      box,
      due: num(p.due) || 0,
      right: Math.max(0, num(p.right) || 0),
      wrong: Math.max(0, num(p.wrong) || 0),
      last: num(p.last) || 0,
    };
  }
  return out;
}

/** Merges imported progress into the current one, keeping the more recent entry for each question. */
export function mergeProgress(cur: Progress, imported: Progress): Progress {
  const out = { ...cur };
  for (const [id, p] of Object.entries(imported)) if (!out[id] || p.last > out[id].last) out[id] = p;
  return out;
}
