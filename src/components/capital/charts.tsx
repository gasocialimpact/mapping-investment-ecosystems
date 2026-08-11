import { useState } from 'react';
import { fmtDollars } from '../../data/capital';

// Shared hand-rolled SVG chart primitives for the capital time-series views.
// Conventions: thin marks, 2px surface gaps between stacked segments, hover
// tooltips on every mark, recessive hairline grid, text in ink tokens.

export const CHART_W = 720;
export const CHART_H = 260;
export const PAD = { l: 52, r: 16, t: 12, b: 30 };

export interface TooltipState {
  x: number;
  y: number;
  lines: string[];
}

export function Tooltip({ tip }: { tip: TooltipState | null }) {
  if (!tip) return null;
  return (
    <div
      className="absolute z-10 pointer-events-none bg-slate-800 text-white text-[11px] rounded-md px-2.5 py-1.5 leading-snug"
      style={{ left: `${(tip.x / CHART_W) * 100}%`, top: tip.y, transform: 'translate(-50%, -110%)' }}
    >
      {tip.lines.map((l, i) => (
        <div key={i} className={i === 0 ? 'font-semibold' : ''}>{l}</div>
      ))}
    </div>
  );
}

export function xScale(years: number[]) {
  return (year: number) =>
    PAD.l + ((year - years[0]) / Math.max(1, years[years.length - 1] - years[0])) * (CHART_W - PAD.l - PAD.r);
}

export function yScale(max: number, min = 0) {
  return (v: number) => CHART_H - PAD.b - ((v - min) / Math.max(1e-9, max - min)) * (CHART_H - PAD.t - PAD.b);
}

export function YearTicks({ years }: { years: number[] }) {
  const sx = xScale(years);
  return (
    <>
      {years.map((y) => (
        <text key={y} x={sx(y)} y={CHART_H - PAD.b + 16} textAnchor="middle" fontSize={10} className="fill-slate-400">
          {y}
        </text>
      ))}
    </>
  );
}

export function GridLines({ ticks, format }: { ticks: number[]; format: (v: number) => string }) {
  const max = ticks[ticks.length - 1];
  const min = ticks[0];
  const sy = yScale(max, min);
  return (
    <>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.l} y1={sy(t)} x2={CHART_W - PAD.r} y2={sy(t)} stroke="#f1f5f9" />
          <text x={PAD.l - 6} y={sy(t) + 3} textAnchor="end" fontSize={9} className="fill-slate-400">
            {format(t)}
          </text>
        </g>
      ))}
    </>
  );
}

// "Nice" ticks: 0 → a rounded max in 4 steps.
export function niceTicks(max: number, steps = 4): number[] {
  const rough = max / steps;
  const mag = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s * steps >= max) ?? rough;
  return Array.from({ length: steps + 1 }, (_, i) => i * step);
}

// --- Stacked bars per year ---------------------------------------------------

export interface StackSeries {
  key: string;
  color: string;
  values: Map<number, number>; // year → amount
}

export function StackedBarChart({ years, series, valueLabel = fmtDollars }: {
  years: number[];
  series: StackSeries[]; // bottom-first
  valueLabel?: (v: number) => string;
}) {
  const [tip, setTip] = useState<TooltipState | null>(null);
  const totals = years.map((y) => series.reduce((s, sr) => s + (sr.values.get(y) ?? 0), 0));
  const ticks = niceTicks(Math.max(...totals));
  const sx = xScale(years);
  const sy = yScale(ticks[ticks.length - 1]);
  const barW = Math.min(64, ((CHART_W - PAD.l - PAD.r) / years.length) * 0.5);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full">
        <GridLines ticks={ticks} format={valueLabel} />
        <YearTicks years={years} />
        {years.map((year, yi) => {
          let acc = 0;
          return series.map((sr) => {
            const v = sr.values.get(year) ?? 0;
            if (v <= 0) return null;
            const y0 = sy(acc);
            const y1 = sy(acc + v);
            acc += v;
            return (
              <rect
                key={`${sr.key}-${year}`}
                x={sx(year) - barW / 2}
                y={y1}
                width={barW}
                height={Math.max(1, y0 - y1 - 2)} /* 2px surface gap */
                rx={2}
                fill={sr.color}
                onMouseEnter={() => setTip({
                  x: sx(year), y: y1,
                  lines: [`${sr.key} · ${year}`, `${valueLabel(v)} of ${valueLabel(totals[yi])}`],
                })}
                onMouseLeave={() => setTip(null)}
              />
            );
          });
        })}
      </svg>
      <Tooltip tip={tip} />
    </div>
  );
}

