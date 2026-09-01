import { useEffect, useRef, useState } from 'react';
import { fmtDollars } from '../../data/capital';

// Shared hand-rolled SVG chart primitives for the capital time-series views.
//
// These render at measured CSS pixel size rather than into a fixed viewBox
// scaled with `width: 100%`. A scaled viewBox shrinks the *type* along with the
// drawing — at half width a 9px axis label became 8px or smaller — and it fixes
// the padding in drawing units, so series labels drawn past the plot were
// clipped by the viewBox edge instead of getting room. Measuring the container
// keeps every label at a real, legible size and lets the right-hand gutter be
// sized to the labels that actually have to fit in it.
//
// Conventions: thin marks, 2px surface gaps between stacked segments, hover
// tooltips on every mark, recessive hairline grid, text in ink tokens.

const AXIS_FONT = 11;
const LABEL_FONT = 11;
const YEAR_FONT = 11;
export const CHART_H = 260;
/** Below this the plot is too tight for labels in the gutter; use the legend. */
const END_LABEL_MIN_W = 520;

/** Rough advance width. Familjen Grotesk sits close to 0.55em average. */
export function textWidth(s: string, size = LABEL_FONT): number {
  return s.length * size * 0.55;
}

/**
 * The container's width in CSS pixels. Charts draw at this size 1:1, so font
 * sizes below are the sizes the reader actually sees.
 */
export function useMeasuredWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(Math.round(el.getBoundingClientRect().width));
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

export interface Plot {
  w: number;
  h: number;
  l: number;
  r: number;
  t: number;
  b: number;
}

function plotOf(w: number, h: number, r = 16, l = 56): Plot {
  return { w, h, l, r, t: 14, b: 28 };
}

export interface TooltipState {
  x: number;
  y: number;
  lines: string[];
}

export function Tooltip({ tip }: { tip: TooltipState | null }) {
  if (!tip) return null;
  return (
    <div
      className="absolute z-10 pointer-events-none bg-slate-800 text-white text-[11px] rounded-md px-2.5 py-1.5 leading-snug whitespace-nowrap"
      style={{ left: tip.x, top: tip.y, transform: 'translate(-50%, -110%)' }}
    >
      {tip.lines.map((l, i) => (
        <div key={i} className={i === 0 ? 'font-semibold' : ''}>{l}</div>
      ))}
    </div>
  );
}

function xScaleOf(years: number[], p: Plot) {
  const span = Math.max(1, years[years.length - 1] - years[0]);
  return (year: number) => p.l + ((year - years[0]) / span) * (p.w - p.l - p.r);
}

function yScaleOf(max: number, min: number, p: Plot) {
  return (v: number) => p.h - p.b - ((v - min) / Math.max(1e-9, max - min)) * (p.h - p.t - p.b);
}

function YearTicks({ years, p }: { years: number[]; p: Plot }) {
  const sx = xScaleOf(years, p);
  return (
    <>
      {years.map((y) => (
        <text key={y} x={sx(y)} y={p.h - p.b + 17} textAnchor="middle" fontSize={YEAR_FONT} className="fill-slate-400">
          {y}
        </text>
      ))}
    </>
  );
}

function GridLines({ ticks, format, p }: { ticks: number[]; format: (v: number) => string; p: Plot }) {
  const sy = yScaleOf(ticks[ticks.length - 1], ticks[0], p);
  return (
    <>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={p.l} y1={sy(t)} x2={p.w - p.r} y2={sy(t)} stroke="#f1f5f9" />
          <text x={p.l - 8} y={sy(t) + 4} textAnchor="end" fontSize={AXIS_FONT} className="fill-slate-400">
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

/**
 * Ticks covering just the data, padded a little.
 *
 * Share series pinned to a full 0–100% axis waste most of the frame: the
 * Atlanta-vs-rest split lives between 42% and 58%, so a 17-point swing was
 * drawn as two flat lines through the middle of an empty box.
 */
export function fittedTicks(values: number[], steps = 4): number[] {
  const clean = values.filter((v) => Number.isFinite(v));
  if (clean.length === 0) return [0, 1];
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  if (max === min) return [min - 1, min, min + 1];
  const pad = (max - min) * 0.15;
  const rough = (max - min + pad * 2) / steps;
  const mag = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= rough) ?? rough;
  const lo = Math.floor((min - pad) / step) * step;
  const hi = Math.ceil((max + pad) / step) * step;
  const out: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) out.push(Number(v.toFixed(10)));
  return out;
}

/** Push overlapping end labels apart so every series stays readable. */
function declutter<T extends { y: number }>(items: T[], gap: number, lo: number, hi: number): T[] {
  const sorted = [...items].sort((a, b) => a.y - b.y);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].y - sorted[i - 1].y < gap) sorted[i].y = sorted[i - 1].y + gap;
  }
  const overflow = sorted.length ? sorted[sorted.length - 1].y - hi : 0;
  if (overflow > 0) sorted.forEach((s) => { s.y -= overflow; });
  sorted.forEach((s) => { s.y = Math.max(lo, s.y); });
  return sorted;
}

// --- Stacked bars per year ---------------------------------------------------

export interface StackSeries {
  key: string;
  color: string;
  values: Map<number, number>; // year → amount
}

