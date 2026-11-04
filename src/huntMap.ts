// Live map of a group hunt: the hunt's district outline, everyone's last position
// with role icons, and optionally each person's track. Lives in its own element that
// huntUi re-attaches after every re-render, so Leaflet keeps its state.

import L from 'leaflet';
import { fetchDistrictsByIds, BDL_WMS_DISTRICTS } from './bdl';
import { baseLayers, POLAND_BOUNDS } from './map';
import { roleIcon, ROLE_COLOR } from './huntIcons';
import { freshness, distanceM, type Position, type Role, type TrackPoint } from './hunt';

export interface PersonInfo {
  name: string;
  role: Role;
}

export interface HuntMapText {
  you: string;
  role: (r: Role) => string;
  ago: (ms: number) => string;
  accuracy: string;
  distance: string;
  layers: { osm: string; topo: string; sat: string; districts: string };
}

export interface HuntMap {
  readonly el: HTMLElement;
  setDistrict(id: number | null): void;
  setPositions(ps: Position[], people: Map<string, PersonInfo>, me: string, now: number): void;
  setTracks(tracks: Map<string, TrackPoint[]> | null, people: Map<string, PersonInfo>): void;
  refreshAges(now: number): void;
  fitAll(): void;
  centerOn(uid: string): boolean;
  invalidate(): void;
  destroy(): void;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const fmtM = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);

