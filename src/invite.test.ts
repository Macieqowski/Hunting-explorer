import { describe, it, expect } from 'vitest';
import { newInviteToken, validToken, inviteExpiry, parseInvites, currentInvite, inviteLink, INVITE_MAX_MS, INVITE_MIN_MS } from './invite';

describe('invite tokens', () => {
  it('are 22 url-safe characters and differ each time', () => {
    const a = newInviteToken();
    const b = newInviteToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(validToken(a)).toBe(true);
    expect(a).not.toBe(b);
  });
  it('use base64url for every byte value', () => {
    const t = newInviteToken((x) => x.fill(255));
    expect(t).toBe('_____________________w');
    expect(validToken(t)).toBe(true);
  });
  it('reject anything that could step into another path', () => {
    for (const t of ['', 'short', 'a/b'.padEnd(22, 'x'), 'a.b'.padEnd(22, 'x'), 'x'.repeat(41), 12345]) expect(validToken(t)).toBe(false);
  });
});

describe('inviteExpiry', () => {
  const h = { date: '2026-12-12', start: '08:00', end: '15:00' };
  it('lasts until the end of the hunt day', () => {
    const now = new Date(2026, 10, 5, 12).getTime();
    expect(inviteExpiry(h, now)).toBe(new Date(2026, 11, 12, 23, 59, 59).getTime());
  });
  it('gives at least a day when the hunt day is over', () => {
    const now = new Date(2026, 11, 13, 9).getTime();
    expect(inviteExpiry(h, now)).toBe(now + INVITE_MIN_MS);
  });
  it('is capped for hunts far ahead', () => {
    const now = new Date(2026, 0, 1).getTime();
    expect(inviteExpiry(h, now)).toBe(now + INVITE_MAX_MS);
  });
});

describe('parseInvites / currentInvite', () => {
  const t1 = 'a'.repeat(22);
  const t2 = 'b'.repeat(22);
  it('skips malformed entries', () => {
    expect(parseInvites({ [t1]: { exp: 5, createdAt: 1 }, bad: { exp: 9 }, [t2]: { exp: 'x' } })).toEqual([{ token: t1, exp: 5, createdAt: 1 }]);
    expect(parseInvites(null)).toEqual([]);
  });
  it('picks the newest unexpired invite', () => {
    const list = parseInvites({ [t1]: { exp: 100, createdAt: 1 }, [t2]: { exp: 50, createdAt: 2 } });
    expect(currentInvite(list, 10)?.token).toBe(t2);
    expect(currentInvite(list, 60)?.token).toBe(t1);
    expect(currentInvite(list, 100)).toBeNull();
  });
});

it('inviteLink puts the token after the hunt id', () => {
  expect(inviteLink('https://x.github.io/app/', '-Nabc', 'T'.repeat(22))).toBe(`https://x.github.io/app/#/polowanie/-Nabc/${'T'.repeat(22)}`);
});
