import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { Organization } from '../../types';
import { SEGMENT_STYLES, SEGMENT_ORDER } from '../../types';
import { useDetail } from '../../context/DetailContext';
import { usePlace } from '../../context/PlaceContext';
import { CHORO_RAMP, metricValue, makeBins, colorFor, metricLabel, formatMetricValue, binLabels, isCviMetric } from '../../lib/choropleth';

const GEORGIA_CENTER: L.LatLngExpression = [32.7, -83.4];

function markerIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: 'ecosystem-marker',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.35)"></div>`,
  });
}

// Bundle GeoJSON feature ids are numeric FIPS/GEOID values.
const featFips = (f: GeoJSON.Feature) => String(f.id).padStart(5, '0');

const CVI_SEGMENTS: { key: string; label: string }[] = [
  { key: 'cvi', label: 'Overall' },
  { key: 'baseline', label: 'Baseline' },
  { key: 'climate', label: 'Climate Change' },
];

interface Props {
  organizations: Organization[];
}

// The Explore tab's map card: county choropleth (Explorer structure) with
// segment-colored organization markers layered on top (ecosystem layer).
// Clicking a county selects it — the place report below the map follows.
export function ExploreMap({ organizations }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const countyLayerRef = useRef<L.GeoJSON | null>(null);
  const tractLayerRef = useRef<L.GeoJSON | null>(null);
  const { open } = useDetail();
  const openRef = useRef(open);
  openRef.current = open;
  const {
    place, countyByFips, metric, setMetric, selectedFips, setSelectedFips,
    tracts, tractStatus, ensureTracts, orgsByCountyFips,
  } = usePlace();
  const selectRef = useRef(setSelectedFips);
  selectRef.current = setSelectedFips;
  const ensureTractsRef = useRef(ensureTracts);
  ensureTractsRef.current = ensureTracts;
  const selectedFipsRef = useRef(selectedFips);
  selectedFipsRef.current = selectedFips;
  const fittedRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: false }).setView(GEORGIA_CENTER, 7);
    L.control.zoom({ position: 'topright' }).addTo(map);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);
    // Tract polygons render above county fills (overlayPane, z400) but below
    // org markers (markerPane, z600).
    map.createPane('tractPane').style.zIndex = '450';
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      countyLayerRef.current = null;
      tractLayerRef.current = null;
    };
  }, []);

  // County choropleth layer.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    countyLayerRef.current?.remove();
    countyLayerRef.current = null;
    if (!place) return;

    const bins = makeBins(metric, place);
    const label = metricLabel(metric, place);

    const layer = L.geoJSON(place.shapes, {
      style: (feat) => {
        const fips = featFips(feat!);
        const county = countyByFips.get(fips);
        const value = county ? metricValue(metric, place, county) : null;
        const isSelected = fips === selectedFips;
        return {
          // When a county is drilled into, tracts replace its fill.
          fillColor: colorFor(value, bins) ?? '#e2e8f0',
          fillOpacity: isSelected ? 0 : selectedFips ? 0.35 : 0.6,
          color: isSelected ? '#1e293b' : '#fff',
          weight: isSelected ? 2 : 1,
        };
      },
      onEachFeature: (feat, lyr) => {
        const fips = featFips(feat);
        const county = countyByFips.get(fips);
        if (!county) return;
        const value = metricValue(metric, place, county);
        const orgCount = orgsByCountyFips.get(fips)?.length ?? 0;
        lyr.bindTooltip(
          `<strong>${county.county}</strong><br/>${label}: ${formatMetricValue(metric, place, value)}` +
            `<br/>${orgCount} organization${orgCount === 1 ? '' : 's'}`,
          { sticky: true, className: 'ecosystem-tooltip' },
        );
        lyr.on('mouseover', () => (lyr as L.Path).setStyle({ weight: 2.5, color: '#475569' }));
        lyr.on('mouseout', () => {
          const isSelected = fips === selectedFipsRef.current;
          (lyr as L.Path).setStyle({
            weight: isSelected ? 2 : 1,
            color: isSelected ? '#1e293b' : '#fff',
          });
        });
        lyr.on('click', () => {
          if (selectedFipsRef.current === fips) {
            selectRef.current(null);
          } else {
            selectRef.current(fips);
            ensureTractsRef.current();
            const b = (lyr as L.Polygon).getBounds();
            mapRef.current?.fitBounds(b.pad(0.1));
          }
        });
      },
    }).addTo(map);
    layer.bringToBack();
    countyLayerRef.current = layer;
    if (!fittedRef.current && !selectedFips) {
      map.fitBounds(layer.getBounds().pad(0.02));
      fittedRef.current = true;
    }
  }, [place, metric, selectedFips, countyByFips, orgsByCountyFips]);

  // Tract drilldown layer for the selected county.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    tractLayerRef.current?.remove();
    tractLayerRef.current = null;
    if (!place || !tracts || !selectedFips || tractStatus !== 'ready') return;

    const bins = makeBins(metric, place);
    const label = metricLabel(metric, place);
    const tractByGeoid = new Map(tracts.tracts.map((t) => [t.geoid, t]));
    const features = tracts.tractShapes.features.filter(
      (f) => String(f.id).startsWith(selectedFips),
    );
    if (features.length === 0) return;

    const layer = L.geoJSON(
      { type: 'FeatureCollection', features } as GeoJSON.FeatureCollection,
      {
        pane: 'tractPane',
        style: (feat) => {
          const tract = tractByGeoid.get(String(feat!.id));
          const value = tract ? metricValue(metric, place, tract) : null;
          return {
            fillColor: colorFor(value, bins) ?? '#e2e8f0',
            fillOpacity: 0.7,
            color: '#fff',
            weight: 0.75,
          };
        },
        onEachFeature: (feat, lyr) => {
          const tract = tractByGeoid.get(String(feat.id));
          if (!tract) return;
          const value = metricValue(metric, place, tract);
          lyr.bindTooltip(
            `<strong>${tract.name}</strong><br/>${label}: ${formatMetricValue(metric, place, value)}`,
            { sticky: true, className: 'ecosystem-tooltip' },
          );
        },
      },
    ).addTo(map);
    tractLayerRef.current = layer;
  }, [place, tracts, tractStatus, selectedFips, metric]);

  // Org markers.
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    for (const org of organizations) {
      if (org.lat == null || org.lng == null) continue;
      const marker = L.marker([org.lat, org.lng], { icon: markerIcon(SEGMENT_STYLES[org.segment].color) });
      marker.on('click', () => openRef.current('organization', org.id));
      marker.bindTooltip(org.name, { direction: 'top', offset: [0, -8], className: 'ecosystem-tooltip' });
      marker.addTo(layer);
    }
    setTimeout(() => map.invalidateSize(), 0);
  }, [organizations]);

  // Zoom back out to the state when a county selection is cleared.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || selectedFips) return;
    const bounds = countyLayerRef.current?.getBounds();
    if (bounds?.isValid()) map.fitBounds(bounds.pad(0.02));
  }, [selectedFips]);

  if (!place) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm text-sm text-slate-400">
        Place data unavailable — the map needs the Community Data Explorer dataset.
      </div>
    );
  }

  const labels = binLabels(metric, place);
  const selectedCounty = selectedFips ? countyByFips.get(selectedFips) : null;

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-base font-bold text-slate-800">Climate Vulnerability Map</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md">
            Counties shaded by how they rank among all 3,143 U.S. counties — darker means more
            vulnerable. Organization markers sit on top. Click a county (or an org) to load its report.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="inline-flex border border-slate-200 rounded-lg overflow-hidden">
            {CVI_SEGMENTS.map((s) => (
              <button
                key={s.key}
                onClick={() => setMetric(s.key)}
                className={`text-xs font-semibold px-3 py-1.5 border-r border-slate-200 last:border-r-0 transition-colors ${
                  metric === s.key ? 'bg-brand-green text-white' : 'bg-white text-slate-500 hover:text-slate-700'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <select
            value={isCviMetric(metric) ? '' : metric}
            onChange={(e) => e.target.value && setMetric(e.target.value)}
            className="text-xs border border-slate-200 rounded-md px-2 py-1 bg-white text-slate-600 focus:outline-none focus:ring-1 focus:ring-brand-green"
          >
            <option value="">More indicators…</option>
            {place.demographics.labels.map((l, i) => (
              <option key={i} value={`demo:${i}`}>{l}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="relative mt-3">
        <div ref={containerRef} className="h-[440px] w-full rounded-lg border border-slate-200 z-0" />
        {selectedCounty && (
          <div className="absolute top-3 left-3 z-[1000] bg-white rounded-md border border-slate-200 shadow-md px-3 py-2 flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-700">{selectedCounty.county}</span>
            {tractStatus === 'loading' && <span className="text-xs text-slate-400">Loading tracts…</span>}
            <span className="text-xs text-slate-400">report below ↓</span>
            <button
              onClick={() => setSelectedFips(null)}
              aria-label="Clear county selection"
              className="text-xs font-medium px-1.5 py-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 flex-wrap mt-3">
        <div>
          <div className="flex">
            {CHORO_RAMP.map((c) => <span key={c} className="w-9 h-2.5 first:rounded-l last:rounded-r" style={{ background: c }} />)}
          </div>
          <div className="flex text-[9px] text-slate-400 mt-0.5">
            {labels.map((l) => <span key={l} className="w-9 text-center">{l}</span>)}
          </div>
        </div>
        <span className="text-[10px] text-slate-400">
          {isCviMetric(metric) ? 'national percentile' : metricLabel(metric, place)}
        </span>
        <div className="flex gap-3 flex-wrap ml-auto">
          {SEGMENT_ORDER.filter((s) => s !== 'Uncategorized').map((s) => (
            <span key={s} className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <span className="w-2.5 h-2.5 rounded-full border border-white shadow-sm" style={{ background: SEGMENT_STYLES[s].color }} />
              {s.replace('Capital ', '')}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
