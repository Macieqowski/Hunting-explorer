# Hunting Explorer – mapa kół łowieckich

Interactive web map of all **hunting districts (obwody łowieckie)** in Poland and the **hunting clubs (koła łowieckie)** and other entities that lease or manage them.

## Features

- **Map** of all ~4,800 hunting districts, coloured by who manages them (club lease, PZŁ, State Forests, other). Click anywhere to see which district it is and who holds it.
- **"Where am I?"** – uses your location to tell you which district you are standing in.
- **Club search** – find a club by name (diacritics-insensitive), filter by voivodeship, PZŁ region or holder type, and see all of its districts outlined on the map.
- **District details** – number, area (total, forest, after exclusions), county, forest district (nadleśnictwo) and RDLP with addresses, PZŁ regional board with address, data year.
- **Statistics** – totals, share of land leased by clubs, largest clubs, breakdown by voivodeship and by PZŁ region.
- **Hunting seasons** – full table of legal hunting seasons with regional exceptions, a yearly timeline, and "open today" highlighting (also shown on each district/club page for its voivodeship).
- **Extra map layers** – forest district boundaries, current forest entry bans, current fire danger; OSM, topographic and satellite base maps.
- Polish / English UI, deep links to clubs and districts, mobile layout, light/dark theme.

## Data sources

| Data | Source |
| --- | --- |
| District boundaries, leaseholders, PZŁ boards, forest districts | [Bank Danych o Lasach – obwody łowieckie](https://www.bdl.lasy.gov.pl/portal/obwody-lowieckie) (ArcGIS REST `WMS_Obwody_lowieckie/MapServer/6`, WMS `WMS_Obwody_lowieckie`). Boundaries come from voivodeship marshal offices, holders from PZŁ / State Forests; refreshed yearly. |
| Forest districts, entry bans, fire danger | BDL WMS services `WMS_BDL`, `WMS_zakazy_wstepu_do_lasu`, `WMS_zagrozenie_pozarowe_w_lasach` ([list](https://bdl.lasy.gov.pl/portal/uslugi-mapowe-ogc-en)) |
| Hunting seasons | Rozporządzenie MŚ w sprawie określenia okresów polowań na zwierzęta łowne, consolidated text [Dz.U. 2023 poz. 99](https://api.sejm.gov.pl/eli/acts/DU/2023/99/text.html) |

All BDL data is loaded **live in the browser** (JSONP against the public ArcGIS REST endpoint), so there is no backend and nothing to refresh – the app always shows the current BDL data.

## Development

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # unit tests (vitest)
npm run build    # static site in dist/
```

Stack: Vite + TypeScript + Leaflet, no framework. Code layout:

- `src/bdl.ts` – BDL client (JSONP queries, paging, Esri → Leaflet geometry)
- `src/data.ts` – grouping districts into clubs, statistics
- `src/seasons.ts` – hunting season data and logic
- `src/map.ts` – Leaflet map and layers
- `src/main.ts` – UI, routing, rendering
- `src/i18n.ts` – Polish/English strings

## Deployment

`.github/workflows/deploy.yml` tests, builds and publishes `dist/` to GitHub Pages on every push to `main`. Enable it once in **Settings → Pages → Source: GitHub Actions**.

## Disclaimer

For information only. Assembly resolutions, lease agreements and the law are authoritative.
