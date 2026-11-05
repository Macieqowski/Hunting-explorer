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

describe('drives', () => {
  const plan = { name: 'Miot 1', start: '08:30', end: '09:30', area: '52.1,21.1;52.2,21.1;52.2,21.2' };
  beforeEach(async () => {
    await createHunt('lead');
    await join('a', 'beater');
    await join('c');
    await update(ref(db('lead'), 'participants/h1/a'), { status: 'confirmed' });
  });
  it('are planned by the leader only', async () => {
    await assertSucceeds(set(ref(db('lead'), 'drives/h1/d1'), plan));
    await assertFails(set(ref(db('a'), 'drives/h1/d2'), plan));
    await assertFails(update(ref(db('a'), 'drives/h1/d1'), { name: 'Mój miot' }));
    await assertSucceeds(update(ref(db('lead'), 'drives/h1/d1'), { name: 'Miot pod Borkiem', end: '10:00' }));
  });
  it('need a name, times and an area of at least three corners', async () => {
    await assertFails(set(ref(db('lead'), 'drives/h1/d1'), { ...plan, name: '' }));
    await assertFails(set(ref(db('lead'), 'drives/h1/d1'), { ...plan, start: '8:30' }));
    await assertFails(set(ref(db('lead'), 'drives/h1/d1'), { ...plan, area: '52.1,21.1;52.2,21.1' }));
    await assertFails(set(ref(db('lead'), 'drives/h1/d1'), { ...plan, area: 'x' }));
    await assertFails(set(ref(db('lead'), 'drives/h1/d1'), { ...plan, extra: 1 }));
    await assertFails(set(ref(db('lead'), 'drives/h1/d1'), { name: 'Miot 1', start: '08:30', end: '09:30' }));
  });
  it('are started and ended with the server time', async () => {
    await set(ref(db('lead'), 'drives/h1/d1'), plan);
    await set(ref(db('lead'), 'drives/h1/d2'), { ...plan, name: 'Miot 2' });
    await assertFails(update(ref(db('lead'), 'drives/h1/d1'), { startedAt: 12345 }));
    await assertFails(update(ref(db('lead'), 'drives/h1/d1'), { endedAt: serverTimestamp() })); // not started
    await assertSucceeds(update(ref(db('lead'), 'drives/h1/d1'), { startedAt: serverTimestamp() }));
    await assertFails(update(ref(db('a'), 'drives/h1/d1'), { endedAt: serverTimestamp() }));
    // Starting the next drive ends the running one in the same write.
    await assertSucceeds(update(ref(db('lead')), { 'drives/h1/d1/endedAt': serverTimestamp(), 'drives/h1/d2/startedAt': serverTimestamp(), 'drives/h1/d2/endedAt': null }));
    await assertSucceeds(update(ref(db('lead'), 'drives/h1/d1'), { name: 'Miot 1a' })); // times are kept
  });
  it('are visible to confirmed participants only', async () => {
    await set(ref(db('lead'), 'drives/h1/d1'), plan);
    await assertSucceeds(get(ref(db('a'), 'drives/h1')));
    await assertFails(get(ref(db('c'), 'drives/h1')));
    await assertFails(get(ref(db('stranger'), 'drives/h1')));
  });
  it('are deleted by the leader, also together with the hunt', async () => {
    await set(ref(db('lead'), 'drives/h1/d1'), plan);
    await set(ref(db('lead'), 'drives/h1/d2'), plan);
    await assertFails(set(ref(db('a'), 'drives/h1/d1'), null));
    await assertSucceeds(set(ref(db('lead'), 'drives/h1/d1'), null));
    await assertSucceeds(update(ref(db('lead')), { 'hunts/h1': null, 'participants/h1': null, 'drives/h1': null }));
  });
});

