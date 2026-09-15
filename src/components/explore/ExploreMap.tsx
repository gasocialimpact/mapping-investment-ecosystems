import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Eye, EyeOff } from 'lucide-react';
import type { Organization } from '../../types';
import { SEGMENT_STYLES, SEGMENT_ORDER } from '../../types';
import { useDetail } from '../../context/DetailContext';
import { usePlace } from '../../context/PlaceContext';
import { CHORO_RAMP, metricValue, makeBins, colorFor, metricLabel, formatMetricValue, binLabels, isCviMetric } from '../../lib/choropleth';
import { SnapshotButton } from '../SnapshotButton';

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
  const cardRef = useRef<HTMLDivElement>(null);
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
    place, countyByFips, metric, setMetric, scope, setScope,
    selectedFips, setSelectedFips, selectedGeoid, setSelectedGeoid,
    tracts, tractStatus, ensureTracts, orgsByCountyFips,
  } = usePlace();
  const setScopeRef = useRef(setScope);
  setScopeRef.current = setScope;
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
    // crossOrigin lets the snapshot capture embed the tiles (OSM sends CORS).
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      crossOrigin: true,
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
      // Gray county context — the selected tract's county carries the color
      // in the tract pane above this one.
      outlineLayerRef.current = L.geoJSON(place.shapes, {
        pane: 'outlinePane',
        interactive: false,
        style: { fillColor: '#94a3b8', fillOpacity: 0.25, color: '#1e293b', weight: 0.8, opacity: 0.45 },
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
        // With a county selected, the rest of the state drops to gray so the
        // selection carries all the color.
        return {
          fillColor: !selectedFips || isSelected ? (colorFor(value, bins) ?? '#e2e8f0') : '#94a3b8',
          fillOpacity: isSelected ? 0 : selectedFips ? 0.3 : 0.6,
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
            // The selection-driven zoom effect handles the fitBounds, so
            // dropdown picks and map clicks behave identically.
            selectFipsRef.current(fips);
            ensureTractsRef.current();
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
    // Tract view shows the selected tract's county; county view shows the
    // drilldown tracts of the selected county (same set — one control row
    // drives both, so the county context is always known).
    const contextFips = scope === 'tract' && selectedGeoid ? selectedGeoid.slice(0, 5) : selectedFips;
    const features = contextFips
      ? tracts.tractShapes.features.filter((f) => String(f.id).startsWith(contextFips))
      : tracts.tractShapes.features;
    if (features.length === 0) return;

    const layer = L.geoJSON(
      { type: 'FeatureCollection', features } as GeoJSON.FeatureCollection,
      {
        pane: 'tractPane',
        // Canvas keeps the statewide 2,791-polygon fallback responsive; a
        // single county's tracts render as SVG. (Valid at runtime; Leaflet's
        // GeoJSONOptions type just doesn't declare `renderer`.)
        ...(scope === 'tract' && !contextFips && canvasRendererRef.current
          ? ({ renderer: canvasRendererRef.current } as object)
          : {}),
        style: (feat) => {
          const geoid = String(feat!.id);
          const tract = tractByGeoid.get(geoid);
          const value = tract ? metricValue(metric, place, tract) : null;
          const isSelected = geoid === selectedGeoid;
          const dimmed = scope === 'tract' && selectedGeoid != null && !isSelected;
          return {
            fillColor: dimmed ? '#94a3b8' : (colorFor(value, bins) ?? '#e2e8f0'),
            fillOpacity: dimmed ? 0.35 : 0.7,
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
          // Clicking a drilldown tract enters the tract view; clicking the
          // selected tract again steps back to its county view.
          lyr.on('click', () => {
            if (selectedGeoidRef.current === geoid) {
              selectGeoidRef.current(null);
              setScopeRef.current('county');
            } else {
              selectFipsRef.current(tract.county);
              selectGeoidRef.current(geoid);
              setScopeRef.current('tract');
            }
          });
        },
      },
    ).addTo(map);
    tractLayerRef.current = layer;
  }, [place, tracts, tractStatus, scope, selectedFips, selectedGeoid, metric, countyByFips]);

  // Org markers.
  const [showOrgs, setShowOrgs] = useState(true);
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    if (!showOrgs) return;

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
  }, [organizations, showOrgs]);

  // Zoom to the selected county — whether it was picked on the map or in the
  // dropdown — and back out to the state when the selection is cleared. The
  // initial mount is skipped so the page still lands on the statewide view.
  const prevFipsRef = useRef<string | null | undefined>(undefined);
  const prevScopeRef = useRef(scope);
  useEffect(() => {
    const map = mapRef.current;
    const prev = prevFipsRef.current;
    prevFipsRef.current = selectedFips;
    const prevScope = prevScopeRef.current;
    prevScopeRef.current = scope;
    if (!map) return;
    if (!selectedFips) {
      const bounds = (countyLayerRef.current ?? outlineLayerRef.current)?.getBounds();
      if (bounds?.isValid()) map.fitBounds(bounds.pad(0.02));
      return;
    }
    // Zoom to the county when it is newly selected, or when stepping back to
    // the county view from a tract.
    if (scope !== 'county' || !place || prev === undefined) return;
    if (selectedFips === prev && prevScope !== 'tract') return;
    const feat = place.shapes.features.find((f: GeoJSON.Feature) => featFips(f) === selectedFips);
    const bounds = feat && L.geoJSON(feat).getBounds();
    if (bounds?.isValid()) map.fitBounds(bounds.pad(0.15));
  }, [selectedFips, scope, place]);

  // Same for tracts: zoom in on selection (from map click or the tract
  // picker), back out to the state on clear.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || scope !== 'tract' || !tracts) return;
    if (selectedGeoid) {
      const feat = tracts.tractShapes.features.find((f) => String(f.id) === selectedGeoid);
      const bounds = feat && L.geoJSON(feat as GeoJSON.Feature).getBounds();
      // A tract alone is a sliver — pad well out and cap the zoom so the
      // surrounding area stays legible.
      if (bounds?.isValid()) map.fitBounds(bounds.pad(1.5), { maxZoom: 13 });
    } else {
      const bounds = outlineLayerRef.current?.getBounds();
      if (bounds?.isValid()) map.fitBounds(bounds.pad(0.02));
    }
  }, [selectedGeoid, scope, tracts]);

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
    <div ref={cardRef} className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm h-full flex flex-col">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-base font-bold text-slate-800">Climate Vulnerability Map</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md">
            {scope === 'county'
              ? selectedFips
                ? 'Tracts of the selected county, shaded by national rank — darker means more vulnerable. Click a tract for its report, or ✕ to zoom back out.'
                : 'Counties shaded by how they rank among all 3,143 U.S. counties — darker means more vulnerable. Click a county (or an org) to load its report.'
              : 'Click another tract to switch reports, or ✕ to step back up to the county.'}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-1.5">
            <SnapshotButton
              target={cardRef}
              label={() => (selectedCounty ? `${selectedCounty.county} map` : selectedTract ? `${selectedTract.name} map` : 'Georgia CVI map')}
            />
            <button
              onClick={() => setShowOrgs((v) => !v)}
            className={`inline-flex items-center gap-1.5 text-xs font-semibold rounded-lg border px-3 py-1.5 transition-colors ${
              showOrgs ? 'bg-white text-slate-600 border-slate-200 hover:border-slate-300' : 'bg-slate-100 text-slate-400 border-slate-200 hover:text-slate-600'
            }`}
            title={showOrgs ? 'Hide organization pins' : 'Show organization pins'}
          >
            {showOrgs ? <Eye size={13} /> : <EyeOff size={13} />}
            {showOrgs ? 'Hide' : 'Show'} organization pins
            </button>
          </div>
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
              onClick={() => { setSelectedGeoid(null); setScope('county'); }}
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
