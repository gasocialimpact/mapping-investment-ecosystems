import { useEffect, useState } from 'react';
import { loadAliceData, ALICE_COLORS } from '../../data/alice';
import type { AliceRow } from '../../data/alice';
import { StackedBarChart, Legend } from '../capital/charts';
import type { StackSeries } from '../capital/charts';
import { DataTable, NO_DATA } from '../capital/DataTable';
import type { TableRow } from '../capital/DataTable';
import { SnapshotCard } from '../SnapshotButton';

const fmtCount = (v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `${Math.round(v / 1e3)}K` : String(v));

// County report card: ALICE household bands over time — how many households
// sit below the Federal Poverty Level, between poverty and the county's
// survival budget (ALICE), and above the threshold.
export function AliceTrend({ fips, countyLabel }: { fips: string; countyLabel: string }) {
  const [rows, setRows] = useState<AliceRow[] | null>(null);
  useEffect(() => {
    loadAliceData()
      .then((d) => setRows(d.rows.filter((r) => r.county_fips === fips)))
      .catch(() => setRows([]));
  }, [fips]);
  if (rows == null || rows.length === 0) return null;

  const years = rows.map((r) => r.year);
  const bands: [string, (r: AliceRow) => number][] = [
    ['Below Federal Poverty Level', (r) => r.poverty_households],
    ['ALICE (above poverty, below survival budget)', (r) => r.alice_households],
    ['Above ALICE Threshold', (r) => r.above_alice_households],
  ];
  const series: StackSeries[] = bands.map(([key, get]) => ({
    key,
    color: ALICE_COLORS[key],
    values: new Map(rows.map((r) => [r.year, get(r)])),
  }));

  const shareBelow = (r: AliceRow) =>
    r.households > 0 ? Math.round(((r.poverty_households + r.alice_households) / r.households) * 100) : null;
  const first = rows[0];
  const last = rows[rows.length - 1];
  const windows = [...new Set(rows.map((r) => r.source_window).filter(Boolean))].join(' / ');

  return (
    <SnapshotCard
      title="ALICE Households Over Time"
      sub={`Households in ${countyLabel} below the Federal Poverty Level, between poverty and the county's survival budget (ALICE — Asset Limited, Income Constrained, Employed), and above the ALICE threshold, ${years[0]}–${years[years.length - 1]}. Source: United For ALICE (${windows} ACS estimates).`}
    >
      <div className="mt-3">
        <StackedBarChart years={years} series={series} valueLabel={fmtCount} />
        <Legend items={series.map((s) => ({ key: s.key, color: s.color }))} />
        <DataTable
          rowHeader="Households"
          columns={years.map(String)}
          rows={[
            ...series.map((sr): TableRow => ({
              label: sr.key.replace(' (above poverty, below survival budget)', ''),
              color: sr.color,
              cells: years.map((y) => {
                const v = sr.values.get(y);
                return v != null ? v.toLocaleString() : NO_DATA;
              }),
            })),
            {
              label: 'Below ALICE threshold', strong: true,
              cells: rows.map((r) => {
                const s = shareBelow(r);
                return s != null ? `${s}%` : NO_DATA;
              }),
            },
          ]}
        />
        {first && last && shareBelow(first) != null && shareBelow(last) != null && (
          <p className="text-xs text-slate-500 mt-2">
            Households below the ALICE threshold: <b>{shareBelow(first)}%</b> in {first.year} →{' '}
            <b>{shareBelow(last)}%</b> in {last.year}.
          </p>
        )}
      </div>
    </SnapshotCard>
  );
}
