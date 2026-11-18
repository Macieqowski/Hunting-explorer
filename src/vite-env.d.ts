/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_DATABASE_URL?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  /** Local development only: point at the database emulator, e.g. "127.0.0.1:9000". */
  readonly VITE_FIREBASE_EMULATOR?: string;
  /** Address of the oral-exam grading service (worker/), e.g. https://polowanie-oral.example.workers.dev. Empty = self-rating only. */
  readonly VITE_ORAL_API_URL?: string;
  /** How the Android build reaches phones: "play" = Google Play (no update check of its own), anything else = the APK on GitHub. */
  readonly VITE_DISTRIBUTION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
