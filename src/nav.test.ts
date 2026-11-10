import { describe, expect, it } from 'vitest';
import { areaOf, hashToView, knowPageOf, knowView, viewToHash, type View } from './nav';
import { nearestState, sheetHeight, PEEK_PX } from './sheet';

describe('areas', () => {
  it('puts every view in one of the five destinations', () => {
    expect(areaOf({ kind: 'tab', tab: 'clubs' })).toBe('map');
    expect(areaOf({ kind: 'tab', tab: 'offline' })).toBe('map');
    expect(areaOf({ kind: 'district', slug: 'x' })).toBe('map');
    expect(areaOf({ kind: 'point', lat: 52, lng: 21 })).toBe('map');
    expect(areaOf({ kind: 'hunt', id: 'abc' })).toBe('hunt');
    expect(areaOf({ kind: 'tab', tab: 'hunt' })).toBe('hunt');
    expect(areaOf({ kind: 'tab', tab: 'weather' })).toBe('weather');
    expect(areaOf({ kind: 'atlas', slug: 'sarna' })).toBe('know');
    expect(areaOf({ kind: 'tab', tab: 'exams' })).toBe('know');
    expect(areaOf({ kind: 'tab', tab: 'about' })).toBe('more');
    expect(areaOf({ kind: 'tab', tab: 'more' })).toBe('more');
  });

  it('knows the pages of "Wiedza"', () => {
    expect(knowPageOf({ kind: 'atlas', slug: null })).toBe('atlas');
    expect(knowPageOf({ kind: 'tab', tab: 'ballistics' })).toBe('ballistics');
    expect(knowPageOf({ kind: 'tab', tab: 'weather' })).toBeNull();
    expect(knowView('atlas')).toEqual({ kind: 'atlas', slug: null });
    expect(knowView('seasons')).toEqual({ kind: 'tab', tab: 'seasons' });
  });
});

describe('addresses', () => {
  const views: View[] = [
    { kind: 'tab', tab: 'clubs' },
    { kind: 'tab', tab: 'districts' },
    { kind: 'tab', tab: 'offline' },
    { kind: 'tab', tab: 'hunt' },
    { kind: 'tab', tab: 'more' },
    { kind: 'tab', tab: 'about' },
    { kind: 'hunt', id: 'h1' },
    { kind: 'hunt', id: 'h1', invite: 'tok' },
    { kind: 'atlas', slug: null },
    { kind: 'atlas', slug: 'dzik' },
    { kind: 'district', slug: '12-mazowieckie' },
    { kind: 'club', key: 'koło łowieckie "bór"' },
  ];
  it('round-trips every view', () => {
    for (const v of views) expect(hashToView(viewToHash(v))).toEqual(v);
  });

  it('keeps links made before the redesign working', () => {
    expect(hashToView('#/polowanie/abc123/inv9')).toEqual({ kind: 'hunt', id: 'abc123', invite: 'inv9' });
    expect(hashToView('#/polowanie')).toEqual({ kind: 'tab', tab: 'hunt' });
    expect(hashToView('#/about')).toEqual({ kind: 'tab', tab: 'about' });
    expect(hashToView('#/seasons')).toEqual({ kind: 'tab', tab: 'seasons' });
    expect(hashToView('#/punkt/52.10000,21.00000')).toEqual({ kind: 'point', lat: 52.1, lng: 21 });
    expect(hashToView('')).toEqual({ kind: 'tab', tab: 'clubs' });
    expect(hashToView('#/nonsense')).toEqual({ kind: 'tab', tab: 'clubs' });
  });

  it('does not throw on a mangled link', () => {
    expect(hashToView('#/kolo/%E0%A4%A')).toEqual({ kind: 'club', key: '%E0%A4%A' });
  });
});

describe('map sheet', () => {
  it('has three heights', () => {
    expect(sheetHeight('peek', 700)).toBe(PEEK_PX);
    expect(sheetHeight('half', 700)).toBe(350);
    expect(sheetHeight('full', 700)).toBe(692);
    expect(sheetHeight('half', 200)).toBe(PEEK_PX);
  });

  it('settles on the nearest height, or follows a flick', () => {
    expect(nearestState(150, 700)).toBe('peek');
    expect(nearestState(330, 700)).toBe('half');
    expect(nearestState(600, 700)).toBe('full');
    expect(nearestState(200, 700, -1)).toBe('half');
    expect(nearestState(400, 700, -1)).toBe('full');
    expect(nearestState(600, 700, 1)).toBe('half');
    expect(nearestState(300, 700, 1)).toBe('peek');
  });
});
