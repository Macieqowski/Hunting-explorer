// Firebase (Auth + Realtime Database) implementation of HuntBackend.
// Data layout and who may write what are defined in database.rules.json.

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, connectAuthEmulator } from 'firebase/auth';
import { getDatabase, ref, child, push, get, set, update, onValue, serverTimestamp, connectDatabaseEmulator } from 'firebase/database';
import { isLeader, parseHunt, parseParticipants, parsePositions, parseTracks, parseDrives, parseSightings, encodeArea, roundCoord, shouldPurge, cleanText, cleanNotes, LIMITS, DRIVE_LIMITS, type Hunt, type HuntInput } from './hunt';
import { parseShots, parseShotSpots, NOTE_MAX, type ShotInput } from './pokot';
import { parseStands, encodeStands } from './stands';
import { newInviteToken, inviteExpiry, parseInvites, PAIR_MS } from './invite';
import { HuntError, type FirebaseConfig, type HuntBackend } from './huntBackend';
import { encodePt, encodeRoute, parseAllRoutes, parseSeats, parsePhones, parseTransport, parseMessages, parseAcks, parseCarcassMarks, cleanPhone, cleanSeat, cleanMessage, CARCASS_KINDS, CREW_LIMITS } from './huntCrew';

function wrap(e: unknown): HuntError {
  const msg = String((e as Error)?.message ?? e);
  if (/permission.denied/i.test(msg)) return new HuntError('denied', msg);
  if (/network|offline|unavailable/i.test(msg)) return new HuntError('offline', msg);
  return new HuntError('unknown', msg);
}

const guard = async <T>(p: Promise<T>): Promise<T> => {
  try {
    return await p;
  } catch (e) {
    throw wrap(e);
  }
};

function cleanInput(i: Partial<HuntInput>): Partial<HuntInput> {
  const out: Partial<HuntInput> = {};
  if (i.name !== undefined) out.name = cleanText(i.name, LIMITS.huntName);
  if (i.date !== undefined) out.date = i.date;
  if (i.start !== undefined) out.start = i.start;
  if (i.end !== undefined) out.end = i.end;
  if (i.place !== undefined) out.place = cleanText(i.place, LIMITS.place);
  if (i.notes !== undefined) out.notes = cleanNotes(i.notes);
  if (i.district !== undefined)
    out.district = i.district && { id: i.district.id, slug: i.district.slug.slice(0, 40), label: cleanText(i.district.label, LIMITS.districtLabel) };
  return out;
}

function shotRecord(uid: string, s: ShotInput & { driveId: string | null }): Record<string, unknown> {
  const rec: Record<string, unknown> = { uid, outcome: s.outcome, ts: serverTimestamp() };
  if (s.game) rec.game = s.game;
  const note = cleanText(s.note, NOTE_MAX);
  if (note) rec.note = note;
  if (s.driveId) rec.driveId = s.driveId;
  return rec;
}

