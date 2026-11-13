// Speech to text for the oral exam: the browser's Web Speech API on the website, the phone's
// speech recognition service in the Android app (SpeechPlugin.java; the WebView has no Web Speech API).
// Both hand the audio to the browser's or phone's speech service; this code never sees or stores it.
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { isApp } from './platform';

export type SpeechError = 'denied' | 'network' | 'audio' | 'language' | 'unavailable' | 'unknown';

export interface SpeechHandlers {
  /** The words of the stretch being spoken right now (replaces the previous partial text). */
  partial(text: string): void;
  /** A finished stretch: append it to the answer. */
  final(text: string): void;
  error(code: SpeechError): void;
  /** Dictation is over (always called last, also after an error). */
  end(): void;
}

export interface SpeechSession {
  /** Stops listening; the last words still arrive, then `end`. */
  stop(): void;
}

interface SpeechPlugin {
  available(): Promise<{ available: boolean }>;
  start(o: { lang: string }): Promise<void>;
  stop(): Promise<void>;
  addListener(event: 'partial' | 'final', cb: (d: { text: string }) => void): Promise<PluginListenerHandle>;
  addListener(event: 'error', cb: (d: { code: string }) => void): Promise<PluginListenerHandle>;
  addListener(event: 'end', cb: () => void): Promise<PluginListenerHandle>;
}

const Speech = registerPlugin<SpeechPlugin>('Speech');

// The Web Speech API is not in TypeScript's DOM typings; this is the part used here.
interface WebRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type WebRecognitionCtor = new () => WebRecognition;

const webCtor = (): WebRecognitionCtor | null => {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: WebRecognitionCtor; webkitSpeechRecognition?: WebRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

/** How speech can be turned into text here, or null when it cannot (then the answer is typed). */
export function speechSupport(): 'native' | 'web' | null {
  if (isApp()) return Capacitor.isPluginAvailable('Speech') ? 'native' : null;
  return webCtor() ? 'web' : null;
}

/** Maps the error codes of the Web Speech API to ours; null = not worth telling the user (silence, our own stop). */
export function webSpeechError(code: string): SpeechError | null {
  switch (code) {
    case 'no-speech':
    case 'aborted':
      return null;
    case 'not-allowed':
    case 'service-not-allowed':
      return 'denied';
    case 'network':
      return 'network';
    case 'audio-capture':
      return 'audio';
    case 'language-not-supported':
      return 'language';
    default:
      return 'unknown';
  }
}

/** Joins a dictated stretch to the text so far: one space between, first letter of a new sentence in upper case. */
export function appendSpeech(sofar: string, piece: string): string {
  const add = piece.trim();
  if (!add) return sofar;
  const base = sofar.replace(/[ \t]+$/, '');
  if (!base) return add[0].toUpperCase() + add.slice(1);
  const newSentence = /[.!?]$/.test(base) || base.endsWith('\n');
  return `${base}${base.endsWith('\n') ? '' : ' '}${newSentence ? add[0].toUpperCase() + add.slice(1) : add}`;
}

/** Starts dictation in `lang` (e.g. "pl-PL"). Rejects with a SpeechError code when it cannot start. */
export async function startSpeech(lang: string, h: SpeechHandlers): Promise<SpeechSession> {
  const kind = speechSupport();
  if (kind === 'native') return startNative(lang, h);
  if (kind === 'web') return startWeb(lang, h);
  throw new SpeechFailure('unavailable');
}

export class SpeechFailure extends Error {
  constructor(readonly code: SpeechError) {
    super(code);
  }
}

async function startNative(lang: string, h: SpeechHandlers): Promise<SpeechSession> {
  const { available } = await Speech.available();
  if (!available) throw new SpeechFailure('unavailable');
  const handles: PluginListenerHandle[] = [];
  const drop = () => handles.splice(0).forEach((x) => void x.remove());
  handles.push(
    await Speech.addListener('partial', (d) => h.partial(d.text)),
    await Speech.addListener('final', (d) => h.final(d.text)),
    await Speech.addListener('error', (d) => h.error((['denied', 'network', 'audio', 'language'] as const).find((c) => c === d.code) ?? 'unknown')),
    await Speech.addListener('end', () => {
      drop();
      h.end();
    }),
  );
  try {
    await Speech.start({ lang });
  } catch (e) {
    drop();
    const code = (e as { code?: string })?.code;
    throw new SpeechFailure(code === 'DENIED' ? 'denied' : code === 'UNAVAILABLE' ? 'unavailable' : 'unknown');
  }
  return { stop: () => void Speech.stop().catch(() => {}) };
}

/** Restarts in a row that brought no words, after which dictation gives up (a broken service would loop forever). */
const MAX_EMPTY_RESTARTS = 8;

function startWeb(lang: string, h: SpeechHandlers): SpeechSession {
  const Ctor = webCtor()!;
  let stopped = false;
  let ended = false;
  let empty = 0;
  let rec: WebRecognition;
  const finish = () => {
    if (ended) return;
    ended = true;
    h.end();
  };
  const run = () => {
    rec = new Ctor();
    rec.lang = lang;
    // Chrome on Android repeats the whole text in every result in continuous mode, so there it
    // listens stretch by stretch and is started again after each one (as the app does).
    rec.continuous = !/Android/i.test(navigator.userAgent);
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const text = r[0]?.transcript ?? '';
        if (r.isFinal) {
          if (text.trim()) {
            empty = 0;
            h.final(text);
          }
        } else interim += text;
      }
      h.partial(interim);
    };
    rec.onerror = (e) => {
      const code = webSpeechError(e.error);
      if (!code) return;
      stopped = true;
      h.error(code);
    };
    rec.onend = () => {
      // The browser ends recognition after a pause; go on until the user stops it.
      if (stopped || ++empty > MAX_EMPTY_RESTARTS) return finish();
      try {
        run();
      } catch {
        finish();
      }
    };
    rec.start();
  };
  try {
    run();
  } catch {
    throw new SpeechFailure('unknown');
  }
  return {
    stop() {
      if (stopped) return;
      stopped = true;
      try {
        rec.stop();
      } catch {
        finish();
      }
      // Some browsers never fire "end" after stop().
      setTimeout(finish, 1500);
    },
  };
}
