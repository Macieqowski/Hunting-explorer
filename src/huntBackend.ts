// The only way the group hunt UI talks to a server. The Firebase implementation
// lives in huntFirebase.ts and is loaded on demand, so people who never open the
// group hunt section never download the Firebase SDK.

import type { Shot, ShotInput, ShotSpot } from './pokot';
import type { Stand } from './stands';
import type { Invite } from './invite';
import type { CarcassMark, Message, MsgTo, Pt, Route, Transport } from './huntCrew';
import type { Drive, DriveInput, Sighting, SightingInput, Hunt, HuntInput, HuntStatus, Participant, Position, Role, TrackPoint } from './hunt';

export type Unsubscribe = () => void;

export interface HuntBackend {
  readonly uid: string;
  /** Also creates the first invitation link. */
  createHunt(input: HuntInput, leaderName: string, passphrase: string): Promise<string>;
  updateHunt(id: string, patch: Partial<HuntInput> & { status?: HuntStatus }): Promise<void>;
  deleteHunt(id: string): Promise<void>;
  /** cb(null) when the hunt does not exist (wrong link or deleted). */
  watchHunt(id: string, cb: (h: Hunt | null) => void, onError: (e: Error) => void): Unsubscribe;
  /** Only participants can read the list; for anyone else onDenied fires. */
  watchParticipants(id: string, cb: (ps: Participant[]) => void, onDenied: () => void): Unsubscribe;
  /** `phone` (optional) is stored with the sign-up, readable by confirmed participants only. */
  join(id: string, name: string, role: Exclude<Role, 'leader'>, passphrase: string, phone?: string | null): Promise<void>;
  /** Sign up with an invitation token instead of the club passphrase (still unconfirmed). */
  joinByInvite(id: string, name: string, role: Exclude<Role, 'leader'>, token: string, phone?: string | null): Promise<void>;
  /** Leader only: the hunt's invitation links. */
  watchInvites(id: string, cb: (list: Invite[]) => void, onDenied: () => void): Unsubscribe;
  /** Leader only: replace all invitation links with a new one valid until `exp`; returns its token. */
  newInvite(id: string, exp: number): Promise<string>;
  /** Leader only: make every invitation link of the hunt stop working. */
  revokeInvites(id: string): Promise<void>;
  rename(id: string, name: string): Promise<void>;
  withdraw(id: string): Promise<void>;
  /** Leader only. */
  setParticipant(id: string, uid: string, patch: { role?: Exclude<Role, 'leader'>; status?: 'confirmed' | 'registered' }): Promise<void>;
  removeParticipant(id: string, uid: string): Promise<void>;
  /** Hunts this browser created or joined. Also deletes old positions of hunts this browser leads. */
  myHunts(): Promise<Hunt[]>;
  /** Server clock estimate (ms), for judging how old a position is. */
  serverNow(): number;
  /** Send my position; `track` also appends it to my track. */
  publishPosition(id: string, fix: { lat: number; lng: number; acc: number | null }, role: Role, track: boolean): Promise<void>;
  clearPosition(id: string): Promise<void>;
  /** Readable by confirmed participants; onDenied for anyone else. */
  watchPositions(id: string, cb: (ps: Position[]) => void, onDenied: () => void): Unsubscribe;
  watchTracks(id: string, cb: (tracks: Map<string, TrackPoint[]>) => void, onDenied: () => void): Unsubscribe;
  /** Leader only: delete all positions, tracks and sightings of a hunt. */
  purgeLocations(id: string): Promise<void>;
  /** Drives (mioty): readable by confirmed participants, written by the leader. */
  watchDrives(id: string, cb: (ds: Drive[]) => void, onDenied: () => void): Unsubscribe;
  /** Create (driveId null) or replace a drive's plan; returns its id. */
  saveDrive(id: string, driveId: string | null, d: DriveInput): Promise<string>;
  deleteDrive(id: string, driveId: string): Promise<void>;
  /** Start a drive now, ending the ones still running. */
  startDrive(id: string, driveId: string, running: string[]): Promise<void>;
  endDrive(id: string, driveId: string): Promise<void>;
  /** High seats (zwyżki, ambony): readable by confirmed participants, set by the leader from a KMZ/KML file. */
  watchStands(id: string, cb: (ss: Stand[]) => void, onDenied: () => void): Unsubscribe;
  /** Replace the hunt's stands (an empty list removes them). */
  saveStands(id: string, ss: Stand[]): Promise<void>;
  /** The club's permanent high seats, shown in hunts without their own. Readable and writable by anyone who gave the passphrase. */
  watchClubStands(cb: (ss: Stand[]) => void, onDenied: () => void): Unsubscribe;
  saveClubStands(ss: Stand[]): Promise<void>;
  /** Unlock the club's seats on this device (devices that joined a hunt before they existed). */
  joinClub(passphrase: string): Promise<void>;
  /** Show the club's seats to a confirmed participant of this hunt who never gave the passphrase (e.g. an invited guest). Read-only. */
  clubGuest(huntId: string): Promise<void>;
  /** Game sightings: reported by confirmed participants while the hunt is live, newest first. */
  watchSightings(id: string, cb: (ss: Sighting[]) => void, onDenied: () => void): Unsubscribe;
  addSighting(id: string, s: SightingInput): Promise<string>;
  deleteSighting(id: string, sightingId: string): Promise<void>;
  /** Shots for the pokot: readable by confirmed participants, oldest first. */
  watchShots(id: string, cb: (ss: Shot[]) => void, onDenied: () => void): Unsubscribe;
  /** Where each shot was fired (deleted with the other locations after RETENTION_MS). */
  watchShotSpots(id: string, cb: (spots: Map<string, ShotSpot>) => void, onDenied: () => void): Unsubscribe;
  /** Log my shot now, at `at`; returns its id. */
  addShot(id: string, s: ShotInput & { driveId: string | null }, at: ShotSpot | null): Promise<string>;
  /** Leader only: add game for a hunter (or NO_SHOOTER) without a logged shot. */
  addShotFor(id: string, uid: string, s: ShotInput & { driveId: string | null }): Promise<string>;
  /** The shooter: outcome, game and note; the leader also uid and driveId. */
  updateShot(id: string, shotId: string, patch: Partial<ShotInput & { uid: string; driveId: string | null }>): Promise<void>;
  deleteShot(id: string, shotId: string): Promise<void>;
  /** Leader only, after the hunt ended: freeze (or unfreeze) the pokot. */
  lockPokot(id: string, locked: boolean): Promise<void>;
  setPokotTitles(id: string, on: boolean): Promise<void>;

