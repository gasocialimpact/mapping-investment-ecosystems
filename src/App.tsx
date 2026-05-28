import { useEffect, useMemo, useState } from 'react';
import type { EcosystemData, Organization, Segment } from './types';
import { SEGMENT_ORDER, SEGMENT_STYLES } from './types';
import { loadEcosystemData } from './data/loadData';
import { formatCurrency, formatCurrencyFull } from './lib/format';
import { StatCards } from './components/StatCards';
import { SegmentSection } from './components/SegmentSection';
import { CapitalFlowCard } from './components/CapitalFlowCard';
import { InstrumentCard } from './components/InstrumentCard';
import { MapView } from './components/MapView';

type Tab = 'overview' | 'organizations' | 'flows' | 'instruments' | 'map';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'organizations', label: 'Organizations' },
  { id: 'flows', label: 'Capital Flows' },
  { id: 'instruments', label: 'Capital Instruments' },
  { id: 'map', label: 'Map' },
];

export default function App() {
  const [data, setData] = useState<EcosystemData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [search, setSearch] = useState('');
  const [segmentFilter, setSegmentFilter] = useState<Segment | 'all'>('all');
  const [expanded, setExpanded] = useState<Set<Segment>>(new Set(SEGMENT_ORDER));
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);

  useEffect(() => {
    loadEcosystemData().then(setData).catch((e) => setError(e.message));
  }, []);

  const orgById = useMemo(() => {
    const m = new Map<string, Organization>();
    data?.organizations.forEach((o) => m.set(o.id, o));
    return m;
  }, [data]);

  const flowCountByOrg = useMemo(() => {
    const counts: Record<string, number> = {};
    data?.capitalFlows.forEach((f) => {
      if (f.sourceId) counts[f.sourceId] = (counts[f.sourceId] ?? 0) + 1;
      if (f.recipientId) counts[f.recipientId] = (counts[f.recipientId] ?? 0) + 1;
    });
    return counts;
  }, [data]);

  const filteredOrgs = useMemo(() => {
    if (!data) return [];
    const q = search.toLowerCase().trim();
    return data.organizations.filter((o) => {
      const matchesQuery =
        !q ||
        o.name.toLowerCase().includes(q) ||
        (o.city ?? '').toLowerCase().includes(q) ||
        (o.description ?? '').toLowerCase().includes(q);
      const matchesSegment = segmentFilter === 'all' || o.segment === segmentFilter;
      return matchesQuery && matchesSegment;
    });
  }, [data, search, segmentFilter]);

  const orgsBySegment = useMemo(() => {
    const grouped: Record<string, Organization[]> = {};
    filteredOrgs.forEach((o) => {
      (grouped[o.segment] ??= []).push(o);
    });
    return grouped;
  }, [filteredOrgs]);

  const totalCapital = useMemo(
    () => data?.capitalFlows.reduce((sum, f) => sum + (f.amount ?? 0), 0) ?? 0,
    [data],
  );

  const capitalBySegment = useMemo(() => {
    const totals: Record<string, number> = {};
    data?.capitalFlows.forEach((f) => {
      const src = f.sourceId ? orgById.get(f.sourceId) : undefined;
      if (src) totals[src.segment] = (totals[src.segment] ?? 0) + (f.amount ?? 0);
    });
    return totals;
  }, [data, orgById]);

  const mappedCount = useMemo(
    () => data?.organizations.filter((o) => o.lat != null && o.lng != null).length ?? 0,
    [data],
  );

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="bg-white rounded-lg border border-red-200 p-6 max-w-md text-center shadow-sm">
          <p className="text-red-600 font-semibold">Could not load data</p>
          <p className="text-sm text-slate-500 mt-2">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400 text-sm">
        Loading ecosystem data…
      </div>
    );
  }

  const segmentFilterActive = segmentFilter !== 'all' || search.trim() !== '';
  const selectedOrgFlows = selectedOrg
    ? data.capitalFlows.filter(
        (f) => f.sourceId === selectedOrg.id || f.recipientId === selectedOrg.id,
      )
    : [];

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-lg font-bold text-slate-800">Investment Ecosystem Dashboard</h1>
            <p className="text-xs text-slate-500">
              Organizations · Capital Flows · Instruments — {data.source}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search organizations…"
              className="text-sm border border-slate-300 rounded-md px-3 py-1.5 w-48 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            <select
              value={segmentFilter}
              onChange={(e) => setSegmentFilter(e.target.value as Segment | 'all')}
              className="text-sm border border-slate-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="all">All segments</option>
              {SEGMENT_ORDER.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === t.id
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <StatCards
              orgCount={data.organizations.length}
              flowCount={data.capitalFlows.length}
              totalCapital={totalCapital}
              instrumentCount={data.capitalInstruments.length}
              mappedCount={mappedCount}
            />
            <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-700 mb-3">Capital deployed by source segment</h2>
              <div className="space-y-2">
                {SEGMENT_ORDER.filter((s) => capitalBySegment[s]).map((s) => {
                  const value = capitalBySegment[s];
                  const pct = totalCapital ? (value / totalCapital) * 100 : 0;
                  return (
                    <div key={s}>
                      <div className="flex justify-between text-xs text-slate-600 mb-0.5">
                        <span>{s}</span>
                        <span>{formatCurrency(value)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, background: SEGMENT_STYLES[s].color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-700 mb-3">Largest capital flows</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[...data.capitalFlows]
                  .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0))
                  .slice(0, 6)
                  .map((f) => (
                    <CapitalFlowCard key={f.id} flow={f} />
                  ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'organizations' && (
          <div>
            <p className="text-sm text-slate-500 mb-4">
              {filteredOrgs.length} organization{filteredOrgs.length === 1 ? '' : 's'}
              {segmentFilterActive ? ' matching filters' : ''} · grouped by ecosystem segment
            </p>
            {SEGMENT_ORDER.filter((s) => orgsBySegment[s]?.length).map((segment) => (
              <SegmentSection
                key={segment}
                segment={segment}
                organizations={orgsBySegment[segment] ?? []}
                flowCountByOrg={flowCountByOrg}
                isExpanded={expanded.has(segment)}
                onToggle={() =>
                  setExpanded((prev) => {
                    const next = new Set(prev);
                    next.has(segment) ? next.delete(segment) : next.add(segment);
                    return next;
                  })
                }
                onSelectOrg={setSelectedOrg}
              />
            ))}
          </div>
        )}

        {activeTab === 'flows' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.capitalFlows.map((f) => (
              <CapitalFlowCard key={f.id} flow={f} />
            ))}
          </div>
        )}

        {activeTab === 'instruments' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {data.capitalInstruments.map((i) => (
              <InstrumentCard key={i.id} instrument={i} />
            ))}
          </div>
        )}

        {activeTab === 'map' && <MapView organizations={filteredOrgs} />}
      </main>

      {selectedOrg && (
        <OrgDetailDrawer
          org={selectedOrg}
          flows={selectedOrgFlows}
          orgById={orgById}
          onClose={() => setSelectedOrg(null)}
        />
      )}
    </div>
  );
}

