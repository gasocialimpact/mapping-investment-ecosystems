import { Building2, TrendingUp } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { usePlace } from '../../context/PlaceContext';
import type { Organization, CapitalFlow } from '../../types';
import { formatCurrency } from '../../lib/format';
import { pctileDisplay } from '../../lib/choropleth';
import { EcosystemLayers } from './EcosystemLayers';

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

// The full-width place report that loads below the map when a county is
// selected — the Explorer's County Report structure, plus ecosystem layers.
export function PlaceReport({ scope }: { scope: 'county' | 'tract' }) {
  const { data, maps } = useData();
  const { place, countyByFips, selectedFips, orgsByCountyFips, tracts, tractStatus } = usePlace();

  if (!place) return null;
  const county = selectedFips ? countyByFips.get(selectedFips) : null;

  if (!county) {
    return (
      <div className="mt-6 border border-dashed border-slate-300 rounded-lg py-14 text-center">
        <h3 className="text-base font-bold text-slate-700">County Report</h3>
        <p className="text-sm text-slate-400 mt-1">
          Select a jurisdiction above (or click the map) to load its report.
        </p>
      </div>
    );
  }

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

  const countyTracts = (tracts?.tracts ?? []).filter((t) => t.county === county.fips);

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5">
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
        <ReportCard title="Top CVI Drivers" sub={`The measures where ${county.county} ranks highest among all U.S. counties.`}>
          <ul className="mt-2 space-y-2.5">
            {county.drivers.map(([label, pctile, category], i) => (
              <li key={i} className="flex items-center gap-2.5 text-[13px]">
                <span className="text-slate-300 font-bold w-4 text-right shrink-0">{i + 1}</span>
                <span className="flex-1 min-w-0 truncate text-slate-700" title={label}>{label}</span>
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 text-slate-600"
                  style={{ background: `${DRIVER_CATEGORY_COLORS[category] ?? '#939699'}33` }}
                >
                  {category}
                </span>
                <span className="w-20 shrink-0 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <span className="block h-full rounded-full" style={{ width: `${pctile}%`, background: DRIVER_CATEGORY_COLORS[category] ?? '#939699' }} />
                </span>
                <b className="w-8 text-right tabular-nums text-slate-600 shrink-0">{Math.round(pctile)}</b>
              </li>
            ))}
          </ul>
        </ReportCard>

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
      </div>

      {/* Census tract table, shown in tract scope */}
      {scope === 'tract' && (
        <div className="mt-5">
          <ReportCard
            title={`Census Tracts (${countyTracts.length})`}
            sub={tractStatus === 'loading' ? 'Loading tract data…' : 'National percentiles per tract — the same tracts shaded on the map above.'}
          >
            {countyTracts.length > 0 && (
              <div className="max-h-72 overflow-y-auto mt-2">
                <table className="w-full text-[13px]">
                  <thead className="sticky top-0 bg-white">
                    <tr className="text-[10px] text-slate-400 uppercase tracking-wide">
                      <th className="text-left font-bold py-1">Tract</th>
                      <th className="text-right font-bold py-1">Overall</th>
                      <th className="text-right font-bold py-1">Baseline</th>
                      <th className="text-right font-bold py-1">Climate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...countyTracts].sort((a, b) => b.pctiles[0] - a.pctiles[0]).map((t) => (
                      <tr key={t.geoid} className="border-t border-slate-50">
                        <td className="py-1 text-slate-600">{t.name}</td>
                        {t.pctiles.map((p, i) => (
                          <td key={i} className="py-1 text-right tabular-nums text-slate-600">{p != null ? `${Math.round(p)}th` : '—'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ReportCard>
        </div>
      )}

      <EcosystemLayers
        title="The ecosystem in this place"
        orgs={orgs}
        flows={flows}
        emptyNote={`No mapped ecosystem organizations in ${county.county} yet — a gap worth noting in itself.`}
      />
    </section>
  );
}

function ReportCard({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm">
      <h3 className="text-base font-bold text-slate-800">{title}</h3>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
      {children}
    </div>
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
