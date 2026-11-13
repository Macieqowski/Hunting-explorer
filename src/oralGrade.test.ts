import { parseGrade, failOf, gradeConfigured } from './oralGrade';

describe('oral grading client', () => {
  it('reads a grade from the service', () => {
    expect(parseGrade({ score: 4, points: ['yes', 'partial', 'no'], errors: ['Zła odległość.', ' ', 7], feedback: ' Dobrze. ', left: 5 }, 3)).toEqual({
      score: 4,
      points: ['yes', 'partial', 'no'],
      errors: ['Zła odległość.'],
      feedback: 'Dobrze.',
      left: 5,
    });
  });

  it('keeps the score but drops key points that do not fit the question (another version of the bank)', () => {
    expect(parseGrade({ score: 9, points: ['yes', 'no'], feedback: 'ok' }, 3)).toMatchObject({ score: 5, points: [], left: null });
    expect(parseGrade({ score: 2, points: ['yes', 'maybe', 'no'], feedback: 'ok' }, 3)?.points).toEqual([]);
  });

  it('rejects anything that is not a grade', () => {
    for (const bad of [null, 'x', {}, { score: '3', feedback: 'ok' }, { score: 3 }, { score: NaN, feedback: 'ok' }]) expect(parseGrade(bad, 3)).toBeNull();
  });

  it('tells the daily limit from other failures', () => {
    expect(failOf(429)).toBe('quota');
    expect(failOf(401)).toBe('unavailable');
    expect(failOf(503)).toBe('unavailable');
  });

  it('is off when the build has no service address', () => {
    expect(gradeConfigured()).toBe(false);
  });
});
