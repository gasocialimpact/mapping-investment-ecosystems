import { useEffect, useState } from 'react';
import {
  loadCapitalTables, fmtDollars,
  PROGRAM_COLORS, DIRECTION_COLORS, INCOME_COLORS, REGION_COLORS,
} from '../../data/capital';
import type { CapitalTables } from '../../data/capital';
import { usePlace } from '../../context/PlaceContext';
import {
  StackedBarChart, LineChart, ShareBarChart, Legend, Tooltip,
  CHART_W, niceTicks,
} from './charts';
import type { StackSeries, LineSeries, TooltipState } from './charts';
import { SnapshotCard } from '../SnapshotButton';

type Scope = 'federal_only' | 'all_programs';

const CRA = 'CRA Small Business';

// Tab 2 — Tracking Capital Changes Over Time. A zoomed-out statewide view of
// community-investment dollars, 2018–2022, with an optional county lens.
export function CapitalTab() {
  const [tables, setTables] = useState<CapitalTables | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<Scope>('federal_only');
  const [countyFips, setCountyFips] = useState<string>(''); // '' = statewide
  const { countyByFips } = usePlace();

  useEffect(() => {
    loadCapitalTables().then(setTables).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-sm text-red-500 pt-8">{error}</p>;
  if (!tables) return <p className="text-sm text-slate-400 pt-8">Loading capital data…</p>;

  const counties = [...new Map(tables.county_year_totals.map((r) => [r.county_fips, r.county_name]))]
    .sort((a, b) => a[1].localeCompare(b[1]));

  return (
    <div className="pb-10 pt-6">
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={countyFips}
          onChange={(e) => setCountyFips(e.target.value)}
          className="text-[13px] font-semibold border border-slate-200 rounded-full px-4 py-2 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-indigo"
        >
          <option value="">Statewide — all of Georgia</option>
          {counties.map(([fips, name]) => (
            <option key={fips} value={fips}>{name} County</option>
          ))}
        </select>
        <div className="inline-flex border border-slate-200 rounded-lg overflow-hidden ml-auto">
          {(['federal_only', 'all_programs'] as Scope[]).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={`text-xs font-semibold px-3 py-1.5 border-r border-slate-200 last:border-r-0 transition-colors ${
                scope === s ? 'bg-brand-indigo text-white' : 'bg-white text-slate-500 hover:text-slate-700'
              }`}
              title={s === 'federal_only' ? 'Federal community development programs, excluding CRA small-business lending' : 'All nine programs including CRA small-business lending'}
            >
              {s === 'federal_only' ? 'Federal programs' : 'Including CRA'}
            </button>
          ))}
        </div>
      </div>

      {countyFips ? (
        <CountyView tables={tables} fips={countyFips} name={countyByFips.get(countyFips)?.county ?? counties.find(([f]) => f === countyFips)?.[1] ?? ''} />
      ) : (
        <StatewideView tables={tables} scope={scope} />
      )}

      <p className="text-[11px] text-slate-400 mt-8 max-w-3xl">
        Community investment programs by census tract, 2018–2022: CRA small-business lending, CDFI,
        CDBG, HOME, LIHTC, NMTC, Historic Tax Credit, and SBA 504 / 7(a). Amounts are reported
        dollars per tract-year; thin cells (fewer than 20 records) are suppressed in share
        calculations. SBA programs lack a 2018 base year and are excluded from indexed trends.
      </p>
    </div>
  );
}

function Card({ title, sub, children, note }: { title: string; sub?: string; note?: string; children: React.ReactNode }) {
  return (
    <SnapshotCard title={title} sub={sub && <span className="block max-w-xl">{sub}</span>} note={note}>
      <div className="mt-3">{children}</div>
    </SnapshotCard>
  );
}

// --- Statewide view ----------------------------------------------------------

