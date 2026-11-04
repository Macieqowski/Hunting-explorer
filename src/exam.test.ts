import { drawExam, drawSectionedExam, seededRng, shuffleAnswers, scoreExam, isCorrect, validateBank, type Question, type Bank } from './exam';
import { seasonQuestions } from './seasonQuestions';
import mysliwy from '../public/exams/mysliwy.json';
import selekcjoner from '../public/exams/selekcjoner.json';

const mk = (id: string, topic: string): Question => ({ id, topic, q: `Q${id}`, answers: ['A', 'B', 'C', 'D'], correct: 1 });
const bank = [
  ...Array.from({ length: 30 }, (_, i) => mk(`law${i}`, 'Prawo')),
  ...Array.from({ length: 10 }, (_, i) => mk(`bio${i}`, 'Biologia')),
];

describe('exam engine', () => {
  it('draws distinct questions spread proportionally across topics', () => {
    const d = drawExam(bank, 20, seededRng(1));
    expect(d).toHaveLength(20);
    expect(new Set(d.map((x) => x.question.id)).size).toBe(20);
    expect(d.filter((x) => x.question.topic === 'Prawo')).toHaveLength(15);
    expect(d.filter((x) => x.question.topic === 'Biologia')).toHaveLength(5);
  });

  it('gives a different selection on different runs', () => {
    const a = drawExam(bank, 10, seededRng(1)).map((x) => x.question.id).join();
    const b = drawExam(bank, 10, seededRng(2)).map((x) => x.question.id).join();
    expect(a).not.toBe(b);
  });

  it('caps the count at the bank size and can filter topics', () => {
    expect(drawExam(bank, 100, seededRng(3))).toHaveLength(40);
    expect(drawExam(bank, 100, seededRng(3), ['Biologia'])).toHaveLength(10);
  });

  it('keeps the right answer correct after shuffling', () => {
    for (let s = 0; s < 20; s++) {
      const d = shuffleAnswers(mk('x', 't'), seededRng(s));
      expect(d.answers[d.correct[0]]).toBe('B');
      expect(isCorrect(d, d.correct)).toBe(true);
    }
  });

  it('supports image questions and image answers', () => {
    const q: Question = {
      id: 'img', topic: 't', q: 'Jaki to gatunek?', image: 'img/x.png',
      answers: [{ image: 'img/a.png' }, { text: 'Sarna', image: 'img/b.png' }, 'Dzik'], correct: 1,
    };
    expect(validateBank({ id: 'b', title: { pl: '', en: '' }, count: 1, passPct: 1, minutes: 1, questions: [q] })).toEqual([]);
    const d = shuffleAnswers(q, seededRng(7));
    expect(d.answers[d.correct[0]]).toEqual({ text: 'Sarna', image: 'img/b.png' });
  });

  it('scores and reports per-topic results', () => {
    const d = drawExam(bank, 10, seededRng(4));
    const answers = d.map((x, i) => (i < 8 ? x.correct : [(x.correct[0] + 1) % 4]));
    const r = scoreExam(d, answers, 80);
    expect(r.correct).toBe(8);
    expect(r.passed).toBe(true);
    expect(r.byTopic.reduce((s, t) => s + t.total, 0)).toBe(10);
    expect(scoreExam(d, [], 80).passed).toBe(false);
  });
});

describe('question banks', () => {
  it('generated season questions are valid', () => {
    const qs = seasonQuestions(seededRng(5));
    expect(qs.length).toBeGreaterThan(20);
    expect(validateBank({ id: 's', title: { pl: '', en: '' }, count: 1, passPct: 1, minutes: 1, questions: qs })).toEqual([]);
    const roe = qs.find((q) => q.id === 'season-Sarna – kozły')!;
    expect(roe.answers[roe.correct as number]).toBe('11 maj – 30 wrz');
  });

  it('bundled bank files are valid', () => {
    for (const b of [mysliwy, selekcjoner]) expect(validateBank(b as unknown as Bank)).toEqual([]);
  });
});

describe('sectioned exams (PZŁ hunter format)', () => {
  const sq = (id: string, section: string): Question => ({ id, topic: section, section, q: id, answers: ['A', 'B', 'C'], correct: 0 });
  const hunter: Bank = {
    id: 'h', title: { pl: '', en: '' }, count: 100, passPct: 80, minutes: 60,
    sections: [
      { id: 'bezpieczenstwo', name: { pl: 'Bezpieczeństwo', en: 'Safety' }, count: 30, minPct: 80 },
      { id: 'ogolne', name: { pl: 'Ogólne', en: 'General' }, count: 70 },
    ],
    questions: [...Array.from({ length: 60 }, (_, i) => sq(`s${i}`, 'bezpieczenstwo')), ...Array.from({ length: 150 }, (_, i) => sq(`g${i}`, 'ogolne'))],
  };

  it('draws 30 safety + 70 general for a full test, safety block first', () => {
    const d = drawSectionedExam(hunter, 100, seededRng(1));
    expect(d).toHaveLength(100);
    expect(d.slice(0, 30).every((x) => x.question.section === 'bezpieczenstwo')).toBe(true);
    expect(d.slice(30).every((x) => x.question.section === 'ogolne')).toBe(true);
  });

  it('scales the section quotas for a shorter test', () => {
    const d = drawSectionedExam(hunter, 20, seededRng(2));
    expect(d.filter((x) => x.question.section === 'bezpieczenstwo')).toHaveLength(6);
    expect(d.filter((x) => x.question.section === 'ogolne')).toHaveLength(14);
  });

  it('fails when safety is below 80% even if the overall score passes', () => {
    const d = drawSectionedExam(hunter, 100, seededRng(3));
    // 23/30 safety (76.7%) + 70/70 general = 93% overall
    const answers = d.map((x, i) => (i < 7 ? [(x.correct[0] + 1) % 3] : x.correct));
    const r = scoreExam(d, answers, 80, hunter.sections);
    expect(r.pct).toBeGreaterThanOrEqual(80);
    expect(r.bySection.find((x) => x.id === 'bezpieczenstwo')!.passed).toBe(false);
    expect(r.passed).toBe(false);
    // 24/30 safety (80%) passes
    const ok = d.map((x, i) => (i < 6 ? [(x.correct[0] + 1) % 3] : x.correct));
    expect(scoreExam(d, ok, 80, hunter.sections).passed).toBe(true);
  });

  it('fails when overall is below 80% even if safety passes', () => {
    const d = drawSectionedExam(hunter, 100, seededRng(4));
    const answers = d.map((x, i) => (i >= 30 && i < 55 ? [(x.correct[0] + 1) % 3] : x.correct));
    const r = scoreExam(d, answers, 80, hunter.sections);
    expect(r.bySection.every((x) => x.passed)).toBe(true);
    expect(r.passed).toBe(false);
  });
});
