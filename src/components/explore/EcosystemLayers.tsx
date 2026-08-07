import { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { useDetail } from '../../context/DetailContext';
import type { Organization, CapitalFlow, CapitalInstrument } from '../../types';
import { SEGMENT_STYLES } from '../../types';
import { formatCurrency } from '../../lib/format';

const ORG_PREVIEW = 10;
const FLOW_PREVIEW = 8;

// Derive the instruments used by a set of flows.
export function useInstrumentsForFlows(flows: CapitalFlow[]): CapitalInstrument[] {
  const { maps } = useData();
  return useMemo(() => {
    const ids = new Set<string>();
    flows.forEach((f) => f.capitalInstrumentIds.forEach((id) => ids.add(id)));
    return [...ids]
      .map((id) => maps.instrumentById.get(id))
      .filter((i): i is CapitalInstrument => !!i);
  }, [flows, maps]);
}

// Compact organization grid with click-through to the detail drawer.
export function OrgGrid({ orgs }: { orgs: Organization[] }) {
  const { open } = useDetail();
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? orgs : orgs.slice(0, ORG_PREVIEW);
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {visible.map((o) => (
          <button
            key={o.id}
            onClick={() => open('organization', o.id)}
            className="flex items-center gap-2.5 text-left text-[13px] border border-slate-100 rounded-lg px-3 py-2 hover:border-slate-300 transition-colors"
          >
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: SEGMENT_STYLES[o.segment].color }} />
            <span className="text-slate-700 truncate">{o.name}</span>
            <span className="text-[10px] text-slate-400 ml-auto shrink-0">{o.city ?? o.segment.replace('Capital ', '')}</span>
          </button>
        ))}
      </div>
      {orgs.length > ORG_PREVIEW && (
        <button onClick={() => setShowAll(!showAll)} className="mt-2 text-xs font-semibold text-brand-indigo hover:underline">
          {showAll ? 'Show fewer' : `Show all ${orgs.length}`}
        </button>
      )}
    </>
  );
}

// Capital-flow list, largest first, with click-through to the drawer.
export function FlowList({ flows }: { flows: CapitalFlow[] }) {
  const { open } = useDetail();
  const [showAll, setShowAll] = useState(false);
  const sorted = useMemo(() => [...flows].sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0)), [flows]);
  const visible = showAll ? sorted : sorted.slice(0, FLOW_PREVIEW);
  return (
    <>
      <div className="divide-y divide-slate-50">
        {visible.map((f) => (
          <button
            key={f.id}
            onClick={() => open('flow', f.id)}
            className="w-full flex items-center gap-2.5 text-left text-[13px] py-2 hover:bg-slate-50 rounded transition-colors"
          >
            <span className="text-slate-700 truncate">{f.sourceName ?? '?'} → {f.recipientName ?? '?'}</span>
            <span className="text-[10px] text-slate-400 shrink-0">{[f.type, f.year].filter(Boolean).join(' · ')}</span>
            <b className="ml-auto shrink-0 text-brand-green tabular-nums">{f.amount != null ? formatCurrency(f.amount) : '—'}</b>
          </button>
        ))}
      </div>
      {sorted.length > FLOW_PREVIEW && (
        <button onClick={() => setShowAll(!showAll)} className="mt-2 text-xs font-semibold text-brand-green hover:underline">
          {showAll ? 'Show fewer' : `Show all ${sorted.length}`}
        </button>
      )}
    </>
  );
}

// Instrument record list mirroring the org/flow rows, with click-through to
// the drawer.
export function InstrumentList({ instruments }: { instruments: CapitalInstrument[] }) {
  const { open } = useDetail();
  const sorted = useMemo(
    () => [...instruments].sort((a, b) => b.capitalFlowIds.length - a.capitalFlowIds.length),
    [instruments],
  );
  return (
    <div className="divide-y divide-slate-50">
      {sorted.map((i) => (
        <button
          key={i.id}
          onClick={() => open('instrument', i.id)}
          className="w-full flex items-center gap-2.5 text-left text-[13px] py-2 hover:bg-slate-50 rounded transition-colors"
        >
          <span className="font-semibold text-slate-700 shrink-0">{i.name}</span>
          <span className="text-slate-500 truncate">
            {(i.description?.split('\n')[0] || i.capitalFlowType) ?? ''}
          </span>
          <span className="ml-auto shrink-0 text-[10px] text-slate-400 tabular-nums">
            {i.capitalFlowIds.length} flow{i.capitalFlowIds.length === 1 ? '' : 's'}
          </span>
        </button>
      ))}
    </div>
  );
}

// Instrument chips with click-through to the drawer.
export function InstrumentChips({ instruments }: { instruments: CapitalInstrument[] }) {
  const { open } = useDetail();
  return (
    <div className="flex flex-wrap gap-2">
      {instruments.map((i) => (
        <button
          key={i.id}
          onClick={() => open('instrument', i.id)}
          className="text-xs font-semibold bg-brand-teal-soft text-[#20605f] rounded-full px-3 py-1.5 hover:brightness-95 transition"
        >
          {i.name}
        </button>
      ))}
    </div>
  );
}

interface Props {
  title: string;
  orgs: Organization[];
  flows: CapitalFlow[];
  emptyNote?: string;
}

// Accordion presentation of the org / flow / instrument layers, used by the
// place report on the Explore tab.
export function EcosystemLayers({ title, orgs, flows, emptyNote }: Props) {
  const totalCapital = flows.reduce((sum, f) => sum + (f.amount ?? 0), 0);
  const instruments = useInstrumentsForFlows(flows);

  if (orgs.length === 0 && flows.length === 0) {
    return (
      <div className="mt-6">
        <h3 className="text-lg font-bold text-slate-800">{title}</h3>
        {emptyNote && <p className="text-sm text-slate-400 mt-2">{emptyNote}</p>}
      </div>
    );
  }

  return (
    <div className="mt-6">
      <h3 className="text-lg font-bold text-slate-800">{title}</h3>

      {orgs.length > 0 && (
        <Layer accent="#4750a2" label="Organizations" count={`${orgs.length}`} defaultOpen>
          <OrgGrid orgs={orgs} />
        </Layer>
      )}

      {flows.length > 0 && (
        <Layer accent="#279a49" label="Capital flows" count={`${flows.length} · ${formatCurrency(totalCapital)}`} defaultOpen>
          <FlowList flows={flows} />
        </Layer>
      )}

      {instruments.length > 0 && (
        <Layer accent="#53c3c2" label="Instruments" count={`${instruments.length}`}>
          <InstrumentChips instruments={instruments} />
        </Layer>
      )}
    </div>
  );
}

function Layer({ accent, label, count, defaultOpen, children }: {
  accent: string;
  label: string;
  count: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(!!defaultOpen);
  return (
    <div className="mt-3 bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm" style={{ borderLeft: `4px solid ${accent}` }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
      >
        <ChevronRight size={14} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
        <span className="text-sm font-bold text-slate-800">{label}</span>
        <span className="ml-auto text-xs text-slate-500 tabular-nums">{count}</span>
      </button>
      {isOpen && <div className="px-4 pb-4 pl-[42px]">{children}</div>}
    </div>
  );
}
