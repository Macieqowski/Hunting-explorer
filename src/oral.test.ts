import { readFileSync } from 'node:fs';
import { seededRng } from './exam';
import { validateOralBank, drawOral, oralResult, suggestScore, clampScore, answerBlocks, wordCount, type OralBank } from './oral';

const bank = JSON.parse(readFileSync(new URL('../public/exams/ustny.json', import.meta.url), 'utf8')) as OralBank;

describe('oral exam bank', () => {
  it('is well formed: every question has an answer, 3-8 key points, a source and a known topic', () => {
    expect(validateOralBank(bank)).toEqual([]);
  });

  it('holds the 209 questions of the original list (no. 191 does not exist)', () => {
    expect(bank.questions).toHaveLength(209);
    const nrs = bank.questions.map((q) => q.nr);
    expect(Math.min(...nrs)).toBe(1);
    expect(Math.max(...nrs)).toBe(210);
    expect(nrs).not.toContain(191);
  });

  it('uses the rules of the real exam: 3 questions, 0-5 points each, 8 of 15 passes', () => {
    expect(bank).toMatchObject({ kind: 'oral', count: 3, maxPerQuestion: 5, passPoints: 8 });
  });

  it('has no topic without questions', () => {
    const used = new Set(bank.questions.map((q) => q.topic));
    expect(bank.topics.filter((t) => !used.has(t.id))).toEqual([]);
  });

  it('reports problems in a broken bank', () => {
    const q = bank.questions[0];
    const broken: OralBank = { ...bank, questions: [{ ...q, points: ['one'], source: '' }, { ...q, topic: 'nope' }] };
    const errs = validateOralBank(broken).join('\n');
    expect(errs).toMatch(/3-8 key points/);
    expect(errs).toMatch(/no source/);
    expect(errs).toMatch(/unknown topic/);
    expect(errs).toMatch(/duplicate id/);
  });
});

describe('drawOral', () => {
  it('draws questions from different topics', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const qs = drawOral(bank.questions, 3, seededRng(seed));
      expect(qs).toHaveLength(3);
      expect(new Set(qs.map((q) => q.topic)).size).toBe(3);
      expect(new Set(qs.map((q) => q.id)).size).toBe(3);
    }
  });

  it('repeats a topic only when there are fewer topics than questions', () => {
    const one = bank.questions.filter((q) => q.topic === bank.questions[0].topic);
    const qs = drawOral(one, 3, seededRng(7));
    expect(qs).toHaveLength(3);
    expect(new Set(qs.map((q) => q.id)).size).toBe(3);
    expect(drawOral(one.slice(0, 2), 3, seededRng(7))).toHaveLength(2);
  });

  it('prefers heavier questions', () => {
    const fav = bank.questions[10].id;
    let hits = 0;
    for (let seed = 1; seed <= 40; seed++) if (drawOral(bank.questions, 3, seededRng(seed), (q) => (q.id === fav ? 5000 : 1)).some((q) => q.id === fav)) hits++;
    expect(hits).toBeGreaterThan(30);
  });
});

describe('oral scoring', () => {
  it('passes at 8 of 15 points', () => {
    expect(oralResult([3, 3, 2], bank)).toEqual({ points: 8, max: 15, passed: true });
    expect(oralResult([5, 2, 0], bank)).toEqual({ points: 7, max: 15, passed: false });
    expect(oralResult([5, null, undefined], bank)).toEqual({ points: 5, max: 15, passed: false });
  });

  it('keeps scores whole and inside 0-5', () => {
    expect(clampScore(7)).toBe(5);
    expect(clampScore(-1)).toBe(0);
    expect(clampScore(2.6)).toBe(3);
    expect(clampScore(NaN)).toBe(0);
  });

  it('suggests a score from the covered key points, partly covered counting half', () => {
    expect(suggestScore(['yes', 'yes', 'yes', 'yes'])).toBe(5);
    expect(suggestScore(['yes', 'yes', 'no', 'no'])).toBe(3);
    expect(suggestScore(['partial', 'partial', 'no', 'no'])).toBe(1);
    expect(suggestScore(['no', 'no', 'no'])).toBe(0);
    expect(suggestScore([])).toBe(0);
  });
});

describe('answer text', () => {
  it('splits paragraphs, bullets and numbered lists', () => {
    expect(answerBlocks('Wstęp.\n- raz\n- dwa\n\nŚrodek.\n1. pierwszy\n2. drugi\nKoniec.')).toEqual([
      { type: 'p', text: 'Wstęp.' },
      { type: 'ul', items: ['raz', 'dwa'] },
      { type: 'p', text: 'Środek.' },
      { type: 'ol', items: ['pierwszy', 'drugi'] },
      { type: 'p', text: 'Koniec.' },
    ]);
  });

  it('counts words', () => {
    expect(wordCount('  ')).toBe(0);
    expect(wordCount('Broń  załadowana to\nbroń')).toBe(4);
  });
});
