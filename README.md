# Polowanie – mapa kół łowieckich

Interactive web map of all **hunting districts (obwody łowieckie)** in Poland and the **hunting clubs (koła łowieckie)** and other entities that lease or manage them.

## Features

- **Map** of all ~4,800 hunting districts, coloured by who manages them (club lease, PZŁ, State Forests, other). Click anywhere to see which district it is and who holds it.
- **"Where am I?"** – uses your location to tell you which district you are standing in.
- **Club search** – find a club by name (diacritics-insensitive), filter by voivodeship, PZŁ region or holder type, and see all of its districts outlined on the map.
- **District details** – number, area (total, forest, after exclusions), county, forest district (nadleśnictwo) and RDLP with addresses, PZŁ regional board with address, data year.
- **Statistics** – totals, share of land leased by clubs, largest clubs, breakdown by voivodeship and by PZŁ region.
- **Hunting seasons** – full table of legal hunting seasons with regional exceptions, a yearly timeline, and "open today" highlighting (also shown on each district/club page for its voivodeship).
- **Practice exams** – hunter (myśliwy) and selekcjoner tests with a random set of questions and shuffled answers on every attempt, an exam mode (timer, pass mark, score by topic, review of mistakes) and a learning mode (instant answer and explanation). Hunting-season questions are generated from the seasons table.
- **Weather for hunters** – for your current location and any number of saved places (search by town or paste coordinates; also "Weather at this point" from the map): current conditions with wind direction and gusts, 3-hour pressure trend, visibility and dew point; practical hints (where your scent goes, fog, frost, fresh snow for tracking, rain coming, bright or dark night); sun times with astronomical/nautical/civil twilight and a 24-hour light bar; moon phase, illumination, moonrise/moonset, hours the moon is up tonight, next full and new moon; 24-hour and 7-day forecasts. Saved places stay in the browser (localStorage).
- **Wind on the map** – on the main map and the group hunt map: a badge with the wind for the area in view (speed, gusts, where your scent carries) and a time slider for the next days; an optional layer of wind arrows; a scent cone (about 400 m) from a tapped point or your own position; in group hunts, drive edges coloured green on the downwind side (good for the line of stands) and red on the upwind side. The badge defaults to the next planned drive's start, and the last forecast is kept in the browser for use without signal.
- **Group hunts (polowanie zbiorowe)** – the hunt leader creates a hunt (date, time, meeting point, notes) and shares its link; people sign up as hunter (myśliwy) or beater (naganiacz) with their name and the club passphrase. Participants see who is coming, grouped by role; the leader confirms people, switches roles, removes people, closes sign-up and starts/ends the hunt. The hunt can be tied to a hunting district (search by number, club or forest district, or "the district I am in"). While the hunt is live, participants who opt in share their location: everyone confirmed sees a map with the district outline and role icons (star = leader, crosshair = hunter, triangle = beater), faded when a position is a few minutes old, optional tracks, and a GPX export of all tracks. The leader plans the drives (mioty): taps the corners of each drive on the map (forest compartment lines from BDL help), sets the planned start and end, and starts and ends each drive during the hunt; everyone sees the running drive highlighted, gets a vibration and a banner when a drive starts or ends, and the GPX export splits tracks per drive. Anyone can report game in a few taps (Jelenie, Dziki, Sarny, Drapieżniki; 1–3, 3–6, 6+) and point the phone where it went, using the phone's compass, or one of eight direction buttons; the sighting appears on everyone's map as an arrow, and hunters it is heading toward (within 500 m and 30°) get a vibration and a banner. A "pocket mode" (black, tap-proof screen with slide-to-unlock) keeps the phone sending while it is in a pocket, since browsers stop location when the screen locks. Positions and tracks are kept for 7 days after the hunt. Stored in Firebase; see [docs/firebase-setup.md](docs/firebase-setup.md).
- **Offline maps** – "Save offline" on a district, club or group hunt (or "Save the visible map area" in the Offline tab) downloads the Geoportal aerial photo and topographic map, the BDL district and forest compartment layers and the district shapes, so the map, district borders and "which district am I in" work in the forest without signal. Shows the size first (zoom 16, or zoom 17 for a closer photo), downloads in the background with progress, resumes after a break, and lists saved areas with Update and Delete. Tiles you look at are kept too (about 150 MB, oldest dropped first). The app installs to the home screen and opens without signal (service worker). OSM, OpenTopoMap and Esri do not allow offline use, so offline the map switches to the Geoportal topographic map. On iPhone the app must be added to the Home Screen, or Safari deletes saved maps after 7 days without use.
- **Extra map layers** – forest district boundaries, current forest entry bans, current fire danger; OSM, OpenTopoMap, Geoportal topographic map and Geoportal aerial photo base maps.
- Polish / English UI, deep links to clubs and districts, mobile layout, light/dark theme.

