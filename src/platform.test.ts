import { afterEach, describe, expect, it, vi } from 'vitest';
import { newerVersion, isApp, publicBase, PUBLIC_URL } from './platform';

describe('newerVersion', () => {
  it('compares numerically, part by part', () => {
    expect(newerVersion('0.2.0', '0.1.9')).toBe(true);
    expect(newerVersion('1.2.10', '1.2.9')).toBe(true);
    expect(newerVersion('1.0.0', '1.0.0')).toBe(false);
    expect(newerVersion('0.9.0', '0.10.0')).toBe(false);
  });
  it('ignores a prefix and treats missing parts as 0', () => {
    expect(newerVersion('android-v1.1', '1.0.5')).toBe(true);
    expect(newerVersion('1.0', '1.0.0')).toBe(false);
  });
  it('never offers a release build over a test build', () => {
    // Test builds are 0.0.<run>-test and never newer than a release.
    expect(newerVersion('0.1.0', '0.0.37-test')).toBe(true);
  });
});

describe('outside the app', () => {
  it('is the website and links point at the page the link was made on', () => {
    expect(isApp()).toBe(false);
    (globalThis as any).location = { origin: 'https://example.org', pathname: '/x/', hash: '' };
    expect(publicBase()).toBe('https://example.org/x/');
    expect(PUBLIC_URL).toBe('https://www.polowanie.org/app/');
  });
});

describe('updates', () => {
  const load = async (platform: string, distribution?: string) => {
    vi.resetModules();
    vi.doMock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => platform, isNativePlatform: () => platform !== 'web' }, registerPlugin: () => ({}) }));
    if (distribution) vi.stubEnv('VITE_DISTRIBUTION', distribution);
    return import('./platform');
  };
  afterEach(() => {
    vi.doUnmock('@capacitor/core');
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('only the Android app installed from the APK looks for updates itself', async () => {
    expect((await load('android')).updatesItself()).toBe(true);
    expect((await load('android', 'apk')).updatesItself()).toBe(true);
    expect((await load('ios')).updatesItself()).toBe(false);
    expect((await load('web')).updatesItself()).toBe(false);
  });

  it('the Google Play build never asks GitHub for a newer APK', async () => {
    const p = await load('android', 'play');
    expect(p.updatesItself()).toBe(false);
    const fetched = vi.fn();
    vi.stubGlobal('fetch', fetched);
    const show = vi.fn();
    expect(await p.checkForAppUpdate(show, true)).toBe('current');
    expect(fetched).not.toHaveBeenCalled();
    expect(show).not.toHaveBeenCalled();
  });
});

