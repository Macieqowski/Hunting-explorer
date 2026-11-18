import { describe, expect, it } from 'vitest';
import { CARDS, FIRST, TRIAGE, KIT, QUIZ, SOURCES, REVIEW, REVIEW_NOTES, reviewLine, AID_PAGES, cardBySlug, nextStep, type AidStep } from './aid';
import { aidArt, AID_ARTS } from './aidArt';

/** Every step reachable from the first by "Dalej" or an answer, and whether some path loops. */
function walk(steps: AidStep[]): { reached: Set<number>; loops: boolean; cards: string[] } {
  const reached = new Set<number>();
  const cards: string[] = [];
  let loops = false;
  const visit = (i: number, path: Set<number>) => {
    if (path.has(i)) {
      loops = true;
      return;
    }
    reached.add(i);
    const s = steps[i];
    const outs = s.ask ? [nextStep(steps, i, true), nextStep(steps, i, false)] : [nextStep(steps, i)];
    for (const o of outs) {
      if ('step' in o) visit(o.step, new Set([...path, i]));
      else if ('card' in o) cards.push(o.card);
    }
  };
  visit(0, new Set());
  return { reached, loops, cards };
}

describe('first-aid cards', () => {
  it('has the 14 cards of the plan, with unique slugs fit for an address', () => {
    expect(CARDS).toHaveLength(14);
    const slugs = CARDS.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) {
      expect(s).toMatch(/^[a-z0-9-]{1,40}$/);
      expect(AID_PAGES as readonly string[]).not.toContain(s);
    }
  });

  it('fills every card: recognising, steps, what not to do, sources', () => {
    for (const c of CARDS) {
      expect(c.title.length, c.slug).toBeGreaterThan(3);
      expect(c.when.length, c.slug).toBeGreaterThan(0);
      expect(c.steps.length, c.slug).toBeGreaterThan(1);
      expect(c.dont.length, c.slug).toBeGreaterThan(0);
      expect(c.src.length, c.slug).toBeGreaterThan(0);
      for (const s of c.src) expect(SOURCES[s], `${c.slug}: ${s}`).toBeDefined();
      expect(AID_ARTS, c.slug).toContain(c.art);
      for (const s of c.steps) {
        if (s.art) expect(AID_ARTS, `${c.slug}: ${s.t}`).toContain(s.art);
        expect(s.t.trim(), c.slug).toBe(s.t);
      }
    }
  });

  it('leads every answer somewhere that exists, never in a circle, and reaches every step', () => {
    for (const c of [...CARDS, { slug: 'start', steps: TRIAGE }]) {
      const ids = c.steps.map((s) => s.id).filter(Boolean);
      expect(new Set(ids).size, c.slug).toBe(ids.length);
      c.steps.forEach((s, i) => {
        if (!s.ask) return;
        for (const go of [s.ask.yes, s.ask.no]) {
          if (go.startsWith('card:')) expect(cardBySlug(go.slice(5)), `${c.slug}: ${go}`).toBeDefined();
          else {
            const j = c.steps.findIndex((x) => x.id === go);
            expect(j, `${c.slug}: ${go}`).toBeGreaterThan(i);
          }
        }
      });
      const w = walk(c.steps);
      expect(w.loops, c.slug).toBe(false);
      expect([...w.reached].sort((a, b) => a - b), c.slug).toEqual(c.steps.map((_, i) => i));
    }
  });

  it('starts every card with the same three things: stop, unload, 112', () => {
    expect(FIRST.map((s) => s.t)).toEqual(['Wstrzymaj polowanie', 'Rozładuj broń', 'Dzwoń 112 albo poproś o to kogoś obok']);
  });

  it('sends the triage ("Nie wiesz, od czego zacząć?") to real cards, bleeding first', () => {
    const w = walk(TRIAGE);
    expect(w.loops).toBe(false);
    expect(w.cards.length).toBeGreaterThan(0);
    for (const c of w.cards) expect(cardBySlug(c), c).toBeDefined();
    expect(TRIAGE[0].ask?.yes).toBe('card:krwotok');
  });

  it('has a tourniquet clock on the bleeding card and a metronome on CPR', () => {
    expect(cardBySlug('krwotok')!.steps.some((s) => s.tool === 'tq')).toBe(true);
    expect(cardBySlug('rko')!.steps.some((s) => s.tool === 'cpr')).toBe(true);
  });

  it('goes on step by step and ends', () => {
    const steps = cardBySlug('krwotok')!.steps;
    expect(nextStep(steps, 0)).toEqual(steps[0].ask ? expect.anything() : { step: 1 });
    expect(nextStep(steps, steps.length - 1)).toEqual({ end: true });
    expect(nextStep(steps, 99)).toEqual({ end: true });
  });

  it('is a draft until it has a review date, then says when it was checked and by whom', () => {
    expect(reviewLine({ by: null, date: null })).toBeNull();
    expect(reviewLine({ by: 'lek. Anna Nowak', date: null })).toBeNull();
    expect(reviewLine({ by: null, date: 'listopad 2026' })).toBe('Przegląd medyczny treści: listopad 2026.');
    expect(reviewLine({ by: 'lek. Anna Nowak', date: 'listopad 2026' })).toBe('Treść sprawdził(a): lek. Anna Nowak, listopad 2026.');
  });

  it('has been checked by a medical reviewer', () => {
    expect(REVIEW.date).toBeTruthy();
    expect(reviewLine()).not.toBeNull();
    for (const n of REVIEW_NOTES) expect(cardBySlug(n.card), n.card).toBeDefined();
  });

  it('lists a first-aid kit', () => {
    expect(KIT.items.length).toBeGreaterThan(5);
    expect(KIT.items.join(' ')).toMatch(/opaska uciskowa/i);
  });
});

describe('practice questions', () => {
  it('has a right answer among the options and a card to read', () => {
    expect(QUIZ.length).toBe(10);
    for (const q of QUIZ) {
      expect(q.opts.length, q.q).toBeGreaterThanOrEqual(2);
      expect(q.a, q.q).toBeGreaterThanOrEqual(0);
      expect(q.a, q.q).toBeLessThan(q.opts.length);
      expect(cardBySlug(q.card), q.q).toBeDefined();
      expect(q.why.length, q.q).toBeGreaterThan(10);
    }
  });

  it('does not always put the right answer in the same place', () => {
    expect(new Set(QUIZ.map((q) => q.a)).size).toBeGreaterThan(1);
  });
});

describe('drawings', () => {
  it('draws every picture as a decorative SVG', () => {
    for (const a of AID_ARTS) {
      const svg = aidArt(a);
      expect(svg).toMatch(/^<svg class="aa" viewBox="0 0 120 64" aria-hidden="true"/);
      expect(svg.endsWith('</svg>')).toBe(true);
    }
    expect(aidArt(undefined)).toBe('');
  });
});
