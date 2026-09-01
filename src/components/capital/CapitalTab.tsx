import { useEffect, useState } from 'react';
import {
  loadCapitalTables, fmtDollars,
  PROGRAM_COLORS, DIRECTION_COLORS, INCOME_COLORS, REGION_COLORS,
} from '../../data/capital';
import type { CapitalTables, ProgramCoverage } from '../../data/capital';
import { usePlace } from '../../context/PlaceContext';
import {
  StackedBarChart, LineChart, ShareBarChart, Legend, niceTicks, fittedTicks,
} from './charts';
import type { StackSeries, LineSeries } from './charts';
import { SnapshotCard } from '../SnapshotButton';
import { DataTable, pct, NO_DATA } from './DataTable';
import type { TableRow } from './DataTable';

type Scope = 'federal_only' | 'all_programs';

const CRA = 'CRA Small Business';

// Tab 2 — Tracking Capital Changes Over Time. A zoomed-out statewide view of
// community-investment dollars across the source's full span, with an
// optional county lens.
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
        Community investment programs by census tract, {tables.years[0]}–{tables.years[tables.years.length - 1]}:
        CRA small-business lending, CDFI, CDBG, HOME, LIHTC, NMTC, Historic Tax Credit, and SBA
        504 / 7(a). Amounts are reported dollars per tract-year; cells built on fewer than 20
        records are marked with an asterisk rather than removed. No single year carries every
        program — LIHTC reports
        {' '}{tables.program_coverage.find((c) => c.program === 'LIHTC')?.first_year}–
        {tables.program_coverage.find((c) => c.program === 'LIHTC')?.last_year} and the SBA programs
        {' '}{tables.program_coverage.find((c) => c.program === 'SBA 7(a)')?.first_year}–
        {tables.program_coverage.find((c) => c.program === 'SBA 7(a)')?.last_year} — so each chart marks
        absent years with a dash rather than closing the gap.
      </p>
    </div>
  );
}

// A chart card. `span` is how many of the 6 grid columns it takes on wide
// screens: charts with many series or many rows need the full width, compact
// ones read fine at half.
function Card({ title, sub, children, note, span = 'half' }: {
  title: string; sub?: string; note?: string; span?: 'half' | 'full';
  children: React.ReactNode;
}) {
  return (
    <div className={span === 'full' ? 'xl:col-span-6' : 'xl:col-span-3'}>
      <SnapshotCard title={title} sub={sub && <span className="block max-w-3xl">{sub}</span>} note={note}>
        <div className="mt-3">{children}</div>
      </SnapshotCard>
    </div>
  );
}

/**
 * A program's change from its first to its last reported year.
 *
 * Each program is measured over its own window, because no two of them share
 * one — so the cell carries the years it actually spans.
 */
function changeSinceFirst(rows: { year: number; total_amount: number }[]) {
  const sorted = [...rows].sort((a, b) => a.year - b.year);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (!first || !last || first.year === last.year || !first.total_amount) return NO_DATA;
  const change = (last.total_amount - first.total_amount) / first.total_amount;
  const color = change > 0.02 ? DIRECTION_COLORS.improved : change < -0.02 ? DIRECTION_COLORS.weakened : DIRECTION_COLORS.flat;
  return (
    <span style={{ color }} title={`${first.year} → ${last.year}`}>
      {change > 0 ? '+' : ''}{Math.round(change * 100)}%
      <span className="text-slate-400 font-normal"> ({first.year}–{last.year})</span>
    </span>
  );
}

// Programs report over different windows, so a missing cell has to be readable
// as "not reported" rather than "zero dollars". Every card that spans multiple
// programs carries this.
function coverageNote(coverage: ProgramCoverage[]): string {
  const partial = coverage.filter((c) => !c.spans_all_years);
  if (partial.length === 0) return '';
  const windows = partial.map((c) => `${c.program} ${c.first_year}–${c.last_year}`).join(' · ');
  return `Reporting windows differ by program — ${windows}. A dash means the program did not report that year; it is not a zero.`;
}

/** Years whose totals come from only one program, so shares describe that program alone. */
function thinYearsNote(rows: { year: number; programs_reporting: number }[]): string {
  const thin = [...new Set(rows.filter((r) => r.programs_reporting === 1).map((r) => r.year))].sort();
  if (thin.length === 0) return '';
  return ` ${thin.join(' and ')} ${thin.length > 1 ? 'are years' : 'is a year'} in which only one program reported, so the split there describes that program rather than the portfolio.`;
}

