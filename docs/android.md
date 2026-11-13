# Android app (APK)

The Android app is the website wrapped with [Capacitor](https://capacitorjs.com/): the same `src/` code, built by Vite into `dist/app/` and copied into `android/`. For now it is not in Google Play; people install `polowanie.apk` from the GitHub release (the welcome page and the About page link to it). Android 9 (API 28) or newer.

## What differs in the app

All of it lives in `src/platform.ts`:

- Links and QR codes (invitations, leader pairing) always point at `https://www.polowanie.org/app/`, because the app itself runs at `https://localhost`.
- Such links open the app when it is installed (`android/app/src/main/AndroidManifest.xml` + `landing/public/.well-known/assetlinks.json`, served from the root of the site). Older links without `app/` open the app as well.
- Share, copy, GPX and exam-progress export use the Android share sheet; the pokot print uses Android's print service (`PrinterPlugin.java`), which can also save a PDF.
- No service worker: the files are inside the APK.
- Once in 12 hours the app asks GitHub for the newest release and shows a bar when there is a newer APK.
- On a phone whose WebView is older than Chrome 87 it shows `public/webview-update.html`.
- The phone's back button closes what is on top (a report sheet, the field-mode list, field mode), then goes one screen back; on the first screen it puts the app aside instead of closing it, so location sharing goes on. The pocket screen and a leader's message ignore it.
- The big field-mode buttons give a short tick under the finger.

Native features (`src/native.ts`, plugins in `android/app/src/main/java/org/polowanie/app/`):

- **Location sharing with the screen off** (`BackgroundLocationPlugin`, `LocationService`): a foreground service with a notification ("Polowanie: udostępniasz położenie" + Stop) sends positions while the phone is locked. It uses Android's own location providers, so it also works without Google Play services. The beater guidance gets these positions too, so it buzzes off-route with the phone in the pocket. Swiping the app away stops sharing.
- **Alerts** (`AlertsPlugin`): vibration patterns that work without a recent tap and with the screen off (alarm vibrations, so also in silent mode), and a notification for leader messages, drive start/end, game coming your way, wounded game and carcasses to collect while the app is not on screen. No sound.
- **System bars** (`BarsPlugin`): the status bar and the navigation bar take the colour of the app's own bars and dark or light icons, following the look chosen in the app (which may differ from the phone's dark mode).
- **Compass** (`CompassPlugin`): Android's rotation-vector sensor, which also says when it needs calibrating (figure-eight hint).
- **Offline maps**: tiles of saved areas are files in the app's storage (`src/tileFiles.ts`) instead of the WebView's database, which Android may clear when the phone is low on space.
- **Saving offline maps with the screen off** (`TileDownloadPlugin`, `TileDownloadService`): the downloading runs in a foreground service (notification with progress and Stop, wake lock and Wi-Fi lock), not in the page, which Android stops soon after the screen goes dark. The page hands over the job (`src/offlineJob.ts`) and records the finished tiles whenever it runs (`downloadInApp` in `src/offline.ts`). The aerial photo and the topographic map come from Geoportal's ready-made WMTS tiles in PUWG 1992, redrawn into web-map tiles on the phone (`Puwg92.java`): WMS draws each image for seconds and stops getting faster past ~6 requests at once (10-16 tiles/s), while WMTS answers from a cache in ~0.6 s up to ~50 requests a second (32 at once; 64-128 at once only queue, with errors at 96). The level used is always the most detailed one that fits the zoom (the topographic map at zoom 16 is the 1:10 000 series, more detailed than what its WMS shows), and the live map draws these two layers from WMTS too (`src/cachedLayer.ts`), so a saved area looks the same as with signal. The BDL layers stay on WMS (12 at once, BDL draws fast). The website does the same in the browser (`src/wmtsSave.ts`, `src/puwg92.ts`). `native-tests` in the Android workflow saves real tiles in the emulator with the screen off and in Doze.

## Built-in club and district list

The list of all hunting districts (numbers, leaseholders, areas; no boundaries) is `public/data/districts.json`, made from BDL by `node scripts/snapshot-districts.mjs`. The website and the app read it instead of downloading ~3 MB from BDL on every start. The deploy workflow refreshes it every Monday (falling back to the file the website serves, then to the one in the repository, if BDL does not answer); the app compares `districts-meta.json` on www.polowanie.org (`app/data/`; app 0.1.x reads `data/` at the root, which the build keeps as a copy) with its own at most every 6 hours (and on "Check for updates") and keeps a newer list on the phone. Boundaries on the map still come from BDL live.

## One-time setup: the signing key

Every version must be signed with the same key, or it will not install over the previous one. Keep a backup of the key outside GitHub.

Add three repository secrets (**Settings → Secrets and variables → Actions → Secrets → New repository secret**):

| Secret | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | the keystore file, base64: `base64 -w0 polowanie-release.p12` |
| `ANDROID_KEYSTORE_PASSWORD` | the keystore password (the key has the same one) |
| `ANDROID_KEY_ALIAS` | `polowanie` |

The certificate's SHA-256 fingerprint is in `landing/public/.well-known/assetlinks.json`. A new key needs a new fingerprint there (`keytool -list -v -keystore polowanie-release.p12`).

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

## Icons and launch screen

All icons are drawn from the brand mark (`branding/mark.svg`, a map pin with a spruce) by `node scripts/make-icons.mjs`: the website icons in `public/`, the launcher icons (`mipmap-*`) and the Android 9–11 launch screens (`drawable*/splash.png`). On Android 12+ the launch screen is the icon on brand green, or on graphite when the phone is in dark mode (`values/styles.xml`, `values-night/colors.xml`). The script needs the `playwright` package; the images are committed, so it only runs when the mark changes.