  // ---- crew planning (see huntCrew.ts)
  /** Leader: the hunt's meeting point on the map (null removes it). */
  setHuntMeet(id: string, at: Pt | null): Promise<void>;
  /** Leader: where everyone gathers after a drive. */
  setDriveMeet(id: string, driveId: string, at: Pt | null): Promise<void>;
  /** Beater routes of every drive: driveId → uid → route. */
  watchRoutes(id: string, cb: (r: Map<string, Map<string, Route>>) => void, onDenied: () => void): Unsubscribe;
  /** Leader: replace all routes of one drive. */
  saveRoutes(id: string, driveId: string, routes: Map<string, Route>): Promise<void>;
  /** Hunters' stands per drive: driveId → uid → stand name/number. */
  watchSeats(id: string, cb: (s: Map<string, Map<string, string>>) => void, onDenied: () => void): Unsubscribe;
  /** My stand (or, for the leader, anyone's); null clears it. */
  setSeat(id: string, driveId: string, uid: string, seat: string | null): Promise<void>;
  watchPhones(id: string, cb: (p: Map<string, string>) => void, onDenied: () => void): Unsubscribe;
  /** My phone number; null removes it. */
  setPhone(id: string, phone: string | null): Promise<void>;
  watchTransport(id: string, cb: (t: Transport) => void, onDenied: () => void): Unsubscribe;
  saveTransport(id: string, t: Transport): Promise<void>;
  /** Leader's messages, newest first. */
  watchMessages(id: string, cb: (ms: Message[]) => void, onDenied: () => void): Unsubscribe;
  sendMessage(id: string, text: string, to: MsgTo): Promise<void>;
  deleteMessage(id: string, msgId: string): Promise<void>;
  watchAcks(id: string, cb: (a: Map<string, Map<string, number>>) => void, onDenied: () => void): Unsubscribe;
  ackMessage(id: string, msgId: string): Promise<void>;
  /** Where carcasses lie (when moved by hand) and who took them. */
  watchCarcasses(id: string, cb: (m: Map<string, CarcassMark>) => void, onDenied: () => void): Unsubscribe;
  moveCarcass(id: string, shotId: string, at: Pt): Promise<void>;
  pickCarcass(id: string, shotId: string, picked: boolean): Promise<void>;
}

/** Errors the UI explains in words. */
export class HuntError extends Error {
  constructor(
    readonly code: 'denied' | 'offline' | 'unknown',
    message: string,
  ) {
    super(message);
  }
}

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  databaseURL: string;
  projectId: string;
  appId: string;
}

export function firebaseConfig(): FirebaseConfig | null {
  const e = import.meta.env;
  const c = {
    apiKey: e.VITE_FIREBASE_API_KEY,
    authDomain: e.VITE_FIREBASE_AUTH_DOMAIN,
    databaseURL: e.VITE_FIREBASE_DATABASE_URL,
    projectId: e.VITE_FIREBASE_PROJECT_ID,
    appId: e.VITE_FIREBASE_APP_ID,
  };
  return Object.values(c).every((v) => typeof v === 'string' && v) ? (c as FirebaseConfig) : null;
}

let pending: Promise<HuntBackend> | null = null;

/** Sign in (anonymously) and return the backend. Retries after a failure. */
export function getBackend(): Promise<HuntBackend> {
  const cfg = firebaseConfig();
  if (!cfg) return Promise.reject(new Error('not configured'));
  pending ??= import('./huntFirebase').then((m) => m.connect(cfg)).catch((e) => {
    pending = null;
    throw e;
  });
  return pending;
}
