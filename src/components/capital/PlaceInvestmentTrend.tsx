import { useEffect, useState } from 'react';
import {
  loadCapitalTables, loadCapitalTracts, fmtDollars, PROGRAM_COLORS,
} from '../../data/capital';
import type { CapitalTables, TractYearTotal } from '../../data/capital';
import { StackedBarChart } from './charts';
import type { StackSeries } from './charts';
import { DataTable, NO_DATA } from './DataTable';
import type { TableRow } from './DataTable';

const CRA = 'CRA Small Business';

// County report card: federal-program dollars over time for one county,
// stacked by program, with CRA carried as a caption (it would flatten the
// stack). Data joins on the 5-digit county FIPS.
export function CountyInvestmentTrend({ fips, countyLabel }: { fips: string; countyLabel: string }) {
  const [tables, setTables] = useState<CapitalTables | null>(null);
  useEffect(() => {
    loadCapitalTables().then(setTables).catch(() => {});
  }, []);
  if (!tables) return null;

  const rows = tables.county_program_year.filter((r) => r.county_fips === fips);
  if (rows.length === 0) return null;

  const stackOrder = [...new Set(tables.program_year_totals.filter((r) => !r.exclude_from_stack).map((r) => r.program))];
  const series: StackSeries[] = stackOrder
    .map((program) => ({
      key: program,
      color: PROGRAM_COLORS[program],
      values: new Map(rows.filter((r) => r.program === program).map((r) => [r.year, r.total_amount])),
    }))
    .filter((s) => [...s.values.values()].some((v) => v > 0));
  const craRows = rows.filter((r) => r.program === CRA);

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm">
      <h3 className="text-base font-bold text-slate-800">Investment Over Time</h3>
      <p className="text-xs text-slate-500 mt-1">
        Federal community development dollars reaching {countyLabel},{' '}
        {tables.years[0]}–{tables.years[tables.years.length - 1]}, by program.
        See the Tracking Capital tab for the statewide picture.
      </p>
      <div className="mt-3">
        {series.length > 0 ? (
          <>
            <StackedBarChart years={tables.years} series={series} />
            <DataTable
              rowHeader="Program"
              columns={tables.years.map(String)}
              rows={[
                ...series.map((sr): TableRow => ({
                  label: sr.key, color: sr.color,
                  cells: tables.years.map((y) => (sr.values.get(y) ? fmtDollars(sr.values.get(y)!) : NO_DATA)),
                })),
                { label: 'Total', strong: true,
                  cells: tables.years.map((y) => fmtDollars(series.reduce((t, sr) => t + (sr.values.get(y) ?? 0), 0))) },
              ]}
            />
          </>
        ) : (
          <p className="text-sm text-slate-400">No federal program dollars recorded here.</p>
        )}
      </div>
      {craRows.length > 0 && (
        <p className="text-[10px] text-slate-400 mt-2">
          CRA small-business lending (not stacked): {craRows.map((r) => `${r.year} ${fmtDollars(r.total_amount)}`).join(' · ')}
        </p>
      )}
    </div>
  );
}

// Tract report card: total program dollars per year for one census tract.
export function TractInvestmentTrend({ geoid }: { geoid: string }) {
  const [rows, setRows] = useState<TractYearTotal[] | null>(null);
  useEffect(() => {
    loadCapitalTracts().then((all) => setRows(all.filter((r) => r.geoid === geoid))).catch(() => setRows([]));
  }, [geoid]);
  if (rows == null) return null;

  const years = [...new Set(rows.map((r) => r.year))].sort((a, b) => a - b);
  const programs = [...new Set(rows.flatMap((r) => r.programs))].sort();
  const series: StackSeries[] = [{
    key: 'All programs',
    color: '#4750a2',
    values: new Map(rows.map((r) => [r.year, r.total_amount])),
  }];
  const total = rows.reduce((s, r) => s + r.total_amount, 0);

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm">
      <h3 className="text-base font-bold text-slate-800">Investment Over Time</h3>
      <p className="text-xs text-slate-500 mt-1">
        Community investment program dollars recorded in this tract{years.length ? `, ${years[0]}–${years[years.length - 1]}` : ''}.
      </p>
      <div className="mt-3">
        {rows.length > 0 ? (
          <>
            <StackedBarChart years={years} series={series} />
            <DataTable
              rowHeader="Measure"
              columns={years.map(String)}
              rows={[{ label: 'All program dollars', color: '#4750a2', strong: true,
                cells: years.map((y) => { const r = rows.find((q) => q.year === y);
                  return r ? fmtDollars(r.total_amount) : NO_DATA; }) }]}
            />
            <p className="text-xs text-slate-500 mt-2">
              {fmtDollars(total)} total · programs active here:{' '}
              {programs.map((p) => (
                <span key={p} className="inline-flex items-center gap-1 mr-2">
                  <span className="w-2 h-2 rounded-sm inline-block" style={{ background: PROGRAM_COLORS[p] ?? '#94a3b8' }} />
                  {p}
                </span>
              ))}
            </p>
          </>
        ) : (
          <p className="text-sm text-slate-400">No program dollars recorded in this tract.</p>
        )}
      </div>
    </div>
  );
}
