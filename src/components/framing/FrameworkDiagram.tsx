import type { KeyboardEvent } from 'react';
import { V2_SEGMENTS, SUB_EXAMPLES } from '../../data/frameworkV2';

// The capital-flow diagram: Supply → Intermediaries → Seekers along the
// spine, Enablers above, Infrastructure beneath. Capital moves left to right
// as an animated ribbon graded between the two segments' colors; returns and
// impact data curve back underneath. Segments are clickable, lift on hover,
// and dim when the active filters leave them with nothing to show.

interface Props {
  activeSeg: string | null;
  /** Segments that still have matching cards under the current filters. */
  liveSegs: Set<string>;
  /** Organization count per segment key under the current filters. */
  counts: Record<string, number>;
  onSelect: (key: string | null) => void;
}

const seg = (key: string) => V2_SEGMENTS.find((s) => s.key === key)!;
const cardsOf = (key: string) => SUB_EXAMPLES.filter((s) => s.seg === key);

// Short names for the diagram; the full titles live on the cards below it.
const SHORT: Record<string, string> = {
  institutional: 'Institutional Investors', dfi: 'DFIs', foundations: 'Foundations & Endowments', hnwi: 'HNWIs & Family Offices', retail: 'Retail Investors',
  fund_managers: 'Impact Fund Managers', ibanks: 'Investment Banks & Advisors', banks: 'Commercial & Community Banks', fintech: 'Crowdfunding & Fintech', cdfi: 'CDFIs, Loan Funds & Credit Unions',
  social_enterprises: 'Social Enterprises & Impact Businesses', public_cos: 'Public Companies & Corporate Issuers', ngos: 'NGOs & Non-Profits',
  developers: 'Sustainable RE & Infrastructure Developers', raters: 'Rating & Verification', networks: 'Networks & Industry Bodies', policy: 'Policymakers & Regulators', coaches: 'Coaches, Incubators & Accelerators', advisors: 'Technical Advisors & Professional Services',
  standards: 'Standard Setters & Frameworks', platforms: 'Technology Platforms & Marketplaces',
};
const linesOf = (key: string) => cardsOf(key).map((c) => SHORT[c.id] ?? c.title);

// Spine geometry
const BOX = { y: 160, w: 280, h: 168 };
const X = { supply: 40, aggs: 420, seek: 800 };
const FLOW_Y = BOX.y + 66;      // capital ribbon
const RETURN_Y = BOX.y + 108;   // returns curve

const CSS = `
.fw-seg { cursor: pointer; transition: opacity .2s, transform .2s; transform-box: fill-box; transform-origin: center; }
.fw-seg:hover, .fw-seg:focus-visible { transform: translateY(-2px); }
.fw-seg:hover .fw-shade, .fw-seg:focus-visible .fw-shade { opacity: 1; }
.fw-seg:focus { outline: none; }
.fw-shade { opacity: 0; transition: opacity .2s; }
.fw-flow { stroke-dasharray: 6 10; animation: fw-run 1.4s linear infinite; }
.fw-back { stroke-dasharray: 3 7; animation: fw-run 2.2s linear infinite reverse; }
.fw-loop { stroke-dasharray: 4 8; animation: fw-run 3s linear infinite; }
@keyframes fw-run { to { stroke-dashoffset: -16; } }
@media (prefers-reduced-motion: reduce) { .fw-flow, .fw-back, .fw-loop { animation: none; } }
`;

