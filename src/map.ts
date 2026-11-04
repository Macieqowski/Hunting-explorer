import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { BDL_WMS_DISTRICTS, BDL_WMS_ENTRY_BANS, BDL_WMS_FIRE, BDL_WMS_FORESTS, type DistrictWithGeometry } from './bdl';
import { t } from './i18n';

export interface MapApi {
  map: L.Map;
  highlight(items: DistrictWithGeometry[], opts?: { fit?: boolean; marker?: L.LatLngExpression }): void;
  clearHighlight(): void;
  rebuildLayerControl(): void;
}

const POLAND_BOUNDS = L.latLngBounds([49.0, 14.1], [54.9, 24.15]);

export function createMap(el: HTMLElement, onClick: (lat: number, lng: number) => void): MapApi {
  const map = L.map(el, { zoomControl: false, minZoom: 5, maxBounds: POLAND_BOUNDS.pad(0.6) });
  map.fitBounds(POLAND_BOUNDS);
  L.control.zoom({ position: 'topright' }).addTo(map);
  L.control.scale({ imperial: false, position: 'bottomright' }).addTo(map);

  const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  });
  const topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    maxZoom: 17,
    attribution: '&copy; OpenStreetMap, SRTM | &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
  });
  const sat = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { maxZoom: 19, attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics' },
  );
  osm.addTo(map);

  const bdlAttr = '&copy; <a href="https://www.bdl.lasy.gov.pl/portal/obwody-lowieckie">Bank Danych o Lasach</a>';
  const wms = (url: string, layers: string, opacity: number, extra: L.WMSOptions = {}) =>
    L.tileLayer.wms(url, {
      layers,
      format: 'image/png',
      transparent: true,
      version: '1.3.0',
      opacity,
      attribution: bdlAttr,
      ...extra,
    } as L.WMSOptions);

  const districts = wms(BDL_WMS_DISTRICTS, '0', 0.6).addTo(map);
  const forests = wms(BDL_WMS_FORESTS, '5', 0.8);
  const bans = wms(BDL_WMS_ENTRY_BANS, '3', 0.7);
  const fire = wms(BDL_WMS_FIRE, '0', 0.5);

  let control: L.Control.Layers | null = null;
  const rebuildLayerControl = () => {
    control?.remove();
    control = L.control
      .layers(
        { [t('bOsm')]: osm, [t('bTopo')]: topo, [t('bSat')]: sat },
        { [t('lDistricts')]: districts, [t('lForest')]: forests, [t('lBans')]: bans, [t('lFire')]: fire },
        { position: 'topright', collapsed: true },
      )
      .addTo(map);
  };
  rebuildLayerControl();

  const hl = L.featureGroup().addTo(map);

  map.on('click', (e: L.LeafletMouseEvent) => onClick(e.latlng.lat, e.latlng.lng));

  return {
    map,
    rebuildLayerControl,
    clearHighlight: () => hl.clearLayers(),
    highlight(items, opts = {}) {
      hl.clearLayers();
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
        if (b.isValid()) map.flyToBounds(b, { padding: [40, 40], maxZoom: 12, duration: 0.6 });
      }
    },
  };
}
