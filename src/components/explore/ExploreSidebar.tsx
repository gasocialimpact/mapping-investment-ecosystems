import { useMemo } from 'react';
import { usePlace } from '../../context/PlaceContext';
import type { PlaceCounty } from '../../types/place';
import { pctileDisplay } from '../../lib/choropleth';

// Which of the three CVI layers the sidebar ranks by (falls back to Overall
// when a demographic indicator is shading the map).
function cviIndex(metric: string): number {
  return metric === 'baseline' ? 1 : metric === 'climate' ? 2 : 0;
}

// Highest & Lowest ranked lists — straight from the Explorer's structure,
// plus an ecosystem-lens line the Explorer doesn't have.
export function HighLowCard() {
  const { place, metric, setSelectedFips, ensureTracts, orgsByCountyFips } = usePlace();
  if (!place) return null;
  const mi = cviIndex(metric);
  const label = place.metricLabels[mi];

  const sorted = [...place.counties].sort((a, b) => b.scores[mi] - a.scores[mi]);
  const highest = sorted.slice(0, 5);
  const lowest = sorted.slice(-5).reverse();

  const top10 = place.counties.filter((c) => c.pctiles[0] >= 90);
  const top10NoOrgs = top10.filter((c) => !(orgsByCountyFips.get(c.fips)?.length));

  const pick = (c: PlaceCounty) => {
    setSelectedFips(c.fips);
    ensureTracts();
  };

  const List = ({ title, items }: { title: string; items: PlaceCounty[] }) => (
    <div>
      <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-slate-200 pb-1.5">{title}</h4>
      <ul className="mt-2 space-y-1">
        {items.map((c) => (
          <li key={c.fips} className="flex justify-between text-[13px]">
            <button onClick={() => pick(c)} className="text-brand-green font-semibold hover:underline text-left">
              {c.county}
            </button>
            <span className="text-slate-500 tabular-nums">{c.scores[mi].toFixed(2)}</span>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm">
      <h3 className="text-base font-bold text-slate-800">Highest &amp; Lowest — {label}</h3>
      <p className="text-xs text-slate-500 mt-1">Click a name to open its report.</p>
      <div className="grid grid-cols-2 gap-4 mt-3">
        <List title="Most vulnerable" items={highest} />
        <List title="Least vulnerable" items={lowest} />
      </div>
      <div className="mt-4 pt-3 border-t border-slate-200 text-xs text-slate-500">
        <span className="font-semibold text-slate-700">Ecosystem lens:</span> of the {top10.length} Georgia
        counties in the U.S. top-10% most vulnerable, <span className="font-semibold text-slate-700">{top10NoOrgs.length} have
        no mapped organizations</span>.
      </div>
    </div>
  );
}

// Score distribution histogram; the highlighted bar contains the selection.
export function DistributionCard() {
  const { place, metric, selectedFips } = usePlace();
  const mi = cviIndex(metric);

  const { bars, hlBin } = useMemo(() => {
    if (!place) return { bars: [] as number[], hlBin: -1 };
    const scores = place.counties.map((c) => c.scores[mi]);
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const N = 16;
    const bin = (s: number) => Math.min(N - 1, Math.floor(((s - min) / (max - min || 1)) * N));
    const bars = Array(N).fill(0);
    scores.forEach((s) => bars[bin(s)]++);
    const sel = selectedFips ? place.counties.find((c) => c.fips === selectedFips) : null;
    return { bars, hlBin: sel ? bin(sel.scores[mi]) : -1 };
  }, [place, mi, selectedFips]);

  if (!place) return null;
  const maxBar = Math.max(...bars, 1);

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm">
      <h3 className="text-base font-bold text-slate-800">Score Distribution — {place.metricLabels[mi]}</h3>
      <p className="text-xs text-slate-500 mt-1">
        {hlBin >= 0 ? 'The highlighted bar contains the selected county.' : 'Select a county to highlight where it falls.'}
      </p>
      <div className="flex items-end gap-1 h-20 mt-3">
        {bars.map((v, i) => (
          <div
            key={i}
            className={`flex-1 rounded-t ${i === hlBin ? 'bg-brand-orange' : 'bg-brand-green-soft'}`}
            style={{ height: `${(v / maxBar) * 100}%`, minHeight: v > 0 ? 3 : 0 }}
            title={`${v} counties`}
          />
        ))}
      </div>
    </div>
  );
}

// Simplified investment-gap card: one headline number and a short ranked
// list — the detailed scatter/table view was retired as overkill.
export function GapsCard() {
  const { place, setSelectedFips, ensureTracts, orgsByCountyFips } = usePlace();

  const gaps = useMemo(() => {
    if (!place) return [];
    const craIdx = place.cie.programs.findIndex((p) => p.includes('CRA'));
    const values = place.counties
      .map((c) => place.cie.areas[c.cieArea]?.percap[craIdx])
      .filter((v): v is number => v != null)
      .sort((a, b) => a - b);
    const median = values[Math.floor(values.length / 2)];
    return place.counties
      .filter((c) => {
        const percap = place.cie.areas[c.cieArea]?.percap[craIdx];
        return c.pctiles[0] >= 80 && (percap == null || percap < median);
      })
      .sort((a, b) => b.pctiles[0] - a.pctiles[0]);
  }, [place]);

  if (!place || gaps.length === 0) return null;

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm">
      <h3 className="text-base font-bold text-slate-800">Investment Gaps</h3>
      <p className="text-xs text-slate-500 mt-1">
        <span className="font-semibold text-brand-orange">{gaps.length} counties</span> rank in the top-20%
        most vulnerable nationally but receive below-median CRA small-business lending.
      </p>
      <ul className="mt-3 space-y-1">
        {gaps.slice(0, 6).map((c) => {
          const orgs = orgsByCountyFips.get(c.fips)?.length ?? 0;
          return (
            <li key={c.fips} className="flex items-center justify-between text-[13px]">
              <button
                onClick={() => { setSelectedFips(c.fips); ensureTracts(); }}
                className="flex items-center gap-1.5 text-left font-semibold text-slate-700 hover:text-brand-orange"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-brand-orange shrink-0" />
                {c.county}
              </button>
              <span className="text-slate-400 tabular-nums text-xs">
                {pctileDisplay(c.pctiles[0])}th pctile · {orgs || 'no'} org{orgs === 1 ? '' : 's'}
              </span>
            </li>
          );
        })}
      </ul>
      {gaps.length > 6 && (
        <p className="text-[11px] text-slate-400 mt-2">+{gaps.length - 6} more — darker counties on the map with few markers tell the same story.</p>
      )}
    </div>
  );
}
