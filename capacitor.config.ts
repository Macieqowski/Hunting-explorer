import type { CapacitorConfig } from '@capacitor/cli';

// Android app (and later iOS) built from the same Vite output as www.polowanie.org.
// `npm run android:apk` builds dist/, copies it into android/ and makes a release APK
// (see docs/android.md; the android workflow does the same on GitHub).
const config: CapacitorConfig = {
  appId: 'org.polowanie.app',
  appName: 'Polowanie',
  webDir: 'dist',
  android: {
    // The build targets Chrome 87+. On an older WebView the app shows webview-update.html instead.
    minWebViewVersion: 87,
  },
  server: { errorPath: 'webview-update.html' },
  // Console messages go to logcat (tag Capacitor/Console) in release builds too: the emulator
  // smoke test checks them for JS errors and startup lines, and they help debugging on a phone.
  loggingBehavior: 'production',
};

export default config;
