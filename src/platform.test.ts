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