describe('stands', () => {
  const stands = { s000: { n: '1', k: 'zwyzka', lat: 52.1, lng: 21.1 }, s001: { n: 'Ambona', k: 'ambona', lat: 52.2, lng: 21.2, b: true } };
  beforeEach(async () => {
    await createHunt('lead');
    await join('a', 'beater');
    await join('c');
    await update(ref(db('lead'), 'participants/h1/a'), { status: 'confirmed' });
  });
  it('are loaded and replaced by the leader only', async () => {
    await assertSucceeds(set(ref(db('lead'), 'stands/h1'), stands));
    await assertFails(set(ref(db('a'), 'stands/h1'), stands));
    await assertFails(set(ref(db('a'), 'stands/h1/s002'), stands.s000));
    await assertSucceeds(set(ref(db('lead'), 'stands/h1'), { s000: stands.s000 }));
  });
  it('need a name, a known kind and coordinates', async () => {
    await assertFails(set(ref(db('lead'), 'stands/h1'), { s000: { ...stands.s000, n: '' } }));
    await assertFails(set(ref(db('lead'), 'stands/h1'), { s000: { ...stands.s000, n: 'x'.repeat(41) } }));
    await assertFails(set(ref(db('lead'), 'stands/h1'), { s000: { ...stands.s000, k: 'bunkier' } }));
    await assertFails(set(ref(db('lead'), 'stands/h1'), { s000: { ...stands.s000, lat: 91 } }));
    await assertFails(set(ref(db('lead'), 'stands/h1'), { s000: { n: '1', k: 'zwyzka', lat: 52 } }));
    await assertFails(set(ref(db('lead'), 'stands/h1'), { s000: { ...stands.s000, note: 'x' } }));
    await assertFails(set(ref(db('lead'), 'stands/h1'), { other: stands.s000 }));
  });
  it('are visible to confirmed participants only', async () => {
    await set(ref(db('lead'), 'stands/h1'), stands);
    await assertSucceeds(get(ref(db('a'), 'stands/h1')));
    await assertFails(get(ref(db('c'), 'stands/h1')));
    await assertFails(get(ref(db('stranger'), 'stands/h1')));
  });
  it('are deleted by the leader, also together with the hunt', async () => {
    await set(ref(db('lead'), 'stands/h1'), stands);
    await assertFails(set(ref(db('a'), 'stands/h1'), null));
    await assertSucceeds(set(ref(db('lead'), 'stands/h1'), null));
    await set(ref(db('lead'), 'stands/h1'), stands);
    await assertSucceeds(update(ref(db('lead')), { 'hunts/h1': null, 'participants/h1': null, 'stands/h1': null }));
  });
});

describe('sightings', () => {
  const sight = (uid: string, extra: Record<string, unknown> = {}) => ({
    uid,
    species: 'boar',
    count: '3-6',
    lat: 52.1,
    lng: 21.1,
    heading: 42,
    src: 'compass',
    ts: serverTimestamp(),
    ...extra,
  });
  beforeEach(async () => {
    await createHunt('lead');
    await join('a', 'beater');
    await join('b');
    await join('c');
    await update(ref(db('lead'), 'participants/h1/a'), { status: 'confirmed' });
    await update(ref(db('lead'), 'participants/h1/b'), { status: 'confirmed' });
  });
  it('can be reported by confirmed participants only while the hunt is live', async () => {
    await assertFails(set(ref(db('a'), 'sightings/h1/s1'), sight('a')));
    await update(ref(db('lead'), 'hunts/h1'), { status: 'live' });
    await assertSucceeds(set(ref(db('a'), 'sightings/h1/s1'), sight('a', { driveId: 'd1' })));
    await assertSucceeds(set(ref(db('b'), 'sightings/h1/s2'), sight('b'))); // hunters too
    await assertFails(set(ref(db('c'), 'sightings/h1/s3'), sight('c'))); // not confirmed
    await assertFails(set(ref(db('a'), 'sightings/h1/s4'), sight('b'))); // in someone else's name
  });
  it('are checked: species, count, heading, server time', async () => {
    await update(ref(db('lead'), 'hunts/h1'), { status: 'live' });
    await assertFails(set(ref(db('a'), 'sightings/h1/x'), sight('a', { species: 'bear' })));
    await assertFails(set(ref(db('a'), 'sightings/h1/x'), sight('a', { count: '10' })));
    await assertFails(set(ref(db('a'), 'sightings/h1/x'), sight('a', { heading: 360 })));
    await assertFails(set(ref(db('a'), 'sightings/h1/x'), sight('a', { ts: 5 })));
    await assertFails(set(ref(db('a'), 'sightings/h1/x'), sight('a', { note: 'x' })));
    await assertSucceeds(set(ref(db('a'), 'sightings/h1/x'), sight('a', { count: '6+', heading: 359.5, src: 'buttons' })));
  });
  it('cannot be changed, only deleted by the author or the leader', async () => {
    await update(ref(db('lead'), 'hunts/h1'), { status: 'live' });
    await set(ref(db('a'), 'sightings/h1/s1'), sight('a'));
    await set(ref(db('a'), 'sightings/h1/s2'), sight('a'));
    await assertFails(update(ref(db('a'), 'sightings/h1/s1'), { heading: 90 }));
    await assertFails(set(ref(db('b'), 'sightings/h1/s1'), null));
    await assertSucceeds(set(ref(db('a'), 'sightings/h1/s1'), null));
    await assertSucceeds(set(ref(db('lead'), 'sightings/h1/s2'), null));
  });
  it('are visible to confirmed participants only and purged by the leader', async () => {
    await update(ref(db('lead'), 'hunts/h1'), { status: 'live' });
    await set(ref(db('a'), 'sightings/h1/s1'), sight('a'));
    await assertSucceeds(get(ref(db('b'), 'sightings/h1')));
    await assertFails(get(ref(db('c'), 'sightings/h1')));
    await assertFails(set(ref(db('a'), 'sightings/h1'), null));
    await assertSucceeds(update(ref(db('lead')), { 'positions/h1': null, 'tracks/h1': null, 'sightings/h1': null }));
  });
});

