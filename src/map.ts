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
  L.control.scale({ imperial: false, position: 'bottomright' }).addTo(map);

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

/**
 * Vector overlay with sharp district borders and district-number labels, loaded for the
 * current viewport from the BDL REST service. The BDL WMS image underneath supplies the colour fill.
 */
function createOutlineLayer(map: L.Map): L.LayerGroup {
  const group = L.layerGroup();
  const renderer = L.canvas({ padding: 0.3 });
  const lines = L.layerGroup().addTo(group);
  const labels = L.layerGroup().addTo(group);
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

  const refresh = async () => {
    const my = ++token;
    const z = map.getZoom();
    updateHint();
    if (!map.hasLayer(group) || z < OUTLINE_MIN_ZOOM) {
      lines.clearLayers();
      labels.clearLayers();
      return;
    }
    const b = map.getBounds().pad(0.15);
    // Simplify to roughly half a screen pixel at this zoom.
    const simplify = (360 / (256 * 2 ** z)) * 0.5;
    try {
      const items = await fetchOutlinesInBounds(b.getSouth(), b.getWest(), b.getNorth(), b.getEast(), simplify);
      if (my !== token) return;
      lines.clearLayers();
      labels.clearLayers();
      for (const it of items) {
        if (!it.geometry.length) continue;
        const ll = it.geometry as L.LatLngExpression[][][];
        // White halo under a dark line keeps borders readable on any base map.
        L.polygon(ll, { renderer, interactive: false, fill: false, color: '#ffffff', weight: 4.5, opacity: 0.85 }).addTo(lines);
        L.polygon(ll, { renderer, interactive: false, fill: false, color: '#7c2d12', weight: 1.8, opacity: 1 }).addTo(lines);
        if (z >= LABEL_MIN_ZOOM && it.number) {
          const pt = labelPoint(it.geometry);
          if (!pt) continue;
          const holder = z >= HOLDER_MIN_ZOOM && it.holder ? `<small>${escapeHtml(shorten(it.holder, 30))}</small>` : '';
          L.marker(pt, {
            interactive: false,
            keyboard: false,
            icon: L.divIcon({ className: 'dist-label', html: `<span><b>${escapeHtml(it.number)}</b>${holder}</span>`, iconSize: [0, 0] }),
          }).addTo(labels);
        }
      }
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
    lines.clearLayers();
    labels.clearLayers();
  });
  return group;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