function StatewideView({ tables, scope }: { tables: CapitalTables; scope: Scope }) {
  const years = tables.years;
  const stackYears = [2019, 2020, 2021, 2022];

  // T1 — program stack (CRA excluded by exclude_from_stack) + CRA context line
  const stackOrder = [...new Set(tables.program_year_totals.filter((r) => !r.exclude_from_stack).map((r) => r.program))];
  const stackSeries: StackSeries[] = stackOrder.map((program) => ({
    key: program,
    color: PROGRAM_COLORS[program],
    values: new Map(tables.program_year_totals.filter((r) => r.program === program).map((r) => [r.year, r.total_amount])),
  }));
  const craByYear = tables.program_year_totals.filter((r) => r.program === CRA);

  // T2 — indexed growth, CDFI highlighted via the data's highlight column
  const indexPrograms = [...new Set(tables.program_index.map((r) => r.program))];
  const indexSeries: LineSeries[] = indexPrograms.map((program) => {
    const rows = tables.program_index.filter((r) => r.program === program);
    const highlight = rows[0]?.highlight;
    return {
      key: program,
      color: highlight ? '#4750a2' : '#cbd5e1',
      width: highlight ? 2.5 : 1.5,
      points: rows.filter((r) => r.index_value != null).map((r) => ({
        year: r.year, value: r.index_value!, label: `index ${r.index_value} · ${fmtDollars(r.total_amount)}`,
      })),
    };
  }).sort((a, b) => Number(a.color !== '#cbd5e1') - Number(b.color !== '#cbd5e1')); // highlighted drawn last
  const maxIndex = Math.max(...tables.program_index.map((r) => r.index_value ?? 0));

  // T3 — LMI share lines, colored by precomputed direction
  const lmiPrograms = [...new Set(tables.lmi_share_by_program.map((r) => r.program))];
  const lmiSeries: LineSeries[] = lmiPrograms.map((program) => {
    const rows = tables.lmi_share_by_program.filter((r) => r.program === program && r.lmi_share != null);
    return {
      key: program,
      color: DIRECTION_COLORS[rows[0]?.direction ?? 'flat'] ?? '#94a3b8',
      points: rows.map((r) => ({ year: r.year, value: r.lmi_share!, label: `${(r.lmi_share! * 100).toFixed(1)}% to LMI tracts · ${r.record_count} records` })),
    };
  });

  // T4 — income mix (scope-aware), fixed Low→Upper order
  const mixRows = tables.income_mix_by_year.filter((r) => r.program_scope === scope);
  const mixSeries: StackSeries[] = tables.income_order.map((level) => ({
    key: level,
    color: INCOME_COLORS[level],
    values: new Map(mixRows.filter((r) => r.tract_income_level === level).map((r) => [r.year, r.share_of_year ?? 0])),
  }));

  // T5 — region share (scope-aware)
  const regionRows = tables.region_share_by_year.filter((r) => r.program_scope === scope);
  const regionSeries: LineSeries[] = (['Atlanta core', 'Rest of state'] as const).map((region) => ({
    key: region,
    color: REGION_COLORS[region],
    points: regionRows.filter((r) => r.region === region && r.share_of_year != null)
      .map((r) => ({ year: r.year, value: r.share_of_year!, label: `${(r.share_of_year! * 100).toFixed(1)}% · ${fmtDollars(r.total_amount)}` })),
  }));

  const scopeLabel = scope === 'federal_only' ? 'federal programs only (CRA excluded)' : 'all programs including CRA';

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mt-5">
      <Card
        title="Program dollars by year"
        sub="Federal community development programs, stacked by 2022 size. CRA small-business lending is charted separately below — it runs roughly ten times everything else combined."
        note={`CRA small-business lending by year: ${craByYear.map((r) => `${r.year} ${fmtDollars(r.total_amount)}`).join(' · ')}`}
      >
        <StackedBarChart years={stackYears} series={stackSeries} />
        <Legend items={stackOrder.map((p) => ({ key: p, color: PROGRAM_COLORS[p] }))} />
      </Card>

      <Card
        title="Growth since 2018 (2018 = 100)"
        sub="Each program indexed to its own 2018 total. CDFI is highlighted; SBA programs have no 2018 base year and are excluded."
      >
        <LineChart
          years={years}
          series={indexSeries}
          ticks={niceTicks(maxIndex)}
          format={(v) => String(Math.round(v))}
          endLabels
        />
        <Legend items={[{ key: 'CDFI', color: '#4750a2' }, { key: 'Other programs', color: '#cbd5e1' }]} />
      </Card>

      <Card
        title="Share of dollars reaching low- and moderate-income tracts"
        sub="Line color reflects the 2018 → 2022 change: green improved, orange weakened, gray flat (within 2 points). Program-years with fewer than 20 records are suppressed."
      >
        <LineChart
          years={years}
          series={lmiSeries}
          ticks={[0, 0.25, 0.5, 0.75, 1]}
          format={(v) => `${Math.round(v * 100)}%`}
          endLabels
        />
        <Legend items={[
          { key: 'Improved', color: DIRECTION_COLORS.improved },
          { key: 'Weakened', color: DIRECTION_COLORS.weakened },
          { key: 'Flat', color: DIRECTION_COLORS.flat },
        ]} />
      </Card>

      <Card
        title="Where the dollars land, by tract income level"
        sub={`Share of each year's dollars by tract income level — ${scopeLabel}. Toggle the scope above: with CRA included the mix is nearly flat; federal-only, the low-income share falls by half.`}
      >
        <ShareBarChart years={years} series={mixSeries} />
        <Legend items={tables.income_order.map((l) => ({ key: l, color: INCOME_COLORS[l] }))} />
      </Card>

      <Card
        title="Atlanta core vs. the rest of the state"
        sub={`Share of each year's dollars — ${scopeLabel}. Atlanta core is Fulton, DeKalb, Cobb, Gwinnett, and Clayton.`}
      >
        <LineChart
          years={years}
          series={regionSeries}
          ticks={[0, 0.25, 0.5, 0.75, 1]}
          format={(v) => `${Math.round(v * 100)}%`}
          endLabels
        />
        <Legend items={Object.entries(REGION_COLORS).map(([key, color]) => ({ key, color }))} />
      </Card>

      <Card
        title="County change, 2018 → 2022"
        sub="Federal-program dollars by county (CRA excluded), for counties clearing $25M in either year. Green moved up, orange moved down; the caption under each county shows how broadly the dollars spread."
      >
        <ArrowChart tables={tables} />
      </Card>
    </div>
  );
}