// --- Multi-line chart --------------------------------------------------------

export interface LineSeries {
  key: string;
  color: string;
  width?: number;
  points: { year: number; value: number; label?: string }[];
}

export function LineChart({ years, series, ticks, format, endLabels }: {
  years: number[];
  series: LineSeries[];
  ticks: number[];
  format: (v: number) => string;
  endLabels?: boolean;
}) {
  const [tip, setTip] = useState<TooltipState | null>(null);
  const sx = xScale(years);
  const sy = yScale(ticks[ticks.length - 1], ticks[0]);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full">
        <GridLines ticks={ticks} format={format} />
        <YearTicks years={years} />
        {series.map((sr) => (
          <g key={sr.key}>
            <polyline
              points={sr.points.map((p) => `${sx(p.year)},${sy(p.value)}`).join(' ')}
              fill="none"
              stroke={sr.color}
              strokeWidth={sr.width ?? 2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {sr.points.map((p) => (
              <circle
                key={p.year}
                cx={sx(p.year)}
                cy={sy(p.value)}
                r={8}
                fill="transparent"
                onMouseEnter={() => setTip({ x: sx(p.year), y: sy(p.value), lines: [`${sr.key} · ${p.year}`, p.label ?? format(p.value)] })}
                onMouseLeave={() => setTip(null)}
              />
            ))}
            {endLabels && sr.points.length > 0 && (
              <text
                x={sx(sr.points[sr.points.length - 1].year) + 6}
                y={sy(sr.points[sr.points.length - 1].value) + 3}
                fontSize={9}
                fontWeight={600}
                className="fill-slate-500"
              >
                {sr.key}
              </text>
            )}
          </g>
        ))}
      </svg>
      <Tooltip tip={tip} />
    </div>
  );
}

// --- 100% stacked share bars -------------------------------------------------

export function ShareBarChart({ years, series }: {
  years: number[];
  series: StackSeries[]; // bottom-first; values are shares 0..1
}) {
  const [tip, setTip] = useState<TooltipState | null>(null);
  const sx = xScale(years);
  const sy = yScale(1);
  const barW = Math.min(64, ((CHART_W - PAD.l - PAD.r) / years.length) * 0.5);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full">
        <GridLines ticks={[0, 0.25, 0.5, 0.75, 1]} format={(v) => `${Math.round(v * 100)}%`} />
        <YearTicks years={years} />
        {years.map((year) => {
          let acc = 0;
          return series.map((sr) => {
            const v = sr.values.get(year) ?? 0;
            if (v <= 0) return null;
            const y0 = sy(acc);
            const y1 = sy(acc + v);
            acc += v;
            return (
              <rect
                key={`${sr.key}-${year}`}
                x={sx(year) - barW / 2}
                y={y1}
                width={barW}
                height={Math.max(1, y0 - y1 - 2)}
                rx={2}
                fill={sr.color}
                onMouseEnter={() => setTip({ x: sx(year), y: y1, lines: [`${sr.key} · ${year}`, `${(v * 100).toFixed(1)}% of year`] })}
                onMouseLeave={() => setTip(null)}
              />
            );
          });
        })}
      </svg>
      <Tooltip tip={tip} />
    </div>
  );
}

export function Legend({ items }: { items: { key: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
      {items.map((i) => (
        <span key={i.key} className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: i.color }} />
          {i.key}
        </span>
      ))}
    </div>
  );
}