interface DrawerProps {
  org: Organization;
  flows: EcosystemData['capitalFlows'];
  orgById: Map<string, Organization>;
  onClose: () => void;
}

function OrgDetailDrawer({ org, flows, orgById, onClose }: DrawerProps) {
  const style = SEGMENT_STYLES[org.segment];
  const location = [org.city, org.state].filter(Boolean).join(', ') || 'Location not set';
  const outbound = flows.filter((f) => f.sourceId === org.id);
  const inbound = flows.filter((f) => f.recipientId === org.id);

  return (
    <div className="fixed inset-0 z-30 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <aside
        className="relative w-full max-w-md bg-white h-full shadow-xl overflow-y-auto p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 text-sm"
        >
          ✕ Close
        </button>
        <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full border ${style.chip}`}>
          {org.segment}
        </span>
        <h2 className="text-lg font-bold text-slate-800 mt-2">{org.name}</h2>
        <p className="text-xs text-slate-500">{location}</p>
        {org.description && <p className="text-sm text-slate-600 mt-3">{org.description}</p>}
        {org.website && (
          <a
            href={org.website}
            target="_blank"
            rel="noopener"
            className="inline-block text-xs text-blue-600 mt-2"
          >
            {org.website} →
          </a>
        )}

        <FlowList title="Capital deployed (outbound)" flows={outbound} counterpartKey="recipientId" orgById={orgById} />
        <FlowList title="Capital received (inbound)" flows={inbound} counterpartKey="sourceId" orgById={orgById} />

        {outbound.length === 0 && inbound.length === 0 && (
          <p className="text-xs text-slate-400 mt-4">No capital flows recorded for this organization.</p>
        )}
      </aside>
    </div>
  );
}

function FlowList({
  title,
  flows,
  counterpartKey,
  orgById,
}: {
  title: string;
  flows: EcosystemData['capitalFlows'];
  counterpartKey: 'sourceId' | 'recipientId';
  orgById: Map<string, Organization>;
}) {
  if (flows.length === 0) return null;
  return (
    <div className="mt-5">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{title}</h3>
      <ul className="space-y-2">
        {flows.map((f) => {
          const counterpartId = f[counterpartKey];
          const counterpart = counterpartId ? orgById.get(counterpartId) : undefined;
          const counterpartName =
            counterpart?.name ?? (counterpartKey === 'sourceId' ? f.sourceName : f.recipientName) ?? 'Unknown';
          return (
            <li key={f.id} className="flex items-center justify-between text-sm border border-slate-100 rounded-md px-3 py-2">
              <span className="text-slate-600 truncate">{counterpartName}</span>
              <span className="font-semibold text-green-700 ml-2 shrink-0">{formatCurrencyFull(f.amount)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