export function FrameworkDiagram({ activeSeg, liveSegs, counts = {}, onSelect }: Props) {
  const op = (key: string) => (liveSegs.has(key) ? 1 : 0.3);
  const toggle = (k: string) => onSelect(activeSeg === k ? null : k);
  const keyHandler = (k: string) => (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(k); }
  };

  const Count = ({ k, x, y }: { k: string; x: number; y: number }) => {
    const s = seg(k);
    const n = counts[k] ?? 0;
    if (!s.data) return null;
    const label = String(n);
    const w = 22 + label.length * 7;
    return (
      <g aria-hidden="true">
        <rect x={x - w} y={y} width={w} height={20} rx={10} fill={activeSeg === k ? s.color : '#fff'} stroke={s.color} strokeWidth={1.25} />
        <text x={x - w / 2} y={y + 14} fontSize={11} fontWeight={700} textAnchor="middle" fill={activeSeg === k ? '#fff' : s.color}>{label}</text>
      </g>
    );
  };

  const Box = ({ k, x }: { k: string; x: number }) => {
    const s = seg(k);
    const active = activeSeg === k;
    const lines = linesOf(k);
    return (
      <g
        className="fw-seg"
        role="button" tabIndex={0}
        aria-label={`${s.label}: ${counts[k] ?? 0} organizations`}
        aria-pressed={active}
        onClick={() => toggle(k)} onKeyDown={keyHandler(k)}
        style={{ opacity: op(k) }}
      >
        <rect x={x} y={BOX.y} width={BOX.w} height={BOX.h} rx={10} fill={s.tint} stroke={s.color} strokeWidth={active ? 3 : 1.5} />
        <rect className="fw-shade" x={x} y={BOX.y} width={BOX.w} height={BOX.h} rx={10} fill={s.color} fillOpacity={0.08} pointerEvents="none" />
        <rect x={x} y={BOX.y} width={6} height={BOX.h} rx={3} fill={s.color} />
        <text x={x + 20} y={BOX.y + 30} fontSize={15} fontWeight={700} fill="#1e2331">{s.label}</text>
        {lines.map((l, i) => (
          <text key={l} x={x + 20} y={BOX.y + 56 + i * 17} fontSize={11.5} fill="#475569">{l}</text>
        ))}
        <Count k={k} x={x + BOX.w - 12} y={BOX.y + BOX.h - 32} />
      </g>
    );
  };

  const Band = ({ k, y, h }: { k: string; y: number; h: number }) => {
    const s = seg(k);
    const active = activeSeg === k;
    return (
      <g
        className="fw-seg"
        role="button" tabIndex={0}
        aria-label={s.label} aria-pressed={active}
        onClick={() => toggle(k)} onKeyDown={keyHandler(k)}
        style={{ opacity: op(k) }}
      >
        <rect x={40} y={y} width={1040} height={h} rx={10} fill="#f4f6fa" stroke={active ? s.color : '#dfe3ec'} strokeWidth={active ? 3 : 1.5} />
        <rect className="fw-shade" x={40} y={y} width={1040} height={h} rx={10} fill={s.color} fillOpacity={0.08} pointerEvents="none" />
        <rect x={40} y={k === 'enab' ? y : y + h - 5} width={1040} height={5} fill={s.color} />
        <text x={60} y={y + 34} fontSize={15} fontWeight={700} fill="#1e2331">{s.label}</text>
        <text x={60} y={y + 54} fontSize={11.5} fill="#475569">{s.desc}</text>
        <text x={60} y={y + h - 18} fontSize={11.5} fill="#64748b">{linesOf(k).join('  ·  ')}</text>
        <Count k={k} x={1068} y={y + 14} />
      </g>
    );
  };

  // Capital ribbon between two boxes, graded from the giver's color to the receiver's.
  const Flow = ({ from, to, x1, x2 }: { from: string; to: string; x1: number; x2: number }) => {
    const id = `fw-grad-${from}-${to}`;
    const mid = (x1 + x2) / 2;
    return (
      <g pointerEvents="none">
        <defs>
          <linearGradient id={id} gradientUnits="userSpaceOnUse" x1={x1} x2={x2} y1={0} y2={0}>
            <stop offset="0" stopColor={seg(from).color} />
            <stop offset="1" stopColor={seg(to).color} />
          </linearGradient>
        </defs>
        <path d={`M${x1} ${FLOW_Y} H${x2 - 10}`} stroke={`url(#${id})`} strokeWidth={16} strokeOpacity={0.18} strokeLinecap="round" fill="none" />
        <path className="fw-flow" d={`M${x1} ${FLOW_Y} H${x2 - 10}`} stroke={`url(#${id})`} strokeWidth={3} strokeLinecap="round" fill="none" />
        <path d={`M${x2 - 12} ${FLOW_Y - 8} L${x2} ${FLOW_Y} L${x2 - 12} ${FLOW_Y + 8} Z`} fill={seg(to).color} />
        <text x={mid} y={FLOW_Y - 14} fontSize={11} fontWeight={600} textAnchor="middle" fill="#334155">capital</text>
        <path className="fw-back" d={`M${x2} ${RETURN_Y} Q${mid} ${RETURN_Y + 34} ${x1 + 10} ${RETURN_Y}`} stroke="#94a3b8" strokeWidth={1.75} fill="none" />
        <path d={`M${x1 + 11} ${RETURN_Y - 6} L${x1} ${RETURN_Y} L${x1 + 11} ${RETURN_Y + 6} Z`} fill="#94a3b8" />
        <text x={mid} y={RETURN_Y + 30} fontSize={10.5} fontStyle="italic" textAnchor="middle" fill="#64748b">returns & impact data</text>
      </g>
    );
  };

  const support = (x: number, y1: number, y2: number, text: string) => (
    <g pointerEvents="none">
      <path d={`M${x} ${y1} V${y2}`} stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="3 4" fill="none" markerEnd="url(#fw-arrow)" />
      {text && <text x={x + 10} y={(y1 + y2) / 2 + 4} fontSize={11} fontStyle="italic" fill="#64748b">{text}</text>}
    </g>
  );

  const loopY = BOX.y + BOX.h + 30;
  const loopD = `M${X.supply + 140} ${BOX.y + BOX.h} V${loopY - 10} Q${X.supply + 140} ${loopY} ${X.supply + 150} ${loopY} H${X.seek + 130} Q${X.seek + 140} ${loopY} ${X.seek + 140} ${loopY - 10} V${BOX.y + BOX.h + 2}`;

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-3 overflow-x-auto">
      <style>{CSS}</style>
      <svg viewBox="0 0 1120 530" className="block w-full min-w-[880px] h-auto" style={{ fontFamily: 'inherit' }} role="img" aria-label="Framework diagram. Capital flows from Supply through Intermediaries to Seekers; Enablers support from above and Infrastructure from below.">
        <defs>
          <marker id="fw-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
            <path d="M0 0L10 5 0 10z" fill="#94a3b8" />
          </marker>
        </defs>

        <Band k="enab" y={16} h={100} />
        {support(X.supply + 140, 116, BOX.y - 2, 'standards, policy')}
        {support(X.aggs + 140, 116, BOX.y - 2, 'verification, pipeline')}
        {support(X.seek + 140, 116, BOX.y - 2, 'investment readiness')}

        <Flow from="supply" to="aggs" x1={X.supply + BOX.w} x2={X.aggs} />
        <Flow from="aggs" to="seek" x1={X.aggs + BOX.w} x2={X.seek} />

        <g pointerEvents="none">
          <path className="fw-loop" d={loopD} stroke="#94a3b8" strokeWidth={1.5} fill="none" markerEnd="url(#fw-arrow)" />
          <rect x={430} y={loopY - 9} width={260} height={18} rx={9} fill="#fff" />
          <text x={560} y={loopY + 4} fontSize={11} fontStyle="italic" textAnchor="middle" fill="#64748b">direct deals: PRIs, first-loss, program lending</text>
        </g>

        <Box k="supply" x={X.supply} />
        <Box k="aggs" x={X.aggs} />
        <Box k="seek" x={X.seek} />

        {support(X.supply + 140, 404, loopY + 12, '')}
        {support(X.aggs + 140, 404, loopY + 12, '')}
        {support(X.seek + 140, 404, loopY + 12, '')}

        <Band k="infra" y={406} h={110} />
      </svg>
    </div>
  );
}
