// Differences between the website and the Android app (Capacitor) live here, so the rest of the
// code calls one function and does not care where it runs. Native plugins are imported lazily,
// so the website never downloads them.
import { Capacitor, registerPlugin } from '@capacitor/core';

/** True inside the Android (later iOS) app, false on the website. */
export const isApp = (): boolean => Capacitor.isNativePlatform();

/**
 * Public address of the app. Links and QR codes made in the app must point here, not at the app's
 * local origin. (Older links without app/ keep working: the welcome page at the root passes them on.)
 */
export const PUBLIC_URL = 'https://www.polowanie.org/app/';

/** Base for shareable links (invitations, pairing codes): the website address the link was made on, or the public site in the app. */
export const publicBase = (): string => (isApp() ? PUBLIC_URL : `${location.origin}${location.pathname}`);

/** The current view as a shareable link. */
export const publicHref = (): string => publicBase() + location.hash;

/** Saves a text file: a download on the website, the Android share sheet ("Save to…", Drive, e-mail) in the app. */
export async function saveTextFile(name: string, mime: string, text: string): Promise<void> {
  if (!isApp()) {
    const url = URL.createObjectURL(new Blob([text], { type: mime }));
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return;
  }
  const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
  const { Share } = await import('@capacitor/share');
  const { uri } = await Filesystem.writeFile({ path: name, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
  await Share.share({ title: name, files: [uri] });
}

/** Whether a system share sheet is available (always in the app; on the website only where the browser has one). */
export const canShare = (): boolean => isApp() || 'share' in navigator;

/** Opens the system share sheet with a link. Resolves quietly when the person closes it. */
export async function shareLink(opts: { title: string; text: string; url: string }): Promise<void> {
  try {
    if (isApp()) {
      const { Share } = await import('@capacitor/share');
      await Share.share({ title: opts.title, text: opts.text, url: opts.url, dialogTitle: opts.title });
    } else await navigator.share?.(opts);
  } catch {
    /* closed without sharing */
  }
}

/** Copies text to the clipboard. */
export async function copyText(text: string): Promise<void> {
  if (isApp()) {
    const { Clipboard } = await import('@capacitor/clipboard');
    await Clipboard.write({ string: text });
  } else if (navigator.clipboard) await navigator.clipboard.writeText(text);
  else throw new Error('Clipboard unavailable');
}

// Android WebView ignores window.print(); the app has a tiny native plugin (MainActivity.java)
// that hands the page to Android's print service, which also offers "Save as PDF".
const Printer = registerPlugin<{ print(opts: { name: string }): Promise<void> }>('Printer');

/** Opens the print dialog for the current page (the system one in the app). */
export function printPage(name = document.title): void {
  if (isApp()) void Printer.print({ name }).catch(() => window.print());
  else window.print();
}

/**
 * In the app, links to www.polowanie.org (invitations, pairing codes) open the app itself.
 * Their #/… part is handed to the router as if it had been typed in the address bar.
 */
export async function initDeepLinks(go: (hash: string) => void): Promise<void> {
  if (!isApp()) return;
  const { App } = await import('@capacitor/app');
  const open = (url?: string) => {
    if (!url) return;
    try {
      const u = new URL(url);
      if (u.hash && u.hash !== location.hash) go(u.hash);
    } catch {
      /* not a URL we understand */
    }
  };
  App.addListener('appUrlOpen', (e) => open(e.url));
  open((await App.getLaunchUrl())?.url);
}

/** Version of the installed app (e.g. "0.1.0"), or null on the website. */
export async function appVersion(): Promise<string | null> {
  if (!isApp()) return null;
  const { App } = await import('@capacitor/app');
  return (await App.getInfo()).version;
}

/** Stable download address of the newest Android app, published by the android-release workflow. */
export const APK_URL = 'https://github.com/Macieqowski/Hunting-explorer/releases/latest/download/polowanie.apk';
const RELEASES_API = 'https://api.github.com/repos/Macieqowski/Hunting-explorer/releases/latest';

/** "1.2.10" > "1.2.9". Non-numeric parts count as 0. */
export function newerVersion(latest: string, current: string): boolean {
  const p = (v: string) => v.replace(/^[^\d]*/, '').split('.').map((x) => parseInt(x, 10) || 0);
  const a = p(latest);
  const b = p(current);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  }
  return false;
}

const UPDATE_CHECKED = 'appUpdateChecked';
const UPDATE_DISMISSED = 'appUpdateDismissed';

/**
 * The app is installed from an APK, so nothing updates it automatically. Once in 12 hours it asks
 * GitHub for the newest release and calls `show` when there is a newer one the person has not dismissed.
 */
export async function checkForAppUpdate(show: (version: string, url: string) => void, force = false): Promise<'newer' | 'current' | 'error'> {
  const current = await appVersion();
  if (!current) return 'current';
  try {
    const last = Number(localStorage.getItem(UPDATE_CHECKED) ?? 0);
    if (!force && Date.now() - last < 12 * 3600_000) return 'current';
  } catch {
    /* no storage: check every time */
  }
  try {
    const r = await fetch(RELEASES_API, { headers: { Accept: 'application/vnd.github+json' } });
    if (!r.ok) return 'error';
    const rel = (await r.json()) as { tag_name?: string; assets?: { name: string; browser_download_url: string }[] };
    try {
      localStorage.setItem(UPDATE_CHECKED, String(Date.now()));
    } catch {
      /* ignore */
    }
    const latest = (rel.tag_name ?? '').replace(/^android-v/, '');
    if (!latest || !newerVersion(latest, current)) return 'current';
    let dismissed: string | null = null;
    try {
      dismissed = localStorage.getItem(UPDATE_DISMISSED);
    } catch {
      /* ignore */
    }
    if (force || dismissed !== latest) {
      const apk = rel.assets?.find((a) => a.name.endsWith('.apk'))?.browser_download_url ?? APK_URL;
      show(latest, apk);
    }
    return 'newer';
  } catch {
    return 'error';
  }
}

export function dismissUpdate(version: string): void {
  try {
    localStorage.setItem(UPDATE_DISMISSED, version);
  } catch {
    /* ignore */
  }
}
