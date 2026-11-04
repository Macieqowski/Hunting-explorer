// The only way the group hunt UI talks to a server. The Firebase implementation
// lives in huntFirebase.ts and is loaded on demand, so people who never open the
// group hunt section never download the Firebase SDK.

import type { Hunt, HuntInput, HuntStatus, Participant, Position, Role, TrackPoint } from './hunt';

export type Unsubscribe = () => void;

export interface HuntBackend {
  readonly uid: string;
  createHunt(input: HuntInput, leaderName: string, passphrase: string): Promise<string>;
  updateHunt(id: string, patch: Partial<HuntInput> & { status?: HuntStatus }): Promise<void>;
  deleteHunt(id: string): Promise<void>;
  /** cb(null) when the hunt does not exist (wrong link or deleted). */
  watchHunt(id: string, cb: (h: Hunt | null) => void, onError: (e: Error) => void): Unsubscribe;
  /** Only participants can read the list; for anyone else onDenied fires. */
  watchParticipants(id: string, cb: (ps: Participant[]) => void, onDenied: () => void): Unsubscribe;
  join(id: string, name: string, role: Exclude<Role, 'leader'>, passphrase: string): Promise<void>;
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
  /** Leader only: delete all positions and tracks of a hunt. */
  purgeLocations(id: string): Promise<void>;
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
