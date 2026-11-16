// Reading text aloud (first-aid steps, so the hands stay free). The browser's speech synthesis on
// the website; in the Android app the phone's text-to-speech engine (VoicePlugin.java), because
// the app's WebView has no speech synthesis.

import { Capacitor, registerPlugin } from '@capacitor/core';
import { isApp } from './platform';

interface VoicePlugin {
  available(): Promise<{ available: boolean }>;
  say(o: { text: string; lang: string }): Promise<void>;
  hush(): Promise<void>;
}
const Voice = registerPlugin<VoicePlugin>('Voice');
const native = () => isApp() && Capacitor.isPluginAvailable('Voice');

/** Whether this phone or browser can read aloud at all. */
export function canSpeak(): boolean {
  if (native()) return true;
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
}

/** Read `text` in Polish, cutting off whatever was being read. */
export function speak(text: string): void {
  if (native()) {
    void Voice.say({ text, lang: 'pl-PL' }).catch(() => {});
    return;
  }
  if (!canSpeak()) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'pl-PL';
    u.rate = 0.95;
    const pl = speechSynthesis.getVoices().find((v) => v.lang?.toLowerCase().startsWith('pl'));
    if (pl) u.voice = pl;
    speechSynthesis.speak(u);
  } catch {
    /* no speech here */
  }
}

export function hush(): void {
  if (native()) {
    void Voice.hush().catch(() => {});
    return;
  }
  try {
    if (canSpeak()) speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
}
