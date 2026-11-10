/**
 * Light and dark look. The choice (automatic, light or dark) is kept on this device; "automatic"
 * follows the phone or computer setting. The resolved theme is written to <html data-theme>, which
 * is what every colour, font and corner radius in style.css reads. index.html sets the same
 * attribute before the first paint, so a dark screen does not flash white on start.
 */
import { setSystemBars } from './native';

export type ThemePref = 'auto' | 'light' | 'dark';
export type Theme = 'light' | 'dark';

const KEY = 'theme';
/** The browser toolbar and the phone's status bar take this colour. */
const BAR: Record<Theme, string> = { light: '#1e5a3a', dark: '#101412' };

const systemDark = () => typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;

export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

export function resolveTheme(pref: ThemePref, dark = systemDark()): Theme {
  return pref === 'auto' ? (dark ? 'dark' : 'light') : pref;
}

export function nextThemePref(pref: ThemePref): ThemePref {
  return pref === 'auto' ? 'light' : pref === 'light' ? 'dark' : 'auto';
}

export function applyTheme(): Theme {
  const theme = resolveTheme(getThemePref());
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BAR[theme]);
  setSystemBars(theme);
  return theme;
}

export function setThemePref(pref: ThemePref): Theme {
  try {
    if (pref === 'auto') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch {
    /* private mode: the choice lasts until the page is closed */
  }
  return applyTheme();
}

/** Follow the system setting while the choice is "automatic". */
export function watchSystemTheme(onChange: () => void): void {
  if (typeof matchMedia !== 'function') return;
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    applyTheme();
    onChange();
  });
}
