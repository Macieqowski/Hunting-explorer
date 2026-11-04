// Security rules tests. Run with `npm run test:rules` (starts the Realtime Database
// emulator; needs Java). Not part of `npm test`.

import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { ref, update, get, set, serverTimestamp, type Database } from 'firebase/database';

const PASS = 'test-passphrase';
let env: RulesTestEnvironment;

const db = (uid: string | null) =>
  (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).database() as unknown as Database;

const huntData = (leader: string) => ({
  name: 'Polowanie na dziki',
  date: '2026-12-12',
  start: '08:00',
  end: '15:00',
  place: 'Leśniczówka Borek',
  notes: '',
  leaderUid: leader,
  leaderName: 'Jan Prowadzący',
  status: 'open',
  createdAt: serverTimestamp(),
});

const createHunt = (uid: string, id = 'h1', pass = PASS) =>
  update(ref(db(uid)), {
    [`joins/${id}/${uid}`]: pass,
    [`hunts/${id}`]: huntData(uid),
    [`participants/${id}/${uid}`]: { name: 'Jan Prowadzący', role: 'leader', status: 'confirmed', joinedAt: serverTimestamp() },
    [`userHunts/${uid}/${id}`]: true,
  });

const join = (uid: string, role = 'hunter', pass = PASS, id = 'h1', status = 'registered') =>
  update(ref(db(uid)), {
    [`joins/${id}/${uid}`]: pass,
    [`participants/${id}/${uid}`]: { name: `Osoba ${uid}`, role, status, joinedAt: serverTimestamp() },
    [`userHunts/${uid}/${id}`]: true,
  });

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-hunting',
    database: { rules: readFileSync(new URL('../database.rules.json', import.meta.url), 'utf8') },
  });
});
afterAll(() => env.cleanup());
beforeEach(async () => {
  await env.clearDatabase();
  await env.withSecurityRulesDisabled((ctx) => set(ref(ctx.database() as unknown as Database, 'secret/passphrase'), PASS));
});

describe('passphrase', () => {
  it('cannot be read by anyone', async () => {
    await assertFails(get(ref(db('a'), 'secret/passphrase')));
    await assertFails(get(ref(db(null), 'secret')));
  });
  it('is required to create a hunt', async () => {
    await assertFails(createHunt('lead', 'h1', 'zly'));
    await assertSucceeds(createHunt('lead'));
  });
  it('is required to join', async () => {
    await createHunt('lead');
    await assertFails(join('a', 'hunter', 'zly'));
    await assertSucceeds(join('a', 'hunter'));
  });
  it('joins cannot be read back', async () => {
    await createHunt('lead');
    await assertFails(get(ref(db('lead'), 'joins/h1/lead')));
  });
});

describe('hunts', () => {
  it('need a signed-in user to read', async () => {
    await createHunt('lead');
    await assertFails(get(ref(db(null), 'hunts/h1')));
    await assertSucceeds(get(ref(db('stranger'), 'hunts/h1')));
  });
  it('cannot be listed', async () => {
    await createHunt('lead');
    await assertFails(get(ref(db('stranger'), 'hunts')));
  });
  it('cannot be created for someone else', async () => {
    await assertFails(
      update(ref(db('a')), { 'joins/h1/a': PASS, 'hunts/h1': huntData('b') }),
    );
  });
  it('can only be changed by the leader', async () => {
    await createHunt('lead');
    await join('a');
    await assertFails(update(ref(db('a'), 'hunts/h1'), { status: 'closed' }));
    await assertSucceeds(update(ref(db('lead'), 'hunts/h1'), { status: 'closed' }));
  });
  it('reject bad fields and handing over leadership by rewriting leaderUid', async () => {
    await createHunt('lead');
    await assertFails(update(ref(db('lead'), 'hunts/h1'), { status: 'party' }));
    await assertFails(update(ref(db('lead'), 'hunts/h1'), { start: '25:00' }));
    await assertFails(update(ref(db('lead'), 'hunts/h1'), { leaderUid: 'a' }));
    await assertFails(update(ref(db('lead'), 'hunts/h1'), { extra: 1 }));
  });
  it('can be deleted with all participants by the leader only', async () => {
    await createHunt('lead');
    await join('a');
    await assertFails(update(ref(db('a')), { 'hunts/h1': null, 'participants/h1': null }));
    await assertFails(update(ref(db('lead')), { 'participants/h1': null }));
    await assertSucceeds(update(ref(db('lead')), { 'hunts/h1': null, 'participants/h1': null }));
  });
});