export function createHuntMap(text: HuntMapText): HuntMap {
  const el = document.createElement('div');
  el.className = 'hm-map';
  const map = L.map(el, { zoomControl: false, minZoom: 5, maxBounds: POLAND_BOUNDS.pad(0.6) });
  map.fitBounds(POLAND_BOUNDS);
  L.control.zoom({ position: 'topright' }).addTo(map);
  L.control.scale({ imperial: false, position: 'bottomright' }).addTo(map);
  const { osm, topo, sat } = baseLayers();
  osm.addTo(map);
  const districtsWms = L.tileLayer.wms(BDL_WMS_DISTRICTS, {
    layers: '0',
    format: 'image/png',
    transparent: true,
    version: '1.3.0',
    opacity: 0.3,
    attribution: '&copy; Bank Danych o Lasach',
  } as L.WMSOptions);
  L.control
    .layers({ [text.layers.osm]: osm, [text.layers.topo]: topo, [text.layers.sat]: sat }, { [text.layers.districts]: districtsWms }, { position: 'topright' })
    .addTo(map);

  const districtLayer = L.featureGroup().addTo(map);
  const trackLayer = L.layerGroup().addTo(map);
  const accLayer = L.layerGroup().addTo(map);
  const markerLayer = L.featureGroup().addTo(map);
  const markers = new Map<string, { marker: L.Marker; acc: L.Circle | null; pos: Position; info: PersonInfo; me: boolean; cls: string }>();
  let districtId: number | null = null;
  let userMoved = false; // stop auto-fitting once the user pans or zooms
  let lastNow = Date.now();
  let myUid = '';

  // Programmatic fits fire zoom events too, so only pointer and wheel input count as the user looking around.
  el.addEventListener('pointerdown', () => (userMoved = true), { passive: true });
  el.addEventListener('wheel', () => (userMoved = true), { passive: true });

  const iconFor = (pos: Position, info: PersonInfo, me: boolean, now: number) => {
    const f = freshness(pos.ts, now);
    const cls = `hm-marker hm-${f}${me ? ' hm-me' : ''}`;
    return {
      cls,
      icon: L.divIcon({
        className: 'hm-icon',
        html: `<div class="${cls}">${roleIcon(info.role, 26)}<span class="hm-label">${esc(me ? text.you : info.name)}</span></div>`,
        iconSize: [0, 0],
      }),
    };
  };

  const popupHtml = (uid: string) => {
    const m = markers.get(uid);
    if (!m) return '';
    const rows = [`<strong>${esc(m.info.name)}</strong> · ${esc(text.role(m.info.role))}`, esc(text.ago(Math.max(0, lastNow - m.pos.ts)))];
    if (m.pos.acc != null) rows.push(`${esc(text.accuracy)}: ±${fmtM(m.pos.acc)}`);
    const mine = markers.get(myUid);
    if (mine && uid !== myUid) rows.push(`${esc(text.distance)}: ${fmtM(distanceM(mine.pos, m.pos))}`);
    return rows.join('<br>');
  };

  const allBounds = () => {
    const b = L.latLngBounds([]);
    if (markerLayer.getLayers().length) b.extend(markerLayer.getBounds());
    if (districtLayer.getLayers().length) b.extend(districtLayer.getBounds());
    return b;
  };
  /** Show the district and everyone, until the user starts looking around themselves. */
  const autoFit = () => {
    if (userMoved) return;
    const b = allBounds();
    if (b.isValid()) map.fitBounds(b.pad(0.1), { maxZoom: 15, animate: false });
  };

  const api: HuntMap = {
    el,

    setDistrict(id) {
      if (id === districtId) return;
      districtId = id;
      districtLayer.clearLayers();
      if (id == null) return;
      fetchDistrictsByIds([id], 0.00005)
        .then((res) => {
          if (districtId !== id) return;
          for (const d of res) {
            if (!d.geometry.length) continue;
            L.polygon(d.geometry as L.LatLngExpression[][][], {
              color: '#7c2d12',
              weight: 3,
              fill: true,
              fillColor: '#f97316',
              fillOpacity: 0.06,
              interactive: false,
            }).addTo(districtLayer);
          }
          autoFit();
        })
        .catch(() => {
          /* BDL unreachable: the map still works without the outline. */
        });
    },

    setPositions(ps, people, me, now) {
      lastNow = now;
      myUid = me;
      const before = markers.size;
      const seen = new Set<string>();
      for (const pos of ps) {
        const info = people.get(pos.uid);
        if (!info) continue; // removed participant
        seen.add(pos.uid);
        const isMe = pos.uid === me;
        const { cls, icon } = iconFor(pos, info, isMe, now);
        const ll = L.latLng(pos.lat, pos.lng);
        let m = markers.get(pos.uid);
        if (!m) {
          const marker = L.marker(ll, { icon, zIndexOffset: isMe ? 1000 : info.role === 'leader' ? 500 : 0, keyboard: true, title: info.name }).addTo(markerLayer);
          marker.bindPopup(() => popupHtml(pos.uid));
          m = { marker, acc: null, pos, info, me: isMe, cls };
          markers.set(pos.uid, m);
        } else {
          m.marker.setLatLng(ll);
          if (m.cls !== cls || m.info.name !== info.name || m.info.role !== info.role) m.marker.setIcon(icon);
          m.pos = pos;
          m.info = info;
          m.cls = cls;
        }
        const showAcc = pos.acc != null && pos.acc > 50 && freshness(pos.ts, now) === 'fresh';
        if (showAcc) {
          if (!m.acc) m.acc = L.circle(ll, { radius: pos.acc!, color: ROLE_COLOR[info.role], weight: 1, fillOpacity: 0.08, interactive: false }).addTo(accLayer);
          else m.acc.setLatLng(ll).setRadius(pos.acc!);
        } else if (m.acc) {
          m.acc.remove();
          m.acc = null;
        }
      }
      for (const [uid, m] of markers)
        if (!seen.has(uid)) {
          m.marker.remove();
          m.acc?.remove();
          markers.delete(uid);
        }
      if (markers.size > before) autoFit();
    },

    setTracks(tracks, people) {
      trackLayer.clearLayers();
      if (!tracks) return;
      for (const [uid, pts] of tracks) {
        const role = people.get(uid)?.role;
        if (!role || pts.length < 2) continue;
        L.polyline(
          pts.map((p) => [p.lat, p.lng] as [number, number]),
          { color: ROLE_COLOR[role], weight: 3, opacity: 0.75, interactive: false },
        ).addTo(trackLayer);
      }
    },

    refreshAges(now) {
      lastNow = now;
      for (const m of markers.values()) {
        const { cls, icon } = iconFor(m.pos, m.info, m.me, now);
        if (cls !== m.cls) {
          m.marker.setIcon(icon);
          m.cls = cls;
        }
        if (m.acc && freshness(m.pos.ts, now) !== 'fresh') {
          m.acc.remove();
          m.acc = null;
        }
      }
    },

    fitAll() {
      const b = allBounds();
      if (b.isValid()) map.fitBounds(b.pad(0.1), { maxZoom: 16 });
    },

    centerOn(uid) {
      const m = markers.get(uid);
      if (!m) return false;
      map.setView(m.marker.getLatLng(), Math.max(map.getZoom(), 15));
      return true;
    },

    invalidate: () => map.invalidateSize(),
    destroy: () => map.remove(),
  };
  return api;
}
