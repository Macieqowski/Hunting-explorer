// Exam progress and results kept in localStorage, shared by the written tests and the oral exam.
import { parseProgress, type Progress } from './examProgress';

export interface HistoryEntry {
  /** Bank id: "mysliwy", "selekcjoner" or "ustny". */
  bank: string;
  date: string;
  /** Right answers, or points in the oral exam. */
  correct: number;
  total: number;
  passed: boolean;
}

const HISTORY_KEY = 'examHistory';
const PROGRESS_KEY = 'examProgress.v1';
const HISTORY_MAX = 50;

export function readHistory(): HistoryEntry[] {
  try {
    const v = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function writeHistory(entries: HistoryEntry[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, HISTORY_MAX)));
  } catch {
    /* storage unavailable */
  }
}

export const pushHistory = (e: HistoryEntry) => writeHistory([e, ...readHistory()]);

export function clearHistory() {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    /* storage unavailable */
  }
}

let progressCache: Progress | null = null;

export function readProgress(): Progress {
  if (progressCache) return progressCache;
  try {
    progressCache = parseProgress(JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? '{}'));
  } catch {
    progressCache = {};
  }
  return progressCache;
}

export function saveProgress(p: Progress) {
  progressCache = p;
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable */
  }
}