describe('participants', () => {
  beforeEach(() => createHunt('lead'));

  it('are visible only to participants', async () => {
    await assertFails(get(ref(db('stranger'), 'participants/h1')));
    await join('a');
    await assertSucceeds(get(ref(db('a'), 'participants/h1')));
  });
  it('cannot sign up as leader or pre-confirmed', async () => {
    await assertFails(join('a', 'leader'));
    await assertFails(join('a', 'hunter', PASS, 'h1', 'confirmed'));
    await assertSucceeds(join('a', 'beater'));
  });
  it('cannot sign up when registration is closed', async () => {
    await update(ref(db('lead'), 'hunts/h1'), { status: 'closed' });
    await assertFails(join('a'));
  });
  it('cannot sign up to a hunt that does not exist', async () => {
    await assertFails(join('a', 'hunter', PASS, 'nope'));
  });
  it('cannot sign up someone else', async () => {
    await assertFails(
      update(ref(db('a')), { 'joins/h1/a': PASS, 'participants/h1/b': { name: 'Ktoś', role: 'hunter', status: 'registered', joinedAt: serverTimestamp() } }),
    );
  });
  it('can rename themselves but not change role or confirm themselves', async () => {
    await join('a');
    await assertSucceeds(update(ref(db('a'), 'participants/h1/a'), { name: 'Nowe Imię' }));
    await assertFails(update(ref(db('a'), 'participants/h1/a'), { role: 'beater' }));
    await assertFails(update(ref(db('a'), 'participants/h1/a'), { status: 'confirmed' }));
  });
  it('can withdraw, but the leader cannot', async () => {
    await join('a');
    await assertSucceeds(update(ref(db('a')), { 'participants/h1/a': null, 'joins/h1/a': null, 'userHunts/a/h1': null }));
    await assertFails(update(ref(db('lead')), { 'participants/h1/lead': null }));
  });
  it('are managed by the leader: confirm, change role, remove', async () => {
    await join('a');
    await join('b', 'beater');
    await assertSucceeds(update(ref(db('lead'), 'participants/h1/a'), { status: 'confirmed' }));
    await assertSucceeds(update(ref(db('lead'), 'participants/h1/b'), { role: 'hunter' }));
    await assertFails(update(ref(db('lead'), 'participants/h1/b'), { role: 'leader' }));
    await assertFails(update(ref(db('lead'), 'participants/h1/b'), { name: 'Zmienione' }));
    await assertSucceeds(update(ref(db('lead')), { 'participants/h1/b': null }));
  });
  it('cannot manage each other', async () => {
    await join('a');
    await join('b');
    await assertFails(update(ref(db('a'), 'participants/h1/b'), { status: 'confirmed' }));
    await assertFails(update(ref(db('a')), { 'participants/h1/b': null }));
  });
});

describe('userHunts', () => {
  it('are private to each user', async () => {
    await createHunt('lead');
    await assertSucceeds(get(ref(db('lead'), 'userHunts/lead')));
    await assertFails(get(ref(db('a'), 'userHunts/lead')));
    await assertFails(set(ref(db('a'), 'userHunts/lead/h2'), true));
  });
});

