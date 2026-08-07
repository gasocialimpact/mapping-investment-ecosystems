import { useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import type { Organization, CapitalFlow } from '../types';
import {
  FRAMEWORK_FUNCTIONS, FRAMEWORK_SEGMENTS, FRAMEWORK_NODES, getSegment,
} from '../data/frameworkData';
import type { FrameworkNode } from '../data/frameworkData';
import { NodeDetailCard } from './FrameworkTab';
import { OrgGrid, FlowList, InstrumentList, useInstrumentsForFlows } from './explore/EcosystemLayers';
import { formatCurrency } from '../lib/format';

// Framework segment key → ecosystem data segment name. Infrastructure has no
// org segment — it's contextual, not a set of tracked organizations.
const SEG_TO_DATA: Record<string, string | null> = {
  supply: 'Capital Allocator',
  aggs: 'Capital Aggregator',
  seek: 'Capital Seeker',
  enab: 'Capital Enabler',
  infra: null,
};

// Stakeholder-type → organization matchers, based on the Airtable orgType
// field. Many orgs have no orgType yet, so segment-level browsing (clicking a
// column header) is the guaranteed path to every record.
const NODE_ORG_MATCH: Record<string, (o: Organization) => boolean> = {
  inst_owners: (o) => o.segment === 'Capital Allocator' &&
    ['Publicly Traded Company', 'Healthcare System', 'Higher Education Institution'].includes(o.orgType ?? ''),
  foundations: (o) =>
    ['Foundation (Private)', 'Foundation (Corporate)', 'Foundation (Public DAF Sponsor)', 'DAF or Charitable Fund'].includes(o.orgType ?? ''),
  gov_supply: (o) => o.segment === 'Capital Allocator' && o.orgType === 'Government Agency',
  hnwi: (o) => o.orgType === 'HNWI or Family Office',
  banks_supply: (o) => ['Bank (Commercial)', 'Bank (Community)'].includes(o.orgType ?? ''),
  fund_managers: (o) => o.orgType === 'Loan or Private Investment Fund',
  cdfi: (o) => o.orgType === 'CDFI or Credit Union',
  intermediaries: (o) => o.orgType === 'Financial Services Firm',
  pe_funds: (o) => o.orgType === 'PE or Venture Capital Firm',
  vc_funds: (o) => o.orgType === 'PE or Venture Capital Firm',
  social_enterprises: (o) => o.orgType === 'Business or Social Enterprise',
  real_estate: (o) => o.orgType === 'Real Estate Development Firm',
  ecosystem_builders: (o) => o.orgType === 'Ecosystem Builder or Think-Tank',
  prof_services: (o) => o.orgType === 'Professional Service Provider',
  gov_enab: (o) => o.segment === 'Capital Enabler' && o.orgType === 'Government Agency',
};

type Selection =
  | { kind: 'node'; node: FrameworkNode }
  | { kind: 'segment'; key: string }
  | { kind: 'uncategorized' }
  | null;

// Tab 2 — Framing Our Ecosystem. The Core Functions framework is the main
// feature; selecting a stakeholder type (or a whole segment) unfurls the
// organizations, capital flows, and instruments behind it.
export function FramingTab() {
  const { data } = useData();
  const [fnFilter, setFnFilter] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection>(null);

  const nodes = useMemo(
    () => FRAMEWORK_NODES.filter((n) => !fnFilter || n.fn.includes(fnFilter)),
    [fnFilter],
  );

  const orgCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of FRAMEWORK_NODES) {
      const match = NODE_ORG_MATCH[n.id];
      counts.set(n.id, match ? (data?.organizations ?? []).filter(match).length : 0);
    }
    return counts;
  }, [data]);

  const { selOrgs, selFlows, selTitle } = useMemo(() => {
    const all = data?.organizations ?? [];
    let orgs: Organization[] = [];
    let title = '';
    if (selection?.kind === 'node') {
      const match = NODE_ORG_MATCH[selection.node.id];
      orgs = match ? all.filter(match) : [];
      title = selection.node.title;
    } else if (selection?.kind === 'segment') {
      const segName = SEG_TO_DATA[selection.key];
      orgs = segName ? all.filter((o) => o.segment === segName) : [];
      title = getSegment(selection.key)?.label ?? '';
    } else if (selection?.kind === 'uncategorized') {
      orgs = all.filter((o) => o.segment === 'Uncategorized');
      title = 'Uncategorized organizations';
    }
    const ids = new Set(orgs.map((o) => o.id));
    const flows = (data?.capitalFlows ?? []).filter(
      (f) => (f.sourceId && ids.has(f.sourceId)) || (f.recipientId && ids.has(f.recipientId)),
    );
    return { selOrgs: orgs, selFlows: flows, selTitle: title };
  }, [selection, data]);

  const uncategorizedCount = (data?.organizations ?? []).filter((o) => o.segment === 'Uncategorized').length;

  return (
    <div className="pb-10 pt-6">
      {/* Function filter */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFnFilter(null)}
          className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
            !fnFilter ? 'bg-brand-indigo text-white border-brand-indigo' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
          }`}
        >
          All Functions
        </button>
        {FRAMEWORK_FUNCTIONS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFnFilter(fnFilter === f.key ? null : f.key)}
            title={f.desc}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
              fnFilter === f.key ? 'bg-brand-indigo text-white border-brand-indigo' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Framework grid */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-5">
        {FRAMEWORK_SEGMENTS.map((seg) => {
          const segNodes = nodes.filter((n) => n.seg === seg.key);
          const segSelected = selection?.kind === 'segment' && selection.key === seg.key;
          const browsable = SEG_TO_DATA[seg.key] != null;
          return (
            <div key={seg.key} className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
              <button
                onClick={() => browsable && setSelection(segSelected ? null : { kind: 'segment', key: seg.key })}
                disabled={!browsable}
                className={`w-full text-left px-3 py-2 border-b-2 transition-colors ${browsable ? 'hover:bg-slate-50' : 'cursor-default'}`}
                style={{ borderBottomColor: seg.color, background: segSelected ? `${seg.color}14` : undefined }}
              >
                <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: seg.color }}>{seg.label}</h3>
                <p className="text-[10px] text-slate-400">
                  {segNodes.length} stakeholder type{segNodes.length !== 1 ? 's' : ''}
                  {browsable && ' · click to browse all'}
                </p>
              </button>
              <div className="p-2 space-y-1.5">
                {segNodes.map((node) => {
                  const isSel = selection?.kind === 'node' && selection.node.id === node.id;
                  const count = orgCounts.get(node.id) ?? 0;
                  return (
                    <button
                      key={node.id}
                      onClick={() => setSelection(isSel ? null : { kind: 'node', node })}
                      className={`w-full text-left p-2 rounded-md border transition-colors ${
                        isSel ? 'border-transparent' : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                      style={isSel ? { background: `${seg.color}1c` } : undefined}
                    >
                      <p className="text-xs font-semibold text-slate-800 flex items-center justify-between gap-1">
                        <span>{node.title}</span>
                        {count > 0 && (
                          <span className="text-[9px] font-bold text-white rounded-full px-1.5 py-px shrink-0" style={{ background: seg.color }}>
                            {count}
                          </span>
                        )}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{node.meta}</p>
                    </button>
                  );
                })}
                {segNodes.length === 0 && <p className="text-[10px] text-slate-300 p-2">No matches</p>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Selection detail: description card (40%) beside the records (60%) */}
      {selection && (
        <div className={`mt-6 grid gap-5 items-start grid-cols-1 ${selection.kind === 'node' ? 'lg:grid-cols-[2fr_3fr]' : ''}`}>
          {selection.kind === 'node' && (
            <NodeDetailCard
              node={selection.node}
              onNavigate={(n) => setSelection({ kind: 'node', node: n })}
            />
          )}
          <RecordsPanel
            key={selTitle}
            title={selTitle}
            orgs={selOrgs}
            flows={selFlows}
            onClose={() => setSelection(null)}
          />
        </div>
      )}

      {/* Uncategorized records stay reachable */}
      {uncategorizedCount > 0 && selection?.kind !== 'uncategorized' && (
        <button
          onClick={() => setSelection({ kind: 'uncategorized' })}
          className="mt-5 text-xs font-semibold text-slate-400 hover:text-slate-600 hover:underline"
        >
          + {uncategorizedCount} uncategorized organizations not shown in the framework
        </button>
      )}

    </div>
  );
}

