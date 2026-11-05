# Group hunts: Firebase setup

The **Polowanie zbiorowe** section stores hunts and sign-ups in Firebase (Authentication + Realtime Database). The free Spark plan is enough and needs no card. The rest of the site keeps working without Firebase; the section just shows a "not set up" notice.

Firebase's menu was reorganised in 2025. If a menu name below does not match, use **All products** at the bottom of the left menu.

## 1. Create the project

1. Open <https://console.firebase.google.com> → **Create a project**. Analytics can be turned off.
2. **Security → Authentication → Get started → Sign-in method** → enable **Anonymous**.
   (Direct link: `https://console.firebase.google.com/project/PROJECT_ID/authentication/providers`.)
3. **Databases & Storage → Realtime Database → Create database** (not Firestore). Location **Belgium (europe-west1)**, start in **locked mode**.
   (Direct link: `https://console.firebase.google.com/project/PROJECT_ID/database`.)

## 2. Rules and passphrase

1. In the Realtime Database, open the **Rules** tab, replace everything with the contents of [`database.rules.json`](../database.rules.json) and click **Publish**. Do this again whenever that file changes.
2. In the **Data** tab, add a child `secret` and under it `passphrase` with the club passphrase.
   Nobody can read it through the app; the rules compare what people type against it. To change the passphrase, edit it here. People who already signed up stay signed up.

## 3. Connect the site

1. **Project settings → General → Your apps** → web icon `</>` → register an app (no Hosting needed). Copy the values from the `firebaseConfig` block.
2. In GitHub: **Settings → Secrets and variables → Actions → Variables** → add:

   | Variable | From `firebaseConfig` |
   | --- | --- |
   | `FIREBASE_API_KEY` | `apiKey` |
   | `FIREBASE_AUTH_DOMAIN` | `authDomain` |
   | `FIREBASE_DATABASE_URL` | `databaseURL` (if missing, copy the URL at the top of the Realtime Database page, e.g. `https://PROJECT_ID-default-rtdb.europe-west1.firebasedatabase.app`) |
   | `FIREBASE_PROJECT_ID` | `projectId` |
   | `FIREBASE_APP_ID` | `appId` |

   These values are public by design (they end up in the site's JavaScript); access is controlled by the database rules. Use **Variables**, not Secrets.
3. Re-run the deploy workflow (or push to `main`).

## How access works

- Each browser signs in anonymously and gets a random ID, so people can only change their own sign-up. Clearing the browser's site data loses that ID: the person has to sign up again, and a leader loses control of their hunt.
- Creating a hunt or signing up needs the club passphrase. Anyone with a hunt's link can see its name, time and meeting point; only participants see who else is coming.
- Only the leader can confirm people, change their role, remove them, close sign-up, start or end the hunt, and delete it.
- Live positions (`positions/`) and tracks (`tracks/`) can be written only by confirmed participants, only for themselves, and only while the hunt status is "live". Only confirmed participants can read them.
- Drives (`drives/`) can be added, changed, started, ended and deleted only by the leader. Only confirmed participants can read them. They stay until the hunt is deleted.
- Game sightings (`sightings/`) can be reported by confirmed participants, in their own name, only while the hunt is live, and cannot be changed afterwards. The author or the leader can delete one. Only confirmed participants can read them.
- Shots for the pokot (`shots/`) are logged by confirmed hunters and the leader, in their own name, only while the hunt is live; beaters cannot log shots. The shooter can set the result (killed, wounded, missed) and the game, and delete the shot, until the leader confirms the pokot (`hunts/<id>/pokotLockedAt`, only after the hunt has ended). The leader can correct any shot, move it to another drive or hunter, or add game nobody logged. Where each shot was fired is stored separately in `shotSpots/`.
- Positions, tracks, sightings and shot locations (`shotSpots/`) are kept for 7 days after the leader ends the hunt (the pokot itself, `shots/`, stays until the hunt is deleted). There is no server code on the free plan, so the leader's browser deletes them the next time the leader opens the hunt or the hunt list after those 7 days. Deleting the hunt deletes them at once.

## Local development with emulators

```bash
npx firebase-tools@15 emulators:start --only auth,database --project demo-hunting
curl -X PUT 'http://127.0.0.1:9000/secret/passphrase.json?ns=demo-hunting-default-rtdb' -H 'Authorization: Bearer owner' -d '"test-passphrase"'
```

`.env.local`:

```
VITE_FIREBASE_API_KEY=demo-key
VITE_FIREBASE_AUTH_DOMAIN=demo-hunting.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=http://127.0.0.1:9000/?ns=demo-hunting-default-rtdb
VITE_FIREBASE_PROJECT_ID=demo-hunting
VITE_FIREBASE_APP_ID=1:1:web:1
VITE_FIREBASE_EMULATOR=127.0.0.1
```

Then `npm run dev`. Rules tests: `npm run test:rules` (needs Java 21).