// --- Arrow (dumbbell) chart --------------------------------------------------

function ArrowChart({ tables }: { tables: CapitalTables }) {
  const [tip, setTip] = useState<TooltipState | null>(null);
  const arrows = tables.county_arrows;
  const rowH = 30;
  const padL = 120, padR = 60, padT = 8;
  const H = padT + arrows.length * rowH + 8;
  const max = Math.max(...arrows.flatMap((a) => [a.amount_2018, a.amount_2022]));
  const sx = (v: number) => padL + (v / max) * (CHART_W - padL - padR);

  const meta = new Map(
    tables.county_year_totals.filter((r) => r.year === 2022).map((r) => [r.county_fips, r]),
  );

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${CHART_W} ${H}`} className="w-full">
        {arrows.map((a, i) => {
          const y = padT + i * rowH + rowH / 2;
          const x1 = sx(a.amount_2018);
          const x2 = sx(a.amount_2022);
          const color = a.change_direction === 'up' ? '#279a49' : a.change_direction === 'down' ? '#f15921' : '#94a3b8';
          const m = meta.get(a.county_fips);
          return (
            <g
              key={a.county_fips}
              onMouseEnter={() => setTip({
                x: Math.max(x1, x2), y: y - 8,
                lines: [
                  `${a.county_name} County`,
                  `2018 ${fmtDollars(a.amount_2018)} → 2022 ${fmtDollars(a.amount_2022)}`,
                  m ? `${m.program_count} programs · ${m.tract_count} tracts in 2022` : '',
                ].filter(Boolean),
              })}
              onMouseLeave={() => setTip(null)}
            >
              <text x={padL - 8} y={y + 3} textAnchor="end" fontSize={10} fontWeight={600} className="fill-slate-600">
                {a.county_name}
              </text>
              <line x1={x1} y1={y} x2={x2} y2={y} stroke={color} strokeWidth={2} />
              <circle cx={x1} cy={y} r={3.5} fill="#fff" stroke={color} strokeWidth={2} />
              <circle cx={x2} cy={y} r={4.5} fill={color} />
              {/* confidence caption: breadth of programs/tracts, not just dollars */}
              <text x={Math.max(x1, x2) + 10} y={y + 3} fontSize={8.5} className="fill-slate-400">
                {m ? `${m.program_count}p · ${m.tract_count}t` : ''}
              </text>
            </g>
          );
        })}
      </svg>
      <Tooltip tip={tip} />
      <p className="text-[10px] text-slate-400 mt-1">
        Open circle = 2018 · filled circle = 2022 · caption = programs and tracts receiving dollars in 2022.
      </p>
    </div>
  );
}

// --- County view -------------------------------------------------------------

function CountyView({ tables, fips, name }: { tables: CapitalTables; fips: string; name: string }) {
  const years = tables.years;
  const countyRows = tables.county_year_totals.filter((r) => r.county_fips === fips);
  const programRows = tables.county_program_year.filter((r) => r.county_fips === fips);

  const stackOrder = [...new Set(tables.program_year_totals.filter((r) => !r.exclude_from_stack).map((r) => r.program))];
  const fedSeries: StackSeries[] = stackOrder
    .map((program) => ({
      key: program,
      color: PROGRAM_COLORS[program],
      values: new Map(programRows.filter((r) => r.program === program).map((r) => [r.year, r.total_amount])),
    }))
    .filter((s) => [...s.values.values()].some((v) => v > 0));
  const craRows = programRows.filter((r) => r.program === CRA);

  const totalAll = countyRows.reduce((s, r) => s + r.total_amount, 0);
  const label = name.replace(/ County$/, '');

  const trendSeries: LineSeries[] = [{
    key: 'All programs',
    color: '#4750a2',
    points: countyRows.map((r) => ({
      year: r.year, value: r.total_amount,
      label: `${fmtDollars(r.total_amount)} · ${r.program_count} programs · ${r.tract_count} tracts · ${r.record_count} records`,
    })),
  }];
  const maxTrend = Math.max(...countyRows.map((r) => r.total_amount), 1);

  return (
    <div className="mt-5">
      <div className="flex items-baseline gap-3 flex-wrap">
        <h2 className="text-xl font-bold text-slate-800">{label} County, 2018–2022</h2>
        <span className="text-sm text-slate-500">{fmtDollars(totalAll)} across all programs</span>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mt-4">
        <Card title="All program dollars by year" sub="Every program including CRA small-business lending. Hover a point for how broadly the dollars spread.">
          <LineChart years={years} series={trendSeries} ticks={niceTicks(maxTrend)} format={fmtDollars} />
        </Card>
        <Card
          title="Federal program mix by year"
          sub="Stacked by statewide 2022 program size; CRA is excluded here so the federal programs stay readable."
          note={craRows.length ? `CRA small-business lending in ${label}: ${craRows.map((r) => `${r.year} ${fmtDollars(r.total_amount)}`).join(' · ')}` : undefined}
        >
          {fedSeries.length > 0
            ? <>
                <StackedBarChart years={years} series={fedSeries} />
                <Legend items={fedSeries.map((s) => ({ key: s.key, color: s.color }))} />
              </>
            : <p className="text-sm text-slate-400">No federal program dollars recorded in {label} County for 2018–2022.</p>}
        </Card>
      </div>
    </div>
  );
}
