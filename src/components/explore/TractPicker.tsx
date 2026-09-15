import { useEffect, useState } from 'react';
import { usePlace } from '../../context/PlaceContext';
import { loadTractPlaces } from '../../data/census';

// County → tract dropdowns as an alternative to clicking the right tract on
// the map. Tracts are labeled with the city/CDP their centroid falls in
// (tracts have no names of their own; unincorporated tracts show the number
// alone) — see scripts/build-tract-places.mjs. Rendered both above the map
// (tract scope) and in the tract report; each instance follows the shared
// tract selection.
export function TractPicker() {
  const { countyByFips, tracts, tractStatus, selectedGeoid, setSelectedGeoid } = usePlace();
  const [countyFips, setCountyFips] = useState('');
  const [placeNames, setPlaceNames] = useState<Record<string, string>>({});
  useEffect(() => { loadTractPlaces().then(setPlaceNames).catch(() => {}); }, []);

  // Follow along when a tract is picked on the map instead.
  useEffect(() => {
    if (!selectedGeoid) return;
    const t = tracts?.tracts.find((x) => x.geoid === selectedGeoid);
    if (t) setCountyFips(t.county);
  }, [selectedGeoid, tracts]);

  const counties = [...countyByFips.values()].sort((a, b) => a.county.localeCompare(b.county));
  const countyTracts = countyFips
    ? (tracts?.tracts ?? []).filter((t) => t.county === countyFips)
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
    : [];
  const tractLabel = (t: { geoid: string; name: string }) => {
    const place = placeNames[t.geoid]?.replace(/ (city|town|CDP)$/, (m) => (m === ' CDP' ? '' : m));
    return place ? `${t.name} — ${place}` : t.name;
  };

  const selectCls = 'text-sm border border-slate-200 rounded-md px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-green/40 max-w-full';
  return (
    <div className="flex items-center gap-2.5 flex-wrap mt-4 print:hidden">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Find a tract</span>
      <select
        value={countyFips}
        onChange={(e) => setCountyFips(e.target.value)}
        className={selectCls}
        aria-label="County"
      >
        <option value="">Choose a county…</option>
        {counties.map((c) => <option key={c.fips} value={c.fips}>{c.county}</option>)}
      </select>
      <select
        value={selectedGeoid && countyTracts.some((t) => t.geoid === selectedGeoid) ? selectedGeoid : ''}
        onChange={(e) => e.target.value && setSelectedGeoid(e.target.value)}
        disabled={!countyFips || tractStatus === 'loading'}
        className={`${selectCls} disabled:bg-slate-50 disabled:text-slate-400`}
        aria-label="Census tract"
      >
        <option value="">
          {!countyFips ? 'Then choose a tract…'
            : tractStatus === 'loading' ? 'Loading tracts…'
            : `Choose from ${countyTracts.length} tracts…`}
        </option>
        {countyTracts.map((t) => <option key={t.geoid} value={t.geoid}>{tractLabel(t)}</option>)}
      </select>
      <span className="text-[11px] text-slate-400">or click a tract on the map</span>
    </div>
  );
}