describe('shots (pokot)', () => {
  const shot = (uid: string, extra: Record<string, unknown> = {}) => ({ uid, outcome: 'unknown', ts: serverTimestamp(), ...extra });
  const fire = (who: string, id: string, extra: Record<string, unknown> = {}) =>
    update(ref(db(who)), { [`shots/h1/${id}`]: shot(who, extra), [`shotSpots/h1/${id}`]: { lat: 52.1, lng: 21.1 } });
  const live = () => update(ref(db('lead'), 'hunts/h1'), { status: 'live' });
  const end = () => update(ref(db('lead'), 'hunts/h1'), { status: 'ended', endedAt: serverTimestamp() });
  beforeEach(async () => {
    await createHunt('lead');
    await join('a'); // hunter
    await join('b'); // hunter
    await join('c', 'beater');
    await join('d'); // hunter, not confirmed
    for (const u of ['a', 'b', 'c']) await update(ref(db('lead'), `participants/h1/${u}`), { status: 'confirmed' });
  });
  it('are logged by confirmed hunters and the leader, only while the hunt is live', async () => {
    await assertFails(fire('a', 's1'));
    await live();
    await assertSucceeds(fire('a', 's1', { driveId: 'd1' }));
    await assertSucceeds(fire('lead', 's2'));
    await assertFails(fire('c', 's3')); // beater
    await assertFails(fire('d', 's4')); // not confirmed
    await assertFails(update(ref(db('a')), { 'shots/h1/s5': shot('b') })); // in someone else's name
    await assertFails(update(ref(db('a')), { 'shotSpots/h1/s6': { lat: 1, lng: 1 } })); // a spot with no shot
  });
  it('are checked: outcome, game, note, server time', async () => {
    await live();
    await assertFails(fire('a', 'x', { outcome: 'hit' }));
    await assertFails(fire('a', 'x', { game: 'bear' }));
    await assertFails(fire('a', 'x', { note: 'x'.repeat(121) }));
    await assertFails(fire('a', 'x', { ts: 5 }));
    await assertFails(fire('a', 'x', { lat: 1 }));
    await assertSucceeds(fire('a', 'x', { outcome: 'kill', game: 'boar_sow', note: 'przy paśniku' }));
  });
  it('the shooter sets the outcome and can undo, but cannot move or reassign the shot', async () => {
    await live();
    await fire('a', 's1', { driveId: 'd1' });
    await fire('a', 's2');
    await assertSucceeds(update(ref(db('a'), 'shots/h1/s1'), { outcome: 'kill', game: 'fox' }));
    await assertFails(update(ref(db('a'), 'shots/h1/s1'), { driveId: 'd2' }));
    await assertFails(update(ref(db('a'), 'shots/h1/s1'), { uid: 'b' }));
    await assertFails(update(ref(db('a'), 'shots/h1/s1'), { ts: 1 }));
    await assertFails(update(ref(db('b'), 'shots/h1/s1'), { outcome: 'miss' }));
    await assertFails(update(ref(db('b')), { 'shots/h1/s2': null, 'shotSpots/h1/s2': null }));
    await assertSucceeds(update(ref(db('a')), { 'shots/h1/s2': null, 'shotSpots/h1/s2': null }));
    await end();
    await assertSucceeds(update(ref(db('a'), 'shots/h1/s1'), { outcome: 'wound' })); // still fixable after the hunt
    await assertFails(fire('a', 's3')); // but no new shots
  });
  it('the leader corrects anything, adds game and assigns it to hunters or to nobody', async () => {
    await live();
    await fire('a', 's1', { driveId: 'd1' });
    await end();
    await assertSucceeds(update(ref(db('lead'), 'shots/h1/s1'), { uid: 'b', driveId: 'd2', outcome: 'kill', game: 'fox' }));
    await assertSucceeds(set(ref(db('lead'), 'shots/h1/n1'), { uid: '-', outcome: 'kill', game: 'hare', ts: serverTimestamp() }));
    await assertSucceeds(set(ref(db('lead'), 'shots/h1/n2'), { uid: 'a', outcome: 'kill', game: 'fox', ts: serverTimestamp() }));
    await assertFails(set(ref(db('lead'), 'shots/h1/n3'), { uid: 'c', outcome: 'kill', ts: serverTimestamp() })); // a beater
    await assertFails(set(ref(db('lead'), 'shots/h1/n4'), { uid: 'zz', outcome: 'kill', ts: serverTimestamp() })); // not in the hunt
    await assertSucceeds(update(ref(db('lead')), { 'shots/h1/n2': null, 'shotSpots/h1/n2': null })); // as the app deletes
    await assertSucceeds(update(ref(db('b')), { 'shots/h1/s1': null, 'shotSpots/h1/s1': null })); // now b's shot
  });
  it('are frozen once the leader locks the pokot, until unlocked', async () => {
    await live();
    await fire('a', 's1');
    await assertFails(update(ref(db('lead'), 'hunts/h1'), { pokotLockedAt: serverTimestamp() })); // only after the end
    await end();
    await assertFails(update(ref(db('a'), 'hunts/h1'), { pokotLockedAt: serverTimestamp() }));
    await assertFails(update(ref(db('lead'), 'hunts/h1'), { pokotLockedAt: 5 }));
    await assertSucceeds(update(ref(db('lead'), 'hunts/h1'), { pokotLockedAt: serverTimestamp(), pokotTitles: true }));
    await assertFails(update(ref(db('a'), 'shots/h1/s1'), { outcome: 'miss' }));
    await assertFails(update(ref(db('lead'), 'shots/h1/s1'), { outcome: 'miss' }));
    await assertFails(set(ref(db('lead'), 'shots/h1/n1'), { uid: '-', outcome: 'kill', ts: serverTimestamp() }));
    await assertSucceeds(update(ref(db('lead'), 'hunts/h1'), { pokotLockedAt: null }));
    await assertSucceeds(update(ref(db('lead'), 'shots/h1/s1'), { outcome: 'miss' }));
  });
  it('are visible to confirmed participants; spots are purged by the leader, shots stay', async () => {
    await live();
    await fire('a', 's1');
    await assertSucceeds(get(ref(db('c'), 'shots/h1')));
    await assertSucceeds(get(ref(db('c'), 'shotSpots/h1')));
    await assertFails(get(ref(db('d'), 'shots/h1')));
    await assertFails(get(ref(db('d'), 'shotSpots/h1')));
    await end();
    await update(ref(db('lead'), 'hunts/h1'), { pokotLockedAt: serverTimestamp() });
    await assertFails(set(ref(db('a'), 'shotSpots/h1'), null));
    await assertSucceeds(update(ref(db('lead')), { 'positions/h1': null, 'tracks/h1': null, 'sightings/h1': null, 'shotSpots/h1': null }));
    await assertSucceeds(update(ref(db('lead')), { 'hunts/h1': null, 'participants/h1': null, 'shots/h1': null }));
  });
});
