# Android app (APK)

The Android app is the website wrapped with [Capacitor](https://capacitorjs.com/): the same `src/` code, built by Vite into `dist/` and copied into `android/`. For now it is not in Google Play; people install `polowanie.apk` from the GitHub release (the About page links to it). Android 9 (API 28) or newer.

## What differs in the app

All of it lives in `src/platform.ts`:

- Links and QR codes (invitations, leader pairing) always point at `https://www.polowanie.org/`, because the app itself runs at `https://localhost`.
- Such links open the app when it is installed (`android/app/src/main/AndroidManifest.xml` + `public/.well-known/assetlinks.json`).
- Share, copy, GPX and exam-progress export use the Android share sheet; the pokot print uses Android's print service (`PrinterPlugin.java`), which can also save a PDF.
- No service worker: the files are inside the APK.
- Once in 12 hours the app asks GitHub for the newest release and shows a bar when there is a newer APK.
- On a phone whose WebView is older than Chrome 87 it shows `public/webview-update.html`.

## One-time setup: the signing key

Every version must be signed with the same key, or it will not install over the previous one. Keep a backup of the key outside GitHub.

Add three repository secrets (**Settings → Secrets and variables → Actions → Secrets → New repository secret**):

| Secret | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | the keystore file, base64: `base64 -w0 polowanie-release.p12` |
| `ANDROID_KEYSTORE_PASSWORD` | the keystore password (the key has the same one) |
| `ANDROID_KEY_ALIAS` | `polowanie` |

The certificate's SHA-256 fingerprint is in `public/.well-known/assetlinks.json`. A new key needs a new fingerprint there (`keytool -list -v -keystore polowanie-release.p12`).

## Publishing a version

**Actions → Android app → Run workflow**, enter a version such as `0.2.0`. The workflow builds the signed APK and creates the release `android-v0.2.0` with `polowanie.apk`. Version code = major×10000 + minor×100 + patch, so versions must only go up.

Run it with an empty version to get a test APK as a workflow artifact, without a release. Pull requests that touch the app build it and start it in an emulator.

## Building locally

Needs Node 22, JDK 21 and the Android SDK (`ANDROID_HOME`).

```sh
npm run android:sync   # web build + copy into android/
cd android && ./gradlew assembleDebug   # android/app/build/outputs/apk/debug/app-debug.apk
```

For a signed release build set `ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` and run `npm run android:apk`. Firebase needs the same `VITE_FIREBASE_*` variables as the website build.

Install on a phone with USB debugging: `adb install -r polowanie.apk`. Logs: `adb logcat -s Capacitor/Console`.
