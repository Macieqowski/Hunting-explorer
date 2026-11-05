// Wind on a Leaflet map: a badge with the wind for the area in view and a time slider,
// an optional layer of wind arrows, the scent cone from a chosen point and the
// downwind / upwind edges of drives. Used by the main map and the group hunt map.

import L from 'leaflet';
import { tt, fmtNum, getLang } from './i18n';
import { compass, directionName } from './weather';
import { fetchWind, windAt, cellKey, gridPoints, scentCone, driveEdges, speedColor, windTo, CALM_KMH, type WindHour } from './wind';

export interface WindApi {
  /** The arrows overlay, for the caller's layer menu. */
  readonly arrows: L.LayerGroup;
  /** The moment to show by default (e.g. the next drive); null = now. Resets the slider. */
  setTime(t: number | null): void;
  /** Where the scent cone starts; null hides it. */
  setScentOrigin(p: { lat: number; lng: number } | null): void;
  /** Drive areas whose downwind / upwind edges are coloured. */
  setDrives(areas: [number, number][][]): void;
  /** Re-render the texts (after a language change). */
  refresh(): void;
}

const TTL = 30 * 60e3;
const STALE = 60 * 60e3;
const STORE = 'wind.last';
/** Below this zoom the view is too big for one wind reading to mean much. */
const MIN_ZOOM = 8;
const HOUR = 36e5;

interface Cached {
  hours: WindHour[];
  at: number; // when it was fetched
}

