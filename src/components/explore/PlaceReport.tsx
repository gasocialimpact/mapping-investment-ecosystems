import { useEffect, useState } from 'react';
import { Building2, TrendingUp } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { usePlace } from '../../context/PlaceContext';
import { loadTractPlaces } from '../../data/census';
import { AliceTrend } from './AliceTrend';
import { ToplineLocalData } from './ToplineLocalData';
import type { Organization, CapitalFlow } from '../../types';
import { formatCurrency } from '../../lib/format';
import { pctileDisplay } from '../../lib/choropleth';
import { EcosystemLayers } from './EcosystemLayers';
import { CountyInvestmentTrend, TractInvestmentTrend } from '../capital/PlaceInvestmentTrend';
import { SnapshotCard } from '../SnapshotButton';
import { SavePdfButton } from '../SavePdfButton';
import { TractPicker } from './TractPicker';
import { CapitalStatewideSection, CapitalCountySection } from '../capital/CapitalTab';

// Category chip colors, consistent with the CVI meters used elsewhere.
const DRIVER_CATEGORY_COLORS: Record<string, string> = {
  Health: '#53c3c2',
  'Social & Economic': '#f1d25b',
  Infrastructure: '#279a49',
  Environment: '#66b445',
  'CC: Health': '#53c3c2',
  'CC: Social & Economic': '#f1d25b',
  'CC: Extreme Events': '#f15921',
  'CC: Environment': '#66b445',
};

// Colors for the 8 profile categories (Overall + 4 baseline + 3 climate).
const PROFILE_COLORS = ['#4750a2', '#53c3c2', '#f1d25b', '#279a49', '#66b445', '#53c3c2', '#f1d25b', '#f15921'];

// The full-width place report below the map: the Explorer's County Report
// structure plus ecosystem layers, or a tract report in tract scope.
export function PlaceReport() {
  const { scope } = usePlace();
  return scope === 'tract' ? <TractReport /> : <CountyReport />;
}

type CountyReportView = 'topline' | 'data' | 'ecosystem';

// --- Statewide report --------------------------------------------------------

