import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { Organization } from '../types';
import { SEGMENT_STYLES } from '../types';

// Default view: Georgia, USA. Markers fit-bounds override this when present.
const GEORGIA_CENTER: L.LatLngExpression = [33.0, -83.5];

function markerIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: 'ecosystem-marker',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -12],
    html: `<div style="width:22px;height:22px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
  });
}

function popupHtml(org: Organization): string {
  const location = [org.city, org.state].filter(Boolean).join(', ');
  const esc = (s: string) => {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  };
  return (
    `<div style="min-width:180px">` +
    `<div style="font-weight:600;font-size:13px;color:#0f172a">${esc(org.name)}</div>` +
    `<div style="font-size:11px;color:#64748b;margin-top:2px">${esc(org.segment)}${location ? ' · ' + esc(location) : ''}</div>` +
    (org.description ? `<div style="font-size:11px;color:#475569;margin-top:6px">${esc(org.description)}</div>` : '') +
    (org.website
      ? `<a href="${esc(org.website)}" target="_blank" rel="noopener" style="display:inline-block;margin-top:6px;font-size:11px;color:#2563eb">Visit website →</a>`
      : '') +
    `</div>`
  );
}

export function MapView({ organizations }: { organizations: Organization[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  // Initialize the map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current).setView(GEORGIA_CENTER, 7);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
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

  // Re-render markers whenever the (filtered) organizations change.
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    const mapped = organizations.filter(
      (o) => typeof o.lat === 'number' && typeof o.lng === 'number',
    );
    const latlngs: L.LatLngExpression[] = [];

    for (const org of mapped) {
      const color = SEGMENT_STYLES[org.segment].color;
      const marker = L.marker([org.lat as number, org.lng as number], { icon: markerIcon(color) });
      marker.bindPopup(popupHtml(org), { maxWidth: 260 });
      marker.addTo(layer);
      latlngs.push([org.lat as number, org.lng as number]);
    }

    if (latlngs.length === 1) {
      map.setView(latlngs[0], 12);
    } else if (latlngs.length > 1) {
      map.fitBounds(L.latLngBounds(latlngs).pad(0.15));
    } else {
      map.setView(GEORGIA_CENTER, 7);
    }
    // Leaflet needs a nudge after layout/tab changes.
    setTimeout(() => map.invalidateSize(), 0);
  }, [organizations]);

  const mappedCount = organizations.filter(
    (o) => typeof o.lat === 'number' && typeof o.lng === 'number',
  ).length;
  const skipped = organizations.length - mappedCount;

  return (
    <div className="space-y-2">
      <div ref={containerRef} className="h-[60vh] w-full rounded-lg border border-slate-200 shadow-sm z-0" />
      <p className="text-xs text-slate-500">
        Showing {mappedCount} mapped organization{mappedCount === 1 ? '' : 's'}.
        {skipped > 0 && ` ${skipped} without coordinates ${skipped === 1 ? 'is' : 'are'} hidden.`}
      </p>
    </div>
  );
}