const ARROW = (size: number) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><path d="M12 2 L19 21 L12 16.5 L5 21 Z" fill="currentColor" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>`;

const locale = () => (getLang() === 'pl' ? 'pl-PL' : 'en-GB');
const fmtTime = (t: number) => new Date(t).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
const fmtHour = (t: number) => new Date(t).toLocaleTimeString(locale(), { hour: '2-digit' }).replace(/\D+$/, '');
const fmtWhen = (t: number) => {
  const d = new Date(t);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay ? fmtTime(t) : `${d.toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'numeric' })} ${fmtTime(t)}`;
};
const ago = (ms: number) => {
  const h = Math.round(ms / HOUR);
  return h < 1 ? tt({ pl: 'przed chwilą', en: 'just now' }) : tt({ pl: `${h} h temu`, en: `${h} h ago` });
};

function loadStored(): ({ lat: number; lng: number } & Cached) | null {
  try {
    const v = JSON.parse(localStorage.getItem(STORE) ?? 'null');
    if (v && typeof v.lat === 'number' && typeof v.lng === 'number' && Array.isArray(v.hours) && typeof v.at === 'number') return v;
  } catch {
    /* storage unavailable or corrupt */
  }
  return null;
}
function saveStored(lat: number, lng: number, c: Cached) {
  try {
    // Keep from two hours ago to three days ahead: enough for a hunt without signal.
    const hours = c.hours.filter((h) => h.time >= c.at - 2 * HOUR && h.time <= c.at + 72 * HOUR);
    localStorage.setItem(STORE, JSON.stringify({ lat, lng, at: c.at, hours }));
  } catch {
    /* full or unavailable: the badge just won't work offline */
  }
}

export function createWind(map: L.Map): WindApi {
  const cache = new Map<string, Cached>();
  const gridCache = new Map<string, { pts: { lat: number; lng: number; hours: WindHour[] }[]; at: number }>();
  let here: (Cached & { key: string }) | null = null;
  let loading = false;
  let failed = false;
  let focus: number | null = null;
  let userTime: number | null = null;
  let open = false;
  let origin: { lat: number; lng: number } | null = null;
  let areas: [number, number][][] = [];
  let grid: { lat: number; lng: number; hours: WindHour[] }[] = [];

  const scentLayer = L.layerGroup().addTo(map);
  const edgeLayer = L.layerGroup().addTo(map);
  const arrows = L.layerGroup();

  // ---------------------------------------------------------------- badge and panel
  const root = L.DomUtil.create('div', 'wind-ctl leaflet-bar');
  root.innerHTML = `
    <button type="button" class="wind-badge" aria-expanded="false"></button>
    <div class="wind-panel" hidden>
      <label class="wind-time"><span class="wind-time-label"></span>
        <input type="range" class="wind-range" min="0" max="0" step="1" value="0"></label>
      <div class="wind-strip"></div>
      <p class="wind-edges-note" hidden></p>
      <p class="wind-note"></p>
      <button type="button" class="wind-now"></button>
    </div>`;
  const badge = root.querySelector<HTMLButtonElement>('.wind-badge')!;
  const panel = root.querySelector<HTMLElement>('.wind-panel')!;
  const range = root.querySelector<HTMLInputElement>('.wind-range')!;
  const timeLabel = root.querySelector<HTMLElement>('.wind-time-label')!;
  const strip = root.querySelector<HTMLElement>('.wind-strip')!;
  const edgesNote = root.querySelector<HTMLElement>('.wind-edges-note')!;
  const note = root.querySelector<HTMLElement>('.wind-note')!;
  const nowBtn = root.querySelector<HTMLButtonElement>('.wind-now')!;
  L.DomEvent.disableClickPropagation(root);
  L.DomEvent.disableScrollPropagation(root);
  const Ctl = L.Control.extend({ onAdd: () => root });
  new Ctl({ position: 'topleft' }).addTo(map);

  badge.addEventListener('click', () => {
    open = !open;
    update();
  });
  range.addEventListener('input', () => {
    const h = here?.hours ?? [];
    const i0 = firstIndex(h);
    const slot = h[i0 + Number(range.value)];
    if (slot) userTime = Number(range.value) === 0 && focus == null ? null : slot.time;
    update();
  });
  nowBtn.addEventListener('click', () => {
    userTime = Date.now();
    update();
  });

  const selected = () => userTime ?? focus ?? Date.now();
  /** Index of the current hour: the slider never goes into the past. */
  const firstIndex = (h: WindHour[]) => {
    const now = Date.now();
    let i = 0;
    while (i + 1 < h.length && h[i + 1].time <= now) i++;
    return i;
  };
  const current = (): WindHour | null => (here && map.getZoom() >= MIN_ZOOM ? windAt(here.hours, selected()) : null);

  function update() {
    const w = current();
    const zoomedOut = map.getZoom() < MIN_ZOOM;
    badge.setAttribute('aria-expanded', String(open));
    panel.hidden = !open || !w;
    // Keep the open panel inside small maps (phones), scrolling inside it instead.
    panel.style.maxHeight = `${Math.max(120, map.getSize().y - 110)}px`;
    if (zoomedOut) {
      badge.innerHTML = `<span class="wind-arrow muted">${ARROW(20)}</span><span class="wind-main small">${tt({ pl: 'Wiatr: przybliż mapę', en: 'Wind: zoom in' })}</span>`;
    } else if (!w) {
      badge.innerHTML = `<span class="wind-arrow muted">${ARROW(20)}</span><span class="wind-main small">${
        loading ? tt({ pl: 'Wiatr: wczytywanie…', en: 'Wind: loading…' }) : failed ? tt({ pl: 'Wiatr: brak danych', en: 'Wind: no data' }) : tt({ pl: 'Wiatr', en: 'Wind' })
      }</span>`;
    } else {
      const calm = w.wind < CALM_KMH;
      const to = windTo(w.dir);
      const t = selected();
      const later = Math.abs(t - Date.now()) > HOUR;
      const stale = here && Date.now() - here.at > STALE ? ` · ${tt({ pl: 'dane', en: 'data' })} ${ago(Date.now() - here.at)}` : '';
      badge.innerHTML = `
        <span class="wind-arrow" style="color:${speedColor(w.wind)};transform:rotate(${Math.round(to)}deg)">${ARROW(26)}</span>
        <span class="wind-main"><span><b>${fmtNum(w.wind)}</b> km/h${later ? ` <span class="wind-at">· ${esc(fmtWhen(w.time))}</span>` : ''}</span>
          <span class="wind-sub">${calm ? tt({ pl: 'prawie bezwietrznie', en: 'almost calm' }) : `${tt({ pl: 'z', en: 'from' })} ${compass(w.dir)} · ${tt({ pl: 'porywy', en: 'gusts' })} ${fmtNum(w.gust)}`}${stale}</span>
          <span class="wind-scent">${calm ? tt({ pl: 'zapach rozchodzi się dookoła', en: 'scent spreads all round' }) : `${tt({ pl: 'zapach niesie na', en: 'scent carries to' })} ${compass(to)}`}</span>
        </span>`;
      badge.setAttribute(
        'aria-label',
        calm
          ? tt({ pl: 'Wiatr: prawie bezwietrznie', en: 'Wind: almost calm' })
          : tt({
              pl: `Wiatr ${directionName(w.dir, 'pl')}, ${fmtNum(w.wind)} km/h, porywy ${fmtNum(w.gust)}. Pokaż prognozę.`,
              en: `Wind from the ${directionName(w.dir, 'en')}, ${fmtNum(w.wind)} km/h, gusts ${fmtNum(w.gust)}. Show forecast.`,
            }),
      );
    }
    if (open && w && here) renderPanel(here.hours);
    drawOverlays(w);
  }

  function renderPanel(h: WindHour[]) {
    const i0 = firstIndex(h);
    const t = selected();
    let sel = i0;
    while (sel + 1 < h.length && h[sel + 1].time <= t) sel++;
    const max = Math.min(h.length - 1 - i0, Math.max(48, sel - i0 + 6));
    range.max = String(Math.max(0, max));
    if (document.activeElement !== range) range.value = String(Math.max(0, sel - i0));
    timeLabel.textContent = `${tt({ pl: 'Godzina', en: 'Time' })}: ${fmtWhen(h[sel]?.time ?? t)}`;
    // The 12 hours from the selected one, so you can see whether the wind turns.
    strip.innerHTML = h
      .slice(sel, sel + 12)
      .map(
        (x) => `<div class="wind-hour${x.time === h[sel].time ? ' sel' : ''}"><span class="small">${esc(fmtHour(x.time))}</span>
          <span class="wind-arrow" style="color:${speedColor(x.wind)};transform:rotate(${Math.round(windTo(x.dir))}deg)">${ARROW(16)}</span>
          <span class="small">${fmtNum(x.wind)}</span></div>`,
      )
      .join('');
    edgesNote.hidden = !areas.length;
    edgesNote.innerHTML = tt({
      pl: '<b class="wind-good">Zielona</b> krawędź miotu: wiatr wieje z miotu na myśliwych, dobra strona na stanowiska. <b class="wind-bad">Czerwona</b>: zapach myśliwych idzie w miot.',
      en: '<b class="wind-good">Green</b> drive edge: the wind blows from the drive to the hunters, a good side for stands. <b class="wind-bad">Red</b>: the hunters’ scent blows into the drive.',
    });
    note.innerHTML = tt({
      pl: 'Prognoza dla otwartego terenu, 10 m nad ziemią, w siatce ok. 2 km. W lesie, w dolinie i na skraju pola wiatr przy ziemi może kręcić – sprawdź go na miejscu. Fioletowy klin to smuga zapachu ok. 400 m od wybranego punktu. Dane: <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a>.',
      en: 'Forecast for open ground, 10 m above it, on a grid of about 2 km. In a forest, a valley or at a field edge the wind near the ground can swirl – check it on the spot. The purple wedge is the scent drifting about 400 m from the chosen point. Data: <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a>.',
    });
    nowBtn.textContent = tt({ pl: 'Teraz', en: 'Now' });
    nowBtn.hidden = Math.abs(t - Date.now()) < HOUR;
  }

  // ---------------------------------------------------------------- overlays
  function drawOverlays(w: WindHour | null) {
    scentLayer.clearLayers();
    edgeLayer.clearLayers();
    if (w && origin) {
      L.polygon(scentCone(origin, w), {
        color: '#7c3aed',
        weight: 1.5,
        dashArray: '4 4',
        fillColor: '#a855f7',
        fillOpacity: 0.18,
        interactive: false,
      }).addTo(scentLayer);
    }
    if (w && w.wind >= CALM_KMH)
      for (const a of areas)
        for (const e of driveEdges(a, w.dir)) {
          if (e.side === 'side') continue;
          L.polyline([e.a, e.b], {
            color: e.side === 'downwind' ? '#16a34a' : '#dc2626',
            weight: 7,
            opacity: 0.75,
            lineCap: 'butt',
            interactive: false,
          }).addTo(edgeLayer);
        }
    drawArrows();
  }

  function drawArrows() {
    arrows.clearLayers();
    if (!map.hasLayer(arrows)) return;
    const t = selected();
    for (const p of grid) {
      const w = windAt(p.hours, t);
      if (!w) continue;
      const calm = w.wind < CALM_KMH;
      L.marker([p.lat, p.lng], {
        interactive: false,
        keyboard: false,
        icon: L.divIcon({
          className: 'wind-grid-icon',
          html: `<div class="wind-grid" style="color:${speedColor(w.wind)}"><span class="wind-arrow" style="transform:rotate(${Math.round(windTo(w.dir))}deg)">${calm ? '' : ARROW(30)}</span><span class="wind-grid-v">${fmtNum(w.wind)}</span></div>`,
          iconSize: [0, 0],
        }),
      }).addTo(arrows);
    }
  }

  // ---------------------------------------------------------------- loading
  async function loadHere() {
    if (map.getZoom() < MIN_ZOOM) {
      update();
      return;
    }
    const c = map.getCenter();
    const key = cellKey(c.lat, c.lng, 0.1);
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < TTL) {
      here = { ...hit, key };
      update();
      return;
    }
    loading = true;
    update();
    try {
      const [p] = await fetchWind([{ lat: c.lat, lng: c.lng }]);
      const entry = { hours: p.hours, at: Date.now() };
      cache.set(key, entry);
      saveStored(c.lat, c.lng, entry);
      if (cellKey(map.getCenter().lat, map.getCenter().lng, 0.1) === key) here = { ...entry, key };
      failed = false;
    } catch {
      failed = true;
      // Offline: fall back to what we had for this area, or the last forecast saved on the device if it is near.
      const stored = loadStored();
      if (hit) here = { ...hit, key };
      else if (stored && map.distance(c, [stored.lat, stored.lng]) < 20_000) here = { hours: stored.hours, at: stored.at, key };
      else here = null;
    } finally {
      loading = false;
      update();
    }
  }

  async function loadGrid() {
    if (!map.hasLayer(arrows)) return;
    const b = map.getBounds();
    const box = { south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() };
    const r = (v: number) => v.toFixed(2);
    const key = `${map.getZoom()}:${r(box.south)},${r(box.west)},${r(box.north)},${r(box.east)}`;
    const hit = gridCache.get(key);
    if (hit && Date.now() - hit.at < TTL) {
      grid = hit.pts;
      drawArrows();
      return;
    }
    const n = map.getSize().x < 500 ? 4 : 5;
    try {
      const pts = await fetchWind(gridPoints(box, n));
      gridCache.set(key, { pts, at: Date.now() });
      if (map.getBounds().equals(b)) grid = pts;
    } catch {
      if (!hit) grid = [];
    }
    drawArrows();
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  map.on('moveend', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      void loadHere();
      void loadGrid();
    }, 500);
  });
  arrows.on('add', () => void loadGrid());
  arrows.on('remove', () => arrows.clearLayers());
  map.whenReady(() => void loadHere());

  return {
    arrows,
    setTime(t) {
      if (t === focus) return;
      focus = t;
      userTime = null;
      update();
    },
    setScentOrigin(p) {
      if (p?.lat === origin?.lat && p?.lng === origin?.lng) return;
      origin = p;
      drawOverlays(current());
    },
    setDrives(a) {
      areas = a.filter((x) => x.length >= 3);
      drawOverlays(current());
      if (open && here) renderPanel(here.hours);
    },
    refresh: update,
  };
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
