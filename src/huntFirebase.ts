// Firebase (Auth + Realtime Database) implementation of HuntBackend.
// Data layout and who may write what are defined in database.rules.json.

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, connectAuthEmulator } from 'firebase/auth';
import { getDatabase, ref, child, push, get, update, onValue, serverTimestamp, connectDatabaseEmulator } from 'firebase/database';
import { parseHunt, parseParticipants, parsePositions, parseTracks, parseDrives, encodeArea, shouldPurge, cleanText, cleanNotes, LIMITS, DRIVE_LIMITS, type Hunt, type HuntInput } from './hunt';
import { HuntError, type FirebaseConfig, type HuntBackend } from './huntBackend';

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
  const purge = (id: string) => update(root, { [`positions/${id}`]: null, [`tracks/${id}`]: null });

  return {
    uid,

    async createHunt(input, leaderName, passphrase) {
      const id = push(child(root, 'hunts')).key!;
      const name = cleanText(leaderName, LIMITS.name);
      await guard(
        update(root, {
          [`joins/${id}/${uid}`]: passphrase.trim(),
          [`hunts/${id}`]: { ...cleanInput(input), leaderUid: uid, leaderName: name, status: 'open', createdAt: serverTimestamp() },
          [`participants/${id}/${uid}`]: { name, role: 'leader', status: 'confirmed', joinedAt: serverTimestamp() },
          [`userHunts/${uid}/${id}`]: true,
        }),
      );
      return id;
    },

    updateHunt: (id, patch) =>
      guard(
        update(child(root, `hunts/${id}`), {
          ...cleanInput(patch),
          ...(patch.status ? { status: patch.status, endedAt: patch.status === 'ended' ? serverTimestamp() : null } : {}),
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
          [`joins/${id}/${uid}`]: null,
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

    join: (id, name, role, passphrase) =>
      guard(
        update(root, {
          [`joins/${id}/${uid}`]: passphrase.trim(),
          [`participants/${id}/${uid}`]: { name: cleanText(name, LIMITS.name), role, status: 'registered', joinedAt: serverTimestamp() },
          [`userHunts/${uid}/${id}`]: true,
        }),
      ),

    rename: (id, name) => guard(update(child(root, `participants/${id}/${uid}`), { name: cleanText(name, LIMITS.name) })),

    withdraw: (id) =>
      guard(
        update(root, {
          [`participants/${id}/${uid}`]: null,
          [`positions/${id}/${uid}`]: null,
          [`tracks/${id}/${uid}`]: null,
          [`joins/${id}/${uid}`]: null,
          [`userHunts/${uid}/${id}`]: null,
        }),
      ),

    setParticipant: (id, who, patch) => guard(update(child(root, `participants/${id}/${who}`), patch)),

    removeParticipant: (id, who) =>
      guard(update(root, { [`participants/${id}/${who}`]: null, [`positions/${id}/${who}`]: null, [`tracks/${id}/${who}`]: null })),

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
      for (const h of hunts) if (h && h.leaderUid === uid && shouldPurge(h, Date.now() + offset)) purge(h.id).catch(() => {});
      const gone = ids.filter((_, i) => !hunts[i]);
      if (gone.length) update(root, Object.fromEntries(gone.map((id) => [`userHunts/${uid}/${id}`, null]))).catch(() => {});
      return hunts.filter((h): h is Hunt => !!h);
    },

    serverNow: () => Date.now() + offset,

    publishPosition(id, fix, role, track) {
      const pos: Record<string, unknown> = { lat: fix.lat, lng: fix.lng, ts: serverTimestamp(), role };
      if (fix.acc != null && isFinite(fix.acc)) pos.acc = Math.round(fix.acc);
      const upd: Record<string, unknown> = { [`positions/${id}/${uid}`]: pos };
      if (track) upd[`tracks/${id}/${uid}/${push(child(root, `tracks/${id}/${uid}`)).key}`] = { lat: fix.lat, lng: fix.lng, ts: serverTimestamp() };
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

    deleteDrive: (id, driveId) => guard(update(root, { [`drives/${id}/${driveId}`]: null })),

    startDrive: (id, driveId, running) =>
      guard(
        update(root, {
          ...Object.fromEntries(running.filter((r) => r !== driveId).map((r) => [`drives/${id}/${r}/endedAt`, serverTimestamp()])),
          [`drives/${id}/${driveId}/startedAt`]: serverTimestamp(),
          [`drives/${id}/${driveId}/endedAt`]: null,
        }),
      ),

    endDrive: (id, driveId) => guard(update(root, { [`drives/${id}/${driveId}/endedAt`]: serverTimestamp() })),
  };
}
