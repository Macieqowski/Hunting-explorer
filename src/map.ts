import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { createWind } from './windLayer';
import {
  fetchOutlinesInBounds,
  labelPoint,
  type DistrictWithGeometry,
} from './bdl';
import { t } from './i18n';
import { cachedWms } from './cachedLayer';
import { MAX_ZOOM, WMS, zoomUpTo } from './tiles';

export interface MapApi {
  map: L.Map;
  /** `padBottom`: px of the map's lower edge covered by the phone sheet, kept clear when framing. */
  highlight(items: DistrictWithGeometry[], opts?: { fit?: boolean; marker?: L.LatLngExpression; padBottom?: number }): void;
  clearHighlight(): void;
  rebuildLayerControl(): void;
}

export const POLAND_BOUNDS = L.latLngBounds([49.0, 14.1], [54.9, 24.15]);

const GEOPORTAL_ATTR = '&copy; <a href="https://www.geoportal.gov.pl/">GUGiK, Geoportal</a>';
export const BDL_ATTR = '&copy; <a href="https://www.bdl.lasy.gov.pl/portal/obwody-lowieckie">Bank Danych o Lasach</a>';

/**
 * Fresh instances of the base maps (a tile layer can belong to one map only).
 * OSM and OpenTopoMap forbid offline use, so they are plain online layers. The Geoportal
 * maps (free Polish public data) are kept on the device and work without signal.
 * All of them reach MAX_ZOOM, scaling up their deepest tiles past what the server draws.
 */
export function baseLayers() {
  return {
    osm: L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      ...zoomUpTo(19),
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }),
    topo: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      ...zoomUpTo(17),
      attribution: '&copy; OpenStreetMap, SRTM | &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
    }),
    geotopo: cachedWms(WMS.geotopo, { attribution: GEOPORTAL_ATTR }),
    sat: cachedWms(WMS.ortho, { attribution: GEOPORTAL_ATTR }),
  };
}

/** Without signal, swap an online-only base map for the Geoportal topographic map. */
export function offlineBaseSwitch(map: L.Map, online: L.Layer[], fallback: L.Layer) {
  const check = () => {
    if (navigator.onLine) return;
    const cur = online.find((l) => map.hasLayer(l));
    if (!cur) return;
    map.removeLayer(cur);
    fallback.addTo(map);
  };
  check();
  window.addEventListener('offline', check);
  return () => window.removeEventListener('offline', check);
}

export function createMap(el: HTMLElement, onClick: (lat: number, lng: number) => void): MapApi {
  const map = L.map(el, { zoomControl: false, minZoom: 5, maxZoom: MAX_ZOOM, maxBounds: POLAND_BOUNDS.pad(0.6) });
  map.fitBounds(POLAND_BOUNDS);
  L.control.zoom({ position: 'topright' }).addTo(map);
  // Redrawn when the map stops, not on every step of a drag (it measures the page each time).
  L.control.scale({ imperial: false, position: 'bottomright', updateWhenIdle: true }).addTo(map);

  const { osm, topo, geotopo, sat } = baseLayers();
  osm.addTo(map);
  offlineBaseSwitch(map, [osm, topo], geotopo);

  const overlay = (def: (typeof WMS)[keyof typeof WMS], opacity: number) => cachedWms(def, { opacity, attribution: BDL_ATTR });
  const districts = overlay(WMS.districts, 0.45).addTo(map);
  const outlines = createOutlineLayer(map);
  outlines.addTo(map);
  const forests = overlay(WMS.forests, 0.8);
  const bans = overlay(WMS.bans, 0.7);
  const fire = overlay(WMS.fire, 0.5);
  const wind = createWind(map);

  let control: L.Control.Layers | null = null;
  const rebuildLayerControl = () => {
    (outlines as L.LayerGroup & { updateHint?: () => void }).updateHint?.();
    control?.remove();
    control = L.control
      .layers(
        { [t('bOsm')]: osm, [t('bTopo')]: topo, [t('bGeoTopo')]: geotopo, [t('bSat')]: sat },
        { [t('lDistricts')]: districts, [t('lOutlines')]: outlines, [t('lForest')]: forests, [t('lBans')]: bans, [t('lFire')]: fire, [t('lWind')]: wind.arrows },
        { position: 'topright', collapsed: true },
      )
      .addTo(map);
    wind.refresh();
  };
  rebuildLayerControl();

  const hl = L.featureGroup().addTo(map);

  map.on('click', (e: L.LeafletMouseEvent) => onClick(e.latlng.lat, e.latlng.lng));

  return {
    map,
    rebuildLayerControl,
    clearHighlight: () => {
      hl.clearLayers();
      wind.setScentOrigin(null);
    },
    highlight(items, opts = {}) {
      hl.clearLayers();
      // A tapped point also shows where a hunter's scent would drift from there.
      wind.setScentOrigin(opts.marker ? L.latLng(opts.marker) : null);
      for (const it of items) {
        if (!it.geometry.length) continue;
        L.polygon(it.geometry as L.LatLngExpression[][][], {
          color: '#c2410c',
          weight: 3,
          fillColor: '#f97316',
          fillOpacity: 0.18,
          interactive: false,
        }).addTo(hl);
      }
      if (opts.marker) L.circleMarker(opts.marker, { radius: 6, color: '#fff', weight: 2, fillColor: '#c2410c', fillOpacity: 1, interactive: false }).addTo(hl);
      if (opts.fit && hl.getLayers().length) {
        const b = hl.getBounds();
        if (b.isValid()) map.flyToBounds(b, { paddingTopLeft: [40, 40], paddingBottomRight: [40, 40 + (opts.padBottom ?? 0)], maxZoom: 12, duration: 0.6 });
      } else if (opts.marker && opts.padBottom) {
        // A tapped point must not end up under the sheet that shows its details.
        map.panInside(opts.marker, { paddingTopLeft: [40, 60], paddingBottomRight: [40, 40 + opts.padBottom] });
      }
    },
  };
}

