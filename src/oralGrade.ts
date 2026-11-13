// Client of the oral-exam grading service (worker/ in this repository, a Cloudflare Worker that
// asks an AI model how close an answer is to the reference one). The service is optional: without
// it, or when it cannot be reached, the user rates their own answer.
import { firebaseConfig } from './huntBackend';
import { clampScore, MAX_ANSWER, type Coverage } from './oral';

export type GradeFail = 'offline' | 'quota' | 'unconfigured' | 'unavailable';

export class GradeError extends Error {
  constructor(readonly code: GradeFail) {
    super(code);
  }
}

export interface AiGrade {
  score: number;
  /** One entry per key point of the question, or empty when the service has another version of the question. */
  points: Coverage[];
  /** Factual mistakes in the answer. */
  errors: string[];
  /** Two or three sentences for the candidate. */
  feedback: string;
  /** Graded answers left today, when the service says so. */
  left: number | null;
}

const apiUrl = (): string => (import.meta.env.VITE_ORAL_API_URL ?? '').replace(/\/+$/, '');

/** The grading service is set up for this build (it still may be unreachable or over its limit). */
export const gradeConfigured = (): boolean => !!apiUrl() && !!firebaseConfig();

const COVERAGE: readonly Coverage[] = ['yes', 'partial', 'no'];

/** Checks a response of the service; null when it is not a grade. */
export function parseGrade(data: unknown, nPoints: number): AiGrade | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (typeof d.score !== 'number' || !Number.isFinite(d.score) || typeof d.feedback !== 'string') return null;
  const pts = Array.isArray(d.points) && d.points.length === nPoints && d.points.every((p) => COVERAGE.includes(p as Coverage)) ? (d.points as Coverage[]) : [];
  return {
    score: clampScore(d.score),
    points: pts,
    errors: Array.isArray(d.errors) ? d.errors.filter((e): e is string => typeof e === 'string' && !!e.trim()).slice(0, 6) : [],
    feedback: d.feedback.trim(),
    left: typeof d.left === 'number' && Number.isFinite(d.left) ? Math.max(0, Math.floor(d.left)) : null,
  };
}

/** Which failure an HTTP status of the service means. */
export const failOf = (status: number): GradeFail => (status === 429 ? 'quota' : 'unavailable');

const TIMEOUT_MS = 45_000;

/** Sends one answer for grading. Throws GradeError; the caller then falls back to self-rating. */
export async function gradeAnswer(nr: number, answer: string, nPoints: number): Promise<AiGrade> {
  const cfg = firebaseConfig();
  const url = apiUrl();
  if (!cfg || !url) throw new GradeError('unconfigured');
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new GradeError('offline');
  let token: string;
  try {
    // The anonymous sign-in used by group hunts: the service counts the daily limit per account.
    token = await (await import('./huntFirebase')).idToken(cfg);
  } catch {
    throw new GradeError(navigator.onLine === false ? 'offline' : 'unavailable');
  }
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${url}/grade`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ nr, answer: answer.slice(0, MAX_ANSWER) }),
      signal: ctl.signal,
    });
  } catch {
    throw new GradeError(navigator.onLine === false ? 'offline' : 'unavailable');
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new GradeError(failOf(res.status));
  const grade = parseGrade(await res.json().catch(() => null), nPoints);
  if (!grade) throw new GradeError('unavailable');
  return grade;
}
