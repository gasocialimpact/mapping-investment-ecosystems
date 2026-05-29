import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { Organization } from '../types';
import { SEGMENT_STYLES } from '../types';
import { useDetail } from '../context/DetailContext';

const GEORGIA_CENTER: L.LatLngExpression = [33.0, -83.5];

function markerIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: 'ecosystem-marker',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -10],
    html: `<div style="width:18px;height:18px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.35)"></div>`,
  });
}

interface Props {
  organizations: Organization[];
}

export function OverviewMap({ organizations }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const { open } = useDetail();
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: false }).setView(GEORGIA_CENTER, 7);
    L.control.zoom({ position: 'topright' }).addTo(map);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    const mapped = organizations.filter((o) => o.lat != null && o.lng != null);
    const latlngs: L.LatLngExpression[] = [];

    for (const org of mapped) {
      const color = SEGMENT_STYLES[org.segment].color;
      const marker = L.marker([org.lat!, org.lng!], { icon: markerIcon(color) });
      marker.on('click', () => openRef.current('organization', org.id));
      marker.bindTooltip(org.name, { direction: 'top', offset: [0, -10], className: 'ecosystem-tooltip' });
      marker.addTo(layer);
      latlngs.push([org.lat!, org.lng!]);
    }

    if (latlngs.length === 1) {
      map.setView(latlngs[0], 12);
    } else if (latlngs.length > 1) {
      map.fitBounds(L.latLngBounds(latlngs).pad(0.15));
    } else {
      map.setView(GEORGIA_CENTER, 7);
    }
    setTimeout(() => map.invalidateSize(), 0);
  }, [organizations]);

  return (
    <div
      ref={containerRef}
      className="h-[350px] w-full rounded-lg border border-slate-200 shadow-sm z-0"
    />
  );
}
