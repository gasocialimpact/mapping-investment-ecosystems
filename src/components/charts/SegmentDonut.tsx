import { SEGMENT_ORDER, SEGMENT_STYLES } from '../../types';
import type { Segment } from '../../types';

interface Props {
  counts: Record<string, number>;
}

export function SegmentDonut({ counts }: Props) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total === 0) return null;

  const size = 140;
  const cx = size / 2;
  const cy = size / 2;
  const r = 50;
  const innerR = 32;

  let cumAngle = -Math.PI / 2;
  const arcs = SEGMENT_ORDER.filter((s) => counts[s] > 0).map((s) => {
    const pct = counts[s] / total;
    const startAngle = cumAngle;
    cumAngle += pct * 2 * Math.PI;
    const endAngle = cumAngle;
    const largeArc = pct > 0.5 ? 1 : 0;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const ix1 = cx + innerR * Math.cos(endAngle);
    const iy1 = cy + innerR * Math.sin(endAngle);
    const ix2 = cx + innerR * Math.cos(startAngle);
    const iy2 = cy + innerR * Math.sin(startAngle);
    const d = `M${x1},${y1} A${r},${r} 0 ${largeArc} 1 ${x2},${y2} L${ix1},${iy1} A${innerR},${innerR} 0 ${largeArc} 0 ${ix2},${iy2} Z`;
    return { segment: s, d, pct };
  });

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Organizations by Segment</h3>
      <div className="flex items-center gap-4">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {arcs.map((a) => (
            <path key={a.segment} d={a.d} fill={SEGMENT_STYLES[a.segment as Segment].color} />
          ))}
          <text x={cx} y={cy - 4} textAnchor="middle" className="fill-slate-800 text-lg font-bold">{total}</text>
          <text x={cx} y={cy + 12} textAnchor="middle" className="fill-slate-400 text-[9px]">total</text>
        </svg>
        <div className="space-y-1.5 text-xs">
          {arcs.map((a) => (
            <div key={a.segment} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: SEGMENT_STYLES[a.segment as Segment].color }} />
              <span className="text-slate-600">{a.segment.replace('Capital ', '')}</span>
              <span className="text-slate-400 ml-auto">{counts[a.segment]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