## Data sources

| Data | Source |
| --- | --- |
| District boundaries, leaseholders, PZŁ boards, forest districts | [Bank Danych o Lasach – obwody łowieckie](https://www.bdl.lasy.gov.pl/portal/obwody-lowieckie) (ArcGIS REST `WMS_Obwody_lowieckie/MapServer/6`, WMS `WMS_Obwody_lowieckie`). Boundaries come from voivodeship marshal offices, holders from PZŁ / State Forests; refreshed yearly. |
| Forest districts, entry bans, fire danger | BDL WMS services `WMS_BDL`, `WMS_zakazy_wstepu_do_lasu`, `WMS_zagrozenie_pozarowe_w_lasach` ([list](https://bdl.lasy.gov.pl/portal/uslugi-mapowe-ogc-en)) |
| Weather forecast, wind on the map, place search | [Open-Meteo](https://open-meteo.com/) forecast and geocoding APIs (free, no key, CC BY 4.0). Sun and moon times are computed in the browser (`src/astro.ts`). |
| Aerial photo, topographic map | [Geoportal (GUGiK)](https://www.geoportal.gov.pl/) WMS: `PZGIK/ORTO/WMS/HighResolution` (with `StandardResolution` where the high-resolution photo has gaps) and `img/guest/TOPO`. Free public data; these are the only base maps the app saves for offline use. |
| Hunting seasons | Rozporządzenie MŚ w sprawie określenia okresów polowań na zwierzęta łowne, consolidated text [Dz.U. 2023 poz. 99](https://api.sejm.gov.pl/eli/acts/DU/2023/99/text.html) |

All BDL data is loaded **live in the browser** (JSONP against the public ArcGIS REST endpoint), so there is no backend and nothing to refresh – the app always shows the current BDL data.

## Development

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # unit tests (vitest)
npm run build    # static site in dist/
npm run test:rules  # Firebase security rules on the emulator (needs Java 21)
```

Stack: Vite + TypeScript + Leaflet, no framework. Code layout:

- `src/bdl.ts` – BDL client (JSONP queries, paging, Esri → Leaflet geometry)
- `src/data.ts` – grouping districts into clubs, statistics
- `src/seasons.ts` – hunting season data and logic
- `src/map.ts` – Leaflet map and layers
- `src/hunt.ts`, `src/huntUi.ts`, `src/huntMap.ts`, `src/huntShare.ts`, `src/huntSighting.ts`, `src/huntIcons.ts`, `src/stands.ts` – group hunts: logic, pages, live map, location sharing, game reporting with the compass, role, species and high-seat icons, high seats (zwyżki, ambony) read from a KMZ/KML file; `src/huntBackend.ts` (interface) + `src/huntFirebase.ts` (Firebase, loaded only when the section opens); rules in `database.rules.json`, tested in `rules/`
- `src/main.ts` – UI, routing, rendering
- `src/i18n.ts` – Polish/English strings

## Exam question banks

Banks live in `public/exams/mysliwy.json` and `public/exams/selekcjoner.json` (count, pass mark, time limit and questions). Import questions from a CSV/TSV file with:

```bash
node scripts/import-questions.mjs questions.csv public/exams/mysliwy.json [--replace]
```

Columns: `temat; pytanie; a; b; c; d; poprawna; wyjasnienie; zrodlo` (`poprawna` is a letter or 1-based number; several correct answers as `A,C`). Images: optional `obraz` (question) and `obraz_a`, `obraz_b`, … (answers) columns hold paths relative to `public/exams/` (e.g. `img/mysliwy/123.png`) or URLs. In JSON, a question has an optional `image`, and an answer is either a string or `{ "text"?, "image"? }`. Questions from the PZŁ “Sprawdź wiedzę” quiz are used with PZŁ's permission.

## Deployment

`.github/workflows/deploy.yml` tests, builds and publishes `dist/` to GitHub Pages on every push to `main`. Enable it once in **Settings → Pages → Source: GitHub Actions**.

## Disclaimer

For information only. Assembly resolutions, lease agreements and the law are authoritative.