describe('hunt district and end time', () => {
  beforeEach(() => createHunt('lead'));
  it('accepts a district and rejects extra fields in it', async () => {
    await assertSucceeds(update(ref(db('lead'), 'hunts/h1'), { district: { id: 123, slug: '14-123', label: 'Obwód nr 123' } }));
    await assertFails(update(ref(db('lead'), 'hunts/h1'), { district: { id: 123, slug: '14-123', label: 'x', extra: 1 } }));
    await assertFails(update(ref(db('lead'), 'hunts/h1'), { district: { id: 'x', slug: '14-123', label: 'x' } }));
  });
  it('records endedAt only together with ending the hunt', async () => {
    await assertFails(update(ref(db('lead'), 'hunts/h1'), { endedAt: serverTimestamp() }));
    await assertSucceeds(update(ref(db('lead'), 'hunts/h1'), { status: 'ended', endedAt: serverTimestamp() }));
    await assertSucceeds(update(ref(db('lead'), 'hunts/h1'), { status: 'live', endedAt: null }));
  });
});

describe('positions and tracks', () => {
  const pos = (role = 'hunter') => ({ lat: 52.1, lng: 21.2, acc: 8, ts: serverTimestamp(), role });
  const share = (uid: string, role = 'hunter', p = 'p1') =>
    update(ref(db(uid)), { [`positions/h1/${uid}`]: pos(role), [`tracks/h1/${uid}/${p}`]: { lat: 52.1, lng: 21.2, ts: serverTimestamp() } });

  beforeEach(async () => {
    await createHunt('lead');
    await join('a');
    await join('b', 'beater');
    await join('c');
    await update(ref(db('lead'), 'participants/h1/a'), { status: 'confirmed' });
    await update(ref(db('lead'), 'participants/h1/b'), { status: 'confirmed' });
  });

  it('can only be shared while the hunt is live', async () => {
    await assertFails(share('a'));
    await update(ref(db('lead'), 'hunts/h1'), { status: 'live' });
    await assertSucceeds(share('a'));
    await update(ref(db('lead'), 'hunts/h1'), { status: 'ended', endedAt: serverTimestamp() });
    await assertFails(share('a', 'hunter', 'p2'));
  });
  it('need a confirmed participant, their own slot and their real role', async () => {
    await update(ref(db('lead'), 'hunts/h1'), { status: 'live' });
    await assertFails(share('c')); // not confirmed
    await assertFails(set(ref(db('a'), 'positions/h1/b'), pos('beater')));
    await assertFails(set(ref(db('a'), 'positions/h1/a'), pos('leader')));
    await assertFails(set(ref(db('a'), 'positions/h1/a'), { ...pos(), lat: 123 }));
    await assertSucceeds(share('b', 'beater'));
    await assertSucceeds(share('lead', 'leader'));
  });
  it('track points cannot be rewritten', async () => {
    await update(ref(db('lead'), 'hunts/h1'), { status: 'live' });
    await share('a');
    await assertFails(set(ref(db('a'), 'tracks/h1/a/p1'), { lat: 50, lng: 20, ts: serverTimestamp() }));
  });
  it('are visible to confirmed participants only', async () => {
    await update(ref(db('lead'), 'hunts/h1'), { status: 'live' });
    await share('a');
    await assertSucceeds(get(ref(db('b'), 'positions/h1')));
    await assertSucceeds(get(ref(db('lead'), 'tracks/h1')));
    await assertFails(get(ref(db('c'), 'positions/h1')));
    await assertFails(get(ref(db('stranger'), 'tracks/h1')));
  });
  it('can be stopped by the owner and cleared by the leader', async () => {
    await update(ref(db('lead'), 'hunts/h1'), { status: 'live' });
    await share('a');
    await share('b', 'beater');
    await assertSucceeds(set(ref(db('a'), 'positions/h1/a'), null));
    await assertFails(set(ref(db('a'), 'positions/h1/b'), null));
    await assertFails(set(ref(db('a'), 'tracks/h1'), null));
    await assertSucceeds(update(ref(db('lead')), { 'positions/h1': null, 'tracks/h1': null }));
  });
  it('are deleted together with the hunt', async () => {
    await update(ref(db('lead'), 'hunts/h1'), { status: 'live' });
    await share('a');
    await assertSucceeds(update(ref(db('lead')), { 'hunts/h1': null, 'participants/h1': null, 'positions/h1': null, 'tracks/h1': null }));
  });
});