type RecordsView = 'orgs' | 'flows' | 'instruments';

// The unfurled records behind a framework selection, switched with the same
// pill sub-tab style used on the Explore scope tabs and the Glossary tab.
function RecordsPanel({ title, orgs, flows, onClose }: {
  title: string;
  orgs: Organization[];
  flows: CapitalFlow[];
  onClose: () => void;
}) {
  const [view, setView] = useState<RecordsView>('orgs');
  const instruments = useInstrumentsForFlows(flows);
  const totalCapital = flows.reduce((s, f) => s + (f.amount ?? 0), 0);

  const pills: { key: RecordsView; label: string }[] = [
    { key: 'orgs', label: `Organizations (${orgs.length})` },
    { key: 'flows', label: `Capital Flows (${flows.length})` },
    { key: 'instruments', label: `Instruments (${instruments.length})` },
  ];

  return (
    <div className="border border-slate-200 rounded-xl p-5 shadow-sm" style={{ borderLeft: '4px solid #4750a2' }}>
      <div className="flex items-baseline gap-3 flex-wrap">
        <h3 className="text-xl font-bold text-slate-800">{title}</h3>
        {totalCapital > 0 && (
          <span className="text-xs text-slate-500">{formatCurrency(totalCapital)} in tracked flows</span>
        )}
        <button onClick={onClose} className="ml-auto text-xs text-slate-400 hover:text-slate-600">✕ Close</button>
      </div>

      {orgs.length === 0 ? (
        <p className="text-sm text-slate-400 mt-3">
          No organizations are tagged with this stakeholder type yet — click the segment header to
          browse the whole segment instead.
        </p>
      ) : (
        <>
          <div className="flex items-center gap-3 flex-wrap mt-4">
            {pills.map((p) => (
              <button
                key={p.key}
                onClick={() => setView(p.key)}
                className={`text-sm font-medium px-3 py-1.5 rounded-md border transition-colors ${
                  view === p.key
                    ? 'bg-brand-indigo text-white border-brand-indigo'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="mt-4">
            {view === 'orgs' && <OrgGrid orgs={orgs} />}
            {view === 'flows' && (flows.length > 0 ? <FlowList flows={flows} /> : <p className="text-sm text-slate-400">No tracked capital flows touch these organizations yet.</p>)}
            {view === 'instruments' && (instruments.length > 0 ? <InstrumentList instruments={instruments} /> : <p className="text-sm text-slate-400">No instruments are linked to these organizations' flows yet.</p>)}
          </div>
        </>
      )}
    </div>
  );
}
