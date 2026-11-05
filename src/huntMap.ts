// Live map of a group hunt: the hunt's district outline, everyone's last position
// with role icons, and optionally each person's track. Lives in its own element that
// huntUi re-attaches after every re-render, so Leaflet keeps its state.

import L from 'leaflet';
import { fetchDistrictsByIds, BDL_WMS_DISTRICTS, BDL_WMS_FORESTS } from './bdl';
import { baseLayers, POLAND_BOUNDS } from './map';
import { roleIcon, ROLE_COLOR, speciesIcon, SPECIES_COLOR } from './huntIcons';
import { freshness, distanceM, offsetPoint, type Area, type DriveState, type Position, type Role, type TrackPoint, type Species, type SightLook } from './hunt';

export interface PersonInfo {
  name: string;
  role: Role;
}

export interface DriveView {
  id: string;
  name: string;
  area: Area;
  state: DriveState;
}

export interface SightView {
  id: string;
  species: Species;
  label: string; // "Dziki 3–6"
  lat: number;
  lng: number;
  heading: number;
  look: SightLook;
  popup: string; // HTML
}

export interface HuntMapText {
  you: string;
  role: (r: Role) => string;
  ago: (ms: number) => string;
  accuracy: string;
  distance: string;
  layers: { osm: string; topo: string; sat: string; districts: string; compartments: string };
}

export interface HuntMap {
  readonly el: HTMLElement;
  setDistrict(id: number | null): void;
  setPositions(ps: Position[], people: Map<string, PersonInfo>, me: string, now: number): void;
  setTracks(tracks: Map<string, TrackPoint[]> | null, people: Map<string, PersonInfo>): void;
  refreshAges(now: number): void;
  fitAll(): void;
  centerOn(uid: string): boolean;
  setDrives(ds: DriveView[]): void;
  setSightings(ss: SightView[]): void;
  centerOnPoint(lat: number, lng: number): void;
  /** Tap the map to add corners, drag corners to move them; onChange gets every change. */
  startDraw(area: Area, onChange: (a: Area) => void, hideDrive?: string | null): void;
  undoCorner(): void;
  showPoint(lat: number, lng: number): void;
  stopDraw(): void;
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
  // Forest compartments (oddziały) help the leader follow real lines when drawing a drive.
  const compartments = L.tileLayer.wms(BDL_WMS_FORESTS, {
    layers: '3,2',
    format: 'image/png',
    transparent: true,
    version: '1.3.0',
    opacity: 0.7,
    attribution: '&copy; Bank Danych o Lasach',
  } as L.WMSOptions);
  L.control
    .layers(
      { [text.layers.osm]: osm, [text.layers.topo]: topo, [text.layers.sat]: sat },
      { [text.layers.districts]: districtsWms, [text.layers.compartments]: compartments },
      { position: 'topright' },
    )
    .addTo(map);

  const districtLayer = L.featureGroup().addTo(map);
  const driveLayer = L.featureGroup().addTo(map);
  const labelLayer = L.layerGroup().addTo(map);
  const drawLayer = L.layerGroup().addTo(map);
  const trackLayer = L.layerGroup().addTo(map);
  const accLayer = L.layerGroup().addTo(map);
  const sightLayer = L.layerGroup().addTo(map);
  const markerLayer = L.featureGroup().addTo(map);
  const markers = new Map<string, { marker: L.Marker; acc: L.Circle | null; pos: Position; info: PersonInfo; me: boolean; cls: string }>();
  let districtId: number | null = null;
  let userMoved = false; // stop auto-fitting once the user pans or zooms
  let lastNow = Date.now();
  let myUid = '';
  let drives: DriveView[] = [];
  let hidden: string | null = null; // the drive being redrawn
  let draw: { area: Area; onChange: (a: Area) => void; compartmentsWereOn: boolean } | null = null;

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

  const areaBounds = (a: Area) => L.latLngBounds(a.map(([lat, lng]) => L.latLng(lat, lng)));
  /** Everyone plus the running drive; with no drive running, the district and all drives. */
  const allBounds = () => {
    const b = L.latLngBounds([]);
    if (markerLayer.getLayers().length) b.extend(markerLayer.getBounds());
    const active = drives.find((d) => d.state === 'active' && d.area.length);
    if (active) b.extend(areaBounds(active.area));
    else {
      if (districtLayer.getLayers().length) b.extend(districtLayer.getBounds());
      for (const d of drives) if (d.area.length) b.extend(areaBounds(d.area));
    }
    return b;
  };

  const DRIVE_STYLE: Record<DriveState, L.PolylineOptions> = {
    active: { color: '#c2410c', weight: 4, fillColor: '#f97316', fillOpacity: 0.16 },
    planned: { color: '#7c2d12', weight: 2, dashArray: '6 6', fillOpacity: 0.03 },
    done: { color: '#6b7280', weight: 2, fillColor: '#6b7280', fillOpacity: 0.06 },
  };
  const drawDrives = () => {
    driveLayer.clearLayers();
    labelLayer.clearLayers();
    for (const d of drives) {
      if (d.id === hidden || d.area.length < 3) continue;
      const poly = L.polygon(d.area, { ...DRIVE_STYLE[d.state], interactive: false }).addTo(driveLayer);
      L.marker(poly.getCenter(), {
        icon: L.divIcon({ className: 'hm-icon', html: `<div class="hm-drive-label hm-drive-${d.state}">${esc(d.name)}</div>`, iconSize: [0, 0] }),
        interactive: false,
        keyboard: false,
        zIndexOffset: -2000, // under the people
      }).addTo(labelLayer);
    }
  };