// The default (All counties) report: Georgia-level figures from the same
// sources that feed the county and tract reports. The ecosystem itself lives
// on the Framing Our Ecosystem tab, so this report points there instead of
// repeating it.
function StateReport() {
  const { data } = useData();
  const { place } = usePlace();
  const [view, setView] = useState<Exclude<CountyReportView, 'ecosystem'>>('topline');

  if (!place) return null;
  const demo = place.demographics;
  const orgCount = data?.organizations.length ?? 0;
  const totalCapital = (data?.capitalFlows ?? []).reduce((s, f) => s + (f.amount ?? 0), 0);
  const fmtVal = (v: number | null, unit: string) =>
    v == null ? '—' : unit === '%' ? `${v}%` : `${v}`;

  const demoGroups: { group: string; indexes: number[] }[] = [];
  demo.labels.forEach((_, i) => {
    const group = demo.groups[i];
    let bucket = demoGroups.find((g) => g.group === group);
    if (!bucket) {
      bucket = { group, indexes: [] };
      demoGroups.push(bucket);
    }
    bucket.indexes.push(i);
  });

  return (
    <section id="place-report" className="mt-8 border-t-[3px] border-brand-indigo pt-6">
      <div className="flex items-baseline gap-4 flex-wrap">
        <h2 className="text-2xl font-bold text-slate-800">Georgia — Statewide</h2>
        <span className="text-sm text-slate-500">
          159 counties · 2,796 census tracts · pick a county or tract above for its own report
        </span>
      </div>

      <div className="flex gap-5 mt-3">
        <span className="flex items-center gap-1.5 text-sm">
          <Building2 size={14} className="text-brand-indigo" />
          <b>{orgCount}</b>
          <span className="text-slate-500">ecosystem orgs statewide</span>
        </span>
        {totalCapital > 0 && (
          <span className="flex items-center gap-1.5 text-sm">
            <TrendingUp size={14} className="text-brand-green" />
            <b className="text-brand-green">{formatCurrency(totalCapital)}</b>
            <span className="text-slate-500">in tracked flows</span>
          </span>
        )}
      </div>

      {/* Report sub-tabs — the ecosystem view lives on its own tab */}
      <div className="flex items-center gap-3 flex-wrap mt-4 print:hidden">
        {([
          ['topline', 'Topline Local Data'],
          ['data', 'Vulnerable Populations & Investment Trends'],
        ] as [Exclude<CountyReportView, 'ecosystem'>, string][]).map(([v, label]) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`text-sm font-medium px-3 py-1.5 rounded-md border transition-colors ${
              view === v
                ? 'bg-brand-indigo text-white border-brand-indigo'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            }`}
          >
            {label}
          </button>
        ))}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('gsic:set-tab', { detail: 'framing' }))}
          className="text-sm font-medium px-3 py-1.5 rounded-md border border-dashed border-slate-300 text-slate-500 hover:text-brand-green hover:border-brand-green transition-colors"
          title="The statewide ecosystem view lives on the Framing Our Ecosystem tab"
        >
          The Ecosystem — see Framing Our Ecosystem →
        </button>
        <span className="ml-auto"><SavePdfButton bare /></span>
      </div>

      {view === 'topline' && (
        <ToplineLocalData
          level="state"
          id="13"
          label="Georgia"
          lifeExpectancy={demo.stateBenchmark[15] ?? null}
          stateLifeExpectancy={demo.stateBenchmark[15] ?? null}
        />
      )}

      {view === 'data' && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 pdf:grid-cols-2 gap-5 mt-5">
            <ReportCard title="Populations at Risk" sub="Georgia vs. the U.S. — the benchmarks every county report is measured against. Red = worse than the national figure.">
              <table className="w-full text-[13px] mt-2">
                <thead>
                  <tr className="text-[10px] text-slate-400 uppercase tracking-wide">
                    <th className="text-left font-bold py-1">Indicator</th>
                    <th className="text-right font-bold py-1">Georgia</th>
                    <th className="text-right font-bold py-1">U.S.</th>
                  </tr>
                </thead>
                <tbody>
                  {demoGroups.map((g) => (
                    [
                      <tr key={g.group}>
                        <td colSpan={3} className="pt-2.5 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{g.group}</td>
                      </tr>,
                      ...g.indexes.map((i) => {
                        const ga = demo.stateBenchmark[i];
                        const us = demo.usBenchmark[i];
                        const worse = ga != null && us != null &&
                          (demo.labels[i].includes('Life expectancy') ? ga < us : ga > us);
                        return (
                          <tr key={i} className="border-t border-slate-50">
                            <td className="py-1 pr-2 text-slate-600">{demo.labels[i]}</td>
                            <td className={`py-1 text-right tabular-nums font-semibold ${worse ? 'text-[#b93c11]' : 'text-slate-800'}`}>{fmtVal(ga, demo.units[i])}</td>
                            <td className="py-1 text-right tabular-nums text-slate-500">{fmtVal(us, demo.units[i])}</td>
                          </tr>
                        );
                      }),
                    ]
                  ))}
                </tbody>
              </table>
            </ReportCard>

            <AliceTrend fips="state" countyLabel="Georgia" />
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500">Investment trends statewide</h3>
            <p className="text-xs text-slate-400 mt-1">Community-investment dollars across programs and years — the statewide picture behind each county's investment cards.</p>
            <CapitalStatewideSection />
          </div>
        </>
      )}
    </section>
  );
}