/** Zoom from which crisp vector borders are drawn; labels appear one level later. */
const OUTLINE_MIN_ZOOM = 8;
const LABEL_MIN_ZOOM = 9;
const HOLDER_MIN_ZOOM = 11;

const shorten = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);

export interface MapLabel {
  lat: number;
  lng: number;
  text: string;
  sub?: string;
}

/**
 * District numbers (and holders) painted on one canvas when the map stops, instead of one
 * HTML element with a blurred text shadow each. At zoom 9 about 200 labels are on screen, and
 * moving that many shadowed elements made a slow phone drop most frames while panning.
 */
export class CanvasLabels extends L.Layer {
  private items: MapLabel[] = [];
  private canvas: HTMLCanvasElement | null = null;
  private font = 'sans-serif';
  /** Extra canvas around the view, as a share of its size, so a short pan shows labels at once. */
  private pad = 0.3;

  setLabels(items: MapLabel[]) {
    this.items = items;
    this.redraw();
    return this;
  }

  onAdd(map: L.Map) {
    if (!map.getPane('distLabels')) {
      const pane = map.createPane('distLabels');
      pane.style.zIndex = '450';
      pane.style.pointerEvents = 'none';
    }
    this.canvas = L.DomUtil.create('canvas', 'dist-label-canvas', map.getPane('distLabels'));
    this.canvas.style.position = 'absolute';
    this.font = getComputedStyle(map.getContainer()).fontFamily || 'sans-serif';
    map.on('moveend viewreset resize', this.redraw, this);
    map.on('zoomstart', this.hide, this);
    this.redraw();
    return this;
  }

  onRemove(map: L.Map) {
    map.off('moveend viewreset resize', this.redraw, this);
    map.off('zoomstart', this.hide, this);
    this.canvas?.remove();
    this.canvas = null;
    return this;
  }

  private hide() {
    if (this.canvas) this.canvas.style.visibility = 'hidden';
  }

  redraw() {
    const map = this._map;
    const c = this.canvas;
    if (!map || !c) return;
    const size = map.getSize();
    const padX = Math.round(size.x * this.pad), padY = Math.round(size.y * this.pad);
    const w = size.x + 2 * padX, h = size.y + 2 * padY;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const origin = map.containerPointToLayerPoint([-padX, -padY]);
    L.DomUtil.setPosition(c, origin);
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      c.style.width = `${w}px`;
      c.style.height = `${h}px`;
    }
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.fillStyle = '#431407';
    const bold = `800 15px ${this.font}`, small = `600 11px ${this.font}`;
    for (const it of this.items) {
      const p = map.latLngToLayerPoint([it.lat, it.lng]).subtract(origin);
      if (p.x < -100 || p.y < -30 || p.x > w + 100 || p.y > h + 30) continue;
      // Same block as before: the number over the holder, centred on the point.
      const y1 = it.sub ? p.y - 7 : p.y, y2 = p.y + 8;
      ctx.font = bold;
      ctx.lineWidth = 4;
      ctx.strokeText(it.text, p.x, y1);
      ctx.fillText(it.text, p.x, y1);
      if (it.sub) {
        ctx.font = small;
        ctx.lineWidth = 3;
        ctx.strokeText(it.sub, p.x, y2);
        ctx.fillText(it.sub, p.x, y2);
      }
    }
    c.style.visibility = '';
  }
}

