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

// The Explore tab's map card. County scope: county choropleth with
// click-to-select. Tract scope: the full statewide census-tract choropleth
// (canvas-rendered) with county outlines on top, tract click-to-select —
// mirroring the Community Data Explorer's tract view.
export function ExploreMap({ organizations }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const countyLayerRef = useRef<L.GeoJSON | null>(null);
  const tractLayerRef = useRef<L.GeoJSON | null>(null);
  const outlineLayerRef = useRef<L.GeoJSON | null>(null);
  const canvasRendererRef = useRef<L.Renderer | null>(null);
  const { open } = useDetail();
  const openRef = useRef(open);
  openRef.current = open;
  const {
    place, countyByFips, metric, setMetric, scope,
    selectedFips, setSelectedFips, selectedGeoid, setSelectedGeoid,
    tracts, tractStatus, ensureTracts, orgsByCountyFips,
  } = usePlace();
  const selectFipsRef = useRef(setSelectedFips);
  selectFipsRef.current = setSelectedFips;
  const selectGeoidRef = useRef(setSelectedGeoid);
  selectGeoidRef.current = setSelectedGeoid;
  const ensureTractsRef = useRef(ensureTracts);
  ensureTractsRef.current = ensureTracts;
  const selectedFipsRef = useRef(selectedFips);
  selectedFipsRef.current = selectedFips;
  const selectedGeoidRef = useRef(selectedGeoid);
  selectedGeoidRef.current = selectedGeoid;
  const fittedRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: false }).setView(GEORGIA_CENTER, 7);
    L.control.zoom({ position: 'topright' }).addTo(map);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);
    // Tract fills sit above county fills; county outlines sit above tract
    // fills in tract scope; org markers (z600) stay on top of everything.
    map.createPane('tractPane').style.zIndex = '450';
    map.createPane('outlinePane').style.zIndex = '460';
    canvasRendererRef.current = L.canvas({ pane: 'tractPane' });
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    // The container's flex height settles after first paint (and changes with
    // the sidebar). Without re-measuring, Leaflet can initialize at the wrong
    // size and render blank until a manual refresh.
    const ro = new ResizeObserver(() => {
      map.invalidateSize();
      if (!fittedRef.current && (containerRef.current?.clientHeight ?? 0) > 100) {
        const bounds = (countyLayerRef.current ?? outlineLayerRef.current)?.getBounds();
        if (bounds?.isValid()) {
          map.fitBounds(bounds.pad(0.02));
          fittedRef.current = true;
        }
      }
    });
    ro.observe(containerRef.current);
    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      countyLayerRef.current = null;
      tractLayerRef.current = null;
      outlineLayerRef.current = null;
      canvasRendererRef.current = null;
    };
  }, []);

  // County layer: choropleth in county scope, thin outlines in tract scope.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    countyLayerRef.current?.remove();
    countyLayerRef.current = null;
    outlineLayerRef.current?.remove();
    outlineLayerRef.current = null;
    if (!place) return;

    if (scope === 'tract') {
      // Orientation outlines only — tracts carry the color below.
      outlineLayerRef.current = L.geoJSON(place.shapes, {
        pane: 'outlinePane',
        interactive: false,
        style: { fill: false, color: '#1e293b', weight: 0.8, opacity: 0.45 },
      }).addTo(map);
      if (!fittedRef.current && (containerRef.current?.clientHeight ?? 0) > 100) {
        map.invalidateSize();
        map.fitBounds(outlineLayerRef.current.getBounds().pad(0.02));
        fittedRef.current = true;
      }
      return;
    }

    const bins = makeBins(metric, place);
    const label = metricLabel(metric, place);

    const layer = L.geoJSON(place.shapes, {
      style: (feat) => {
        const fips = featFips(feat!);
        const county = countyByFips.get(fips);
        const value = county ? metricValue(metric, place, county) : null;
        const isSelected = fips === selectedFips;
        return {
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
            selectFipsRef.current(null);
          } else {
            selectFipsRef.current(fips);
            ensureTractsRef.current();
            const b = (lyr as L.Polygon).getBounds();
            mapRef.current?.fitBounds(b.pad(0.1));
          }
        });
      },
    }).addTo(map);
    layer.bringToBack();
    countyLayerRef.current = layer;
    // Only fit once the container has real dimensions — a zero-height fit
    // computes a broken zoom and the map looks blank. The ResizeObserver in
    // the init effect performs the fit once layout settles otherwise.
    if (!fittedRef.current && !selectedFips && (containerRef.current?.clientHeight ?? 0) > 100) {
      map.invalidateSize();
      map.fitBounds(layer.getBounds().pad(0.02));
      fittedRef.current = true;
    }
  }, [place, metric, scope, selectedFips, countyByFips, orgsByCountyFips]);

  // Tract layer: drilldown tracts of the selected county (county scope) or
  // the full statewide tract choropleth (tract scope).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    tractLayerRef.current?.remove();
    tractLayerRef.current = null;
    if (!place || !tracts || tractStatus !== 'ready') return;
    if (scope === 'county' && !selectedFips) return;

    const bins = makeBins(metric, place);
    const label = metricLabel(metric, place);
    const tractByGeoid = new Map(tracts.tracts.map((t) => [t.geoid, t]));
    const features = scope === 'tract'
      ? tracts.tractShapes.features
      : tracts.tractShapes.features.filter((f) => String(f.id).startsWith(selectedFips!));
    if (features.length === 0) return;

    const layer = L.geoJSON(
      { type: 'FeatureCollection', features } as GeoJSON.FeatureCollection,
      {
        pane: 'tractPane',
        // Canvas keeps 2,791 statewide polygons responsive. (Valid at runtime;
        // Leaflet's GeoJSONOptions type just doesn't declare `renderer`.)
        ...(scope === 'tract' && canvasRendererRef.current
          ? ({ renderer: canvasRendererRef.current } as object)
          : {}),
        style: (feat) => {
          const geoid = String(feat!.id);
          const tract = tractByGeoid.get(geoid);
          const value = tract ? metricValue(metric, place, tract) : null;
          const isSelected = geoid === selectedGeoid;
          return {
            fillColor: colorFor(value, bins) ?? '#e2e8f0',
            fillOpacity: 0.7,
            color: isSelected ? '#1e293b' : '#fff',
            weight: isSelected ? 2 : 0.5,
          };
        },
        onEachFeature: (feat, lyr) => {
          const geoid = String(feat.id);
          const tract = tractByGeoid.get(geoid);
          if (!tract) return;
          const county = countyByFips.get(tract.county);
          const value = metricValue(metric, place, tract);
          lyr.bindTooltip(
            `<strong>${tract.name}</strong> · ${county?.county ?? ''}<br/>${label}: ${formatMetricValue(metric, place, value)}`,
            { sticky: true, className: 'ecosystem-tooltip' },
          );
          if (scope === 'tract') {
            lyr.on('click', () => {
              selectGeoidRef.current(selectedGeoidRef.current === geoid ? null : geoid);
            });
          }
        },
      },
    ).addTo(map);
    tractLayerRef.current = layer;
  }, [place, tracts, tractStatus, scope, selectedFips, selectedGeoid, metric, countyByFips]);

  // Org markers.
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    // Every mapped org is a sibling, so the record modal pages across the pins.
    const mapped = organizations.filter((o) => o.lat != null && o.lng != null);
    const ids = mapped.map((o) => o.id);

    for (const org of mapped) {
      const marker = L.marker([org.lat!, org.lng!], { icon: markerIcon(SEGMENT_STYLES[org.segment].color) });
      marker.on('click', () => openRef.current('organization', org.id, ids));
      marker.bindTooltip(org.name, { direction: 'top', offset: [0, -8], className: 'ecosystem-tooltip' });
      marker.addTo(layer);
    }
    setTimeout(() => map.invalidateSize(), 0);
  }, [organizations]);

  // Zoom back out to the state when a county selection is cleared.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || selectedFips) return;
    const bounds = (countyLayerRef.current ?? outlineLayerRef.current)?.getBounds();
    if (bounds?.isValid()) map.fitBounds(bounds.pad(0.02));
  }, [selectedFips]);

  if (!place) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm h-full min-h-[520px] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 mx-auto rounded-full border-[3px] border-slate-200 border-t-brand-green animate-spin" />
          <p className="text-sm text-slate-400 mt-3">Loading the map…</p>
        </div>
      </div>
    );
  }

  const labels = binLabels(metric, place);
  const selectedCounty = selectedFips ? countyByFips.get(selectedFips) : null;
  const selectedTract = selectedGeoid ? tracts?.tracts.find((t) => t.geoid === selectedGeoid) : null;

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm h-full flex flex-col">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-base font-bold text-slate-800">Climate Vulnerability Map</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md">
            {scope === 'county'
              ? 'Counties shaded by how they rank among all 3,143 U.S. counties — darker means more vulnerable. Click a county (or an org) to load its report.'
              : 'All 2,791 Georgia census tracts, shaded by national rank — darker means more vulnerable. Click a tract to load its report.'}
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

      <div className="relative mt-3 flex-1 min-h-[440px]">
        <div ref={containerRef} className="absolute inset-0 rounded-lg border border-slate-200 z-0" />
        {scope === 'county' && selectedCounty && (
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
        {scope === 'tract' && selectedTract && (
          <div className="absolute top-3 left-3 z-[1000] bg-white rounded-md border border-slate-200 shadow-md px-3 py-2 flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-700">
              {selectedTract.name} · {countyByFips.get(selectedTract.county)?.county}
            </span>
            <span className="text-xs text-slate-400">report below ↓</span>
            <button
              onClick={() => setSelectedGeoid(null)}
              aria-label="Clear tract selection"
              className="text-xs font-medium px-1.5 py-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              ✕
            </button>
          </div>
        )}
        {scope === 'tract' && tractStatus === 'loading' && (
          <div className="absolute top-3 left-3 z-[1000] bg-white rounded-md border border-slate-200 shadow-md px-3 py-2 text-xs text-slate-500">
            Loading census tracts…
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