export function StackedBarChart({ years, series, valueLabel = fmtDollars, height = CHART_H }: {
  years: number[];
  series: StackSeries[]; // bottom-first
  valueLabel?: (v: number) => string;
  height?: number;
}) {
  const [ref, w] = useMeasuredWidth();
  const [tip, setTip] = useState<TooltipState | null>(null);
  const totals = years.map((y) => series.reduce((s, sr) => s + (sr.values.get(y) ?? 0), 0));
  const ticks = niceTicks(Math.max(...totals, 1));
  // The axis gutter has to fit the widest formatted value, not a guessed 52px.
  const p = plotOf(w, height, 16, Math.max(44, textWidth(valueLabel(ticks[ticks.length - 1]), AXIS_FONT) + 16));
  const sx = xScaleOf(years, p);
  const sy = yScaleOf(ticks[ticks.length - 1], 0, p);
  const barW = Math.min(64, ((p.w - p.l - p.r) / years.length) * 0.5);

  return (
    <div ref={ref} className="relative">
      {w > 0 && (
        <svg width={w} height={height} className="block overflow-visible">
          <GridLines ticks={ticks} format={valueLabel} p={p} />
          <YearTicks years={years} p={p} />
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
      )}
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

export function LineChart({
  years, series, ticks, format, endLabels, height = CHART_H, reference,
}: {
  years: number[];
  series: LineSeries[];
  /** Explicit ticks; omit to fit the axis to the data. */
  ticks?: number[];
  format: (v: number) => string;
  endLabels?: boolean;
  height?: number;
  /** A horizontal marker — e.g. the 50% line on a two-way share. */
  reference?: { value: number; label?: string };
}) {
  const [ref, w] = useMeasuredWidth();
  const [tip, setTip] = useState<TooltipState | null>(null);

  const axis = ticks ?? fittedTicks(series.flatMap((s) => s.points.map((pt) => pt.value)));
  // Labels sit in a reserved gutter rather than overflowing the drawing.
  const showEnds = !!endLabels && w >= END_LABEL_MIN_W;
  const gutter = showEnds
    ? Math.min(
        Math.max(...series.map((s) => textWidth(s.key)), 0) + 14,
        Math.max(90, w * 0.22),
      )
    : 16;
  const axisGutter = Math.max(44, textWidth(format(axis[axis.length - 1]), AXIS_FONT) + 16);
  const p = plotOf(w, height, gutter, axisGutter);
  const sx = xScaleOf(years, p);
  const sy = yScaleOf(axis[axis.length - 1], axis[0], p);

  const ends = showEnds
    ? declutter(
        series
          .filter((s) => s.points.length > 0)
          .map((s) => {
            const last = s.points[s.points.length - 1];
            return { key: s.key, color: s.color, y: sy(last.value), x: sx(last.year) };
          }),
        LABEL_FONT + 2,
        p.t + 4,
        p.h - p.b,
      )
    : [];

  return (
    <div ref={ref} className="relative">
      {w > 0 && (
        <svg width={w} height={height} className="block overflow-visible">
          <GridLines ticks={axis} format={format} p={p} />
          <YearTicks years={years} p={p} />
          {reference && (
            <g>
              <line
                x1={p.l} y1={sy(reference.value)} x2={p.w - p.r} y2={sy(reference.value)}
                stroke="#cbd5e1" strokeWidth={1} strokeDasharray="4 3"
              />
              {reference.label && (
                <text x={p.l + 4} y={sy(reference.value) - 5} fontSize={10} className="fill-slate-400">
                  {reference.label}
                </text>
              )}
            </g>
          )}
          {series.map((sr) => (
            <g key={sr.key}>
              <polyline
                points={sr.points.map((pt) => `${sx(pt.year)},${sy(pt.value)}`).join(' ')}
                fill="none"
                stroke={sr.color}
                strokeWidth={sr.width ?? 2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {sr.points.map((pt) => (
                <circle
                  key={pt.year}
                  cx={sx(pt.year)}
                  cy={sy(pt.value)}
                  r={8}
                  fill="transparent"
                  onMouseEnter={() => setTip({
                    x: sx(pt.year), y: sy(pt.value),
                    lines: [`${sr.key} · ${pt.year}`, pt.label ?? format(pt.value)],
                  })}
                  onMouseLeave={() => setTip(null)}
                />
              ))}
            </g>
          ))}
          {ends.map((e) => (
            <text
              key={e.key}
              x={p.w - p.r + 6}
              y={e.y + 4}
              fontSize={LABEL_FONT}
              fontWeight={600}
              fill={e.color}
            >
              {e.key}
            </text>
          ))}
        </svg>
      )}
      <Tooltip tip={tip} />
    </div>
  );
}

// --- 100% stacked share bars -------------------------------------------------

export function ShareBarChart({ years, series, height = CHART_H }: {
  years: number[];
  series: StackSeries[]; // bottom-first; values are shares 0..1
  height?: number;
}) {
  const [ref, w] = useMeasuredWidth();
  const [tip, setTip] = useState<TooltipState | null>(null);
  const p = plotOf(w, height, 16, 48);
  const sx = xScaleOf(years, p);
  const sy = yScaleOf(1, 0, p);
  const barW = Math.min(64, ((p.w - p.l - p.r) / years.length) * 0.5);

  return (
    <div ref={ref} className="relative">
      {w > 0 && (
        <svg width={w} height={height} className="block overflow-visible">
          <GridLines ticks={[0, 0.25, 0.5, 0.75, 1]} format={(v) => `${Math.round(v * 100)}%`} p={p} />
          <YearTicks years={years} p={p} />
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
                  onMouseEnter={() => setTip({
                    x: sx(year), y: y1,
                    lines: [`${sr.key} · ${year}`, `${(v * 100).toFixed(1)}% of year`],
                  })}
                  onMouseLeave={() => setTip(null)}
                />
              );
            });
          })}
        </svg>
      )}
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
