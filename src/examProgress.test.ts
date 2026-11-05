import { drawExam, seededRng, weightedSample, type Question } from './exam';
import {
  recordAnswer,
  isDue,
  statusOf,
  weightOf,
  dueQuestions,
  summarize,
  mostMissed,
  parseProgress,
  mergeProgress,
  type Progress,
} from './examProgress';

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 10, 5, 8);
const mk = (id: string, topic: string): Question => ({ id, topic, q: `Q${id}`, answers: ['A', 'B'], correct: 0 });

describe('exam progress', () => {
  it('moves up one box per right answer and back to box 1 on a wrong one', () => {
    let p = recordAnswer(undefined, true, T0);
    expect(p).toMatchObject({ box: 2, right: 1, wrong: 0, due: T0 + DAY });
    p = recordAnswer(p, true, T0);
    expect(p).toMatchObject({ box: 3, due: T0 + 3 * DAY });
    p = recordAnswer(p, true, T0);
    expect(statusOf(p)).toBe('mastered');
    p = recordAnswer(recordAnswer(p, true, T0), true, T0);
    expect(p).toMatchObject({ box: 5, due: T0 + 21 * DAY, right: 5 });
    p = recordAnswer(p, false, T0 + DAY);
    expect(p).toMatchObject({ box: 1, due: T0 + DAY, right: 5, wrong: 1 });
    expect(statusOf(p)).toBe('wrong');
  });

  it('a first wrong answer is due right away, a right one tomorrow', () => {
    expect(isDue(recordAnswer(undefined, false, T0), T0)).toBe(true);
    const ok = recordAnswer(undefined, true, T0);
    expect(isDue(ok, T0 + DAY - 1)).toBe(false);
    expect(isDue(ok, T0 + DAY)).toBe(true);
    expect(isDue(undefined, T0)).toBe(false);
  });

  it('weights due wrong questions above unseen ones, and mastered ones lowest', () => {
    const wrong = recordAnswer(undefined, false, T0);
    const mastered = { box: 5, due: T0 + 10 * DAY, right: 5, wrong: 0, last: T0 };
    const learning = { box: 2, due: T0 + DAY, right: 1, wrong: 0, last: T0 };
    expect(weightOf(wrong, T0)).toBeGreaterThan(weightOf(undefined, T0));
    expect(weightOf(undefined, T0)).toBeGreaterThan(weightOf(learning, T0));
    expect(weightOf(learning, T0)).toBeGreaterThan(weightOf(mastered, T0));
    expect(weightOf(learning, T0 + DAY)).toBeGreaterThan(weightOf(undefined, T0));
  });

  it('lists due questions with wrong ones first, and summarizes per topic', () => {
    const qs = [mk('a', 'Prawo'), mk('b', 'Prawo'), mk('c', 'Biologia'), mk('d', 'Biologia')];
    const progress: Progress = {
      a: recordAnswer(undefined, true, T0 - 2 * DAY), // box 2, due
      b: recordAnswer(undefined, false, T0), // box 1, due
      c: { box: 4, due: T0 + DAY, right: 3, wrong: 0, last: T0 },
      gone: recordAnswer(undefined, false, T0), // not in the bank any more
    };
    expect(dueQuestions(qs, progress, T0).map((q) => q.id)).toEqual(['b', 'a']);
    const s = summarize(qs, progress, T0);
    expect(s).toMatchObject({ total: 4, new: 1, wrong: 1, learning: 1, mastered: 1, due: 2 });
    expect(s.byTopic.map((t) => [t.topic, t.mastered, t.new])).toEqual([
      ['Biologia', 1, 1],
      ['Prawo', 0, 0],
    ]);
  });

  it('ranks the most missed questions', () => {
    const qs = [mk('a', 'x'), mk('b', 'x'), mk('c', 'x')];
    const progress: Progress = {
      a: { box: 2, due: 0, right: 3, wrong: 1, last: 1 },
      b: { box: 1, due: 0, right: 0, wrong: 3, last: 1 },
      c: { box: 3, due: 0, right: 2, wrong: 0, last: 1 },
    };
    expect(mostMissed(qs, progress).map((q) => q.id)).toEqual(['b', 'a']);
  });

  it('parses stored data defensively and merges by most recent answer', () => {
    const parsed = parseProgress({ a: { box: 3, due: 5, right: 2, wrong: 1, last: 10 }, b: { box: 9 }, c: 'x', d: { box: 1 } });
    expect(Object.keys(parsed)).toEqual(['a', 'd']);
    expect(parsed.d).toEqual({ box: 1, due: 0, right: 0, wrong: 0, last: 0 });
    expect(parseProgress(null)).toEqual({});
    const merged = mergeProgress(parsed, { a: { box: 1, due: 0, right: 0, wrong: 1, last: 5 }, e: { box: 2, due: 0, right: 1, wrong: 0, last: 1 } });
    expect(merged.a.box).toBe(3);
    expect(merged.e.box).toBe(2);
  });
});

describe('weighted draw', () => {
  it('samples by weight without replacement', () => {
    const xs = Array.from({ length: 20 }, (_, i) => i);
    const s = weightedSample(xs, 20, () => 1, seededRng(1));
    expect(new Set(s).size).toBe(20);
    let heavy = 0;
    for (let seed = 1; seed <= 200; seed++) if (weightedSample(xs, 1, (x) => (x === 7 ? 50 : 1), seededRng(seed))[0] === 7) heavy++;
    expect(heavy).toBeGreaterThan(120);
  });

  it('keeps topic proportions and prefers heavy questions', () => {
    const bank = [...Array.from({ length: 30 }, (_, i) => mk(`law${i}`, 'Prawo')), ...Array.from({ length: 10 }, (_, i) => mk(`bio${i}`, 'Biologia'))];
    const weak = new Set(['law1', 'law2', 'law3', 'bio4']);
    const d = drawExam(bank, 20, seededRng(4), undefined, undefined, (q) => (weak.has(q.id) ? 1000 : 1));
    expect(d.filter((x) => x.question.topic === 'Prawo')).toHaveLength(15);
    expect(d.filter((x) => x.question.topic === 'Biologia')).toHaveLength(5);
    expect(d.filter((x) => weak.has(x.question.id))).toHaveLength(4);
  });
});