/**
 * Vector overlay with sharp district borders and district-number labels, loaded for the
 * current viewport from the BDL REST service. The BDL WMS image underneath supplies the colour fill.
 */
function createOutlineLayer(map: L.Map): L.LayerGroup {
  const group = L.layerGroup();
  const renderer = L.canvas({ padding: 0.3 });
  const lines = L.layerGroup().addTo(group);
  const labels = new CanvasLabels().addTo(group);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let token = 0;

  const hint = L.DomUtil.create('div', 'zoom-hint', map.getContainer());
  const updateHint = () => {
    hint.textContent = t('zoomForBorders');
    hint.style.display = map.hasLayer(group) && map.getZoom() < OUTLINE_MIN_ZOOM ? '' : 'none';
  };
  map.on('zoomend', updateHint);
  group.on('add remove', updateHint);
  (group as L.LayerGroup & { updateHint?: () => void }).updateHint = updateHint;

  /** What is drawn now, per district, and at which zoom (the outline detail and labels depend on it). */
  let shown = new Map<number, { lines: L.Layer[]; label: MapLabel | null }>();
  let shownZoom = -1;
  /** Label positions per district: the search for a good spot is the costly part on a slow phone. */
  const labelAt = new Map<number, [number, number] | null>();
  const clear = () => {
    lines.clearLayers();
    labels.setLabels([]);
    shown = new Map();
    shownZoom = -1;
  };

  const refresh = async () => {
    const my = ++token;
    const z = map.getZoom();
    updateHint();
    if (!map.hasLayer(group) || z < OUTLINE_MIN_ZOOM) {
      clear();
      return;
    }
    const b = map.getBounds().pad(0.15);
    // Simplify to roughly half a screen pixel at this zoom.
    const simplify = (360 / (256 * 2 ** z)) * 0.5;
    try {
      const items = await fetchOutlinesInBounds(b.getSouth(), b.getWest(), b.getNorth(), b.getEast(), simplify);
      if (my !== token) return;
      // After a pan at the same zoom only the districts that came into view are drawn and
      // those that left are removed; the rest stay as they are.
      if (z !== shownZoom) clear();
      shownZoom = z;
      const next = new Map<number, { lines: L.Layer[]; label: MapLabel | null }>();
      for (const it of items) {
        if (!it.geometry.length) continue;
        const have = shown.get(it.objectid);
        if (have) {
          next.set(it.objectid, have);
          shown.delete(it.objectid);
          continue;
        }
        const ll = it.geometry as L.LatLngExpression[][][];
        // White halo under a dark line keeps borders readable on any base map.
        const drawn: L.Layer[] = [
          L.polygon(ll, { renderer, interactive: false, fill: false, color: '#ffffff', weight: 4.5, opacity: 0.85 }).addTo(lines),
          L.polygon(ll, { renderer, interactive: false, fill: false, color: '#7c2d12', weight: 1.8, opacity: 1 }).addTo(lines),
        ];
        let label: MapLabel | null = null;
        if (z >= LABEL_MIN_ZOOM && it.number) {
          if (!labelAt.has(it.objectid)) labelAt.set(it.objectid, labelPoint(it.geometry));
          const pt = labelAt.get(it.objectid);
          if (pt) label = { lat: pt[0], lng: pt[1], text: it.number, sub: z >= HOLDER_MIN_ZOOM && it.holder ? shorten(it.holder, 30) : undefined };
        }
        next.set(it.objectid, { lines: drawn, label });
      }
      for (const gone of shown.values()) for (const l of gone.lines) lines.removeLayer(l);
      shown = next;
      labels.setLabels([...next.values()].flatMap((v) => (v.label ? [v.label] : [])));
    } catch {
      /* Borders are an enhancement; the WMS layer still shows the districts. */
    }
  };
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(refresh, 250);
  };
  group.on('add', () => {
    map.on('moveend', schedule);
    refresh();
  });
  group.on('remove', () => {
    map.off('moveend', schedule);
    token++;
    clear();
  });
  return group;
}