function CountyReport() {
  const { data, maps } = useData();
  const { place, countyByFips, selectedFips, orgsByCountyFips } = usePlace();
  const [view, setView] = useState<CountyReportView>('topline');
  // A fresh county starts back on the first sub-tab.
  useEffect(() => setView('topline'), [selectedFips]);

  if (!place) return null;
  const county = selectedFips ? countyByFips.get(selectedFips) : null;

  // No county selected — the statewide report, built from the same sources
  // that feed every county and tract report.
  if (!county) return <StateReport />;

  const orgIds = orgsByCountyFips.get(county.fips) ?? [];
  const orgs = orgIds.map((id) => maps.orgById.get(id)).filter((o): o is Organization => !!o);
  const orgIdSet = new Set(orgIds);
  const flows: CapitalFlow[] = (data?.capitalFlows ?? []).filter(
    (f) => (f.sourceId && orgIdSet.has(f.sourceId)) || (f.recipientId && orgIdSet.has(f.recipientId)),
  );
  const totalCapital = flows.reduce((sum, f) => sum + (f.amount ?? 0), 0);

  const cieArea = place.cie.areas[county.cieArea];
  const demo = place.demographics;

  const demoGroups: { group: string; indexes: number[] }[] = [];
  demo.labels.forEach((_, i) => {
    const group = demo.groups[i];
    let bucket = demoGroups.find((g) => g.group === group);
    if (!bucket) {
      bucket = { group, indexes: [] };
      demoGroups.push(bucket);
    }
    bucket.indexes.push(i);
  });

  const fmtVal = (v: number | null, unit: string) =>
    v == null ? '—' : unit === '%' ? `${v}%` : `${v}`;
  const fmtChange = (v: number | null) => (v == null ? '—' : `${v > 0 ? '+' : ''}${v}`);

  return (
    <section id="place-report" className="mt-8 border-t-[3px] border-brand-indigo pt-6">
      <div className="flex items-baseline gap-4 flex-wrap">
        <h2 className="text-2xl font-bold text-slate-800">{county.county}, Georgia</h2>
        <span className="text-sm text-slate-500">
          FIPS {county.fips}
          {county.cieArea !== 'Georgia' && cieArea && <> · {county.cieArea} ({cieArea.type} area)</>}
        </span>
        {county.pctiles[0] != null && (
          <span className="text-xs font-bold text-[#b93c11] bg-[#fdece4] rounded-full px-3 py-1">
            More vulnerable than {pctileDisplay(county.pctiles[0])}% of U.S. counties
          </span>
        )}
      </div>

      <div className="flex gap-5 mt-3">
        <span className="flex items-center gap-1.5 text-sm">
          <Building2 size={14} className="text-brand-indigo" />
          <b>{orgs.length}</b>
          <span className="text-slate-500">ecosystem org{orgs.length !== 1 ? 's' : ''}</span>
        </span>
        {totalCapital > 0 && (
          <span className="flex items-center gap-1.5 text-sm">
            <TrendingUp size={14} className="text-brand-green" />
            <b className="text-brand-green">{formatCurrency(totalCapital)}</b>
            <span className="text-slate-500">in tracked flows</span>
          </span>
        )}
      </div>

      {/* Report sub-tabs */}
      <div className="flex items-center gap-3 flex-wrap mt-4 print:hidden">
        {([
          ['topline', 'Topline Local Data'],
          ['data', 'Vulnerable Populations & Investment Trends'],
          ['ecosystem', `The Ecosystem in this Place${orgs.length ? ` (${orgs.length})` : ''}`],
        ] as [CountyReportView, string][]).map(([v, label]) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`text-sm font-medium px-3 py-1.5 rounded-md border transition-colors ${
              view === v
                ? 'bg-brand-indigo text-white border-brand-indigo'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            }`}
          >
            {label}
          </button>
        ))}
        <span className="ml-auto"><SavePdfButton bare /></span>
      </div>

      {view === 'topline' && (
        <ToplineLocalData
          level="county"
          id={county.fips}
          label={`${county.county}`}
          lifeExpectancy={county.demo[15] ?? null}
          stateLifeExpectancy={demo.stateBenchmark[15] ?? null}
        />
      )}
      {view === 'ecosystem' && (
        <EcosystemLayers
          title=""
          orgs={orgs}
          flows={flows}
          emptyNote={`No mapped ecosystem organizations in ${county.county} yet — a gap worth noting in itself.`}
        />
      )}
      {view === 'data' && (
      <>
      {/* ~65/35 split: people & investment on the left, CVI on the right.
          Columns stretch and their last card absorbs the difference, so both
          sides end on the same line instead of leaving a white gap. */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.85fr_1fr] pdf:grid-cols-[1.85fr_1fr] gap-5 mt-5">
        <div className="flex flex-col gap-5 [&>*:last-child]:flex-1">
          {/* Populations at risk */}
          <ReportCard title="Populations at Risk" sub={`County · ${demo.benchmarkName} · U.S. comparison.`}>
            <table className="w-full text-[13px] mt-2">
              <thead>
                <tr className="text-[10px] text-slate-400 uppercase tracking-wide">
                  <th className="text-left font-bold py-1">Indicator</th>
                  <th className="text-right font-bold py-1">County</th>
                  <th className="text-right font-bold py-1">{demo.benchmarkName}</th>
                  <th className="text-right font-bold py-1">U.S.</th>
                  <th className="text-right font-bold py-1">Change</th>
                </tr>
              </thead>
              <tbody>
                {demoGroups.map((g) => (
                  [
                    <tr key={g.group}>
                      <td colSpan={5} className="pt-2.5 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{g.group}</td>
                    </tr>,
                    ...g.indexes.map((i) => {
                      const worse = county.demo[i] != null && demo.usBenchmark[i] != null &&
                        (demo.labels[i].includes('Life expectancy') ? county.demo[i]! < demo.usBenchmark[i]! : county.demo[i]! > demo.usBenchmark[i]!);
                      return (
                        <tr key={i} className="border-t border-slate-50">
                          <td className="py-1 pr-2 text-slate-600">{demo.labels[i]}</td>
                          <td className={`py-1 text-right tabular-nums font-semibold ${worse ? 'text-[#b93c11]' : 'text-slate-800'}`}>{fmtVal(county.demo[i], demo.units[i])}</td>
                          <td className="py-1 text-right tabular-nums text-slate-500">{fmtVal(demo.stateBenchmark[i], demo.units[i])}</td>
                          <td className="py-1 text-right tabular-nums text-slate-500">{fmtVal(demo.usBenchmark[i], demo.units[i])}</td>
                          <td className="py-1 text-right tabular-nums text-slate-400">{fmtChange(county.change[i])}</td>
                        </tr>
                      );
                    }),
                  ]
                ))}
              </tbody>
            </table>
            <p className="text-[10px] text-slate-400 mt-2">Change: {demo.changeNote}.</p>
          </ReportCard>

          {/* ALICE households over time */}
          <AliceTrend fips={county.fips} countyLabel={`${county.county}`} />

          {/* Community investment */}
          {cieArea && (
            <ReportCard
              title="Community Investment"
              sub={`Per resident per year — ${county.cieArea === 'Georgia' ? 'non-metro Georgia (county-level figures unavailable)' : `${county.cieArea} ${cieArea.type} area, not the county alone`} — vs. the U.S. average (tick). Source: Fed Community Investment Explorer.`}
            >
              <div className="space-y-2.5 mt-2">
                {place.cie.programs.map((program, i) => {
                  const local = cieArea.percap[i];
                  const us = place.cie.usPerCapita[i];
                  if (local == null && us == null) return null;
                  const max = Math.max(local ?? 0, us ?? 0) || 1;
                  return (
                    <div key={program}>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="text-slate-600">{program}</span>
                        <span className="font-medium tabular-nums text-slate-700">
                          {local == null ? '—' : `$${local.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                          <span className="text-slate-400 font-normal"> / US ${us == null ? '—' : us.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden relative">
                        <div className="h-full rounded-full bg-brand-teal" style={{ width: `${((local ?? 0) / max) * 100}%` }} />
                        {us != null && <div className="absolute top-0 h-full w-0.5 bg-slate-500" style={{ left: `${(us / max) * 100}%` }} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ReportCard>
          )}

          {/* Investment over time (tract-level program data, county rollup) */}
          <CountyInvestmentTrend fips={county.fips} countyLabel={`${county.county}`} />
        </div>

        <div className="flex flex-col gap-5 [&>*:last-child]:flex-1">
          {/* CVI profile */}
          <ReportCard title="CVI Category Profile" sub="County score vs. the median U.S. county (tick). Higher = more vulnerable.">
            <div className="space-y-3 mt-1">
              {place.metricKeys.map((_, i) => (
                <div key={i}>
                  <div className="flex justify-between text-[13px] mb-1">
                    <span className="font-semibold text-slate-700">{place.metricLabels[i]}</span>
                    <b className="tabular-nums">{county.scores[i]?.toFixed(3) ?? '—'}</b>
                  </div>
                  <Meter value={county.scores[i]} tick={place.nationalMedians[i]} color="#4750a2" />
                  {county.pctiles[i] != null && (
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      More vulnerable than {pctileDisplay(county.pctiles[i])}% of U.S. counties
                    </p>
                  )}
                </div>
              ))}
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-4 mb-2">By category</p>
            <div className="space-y-2">
              {place.profile.labels.map((label, i) => {
                const val = county.catScores[i];
                if (val == null || label === 'Overall CVI') return null;
                return (
                  <div key={label}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-slate-600">{label}</span>
                      <span className="font-medium tabular-nums">{val.toFixed(3)}</span>
                    </div>
                    <Meter value={val} tick={place.profile.medians[i]} color={PROFILE_COLORS[i]} thin />
                  </div>
                );
              })}
            </div>
          </ReportCard>

          {/* Drivers */}
          <ReportCard title="Top CVI Drivers" sub={`Where ${county.county} ranks highest among all U.S. counties.`}>
            <ul className="mt-2 space-y-2.5">
              {county.drivers.map(([label, pctile, category], i) => (
                <li key={i} className="flex items-center gap-2 text-xs">
                  <span className="text-slate-300 font-bold w-4 text-right shrink-0">{i + 1}</span>
                  <span className="flex-1 min-w-0 truncate text-slate-700" title={`${label} (${category})`}>{label}</span>
                  <span className="w-12 shrink-0 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <span className="block h-full rounded-full" style={{ width: `${pctile}%`, background: DRIVER_CATEGORY_COLORS[category] ?? '#939699' }} />
                  </span>
                  <b className="w-7 text-right tabular-nums text-slate-600 shrink-0">{Math.round(pctile)}</b>
                </li>
              ))}
            </ul>
            <p className="text-[10px] text-slate-400 mt-2">Bar color = CVI category · value = national percentile.</p>
          </ReportCard>
        </div>
      </div>

      {/* Program-level capital trends + CDFI lending detail for this county,
          migrated in from the Tracking Capital Changes Over Time tab. */}
      <div className="mt-6">
        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500">Capital over time</h3>
        <CapitalCountySection fips={county.fips} name={county.county} />
      </div>
      </>
      )}
    </section>
  );
}

// Tract-level report for the Census Tract Data scope, modeled on the
// Explorer's tract reports: CVI ranks + Populations at Risk vs. benchmarks.
function TractReport() {
  const { data, maps } = useData();
  const {
    place, countyByFips, selectedGeoid, tracts, tractStatus,
    setScope, setSelectedFips, orgsByCountyFips,
  } = usePlace();
  const [view, setView] = useState<CountyReportView>('topline');
  useEffect(() => setView('topline'), [selectedGeoid]);
  const [placeNames, setPlaceNames] = useState<Record<string, string>>({});
  useEffect(() => { loadTractPlaces().then(setPlaceNames).catch(() => {}); }, []);

  if (!place) return null;
  const tract = selectedGeoid ? tracts?.tracts.find((t) => t.geoid === selectedGeoid) : null;

  if (!tract) {
    return (
      <div className="mt-6 border border-dashed border-slate-300 rounded-lg py-10 text-center" id="place-report">
        <h3 className="text-base font-bold text-slate-700">Census Tract Report</h3>
        <p className="text-sm text-slate-400 mt-1">
          {tractStatus === 'loading' ? 'Loading census tracts…' : 'Pick a county and tract below, or click a tract on the map.'}
        </p>
        <div className="flex justify-center"><TractPicker /></div>
      </div>
    );
  }

  const county = countyByFips.get(tract.county);
  const par = place.parMeasures;

  const parGroups: { group: string; indexes: number[] }[] = [];
  par.labels.forEach((_, i) => {
    const group = par.groups[i];
    let bucket = parGroups.find((g) => g.group === group);
    if (!bucket) {
      bucket = { group, indexes: [] };
      parGroups.push(bucket);
    }
    bucket.indexes.push(i);
  });

  const fmtVal = (v: number | null, unit: string) =>
    v == null ? '—' : unit === '%' ? `${v}%` : `${v}`;

  const orgIds = county ? orgsByCountyFips.get(county.fips) ?? [] : [];
  const orgs = orgIds.map((id) => maps.orgById.get(id)).filter((o): o is Organization => !!o);
  const orgIdSet = new Set(orgIds);
  const flows: CapitalFlow[] = (data?.capitalFlows ?? []).filter(
    (f) => (f.sourceId && orgIdSet.has(f.sourceId)) || (f.recipientId && orgIdSet.has(f.recipientId)),
  );

  return (
    <section id="place-report" className="mt-8 border-t-[3px] border-brand-indigo pt-6">
      <div className="flex items-baseline gap-4 flex-wrap">
        <h2 className="text-2xl font-bold text-slate-800">{tract.name}</h2>
        <span className="text-sm text-slate-500">
          {placeNames[tract.geoid] && <>{placeNames[tract.geoid]} · </>}
          {county?.county}, Georgia · GEOID {tract.geoid}
        </span>
        {tract.pctiles[0] != null && (
          <span className="text-xs font-bold text-[#b93c11] bg-[#fdece4] rounded-full px-3 py-1">
            More vulnerable than {pctileDisplay(tract.pctiles[0])}% of U.S. tracts
          </span>
        )}
        {county && (
          <button
            onClick={() => { setScope('county'); setSelectedFips(county.fips); }}
            className="text-xs font-semibold text-brand-green hover:underline"
          >
            View {county.county} report →
          </button>
        )}
      </div>

      <TractPicker />

      {/* Report sub-tabs (mirrors the county report) */}
      <div className="flex items-center gap-3 flex-wrap mt-4 print:hidden">
        {([
          ['topline', 'Topline Local Data'],
          ['data', 'Vulnerable Populations & Investment Trends'],
          ['ecosystem', `The Ecosystem in this Place${orgs.length ? ` (${orgs.length})` : ''}`],
        ] as [CountyReportView, string][]).map(([v, lbl]) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`text-sm font-medium px-3 py-1.5 rounded-md border transition-colors ${
              view === v ? 'bg-brand-indigo text-white border-brand-indigo' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            }`}
          >
            {lbl}
          </button>
        ))}
        <span className="ml-auto"><SavePdfButton bare /></span>
      </div>

      {view === 'topline' && (
        <ToplineLocalData
          level="tract"
          id={tract.geoid}
          label={tract.name}
          lifeExpectancy={tract.par[15] ?? null}
          stateLifeExpectancy={par.stateBenchmark[15] ?? null}
        />
      )}

      {view === 'data' && (
      <div className="grid grid-cols-1 lg:grid-cols-[1.85fr_1fr] pdf:grid-cols-[1.85fr_1fr] gap-5 mt-5">
        {/* Populations at risk (tract) */}
        <ReportCard title="Populations at Risk" sub={`Tract · ${par.stateName} · U.S. comparison.`}>
          <table className="w-full text-[13px] mt-2">
            <thead>
              <tr className="text-[10px] text-slate-400 uppercase tracking-wide">
                <th className="text-left font-bold py-1">Indicator</th>
                <th className="text-right font-bold py-1">Tract</th>
                <th className="text-right font-bold py-1">{par.stateName}</th>
                <th className="text-right font-bold py-1">U.S.</th>
              </tr>
            </thead>
            <tbody>
              {parGroups.map((g) => (
                [
                  <tr key={g.group}>
                    <td colSpan={4} className="pt-2.5 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{g.group}</td>
                  </tr>,
                  ...g.indexes.map((i) => {
                    const worse = tract.par[i] != null && par.usBenchmark[i] != null &&
                      (par.labels[i].includes('Life expectancy') ? tract.par[i]! < par.usBenchmark[i]! : tract.par[i]! > par.usBenchmark[i]!);
                    return (
                      <tr key={i} className="border-t border-slate-50">
                        <td className="py-1 pr-2 text-slate-600">{par.labels[i]}</td>
                        <td className={`py-1 text-right tabular-nums font-semibold ${worse ? 'text-[#b93c11]' : 'text-slate-800'}`}>{fmtVal(tract.par[i], par.units[i])}</td>
                        <td className="py-1 text-right tabular-nums text-slate-500">{fmtVal(par.stateBenchmark[i], par.units[i])}</td>
                        <td className="py-1 text-right tabular-nums text-slate-500">{fmtVal(par.usBenchmark[i], par.units[i])}</td>
                      </tr>
                    );
                  }),
                ]
              ))}
            </tbody>
          </table>
        </ReportCard>

        <div className="flex flex-col gap-5 [&>*:last-child]:flex-1">
        {/* Tract CVI */}
        <ReportCard title="CVI Profile" sub="Tract score vs. the national median (tick). Higher = more vulnerable.">
          <div className="space-y-3 mt-1">
            {place.metricKeys.map((_, i) => (
              <div key={i}>
                <div className="flex justify-between text-[13px] mb-1">
                  <span className="font-semibold text-slate-700">{place.metricLabels[i]}</span>
                  <b className="tabular-nums">{tract.scores[i]?.toFixed(3) ?? '—'}</b>
                </div>
                <Meter value={tract.scores[i]} tick={place.nationalMedians[i]} color="#4750a2" />
                {tract.pctiles[i] != null && (
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    More vulnerable than {pctileDisplay(tract.pctiles[i])}% of U.S. tracts
                  </p>
                )}
              </div>
            ))}
          </div>
        </ReportCard>

        {/* Investment over time in this tract */}
        <TractInvestmentTrend geoid={tract.geoid} />
        </div>
      </div>
      )}

      {view === 'ecosystem' && county && (
        <EcosystemLayers
          title=""
          orgs={orgs}
          flows={flows}
          emptyNote={`No mapped ecosystem organizations in ${county.county} yet.`}
        />
      )}
    </section>
  );
}

function ReportCard({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <SnapshotCard title={title} sub={sub}>
      {children}
    </SnapshotCard>
  );
}

function Meter({ value, tick, color, thin }: { value: number | null; tick?: number; color: string; thin?: boolean }) {
  if (value == null) return null;
  return (
    <div className={`${thin ? 'h-1.5' : 'h-2'} rounded-full bg-slate-100 overflow-hidden relative`}>
      <div className="h-full rounded-full" style={{ width: `${Math.min(value * 100, 100)}%`, background: color }} />
      {tick != null && <div className="absolute top-0 h-full w-0.5 bg-slate-500/70" style={{ left: `${Math.min(tick * 100, 100)}%` }} />}
    </div>
  );
}
