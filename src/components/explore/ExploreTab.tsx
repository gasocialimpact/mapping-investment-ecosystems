import { useEffect, useMemo, useRef, useState } from 'react';
import { useData } from '../../context/DataContext';
import { usePlace } from '../../context/PlaceContext';
import { useEmbed } from '../../context/EmbedContext';
import { loadTractPlaces } from '../../data/census';
import { ExploreMap } from './ExploreMap';
import { HighLowCard, DistributionCard, GapsCard } from './ExploreSidebar';
import { PlaceReport } from './PlaceReport';

// The Explore tab: the Community Data Explorer's information structure with
// the Ecosystem Map's branding, and the ecosystem layered into each place.
export function ExploreTab() {
  const { data } = useData();
  const { place, selectedFips, selectedGeoid } = usePlace();
  const { scrollIntoView } = useEmbed();
  // Seeded with the initial (default DeKalb) selection so the page doesn't
  // auto-scroll to the report on first load.
  const prevSelection = useRef<string | null>(selectedGeoid ?? selectedFips);

  // Scroll to the report when a county or tract is newly selected. In flow
  // mode the host page owns the scrollbar, so this is a request rather than a
  // direct scroll — a cross-origin frame cannot move its parent itself.
  useEffect(() => {
    const current = selectedGeoid ?? selectedFips;
    if (current && current !== prevSelection.current) {
      setTimeout(() => scrollIntoView(document.getElementById('place-report')), 100);
    }
    prevSelection.current = current;
  }, [selectedFips, selectedGeoid, scrollIntoView]);

  const counties = useMemo(
    () => [...(place?.counties ?? [])].sort((a, b) => a.county.localeCompare(b.county)),
    [place],
  );

  return (
    <div className="pt-2 pb-10">
      {/* One control row drives scope, map and report: a county alone loads
          the county view; adding a tract switches everything to that tract. */}
      <PlacePicker counties={counties} />

      {/* Map + sidebar — the map card stretches to match the sidebar height */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.55fr_1fr] pdf:grid-cols-[1.55fr_1fr] gap-5 mt-5">
        <ExploreMap organizations={data?.organizations ?? []} />
        <div className="space-y-5">
          <HighLowCard />
          <DistributionCard />
          <GapsCard />
        </div>
      </div>

      {/* Place report */}
      <PlaceReport />

      <p className="text-[11px] text-slate-400 mt-10 max-w-3xl">
        Data: U.S. Climate Vulnerability Index (Lewis et al. 2023) · CDC/ATSDR SVI 2022 (ACS 5-year
        estimates) · Federal Reserve Bank of St. Louis Community Investment Explorer · Ecosystem
        database synced nightly from Airtable.
      </p>
    </div>
  );
}

// County + tract dropdowns that set the shared selection (and with it the
// scope): county only → county view; county + tract → tract view. Tracts are
// labeled with the city/CDP their centroid falls in.
function PlacePicker({ counties }: { counties: { fips: string; county: string }[] }) {
  const {
    scope, setScope, selectedFips, setSelectedFips,
    selectedGeoid, setSelectedGeoid, tracts, tractStatus, ensureTracts,
  } = usePlace();
  const [placeNames, setPlaceNames] = useState<Record<string, string>>({});
  useEffect(() => { loadTractPlaces().then(setPlaceNames).catch(() => {}); }, []);

  // The county in play: the tract's county in tract view, else the selection.
  const countyFips = scope === 'tract' && selectedGeoid ? selectedGeoid.slice(0, 5) : selectedFips;
  useEffect(() => { if (countyFips) ensureTracts(); }, [countyFips, ensureTracts]);

  const countyTracts = countyFips
    ? (tracts?.tracts ?? []).filter((t) => t.county === countyFips)
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
    : [];
  const tractLabel = (t: { geoid: string; name: string }) => {
    const place = placeNames[t.geoid]?.replace(/ CDP$/, '');
    return place ? `${t.name} — ${place}` : t.name;
  };

  const selectCls = 'text-[13px] font-semibold border border-slate-200 rounded-full px-4 py-2 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-green max-w-full';
  return (
    <div className="flex items-center gap-3 flex-wrap mt-6">
      <button
        onClick={() => { setScope('county'); setSelectedGeoid(null); setSelectedFips(null); }}
        className={`text-[13px] font-bold rounded-full px-4 py-2 transition-colors ${
          !countyFips ? 'bg-brand-green text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
        }`}
      >
        All counties
      </button>
      <select
        value={countyFips ?? ''}
        onChange={(e) => {
          const fips = e.target.value || null;
          setScope('county');
          setSelectedGeoid(null);
          setSelectedFips(fips);
          if (fips) ensureTracts();
        }}
        className={selectCls}
        aria-label="County"
      >
        <option value="">Choose a county…</option>
        {counties.map((c) => (
          <option key={c.fips} value={c.fips}>{c.county}</option>
        ))}
      </select>
      <select
        value={selectedGeoid ?? ''}
        onChange={(e) => {
          const geoid = e.target.value;
          if (geoid) {
            setSelectedFips(geoid.slice(0, 5));
            setSelectedGeoid(geoid);
            setScope('tract');
          } else {
            setSelectedGeoid(null);
            setScope('county');
          }
        }}
        disabled={!countyFips || tractStatus === 'loading'}
        className={`${selectCls} disabled:bg-slate-50 disabled:text-slate-400`}
        aria-label="Census tract"
      >
        <option value="">
          {!countyFips ? 'Census tract (pick a county first)…'
            : tractStatus === 'loading' ? 'Loading tracts…'
            : 'County overview — or pick a tract…'}
        </option>
        {countyTracts.map((t) => <option key={t.geoid} value={t.geoid}>{tractLabel(t)}</option>)}
      </select>
      <span className="text-xs text-slate-400">or click the map</span>
    </div>
  );
}

