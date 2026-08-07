import type { PlaceCounty, PlaceTract, PlaceCountyData, PlaceMetric } from '../types/place';

// Sequential ramp derived from the brand greens (light → dark = less → more),
// echoing the Georgia partner theme in the Community Data Explorer.
export const CHORO_RAMP = ['#f4faf1', '#d9eecb', '#a9d792', '#66b445', '#279a49', '#17632e'];

// CVI metrics are national percentiles; a fixed scale with an extra top bin
// keeps the most-vulnerable decile visually distinct.
const CVI_BINS = [20, 40, 60, 80, 90];

// Display form of a national percentile, capped at 99 (a place can't be more
// vulnerable than 100% of counties — it is one).
export function pctileDisplay(p: number): number {
  return Math.min(99, Math.floor(p));
}

export function isCviMetric(metric: PlaceMetric): boolean {
  return metric === 'cvi' || metric === 'baseline' || metric === 'climate';
}

export function demoIndex(metric: PlaceMetric): number | null {
  return metric.startsWith('demo:') ? Number(metric.slice(5)) : null;
}

export function metricValue(
  metric: PlaceMetric,
  place: PlaceCountyData,
  unit: PlaceCounty | PlaceTract,
): number | null {
  if (isCviMetric(metric)) {
    const i = place.metricKeys.indexOf(metric);
    return i >= 0 ? unit.pctiles[i] ?? null : null;
  }
  const di = demoIndex(metric);
  if (di == null) return null;
  const values = 'demo' in unit ? unit.demo : unit.par;
  return values[di] ?? null;
}

// Upper edges of the first 5 bins; values above the last edge fall in bin 6.
// Demographic metrics use sextile breaks computed from the 159 county values —
// and tracts reuse the county breaks so colors stay comparable across zooms.
export function makeBins(metric: PlaceMetric, place: PlaceCountyData): number[] {
  if (isCviMetric(metric)) return CVI_BINS;
  const values = place.counties
    .map((c) => metricValue(metric, place, c))
    .filter((v): v is number => v != null)
    .sort((a, b) => a - b);
  if (values.length === 0) return CVI_BINS;
  return [1, 2, 3, 4, 5].map((k) => values[Math.min(values.length - 1, Math.floor((k / 6) * values.length))]);
}

export function colorFor(value: number | null, bins: number[]): string | null {
  if (value == null) return null;
  let i = 0;
  while (i < bins.length && value >= bins[i]) i++;
  return CHORO_RAMP[i];
}

export function metricLabel(metric: PlaceMetric, place: PlaceCountyData): string {
  if (isCviMetric(metric)) {
    return place.metricLabels[place.metricKeys.indexOf(metric)] ?? metric;
  }
  const di = demoIndex(metric);
  return di != null ? place.demographics.labels[di] ?? metric : metric;
}

export function formatMetricValue(
  metric: PlaceMetric,
  place: PlaceCountyData,
  value: number | null,
): string {
  if (value == null) return '—';
  if (isCviMetric(metric)) return `${pctileDisplay(value)}th pctile`;
  const di = demoIndex(metric);
  const unit = di != null ? place.demographics.units[di] : '';
  return unit === '%' ? `${value}%` : `${value}${unit ? ` ${unit}` : ''}`;
}

export function binLabels(metric: PlaceMetric, place: PlaceCountyData): string[] {
  const bins = makeBins(metric, place);
  const fmt = (v: number) => (isCviMetric(metric) ? `${v}` : `${Math.round(v * 10) / 10}`);
  const labels: string[] = [];
  for (let i = 0; i <= bins.length; i++) {
    if (i === 0) labels.push(`< ${fmt(bins[0])}`);
    else if (i === bins.length) labels.push(`≥ ${fmt(bins[bins.length - 1])}`);
    else labels.push(`${fmt(bins[i - 1])}–${fmt(bins[i])}`);
  }
  return labels;
}
