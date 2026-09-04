import { useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import type { Organization, CapitalFlow, ImpactDimension } from '../types';
import {
  V2_SEGMENTS, V2_FUNCTIONS, SUB_EXAMPLES, subExampleFor, segmentKeyFor, impactIdsOf,
} from '../data/frameworkV2';
import type { SubExample, FnKey } from '../data/frameworkV2';
import { FrameworkDiagram } from './framing/FrameworkDiagram';
import { OrgGrid, FlowList, InstrumentList, useInstrumentsForFlows } from './explore/EcosystemLayers';
import { formatCurrency } from '../lib/format';

// Tab 2 — Framing Our Ecosystem (framework v2). The diagram and the cards are
// one view: filters narrow both, and selecting a segment or a card unfurls
// the organizations, capital flows and instruments behind it.

type Selection =
  | { kind: 'card'; card: SubExample }
  | { kind: 'segment'; key: string }
  | { kind: 'untagged'; key: string }
  | { kind: 'uncategorized' }
  | null;

const IMPACT_GROUPS: ImpactDimension['type'][] = ['Sector Focus', 'SDG Alignment', 'Population Focus', 'Alternative Ownership Component'];

export function FramingTab() {
  const { data } = useData();
  const [segFilter, setSegFilter] = useState<string | null>(null);
  const [fnFilter, setFnFilter] = useState<FnKey | null>(null);
  const [impactFilter, setImpactFilter] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection>(null);

  const allOrgs = data?.organizations ?? [];

  // Organizations that pass the impact filter (segment/function filters act on cards).
  const orgs = useMemo(
    () => (impactFilter ? allOrgs.filter((o) => impactIdsOf(o).includes(impactFilter)) : allOrgs),
    [allOrgs, impactFilter],
  );

  // Roll-up: card id -> orgs; segment key -> orgs with no card.
  const { byCard, untaggedBySeg } = useMemo(() => {
    const byCard = new Map<string, Organization[]>();
    const untaggedBySeg = new Map<string, Organization[]>();
    for (const o of orgs) {
      const card = subExampleFor(o);
      if (card) {
        if (!byCard.has(card.id)) byCard.set(card.id, []);
        byCard.get(card.id)!.push(o);
      } else {
        const seg = segmentKeyFor(o);
        if (seg) {
          if (!untaggedBySeg.has(seg)) untaggedBySeg.set(seg, []);
          untaggedBySeg.get(seg)!.push(o);
        }
      }
    }
    return { byCard, untaggedBySeg };
  }, [orgs]);

  const visibleCards = useMemo(
    () => SUB_EXAMPLES.filter((c) => (!segFilter || c.seg === segFilter) && (!fnFilter || c.fn.includes(fnFilter))),
    [segFilter, fnFilter],
  );
  const liveSegs = useMemo(() => new Set(visibleCards.map((c) => c.seg)), [visibleCards]);
  const segCounts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const s of V2_SEGMENTS) if (s.data) out[s.key] = orgs.filter((o) => o.segment === s.data).length;
    return out;
  }, [orgs]);

  const { selOrgs, selFlows, selTitle, selSeg } = useMemo(() => {
    let list: Organization[] = [];
    let title = '';
    let segKey: string | null = null;
    if (selection?.kind === 'card') {
      list = byCard.get(selection.card.id) ?? [];
      title = selection.card.title;
      segKey = selection.card.seg;
    } else if (selection?.kind === 'segment') {
      const s = V2_SEGMENTS.find((x) => x.key === selection.key);
      list = s?.data ? orgs.filter((o) => o.segment === s.data) : [];
      title = s?.label ?? '';
      segKey = selection.key;
    } else if (selection?.kind === 'untagged') {
      const s = V2_SEGMENTS.find((x) => x.key === selection.key);
      list = untaggedBySeg.get(selection.key) ?? [];
      title = `${s?.label ?? ''} · not yet tagged to a sub-example`;
      segKey = selection.key;
    } else if (selection?.kind === 'uncategorized') {
      list = orgs.filter((o) => o.segment === 'Uncategorized');
      title = 'Uncategorized organizations';
    }
    const ids = new Set(list.map((o) => o.id));
    const flows = (data?.capitalFlows ?? []).filter(
      (f) => (f.sourceId && ids.has(f.sourceId)) || (f.recipientId && ids.has(f.recipientId)),
    );
    return { selOrgs: list, selFlows: flows, selTitle: title, selSeg: segKey };
  }, [selection, byCard, untaggedBySeg, orgs, data]);

  const uncategorizedCount = orgs.filter((o) => o.segment === 'Uncategorized').length;
  const impactDims = data?.impactDimensions ?? [];
  const activeImpact = impactDims.find((d) => d.id === impactFilter) ?? null;

  const selectSegment = (key: string | null) => {
    setSegFilter(key);
    setSelection(key ? { kind: 'segment', key } : null);
  };

  return (
    <div className="pb-10 pt-6 space-y-5">
      {/* Filter bar */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm px-3 py-2.5 flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mr-1">Filter</span>

        <Select
          label="Segment"
          value={segFilter ?? ''}
          onChange={(v) => selectSegment(v || null)}
          options={V2_SEGMENTS.map((s) => ({ value: s.key, label: s.label }))}
        />
        <Select
          label="Function"
          value={fnFilter ?? ''}
          onChange={(v) => setFnFilter((v || null) as FnKey | null)}
          options={V2_FUNCTIONS.map((f) => ({ value: f.key, label: f.label }))}
        />
        <Select
          label="Impact"
          value={impactFilter ?? ''}
          onChange={(v) => setImpactFilter(v || null)}
          groups={IMPACT_GROUPS.map((g) => ({
            label: g,
            options: impactDims.filter((d) => d.type === g).map((d) => ({ value: d.id, label: d.label })),
          }))}
        />
        <span className="text-xs text-slate-400 border border-dashed border-slate-200 rounded-md px-2.5 py-1.5 cursor-not-allowed" title="Capital type and instrument tagging is still being defined">
          Capital type / instrument <span className="text-[9px] font-semibold uppercase tracking-wider ml-1">soon</span>
        </span>
        <span className="text-xs text-slate-400 border border-dashed border-slate-200 rounded-md px-2.5 py-1.5 cursor-not-allowed" title="Service offering tagging has not been built yet">
          Service offering <span className="text-[9px] font-semibold uppercase tracking-wider ml-1">soon</span>
        </span>

        {(segFilter || fnFilter || impactFilter) && (
          <button
            onClick={() => { setSegFilter(null); setFnFilter(null); setImpactFilter(null); setSelection(null); }}
            className="ml-auto text-xs font-semibold text-slate-500 hover:text-slate-800"
          >
            Clear filters
          </button>
        )}
      </div>

      {activeImpact && (
        <p className="text-xs text-slate-500 -mt-2">
          Showing organizations tagged <span className="font-semibold text-slate-700">{activeImpact.label}</span> ({orgs.length} of {allOrgs.length}). Card counts reflect this filter.
        </p>
      )}

      <FrameworkDiagram activeSeg={segFilter} liveSegs={liveSegs} counts={segCounts} onSelect={selectSegment} />

      {/* Cards, grouped by segment */}
      <div className="space-y-6">
        {V2_SEGMENTS.filter((s) => !segFilter || s.key === segFilter).map((s) => {
          const cards = visibleCards.filter((c) => c.seg === s.key);
          if (cards.length === 0) return null;
          const segOrgs = s.data ? orgs.filter((o) => o.segment === s.data) : [];
          const untagged = untaggedBySeg.get(s.key) ?? [];
          const segSelected = selection?.kind === 'segment' && selection.key === s.key;
          return (
            <section key={s.key} aria-label={s.label}>
              <div className="grid grid-cols-[6px_1fr_auto] gap-3 items-start mb-2.5">
                <div className="w-1.5 self-stretch rounded-full" style={{ background: s.color }} />
                <div>
                  <h3 className="text-base font-bold text-slate-800 leading-tight">{s.label}</h3>
                  <p className="text-xs text-slate-500 mt-0.5 max-w-3xl">{s.desc}</p>
                </div>
                {s.data && (
                  <button
                    onClick={() => setSelection(segSelected ? null : { kind: 'segment', key: s.key })}
                    className={`text-xs font-semibold rounded-md px-2.5 py-1.5 border transition-colors ${segSelected ? 'text-white border-transparent' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}
                    style={segSelected ? { background: s.color } : undefined}
                  >
                    Browse all {segOrgs.length}
                  </button>
                )}
              </div>

              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {cards.map((card) => {
                  const list = byCard.get(card.id) ?? [];
                  const isSel = selection?.kind === 'card' && selection.card.id === card.id;
                  return (
                    <button
                      key={card.id}
                      onClick={() => setSelection(isSel ? null : { kind: 'card', card })}
                      aria-pressed={isSel}
                      className={`text-left bg-white rounded-lg border p-3.5 flex flex-col gap-2 transition-colors ${isSel ? 'border-transparent ring-2' : 'border-slate-200 hover:border-slate-300'}`}
                      style={{ borderTop: `3px solid ${s.color}`, ...(isSel ? { boxShadow: `0 0 0 2px ${s.color}` } : {}) }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-semibold text-slate-800 leading-snug">{card.title}</h4>
                        <span
                          className={`shrink-0 text-[10px] font-bold rounded-full px-1.5 py-px ${list.length ? 'text-white' : 'text-slate-400 border border-dashed border-slate-300'}`}
                          style={list.length ? { background: s.color } : undefined}
                          title={list.length ? `${list.length} organizations` : 'No organizations tagged yet'}
                        >
                          {list.length}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed line-clamp-4">{card.desc}</p>
                      <div className="flex flex-wrap gap-1 mt-auto pt-1">
                        {card.subcards.map((t) => (
                          <span key={t} className="text-[10.5px] px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-600 leading-tight">{t}</span>
                        ))}
                      </div>
                    </button>
                  );
                })}

                {untagged.length > 0 && !fnFilter && (
                  <button
                    onClick={() => setSelection(selection?.kind === 'untagged' && selection.key === s.key ? null : { kind: 'untagged', key: s.key })}
                    className="text-left rounded-lg border border-dashed border-slate-300 p-3.5 flex flex-col gap-1 hover:border-slate-400 transition-colors"
                  >
                    <h4 className="text-sm font-semibold text-slate-600">Not yet tagged</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {untagged.length} {s.short} organization{untagged.length === 1 ? '' : 's'} have no Org. Type in Airtable, so they don't roll up to a sub-example yet.
                    </p>
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {selection && (
        <RecordsPanel
          key={selTitle}
          title={selTitle}
          color={V2_SEGMENTS.find((s) => s.key === selSeg)?.color ?? '#4750a2'}
          orgs={selOrgs}
          flows={selFlows}
          onClose={() => setSelection(null)}
        />
      )}

      {uncategorizedCount > 0 && selection?.kind !== 'uncategorized' && (
        <button
          onClick={() => setSelection({ kind: 'uncategorized' })}
          className="text-xs font-semibold text-slate-400 hover:text-slate-600 hover:underline"
        >
          + {uncategorizedCount} uncategorized organizations not shown in the framework
        </button>
      )}
    </div>
  );
}

function Select({ label, value, onChange, options, groups }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options?: { value: string; label: string }[];
  groups?: { label: string; options: { value: string; label: string }[] }[];
}) {
  const active = value !== '';
  return (
    <label className={`inline-flex items-center gap-1.5 text-xs rounded-md border px-2 py-1 ${active ? 'border-brand-indigo bg-brand-indigo/5 text-slate-800' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
      <span className="font-semibold">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-xs outline-none max-w-[220px] cursor-pointer"
        aria-label={`Filter by ${label.toLowerCase()}`}
      >
        <option value="">All</option>
        {options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        {groups?.map((g) => g.options.length > 0 && (
          <optgroup key={g.label} label={g.label}>
            {g.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

type RecordsView = 'orgs' | 'flows' | 'instruments';

// The unfurled records behind a selection, switched with the same pill
// sub-tab style used on the Explore scope tabs and the Glossary tab.
function RecordsPanel({ title, color, orgs, flows, onClose }: {
  title: string;
  color: string;
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
    <div className="border border-slate-200 rounded-xl p-5 shadow-sm bg-white" style={{ borderLeft: `4px solid ${color}` }}>
      <div className="flex items-baseline gap-3 flex-wrap">
        <h3 className="text-xl font-bold text-slate-800">{title}</h3>
        {totalCapital > 0 && (
          <span className="text-xs text-slate-500">{formatCurrency(totalCapital)} in tracked flows</span>
        )}
        <button onClick={onClose} className="ml-auto text-xs text-slate-400 hover:text-slate-600">✕ Close</button>
      </div>

      {orgs.length === 0 ? (
        <p className="text-sm text-slate-400 mt-3">
          No organizations are tagged here yet. Use "Browse all" on the segment to see every record in it.
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
