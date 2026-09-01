import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

// Every chart on the capital tab is paired with the numbers behind it.
//
// The charts used to carry their values only in hover tooltips, which meant the
// figures were invisible when reading, printing, screenshotting or using a
// screen reader — and the datasets here are small enough (five years, a handful
// of series) that the whole thing fits in a table comfortably. The chart is for
// the shape; the table is for the values. Neither is a fallback for the other.

export interface TableRow {
  label: string;
  /** Series swatch, matched to the chart. */
  color?: string;
  cells: ReactNode[];
  /** Totals and summary rows. */
  strong?: boolean;
  /** Rendered in the first cell under the label, e.g. an inline bar. */
  visual?: ReactNode;
}

export function DataTable({ columns, rows, rowHeader = 'Series', note, label = 'numbers' }: {
  /** Value column headings; the row-label column is added automatically. */
  columns: string[];
  rows: TableRow[];
  rowHeader?: string;
  note?: string;
  /** What the toggle calls this table, e.g. "numbers", "counties". */
  label?: string;
}) {
  // Open by default: the numbers are the point. The toggle is for folding a
  // long table away once you have read it, not for hiding it on arrival.
  const [open, setOpen] = useState(true);
  const id = useId();

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={id}
        className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-slate-700 transition-colors"
      >
        <ChevronRight size={12} className={`transition-transform ${open ? 'rotate-90' : ''}`} />
        {open ? `Hide ${label}` : `Show ${label} (${rows.length} rows)`}
      </button>
      {open && (
      <div id={id} className="overflow-x-auto">
        <table className="w-full text-[12px] border-collapse">
          <thead>
            <tr className="text-[10px] uppercase tracking-widest text-slate-400">
              <th scope="col" className="text-left font-bold py-1.5 pr-3 whitespace-nowrap">{rowHeader}</th>
              {columns.map((c) => (
                <th key={c} scope="col" className="text-right font-bold py-1.5 pl-3 whitespace-nowrap">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-t border-slate-100">
                <th
                  scope="row"
                  className={`text-left py-1.5 pr-3 font-normal ${r.strong ? 'font-semibold text-slate-700' : 'text-slate-600'}`}
                >
                  <span className="flex items-center gap-1.5">
                    {r.color && (
                      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: r.color }} />
                    )}
                    <span>{r.label}</span>
                  </span>
                  {r.visual}
                </th>
                {r.cells.map((c, i) => (
                  <td
                    key={i}
                    className={`py-1.5 pl-3 text-right tabular-nums whitespace-nowrap ${
                      r.strong ? 'font-semibold text-slate-800' : 'text-slate-600'
                    }`}
                  >
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
      {open && note && <p className="text-[10px] text-slate-400 mt-2">{note}</p>}
    </div>
  );
}

/** Em dash for a genuinely absent value, so blanks read as "no data". */
export const NO_DATA = '—';

export function pct(v: number | null | undefined, digits = 1): string {
  return v == null || !Number.isFinite(v) ? NO_DATA : `${(v * 100).toFixed(digits)}%`;
}

export function signed(v: number | null | undefined, digits = 1): string {
  if (v == null || !Number.isFinite(v)) return NO_DATA;
  const s = (v * 100).toFixed(digits);
  return `${v > 0 ? '+' : ''}${s} pts`;
}