  const cornerIcon = (first: boolean) =>
    L.divIcon({ className: 'hm-icon', html: `<div class="hm-corner${first ? ' first' : ''}"></div>`, iconSize: [0, 0] });
  const drawEditor = () => {
    drawLayer.clearLayers();
    if (!draw) return;
    const a = draw.area;
    if (a.length >= 3) L.polygon(a, { color: '#c2410c', weight: 3, fillColor: '#f97316', fillOpacity: 0.2, interactive: false }).addTo(drawLayer);
    else if (a.length === 2) L.polyline(a, { color: '#c2410c', weight: 3, interactive: false }).addTo(drawLayer);
    a.forEach((ll, i) => {
      const m = L.marker(ll, { icon: cornerIcon(i === 0), draggable: true, keyboard: false, zIndexOffset: 2000 }).addTo(drawLayer);
      m.on('drag', () => {
        const p = m.getLatLng();
        a[i] = [p.lat, p.lng];
        const shape = drawLayer.getLayers().find((x) => x instanceof L.Polyline) as L.Polyline | undefined;
        shape?.setLatLngs(a);
      });
      m.on('dragend', () => draw?.onChange([...a]));
    });
  };
  map.on('click', (e: L.LeafletMouseEvent) => {
    if (!draw) return;
    draw.area.push([e.latlng.lat, e.latlng.lng]);
    drawEditor();
    draw.onChange([...draw.area]);
  });
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

    setSightings(ss) {
      sightLayer.clearLayers();
      // Oldest first, so the newest is drawn on top.
      for (const s of [...ss].reverse()) {
        const color = SPECIES_COLOR[s.species];
        const o = { lat: s.lat, lng: s.lng };
        const len = 150;
        const opacity = s.look === 'bright' ? 1 : s.look === 'faded' ? 0.55 : 0.35;
        // Phone compasses are 10–20° off, so the direction is a narrow fan, not a line.
        const fan = [o, offsetPoint(o, s.heading - 15, len), offsetPoint(o, s.heading, len * 1.05), offsetPoint(o, s.heading + 15, len)];
        L.polygon(fan, { color, weight: 1, opacity: opacity * 0.6, fillColor: color, fillOpacity: 0.15 * opacity, interactive: false }).addTo(sightLayer);
        const tip = offsetPoint(o, s.heading, len * 1.05);
        L.polyline([o, tip], { color, weight: 3, opacity, interactive: false }).addTo(sightLayer);
        L.polygon([tip, offsetPoint(tip, s.heading + 150, 35), offsetPoint(tip, s.heading - 150, 35)], {
          color,
          weight: 1,
          fillColor: color,
          fillOpacity: opacity,
          opacity,
          interactive: false,
        }).addTo(sightLayer);
        L.marker([s.lat, s.lng], {
          icon: L.divIcon({
            className: 'hm-icon',
            html: `<div class="hs-marker hs-${s.look}">${speciesIcon(s.species, 24)}<span class="hm-label">${esc(s.label)}</span></div>`,
            iconSize: [0, 0],
          }),
          zIndexOffset: s.look === 'bright' ? 800 : -500,
          title: s.label,
        })
          .bindPopup(s.popup)
          .addTo(sightLayer);
      }
    },

    centerOnPoint(lat, lng) {
      userMoved = true;
      map.setView([lat, lng], Math.max(map.getZoom(), 15));
    },

    setDrives(ds) {
      const before = JSON.stringify(drives.map((d) => [d.id, d.state]));
      drives = ds;
      drawDrives();
      if (JSON.stringify(drives.map((d) => [d.id, d.state])) !== before) autoFit();
    },

    startDraw(area, onChange, hideDrive = null) {
      const wasOn = draw ? draw.compartmentsWereOn : map.hasLayer(compartments);
      draw = { area: [...area], onChange, compartmentsWereOn: wasOn };
      if (!map.hasLayer(compartments)) compartments.addTo(map);
      if (!el.classList.contains('hm-drawing')) {
        el.classList.add('hm-drawing');
        map.invalidateSize();
      }
      if (hidden !== hideDrive) {
        hidden = hideDrive;
        drawDrives();
        if (area.length >= 3) map.fitBounds(areaBounds(area).pad(0.3), { maxZoom: 16, animate: false });
      }
      drawEditor();
    },

    undoCorner() {
      if (!draw || !draw.area.length) return;
      draw.area.pop();
      drawEditor();
      draw.onChange([...draw.area]);
    },

    showPoint(lat, lng) {
      userMoved = true;
      map.setView([lat, lng], Math.max(map.getZoom(), 15));
    },

    stopDraw() {
      if (!draw) return;
      if (!draw.compartmentsWereOn) compartments.remove();
      draw = null;
      hidden = null;
      el.classList.remove('hm-drawing');
      map.invalidateSize();
      drawLayer.clearLayers();
      drawDrives();
    },

    invalidate: () => map.invalidateSize(),
    destroy: () => map.remove(),
  };
  return api;
}