export async function connect(cfg: FirebaseConfig): Promise<HuntBackend> {
  const app = initializeApp(cfg);
  const auth = getAuth(app);
  const db = getDatabase(app);
  const emu = import.meta.env.VITE_FIREBASE_EMULATOR;
  if (emu) {
    connectAuthEmulator(auth, `http://${emu}:9099`, { disableWarnings: true });
    connectDatabaseEmulator(db, emu, 9000);
  }
  await auth.authStateReady();
  const user = auth.currentUser ?? (await guard(signInAnonymously(auth))).user;
  const uid = user.uid;
  const root = ref(db);
  let offset = 0;
  onValue(ref(db, '.info/serverTimeOffset'), (s) => (offset = Number(s.val()) || 0));
  // Locations and personal data go RETENTION_MS after the end; the plan (drives, routes, stands) stays with the hunt.
  const purge = (id: string) =>
    update(root, {
      [`positions/${id}`]: null,
      [`tracks/${id}`]: null,
      [`sightings/${id}`]: null,
      [`shotSpots/${id}`]: null,
      [`phones/${id}`]: null,
      [`messages/${id}`]: null,
      [`msgAcks/${id}`]: null,
      [`carcasses/${id}`]: null,
    });
  const watch = <T>(path: string, parse: (v: unknown) => T, cb: (v: T) => void, onDenied: () => void) =>
    onValue(
      child(root, path),
      (s) => cb(parse(s.val())),
      () => onDenied(),
    );
  const val = (path: string) => get(child(root, path)).then((s) => s.val() as unknown, () => null);
  const obj = (v: unknown) => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});

  /** This (leader) device becomes the leader in the field; see HuntBackend.takeField. */
  async function takeField(id: string) {
    const h = parseHunt(id, await guard(get(child(root, `hunts/${id}`)).then((s) => s.val())));
    if (!h) throw new HuntError('unknown', 'no such hunt');
    const old = h.leaderUid;
    if (old === uid) return;
    const ps = parseParticipants(await guard(get(child(root, `participants/${id}`)).then((s) => s.val())));
    const oldRow = ps.find((p) => p.uid === old);
    const mine = ps.find((p) => p.uid === uid);
    await guard(
      update(root, {
        [`hunts/${id}/leaderUid`]: uid,
        [`participants/${id}/${uid}`]: { name: oldRow?.name ?? h.leaderName, role: 'leader', status: 'confirmed', joinedAt: mine ? mine.joinedAt : serverTimestamp() },
        ...(oldRow && oldRow.role === 'leader' ? { [`participants/${id}/${old}`]: null, [`positions/${id}/${old}`]: null } : {}),
        [`userHunts/${uid}/${id}`]: true,
      }),
    );
    // What hangs on the leader's uid moves along: phone number, stands, transport, shots.
    const [phones, seats, shots, transport] = await Promise.all(['phones', 'seats', 'shots', 'transport'].map((k) => val(`${k}/${id}`)));
    const upd: Record<string, unknown> = {};
    const ph = obj(phones);
    if (typeof ph[old] === 'string') {
      if (!ph[uid]) upd[`phones/${id}/${uid}`] = ph[old];
      upd[`phones/${id}/${old}`] = null;
    }
    for (const [d, m] of Object.entries(obj(seats))) {
      const mm = obj(m);
      if (typeof mm[old] !== 'string') continue;
      if (!mm[uid]) upd[`seats/${id}/${d}/${uid}`] = mm[old];
      upd[`seats/${id}/${d}/${old}`] = null;
    }
    for (const k of CARCASS_KINDS) if (obj(obj(transport)[k]).uid === old) upd[`transport/${id}/${k}/uid`] = uid;
    if (h.pokotLockedAt == null && (h.status === 'live' || h.status === 'ended'))
      for (const [sid, v] of Object.entries(obj(shots))) if (obj(v).uid === old) upd[`shots/${id}/${sid}/uid`] = uid;
    if (Object.keys(upd).length) await guard(update(root, upd));
  }

  const phoneRec = (id: string, phone: string | null | undefined) => {
    const p = phone ? cleanPhone(phone) : null;
    return p ? { [`phones/${id}/${uid}`]: p } : {};
  };

  return {
    uid,

    async createHunt(input, leaderName, passphrase) {
      const id = push(child(root, 'hunts')).key!;
      const name = cleanText(leaderName, LIMITS.name);
      await guard(
        update(root, {
          [`joins/${id}/${uid}`]: passphrase.trim(),
          [`club/members/${uid}`]: passphrase.trim(),
          [`hunts/${id}`]: { ...cleanInput(input), leaderUid: uid, leaderName: name, status: 'open', createdAt: serverTimestamp() },
          [`participants/${id}/${uid}`]: { name, role: 'leader', status: 'confirmed', joinedAt: serverTimestamp() },
          [`userHunts/${uid}/${id}`]: true,
          [`invites/${id}/${newInviteToken()}`]: { exp: inviteExpiry(input, Date.now() + offset), createdAt: serverTimestamp() },
        }),
      );
      return id;
    },

    updateHunt: (id, patch) =>
      guard(
        update(child(root, `hunts/${id}`), {
          ...cleanInput(patch),
          ...(patch.status ? { status: patch.status, endedAt: patch.status === 'ended' ? serverTimestamp() : null } : {}),
          // Reopening the hunt unlocks the pokot, so shots can be logged again.
          ...(patch.status && patch.status !== 'ended' ? { pokotLockedAt: null } : {}),
        }),
      ),

    deleteHunt: (id) =>
      guard(
        update(root, {
          [`hunts/${id}`]: null,
          [`participants/${id}`]: null,
          [`positions/${id}`]: null,
          [`tracks/${id}`]: null,
          [`drives/${id}`]: null,
          [`stands/${id}`]: null,
          [`sightings/${id}`]: null,
          [`shots/${id}`]: null,
          [`shotSpots/${id}`]: null,
          [`routes/${id}`]: null,
          [`seats/${id}`]: null,
          [`phones/${id}`]: null,
          [`transport/${id}`]: null,
          [`messages/${id}`]: null,
          [`msgAcks/${id}`]: null,
          [`carcasses/${id}`]: null,
          [`joins/${id}/${uid}`]: null,
          [`invites/${id}`]: null,
          [`leaderPair/${id}`]: null,
          [`leaderPairJoins/${id}`]: null,
          // Other people's "my hunts" entries are cleaned up by their own browsers (see myHunts).
          [`userHunts/${uid}/${id}`]: null,
        }),
      ),

    watchHunt(id, cb, onError) {
      return onValue(
        child(root, `hunts/${id}`),
        (s) => cb(parseHunt(id, s.val())),
        (e) => onError(wrap(e)),
      );
    },

    watchParticipants(id, cb, onDenied) {
      return onValue(
        child(root, `participants/${id}`),
        (s) => cb(parseParticipants(s.val())),
        () => onDenied(),
      );
    },

    join: (id, name, role, passphrase, phone) =>
      guard(
        update(root, {
          [`joins/${id}/${uid}`]: passphrase.trim(),
          [`club/members/${uid}`]: passphrase.trim(),
          [`participants/${id}/${uid}`]: { name: cleanText(name, LIMITS.name), role, status: 'registered', joinedAt: serverTimestamp() },
          [`userHunts/${uid}/${id}`]: true,
          ...phoneRec(id, phone),
        }),
      ),

    joinByInvite: (id, name, role, token, phone) =>
      guard(
        update(root, {
          [`inviteJoins/${id}/${uid}`]: token,
          [`participants/${id}/${uid}`]: { name: cleanText(name, LIMITS.name), role, status: 'registered', joinedAt: serverTimestamp() },
          [`userHunts/${uid}/${id}`]: true,
          ...phoneRec(id, phone),
        }),
      ),

    watchInvites(id, cb, onDenied) {
      return onValue(
        child(root, `invites/${id}`),
        (s) => cb(parseInvites(s.val())),
        () => onDenied(),
      );
    },

    async newInvite(id, exp) {
      const token = newInviteToken();
      await guard(set(child(root, `invites/${id}`), { [token]: { exp, createdAt: serverTimestamp() } }));
      return token;
    },

    revokeInvites: (id) => guard(set(child(root, `invites/${id}`), null)),

    async newLeaderCode(id) {
      const token = newInviteToken();
      const exp = Date.now() + offset + PAIR_MS;
      await guard(update(root, { [`hunts/${id}/leaders/${uid}`]: 'device', [`leaderPair/${id}`]: { [token]: { exp, createdAt: serverTimestamp() } } }));
      return { token, exp };
    },

    cancelLeaderCode: (id) => guard(update(root, { [`leaderPair/${id}`]: null })),

    async pairLeader(id, token) {
      await guard(
        update(root, {
          [`leaderPairJoins/${id}/${uid}`]: token,
          [`hunts/${id}/leaders/${uid}`]: 'device',
          [`leaderPair/${id}/${token}`]: null,
          [`userHunts/${uid}/${id}`]: true,
        }),
      );
      await takeField(id);
    },

    takeField,

    async handOver(id, to, stayDeputy) {
      const h = parseHunt(id, await guard(get(child(root, `hunts/${id}`)).then((s) => s.val())));
      if (!h) throw new HuntError('unknown', 'no such hunt');
      const ps = parseParticipants(await guard(get(child(root, `participants/${id}`)).then((s) => s.val())));
      const next = ps.find((p) => p.uid === to);
      if (!next || next.status !== 'confirmed' || next.role === 'leader' || to === h.leaderUid) throw new HuntError('unknown', 'not a confirmed participant');
      const old = h.leaderUid;
      const oldRow = ps.find((p) => p.uid === old && p.role === 'leader');
      const upd: Record<string, unknown> = {
        [`hunts/${id}/leaderUid`]: to,
        [`hunts/${id}/leaderName`]: next.name,
        [`participants/${id}/${to}/role`]: 'leader',
        // Pairing codes belong to the old leader's devices.
        [`leaderPair/${id}`]: null,
        [`leaderPairJoins/${id}`]: null,
      };
      for (const [u, k] of Object.entries(h.leaders)) if (k === 'device' || u === to) upd[`hunts/${id}/leaders/${u}`] = null;
      if (oldRow) {
        upd[`participants/${id}/${old}/role`] = 'hunter';
        if (stayDeputy) upd[`hunts/${id}/leaders/${old}`] = 'deputy';
      }
      await guard(update(root, upd));
    },

    setDeputy: (id, who, on) => guard(update(root, { [`hunts/${id}/leaders/${who}`]: on ? 'deputy' : null })),

    removeLeader: (id, who) => guard(update(root, { [`hunts/${id}/leaders/${who}`]: null })),

    rename: (id, name) => guard(update(child(root, `participants/${id}/${uid}`), { name: cleanText(name, LIMITS.name) })),

    withdraw: async (id) =>
      guard(
        update(root, {
          // A deputy steps down too (a plain participant may not touch the hunt record).
          ...((await val(`hunts/${id}/leaders/${uid}`)) ? { [`hunts/${id}/leaders/${uid}`]: null } : {}),
          [`participants/${id}/${uid}`]: null,
          [`positions/${id}/${uid}`]: null,
          [`tracks/${id}/${uid}`]: null,
          [`joins/${id}/${uid}`]: null,
          [`inviteJoins/${id}/${uid}`]: null,
          [`phones/${id}/${uid}`]: null,
          [`userHunts/${uid}/${id}`]: null,
        }),
      ),

    setParticipant: (id, who, patch) => guard(update(child(root, `participants/${id}/${who}`), patch)),

    removeParticipant: (id, who) =>
      guard(update(root, { [`participants/${id}/${who}`]: null, [`hunts/${id}/leaders/${who}`]: null, [`positions/${id}/${who}`]: null, [`tracks/${id}/${who}`]: null, [`phones/${id}/${who}`]: null })),

    async myHunts() {
      const ids = Object.keys((await guard(get(child(root, `userHunts/${uid}`)))).val() ?? {});
      const hunts = await Promise.all(
        ids.map(async (id) => {
          try {
            return parseHunt(id, (await get(child(root, `hunts/${id}`))).val());
          } catch {
            return null;
          }
        }),
      );
      for (const h of hunts) if (h && isLeader(h, uid) && shouldPurge(h, Date.now() + offset)) purge(h.id).catch(() => {});
      const gone = ids.filter((_, i) => !hunts[i]);
      if (gone.length) update(root, Object.fromEntries(gone.map((id) => [`userHunts/${uid}/${id}`, null]))).catch(() => {});
      return hunts.filter((h): h is Hunt => !!h);
    },

    serverNow: () => Date.now() + offset,

    publishPosition(id, fix, track) {
      // Kept small: every update is sent to everyone in the hunt. The role comes from the participant list.
      const lat = roundCoord(fix.lat);
      const lng = roundCoord(fix.lng);
      const pos: Record<string, unknown> = { lat, lng, ts: serverTimestamp() };
      if (fix.acc != null && isFinite(fix.acc)) pos.acc = Math.round(fix.acc);
      const upd: Record<string, unknown> = { [`positions/${id}/${uid}`]: pos };
      if (track) upd[`tracks/${id}/${uid}/${push(child(root, `tracks/${id}/${uid}`)).key}`] = { lat, lng, ts: serverTimestamp() };
      return guard(update(root, upd));
    },

    clearPosition: (id) => guard(update(root, { [`positions/${id}/${uid}`]: null })),

    watchPositions(id, cb, onDenied) {
      return onValue(
        child(root, `positions/${id}`),
        (s) => cb(parsePositions(s.val())),
        () => onDenied(),
      );
    },

    watchTracks(id, cb, onDenied) {
      return onValue(
        child(root, `tracks/${id}`),
        (s) => cb(parseTracks(s.val())),
        () => onDenied(),
      );
    },

    purgeLocations: (id) => guard(purge(id)),

    watchDrives(id, cb, onDenied) {
      return onValue(
        child(root, `drives/${id}`),
        (s) => cb(parseDrives(s.val())),
        () => onDenied(),
      );
    },

    async saveDrive(id, driveId, d) {
      const key = driveId ?? push(child(root, `drives/${id}`)).key!;
      // Only the plan; startedAt / endedAt are left as they are.
      await guard(
        update(child(root, `drives/${id}/${key}`), {
          name: cleanText(d.name, DRIVE_LIMITS.name),
          start: d.start,
          end: d.end,
          area: encodeArea(d.area.slice(0, DRIVE_LIMITS.corners)),
        }),
      );
      return key;
    },

    deleteDrive: (id, driveId) => guard(update(root, { [`drives/${id}/${driveId}`]: null, [`routes/${id}/${driveId}`]: null, [`seats/${id}/${driveId}`]: null })),

    startDrive: (id, driveId, running) =>
      guard(
        update(root, {
          ...Object.fromEntries(running.filter((r) => r !== driveId).map((r) => [`drives/${id}/${r}/endedAt`, serverTimestamp()])),
          [`drives/${id}/${driveId}/startedAt`]: serverTimestamp(),
          [`drives/${id}/${driveId}/endedAt`]: null,
        }),
      ),

    watchStands(id, cb, onDenied) {
      return onValue(
        child(root, `stands/${id}`),
        (s) => cb(parseStands(s.val())),
        () => onDenied(),
      );
    },

    saveStands: (id, ss) => guard(set(child(root, `stands/${id}`), ss.length ? encodeStands(ss) : null)),

    watchClubStands(cb, onDenied) {
      return onValue(
        child(root, 'club/stands'),
        (s) => cb(parseStands(s.val())),
        () => onDenied(),
      );
    },

    saveClubStands: (ss) => guard(set(child(root, 'club/stands'), ss.length ? encodeStands(ss) : null)),

    joinClub: (passphrase) => guard(set(child(root, `club/members/${uid}`), passphrase.trim())),

    clubGuest: (huntId) => guard(set(child(root, `club/guests/${uid}`), huntId)),

    watchSightings(id, cb, onDenied) {
      return onValue(
        child(root, `sightings/${id}`),
        (s) => cb(parseSightings(s.val())),
        () => onDenied(),
      );
    },

    async addSighting(id, s) {
      const key = push(child(root, `sightings/${id}`)).key!;
      const rec: Record<string, unknown> = {
        uid,
        species: s.species,
        count: s.count,
        lat: s.lat,
        lng: s.lng,
        heading: Math.round(s.heading) % 360,
        src: s.src,
        ts: serverTimestamp(),
      };
      if (s.driveId) rec.driveId = s.driveId;
      await guard(update(child(root, `sightings/${id}/${key}`), rec));
      return key;
    },

    deleteSighting: (id, sid) => guard(update(root, { [`sightings/${id}/${sid}`]: null })),

    watchShots(id, cb, onDenied) {
      return onValue(
        child(root, `shots/${id}`),
        (s) => cb(parseShots(s.val())),
        () => onDenied(),
      );
    },

    watchShotSpots(id, cb, onDenied) {
      return onValue(
        child(root, `shotSpots/${id}`),
        (s) => cb(parseShotSpots(s.val())),
        () => onDenied(),
      );
    },

    async addShot(id, s, at) {
      const key = push(child(root, `shots/${id}`)).key!;
      const upd: Record<string, unknown> = { [`shots/${id}/${key}`]: shotRecord(uid, s) };
      if (at) upd[`shotSpots/${id}/${key}`] = { lat: at.lat, lng: at.lng };
      await guard(update(root, upd));
      return key;
    },

    async addShotFor(id, who, s) {
      const key = push(child(root, `shots/${id}`)).key!;
      await guard(update(root, { [`shots/${id}/${key}`]: shotRecord(who, s) }));
      return key;
    },

    updateShot(id, sid, p) {
      const upd: Record<string, unknown> = {};
      if (p.outcome !== undefined) upd.outcome = p.outcome;
      if (p.game !== undefined) upd.game = p.game;
      if (p.note !== undefined) upd.note = cleanText(p.note, NOTE_MAX) || null;
      if (p.uid !== undefined) upd.uid = p.uid;
      if (p.driveId !== undefined) upd.driveId = p.driveId;
      return guard(update(child(root, `shots/${id}/${sid}`), upd));
    },

    deleteShot: (id, sid) => guard(update(root, { [`shots/${id}/${sid}`]: null, [`shotSpots/${id}/${sid}`]: null, [`carcasses/${id}/${sid}`]: null })),

    lockPokot: (id, locked) => guard(update(child(root, `hunts/${id}`), { pokotLockedAt: locked ? serverTimestamp() : null })),

    setPokotTitles: (id, on) => guard(update(child(root, `hunts/${id}`), { pokotTitles: on })),

    endDrive: (id, driveId) => guard(update(root, { [`drives/${id}/${driveId}/endedAt`]: serverTimestamp() })),

    setHuntMeet: (id, at) => guard(update(child(root, `hunts/${id}`), { meet: at ? encodePt(at) : null })),

    setDriveMeet: (id, driveId, at) => guard(update(child(root, `drives/${id}/${driveId}`), { meet: at ? encodePt(at) : null })),

    watchRoutes: (id, cb, onDenied) => watch(`routes/${id}`, parseAllRoutes, cb, onDenied),

    saveRoutes: (id, driveId, routes) =>
      guard(
        set(
          child(root, `routes/${id}/${driveId}`),
          routes.size ? Object.fromEntries([...routes].filter(([, r]) => r.length >= 2).map(([who, r]) => [who, encodeRoute(r.slice(0, CREW_LIMITS.routePoints))])) : null,
        ),
      ),

    watchSeats: (id, cb, onDenied) => watch(`seats/${id}`, parseSeats, cb, onDenied),

    setSeat: (id, driveId, who, seat) => {
      const v = seat ? cleanSeat(seat) : '';
      return guard(set(child(root, `seats/${id}/${driveId}/${who}`), v || null));
    },

    watchPhones: (id, cb, onDenied) => watch(`phones/${id}`, parsePhones, cb, onDenied),

    setPhone: (id, phone) => guard(set(child(root, `phones/${id}/${uid}`), (phone && cleanPhone(phone)) || null)),

    watchTransport: (id, cb, onDenied) => watch(`transport/${id}`, parseTransport, cb, onDenied),

    saveTransport: (id, t) => {
      const rec: Record<string, unknown> = {};
      for (const k of CARCASS_KINDS) {
        const c = t[k];
        if (!c) continue;
        if ('uid' in c) rec[k] = { uid: c.uid };
        else {
          const phone = cleanPhone(c.phone);
          const name = cleanText(c.name, CREW_LIMITS.transportName);
          if (phone && name) rec[k] = { name, phone };
        }
      }
      return guard(set(child(root, `transport/${id}`), Object.keys(rec).length ? rec : null));
    },

    watchMessages: (id, cb, onDenied) => watch(`messages/${id}`, parseMessages, cb, onDenied),

    async sendMessage(id, text, to) {
      const key = push(child(root, `messages/${id}`)).key!;
      await guard(set(child(root, `messages/${id}/${key}`), { text: cleanMessage(text), to, ts: serverTimestamp() }));
    },

    deleteMessage: (id, msgId) => guard(update(root, { [`messages/${id}/${msgId}`]: null, [`msgAcks/${id}/${msgId}`]: null })),

    watchAcks: (id, cb, onDenied) => watch(`msgAcks/${id}`, parseAcks, cb, onDenied),

    ackMessage: (id, msgId) => guard(set(child(root, `msgAcks/${id}/${msgId}/${uid}`), serverTimestamp())),

    watchCarcasses: (id, cb, onDenied) => watch(`carcasses/${id}`, parseCarcassMarks, cb, onDenied),

    moveCarcass: (id, sid, at) => guard(update(child(root, `carcasses/${id}/${sid}`), { lat: +at.lat.toFixed(6), lng: +at.lng.toFixed(6) })),

    pickCarcass: (id, sid, picked) =>
      guard(update(child(root, `carcasses/${id}/${sid}`), picked ? { pickedBy: uid, pickedAt: serverTimestamp() } : { pickedBy: null, pickedAt: null })),
  };
}