function SectionHeading({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="xl:col-span-6 flex items-baseline gap-3 flex-wrap mt-2 first:mt-0">
      <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500">{children}</h2>
      {hint && <span className="text-xs text-slate-400">{hint}</span>}
    </div>
  );
}

// --- Statewide view ----------------------------------------------------------

function StatewideView({ tables, scope }: { tables: CapitalTables; scope: Scope }) {
  const years = tables.years;
  // Was [2019..2022]. The stack now spans whatever the source actually holds.
  const stackYears = years;
  const coverage = coverageNote(tables.program_coverage);

  // T1 — program stack (CRA excluded by exclude_from_stack) + CRA context line
  const stackOrder = [...new Set(tables.program_year_totals.filter((r) => !r.exclude_from_stack).map((r) => r.program))];
  const stackSeries: StackSeries[] = stackOrder.map((program) => ({
    key: program,
    color: PROGRAM_COLORS[program],
    values: new Map(tables.program_year_totals.filter((r) => r.program === program).map((r) => [r.year, r.total_amount])),
  }));
  const craByYear = tables.program_year_totals.filter((r) => r.program === CRA);

  // T3 — LMI share lines, colored by precomputed direction
  const lmiRows = tables.lmi_share_by_program;
  const lmiPrograms = [...new Set(lmiRows.map((r) => r.program))];
  const lmiSeries: LineSeries[] = lmiPrograms.map((program) => {
    const rows = tables.lmi_share_by_program.filter((r) => r.program === program && r.lmi_share != null);
    return {
      key: program,
      // No direction verdict means too few reliable years to judge — drawn
      // dashed and in neutral gray rather than scored as "flat".
      color: rows[0]?.direction ? DIRECTION_COLORS[rows[0].direction] : '#94a3b8',
      dashed: !rows[0]?.direction,
      points: rows.map((r) => ({
        year: r.year,
        value: r.lmi_share!,
        thin: r.thin,
        label: `${(r.lmi_share! * 100).toFixed(1)}% to LMI tracts · ${r.record_count} records${r.thin ? ' (thin)' : ''}`,
      })),
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
    <div className="grid grid-cols-1 xl:grid-cols-6 gap-5 mt-5">
      <SectionHeading hint={`Totals by program, ${years[0]}\u2013${years[years.length - 1]}`}>How much moved</SectionHeading>

      <Card
        span="full"
        title="Program dollars by year"
        sub={`Federal community development programs, stacked by ${tables.reference_year} size. CRA small-business lending is in the table but kept out of the stack — it runs roughly ten times everything else combined.`}
        note={coverage}
      >
        <StackedBarChart years={stackYears} series={stackSeries} />
        <DataTable
          rowHeader="Program"
          columns={[...stackYears.map(String), '% change']}
          rows={[
            ...stackSeries.map((sr): TableRow => ({
              label: sr.key,
              color: sr.color,
              cells: [
                ...stackYears.map((y) => (sr.values.get(y) ? fmtDollars(sr.values.get(y)!) : NO_DATA)),
                changeSinceFirst(
                  tables.program_year_totals.filter((r) => r.program === sr.key),
                ),
              ],
            })),
            {
              label: 'Total (stacked)',
              strong: true,
              cells: [
                ...stackYears.map((y) =>
                  fmtDollars(stackSeries.reduce((t, sr) => t + (sr.values.get(y) ?? 0), 0))),
                // Deliberately blank: the first and last year hold different
                // programs, so a portfolio-level change would compare LIHTC
                // alone against SBA alone.
                <span className="text-slate-400" title="Not comparable — the program mix differs between the first and last year">{NO_DATA}</span>,
              ],
            },
            {
              label: 'CRA small business (not stacked)',
              cells: [
                ...stackYears.map((y) => {
                  const row = craByYear.find((r) => r.year === y);
                  return row ? fmtDollars(row.total_amount) : NO_DATA;
                }),
                changeSinceFirst(craByYear),
              ],
            },
          ]}
          note={`% change runs from each program's own first reported year to its last — the span is shown beside each figure. The stacked total has no change figure because the first and last years hold different programs. ${coverage}`}
        />
      </Card>

      <SectionHeading hint="Whether the dollars land in the places that need them">Who they reach</SectionHeading>

      <Card
        span="full"
        title="Share of dollars reaching low- and moderate-income tracts"
        sub="Line color reflects the change across each program's own first and last reliably-reported year: green improved, orange weakened, gray flat (within 2 points). Thin program-years are marked, not removed — see the note under the table."
      >
        <LineChart
          years={years}
          series={lmiSeries}
          ticks={[0, 0.25, 0.5, 0.75, 1]}
          format={(v) => `${Math.round(v * 100)}%`}
          height={320}
          endLabels
        />
        <DataTable
          rowHeader="Program"
          columns={[...years.map(String), 'First \u2192 last']}
          rows={lmiSeries.map((sr): TableRow => {
            const first = sr.points[0];
            const last = sr.points[sr.points.length - 1];
            const delta = first && last && first.year !== last.year ? last.value - first.value : null;
            return {
              label: sr.key,
              color: sr.color,
              cells: [
                ...years.map((y) => {
                  const row = lmiRows.find((r) => r.program === sr.key && r.year === y);
                  if (!row || row.lmi_share == null) return NO_DATA;
                  return row.thin
                    ? <span className="text-slate-400" title={`${row.record_count} records — too few to be stable`}>{pct(row.lmi_share)}*</span>
                    : pct(row.lmi_share);
                }),
                delta == null ? NO_DATA
                  : `${delta > 0 ? '+' : ''}${(delta * 100).toFixed(1)} pts`,
              ],
            };
          })}
          note={`* marks a program-year built on fewer than 20 records — shown because it is real, greyed because one large deal can swing the share by tens of points. Hollow points on the chart mark the same cells, and a dashed line means too few reliable years to call a direction. A dash is a year the program did not report. ${coverage}`}
        />
        <Legend items={[
          { key: 'Improved', color: DIRECTION_COLORS.improved },
          { key: 'Weakened', color: DIRECTION_COLORS.weakened },
          { key: 'Flat', color: DIRECTION_COLORS.flat },
          { key: 'Too few reliable years to call', color: '#94a3b8' },
        ]} />
      </Card>

      <SectionHeading hint="By tract income level and by region">Where they land</SectionHeading>

      <Card
        title="Where the dollars land, by tract income level"
        sub={`Share of each year's dollars by tract income level — ${scopeLabel}. Toggle the scope above: with CRA included the mix is nearly flat; federal-only, the low-income share falls by half.`}
      >
        <ShareBarChart years={years} series={mixSeries} />
        <DataTable
          rowHeader="Tract income level"
          columns={years.map(String)}
          rows={mixSeries.map((sr): TableRow => ({
            label: sr.key,
            color: sr.color,
            cells: years.map((y) => pct(sr.values.get(y))),
          }))}
          note={`Shares are of each year's total.${thinYearsNote(mixRows)}`}
        />
      </Card>

      <Card
        title="Atlanta core vs. the rest of the state"
        sub={`Share of each year's dollars — ${scopeLabel}. Atlanta core is Fulton, DeKalb, Cobb, Gwinnett, and Clayton.`}
      >
        <LineChart
          years={years}
          series={regionSeries}
          ticks={fittedTicks(regionSeries.flatMap((s) => s.points.map((pt) => pt.value)))}
          format={(v) => `${Math.round(v * 100)}%`}
          reference={{ value: 0.5, label: 'even split' }}
          endLabels
        />
        <DataTable
          rowHeader="Region"
          columns={years.map(String)}
          rows={regionSeries.map((sr): TableRow => ({
            label: sr.key,
            color: sr.color,
            cells: years.map((y) => {
              const pt = sr.points.find((q) => q.year === y);
              return pt ? pct(pt.value) : NO_DATA;
            }),
          }))}
          note={`Atlanta core is Fulton, DeKalb, Cobb, Gwinnett and Clayton.${thinYearsNote(regionRows)}`}
        />
      </Card>

      <SectionHeading hint="Counties clearing $25M in either year">County detail</SectionHeading>

      <Card
        span="full"
        title="County change, 2018 → 2022"
        sub="Federal-program dollars by county (CRA excluded), for counties clearing $25M in either year. Green moved up, orange moved down; the caption under each county shows how broadly the dollars spread."
      >
        <CountyChangeTable tables={tables} />
      </Card>
    </div>
  );
}

// --- County movement table ---------------------------------------------------

// Was a dumbbell chart. For two dozen counties compared on two numbers, a table
// carries far more: the actual dollars, the percent change and the breadth
// columns are all readable at once instead of one at a time under the cursor.
// The bar stays as an inline cell so the shape is still scannable down the page.
function CountyChangeTable({ tables }: { tables: CapitalTables }) {
  const arrows = tables.county_arrows;
  const max = Math.max(...arrows.flatMap((a) => [a.amount_2018, a.amount_2022]), 1);
  const meta = new Map(
    tables.county_year_totals.filter((r) => r.year === 2022).map((r) => [r.county_fips, r]),
  );

  const rows: TableRow[] = arrows.map((a) => {
    const color = a.change_direction === 'up' ? '#279a49' : a.change_direction === 'down' ? '#f15921' : '#94a3b8';
    const m = meta.get(a.county_fips);
    const change = a.amount_2018 > 0 ? (a.amount_2022 - a.amount_2018) / a.amount_2018 : null;
    const lo = Math.min(a.amount_2018, a.amount_2022) / max;
    const hi = Math.max(a.amount_2018, a.amount_2022) / max;
    return {
      label: a.county_name,
      cells: [
        fmtDollars(a.amount_2018),
        fmtDollars(a.amount_2022),
        <span style={{ color }}>{change == null ? '—' : `${change > 0 ? '+' : ''}${Math.round(change * 100)}%`}</span>,
        m ? m.program_count : '—',
        m ? m.tract_count : '—',
        // 2018 → 2022 span, drawn in place so the movement reads down the column
        <span className="inline-block relative w-[120px] h-2 align-middle" aria-hidden="true">
          <span className="absolute inset-y-0 my-auto h-[3px] rounded-full" style={{
            left: `${lo * 100}%`, width: `${Math.max(1, (hi - lo) * 100)}%`, background: color,
          }} />
          <span className="absolute w-2 h-2 rounded-full border-2 bg-white" style={{
            left: `calc(${(a.amount_2018 / max) * 100}% - 4px)`, borderColor: color, top: 0,
          }} />
          <span className="absolute w-2 h-2 rounded-full" style={{
            left: `calc(${(a.amount_2022 / max) * 100}% - 4px)`, background: color, top: 0,
          }} />
        </span>,
      ],
    };
  });

  return (
    <DataTable
      rowHeader="County"
      columns={['2018', '2022', 'Change', 'Programs', 'Tracts', '2018 → 2022']}
      rows={rows}
      note="Programs and tracts are the count receiving dollars in 2022 — how broadly the money spread. Open circle = 2018, filled = 2022."
    />
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
        <h2 className="text-xl font-bold text-slate-800">{label} County, {years[0]}–{years[years.length - 1]}</h2>
        <span className="text-sm text-slate-500">{fmtDollars(totalAll)} across all programs</span>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-6 gap-5 mt-4">
        <Card title="All program dollars by year" sub="Every program including CRA small-business lending. Hover a point for how broadly the dollars spread.">
          <LineChart years={years} series={trendSeries} ticks={niceTicks(maxTrend)} format={fmtDollars} />
          <DataTable
            rowHeader="Measure"
            columns={years.map(String)}
            rows={[
              { label: 'All program dollars', color: '#4750a2', strong: true,
                cells: years.map((y) => {
                  const r = countyRows.find((q) => q.year === y);
                  return r ? fmtDollars(r.total_amount) : NO_DATA;
                }) },
              { label: 'Programs active', cells: years.map((y) => countyRows.find((q) => q.year === y)?.program_count ?? NO_DATA) },
              { label: 'Tracts reached', cells: years.map((y) => countyRows.find((q) => q.year === y)?.tract_count ?? NO_DATA) },
              { label: 'Records', cells: years.map((y) => countyRows.find((q) => q.year === y)?.record_count ?? NO_DATA) },
            ]}
          />
        </Card>
        <Card
          title="Federal program mix by year"
          sub="Stacked by statewide 2022 program size; CRA is excluded here so the federal programs stay readable."
          note={craRows.length ? `CRA small-business lending in ${label}: ${craRows.map((r) => `${r.year} ${fmtDollars(r.total_amount)}`).join(' · ')}` : undefined}
        >
          {fedSeries.length > 0
            ? <>
                <StackedBarChart years={years} series={fedSeries} />
                <DataTable
                  rowHeader="Program"
                  columns={years.map(String)}
                  rows={[
                    ...fedSeries.map((sr): TableRow => ({
                      label: sr.key, color: sr.color,
                      cells: years.map((y) => (sr.values.get(y) ? fmtDollars(sr.values.get(y)!) : NO_DATA)),
                    })),
                    { label: 'Total (stacked)', strong: true,
                      cells: years.map((y) => fmtDollars(fedSeries.reduce((t, sr) => t + (sr.values.get(y) ?? 0), 0))) },
                  ]}
                />
              </>
            : <p className="text-sm text-slate-400">No federal program dollars recorded in {label} County.</p>}
        </Card>
      </div>
    </div>
  );
}
