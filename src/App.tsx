import { useMemo, useState } from 'react';
import { LayoutDashboard, Building2, ArrowRightLeft, Briefcase, MapPin, BookOpen, RotateCcw, Printer, HelpCircle } from 'lucide-react';
import { SEGMENT_ORDER, SEGMENT_STYLES } from './types';
import type { Segment, Tab } from './types';
import { DataProvider, useData } from './context/DataContext';
import { FilterProvider, useFilters } from './context/FilterContext';
import { DetailProvider } from './context/DetailContext';
import { FilterBar } from './components/FilterBar';
import { StatCards } from './components/StatCards';
import { SegmentSection } from './components/SegmentSection';
import { CapitalFlowCard } from './components/CapitalFlowCard';
import { InstrumentCard } from './components/InstrumentCard';
import { LocationCard } from './components/LocationCard';
import { OverviewMap } from './components/OverviewMap';
import { DetailDrawer } from './components/detail/DetailDrawer';
import { FrameworkTab } from './components/FrameworkTab';
import { SegmentDonut } from './components/charts/SegmentDonut';
import { FlowTypeBar } from './components/charts/FlowTypeBar';
import { ImpactBreakdown } from './components/charts/ImpactBreakdown';
import { formatCurrency } from './lib/format';

const TABS: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'organizations', label: 'Organizations', icon: Building2 },
  { id: 'flows', label: 'Capital Flows', icon: ArrowRightLeft },
  { id: 'instruments', label: 'Instruments', icon: Briefcase },
  { id: 'locations', label: 'Locations', icon: MapPin },
  { id: 'framework', label: 'Framework & Terminology', icon: BookOpen },
];

export default function App() {
  return (
    <DataProvider>
      <FilterProvider>
        <DetailProvider>
          <Dashboard />
          <DetailDrawer />
        </DetailProvider>
      </FilterProvider>
    </DataProvider>
  );
}

function Dashboard() {
  const { data, error } = useData();
  const [activeTab, setActiveTab] = useState<Tab>('overview');

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
        Loading ecosystem data...
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg shrink-0" style={{ background: 'conic-gradient(from 90deg, #4750a2, #53c3c2, #f1d25b, #279a49)', border: '1px solid #e4e8f2' }} />
            <div>
              <h1 className="text-lg font-bold text-slate-800">Investment Ecosystem Dashboard</h1>
              <p className="text-xs text-slate-500">Georgia Impact Investing Ecosystem</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setActiveTab('overview'); window.scrollTo(0, 0); }}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <RotateCcw size={12} /> Reset View
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <Printer size={12} /> Print
            </button>
            <button
              onClick={() => setActiveTab('framework')}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <HelpCircle size={12} /> How To
            </button>
          </div>
        </div>
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === t.id
                  ? 'border-brand-indigo text-brand-indigo'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <t.icon size={14} />
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <FilterBar />

        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'organizations' && <OrganizationsTab />}
        {activeTab === 'flows' && <FlowsTab />}
        {activeTab === 'instruments' && <InstrumentsTab />}
        {activeTab === 'locations' && <LocationsTab />}
        {activeTab === 'framework' && <FrameworkTab />}
      </main>
    </div>
  );
}

function OverviewTab() {
  const { data, maps } = useData();
  const { filteredOrgIds, filteredFlowIds } = useFilters();
  if (!data) return null;

  const filteredOrgs = data.organizations.filter((o) => filteredOrgIds.has(o.id));
  const filteredFlows = data.capitalFlows.filter((f) => filteredFlowIds.has(f.id));
  const totalCapital = filteredFlows.reduce((sum, f) => sum + (f.amount ?? 0), 0);
  const mappedCount = filteredOrgs.filter((o) => o.lat != null && o.lng != null).length;

  const segmentCounts: Record<string, number> = {};
  filteredOrgs.forEach((o) => {
    segmentCounts[o.segment] = (segmentCounts[o.segment] ?? 0) + 1;
  });

  const capitalBySegment: Record<string, number> = {};
  filteredFlows.forEach((f) => {
    const src = f.sourceId ? maps.orgById.get(f.sourceId) : undefined;
    if (src) capitalBySegment[src.segment] = (capitalBySegment[src.segment] ?? 0) + (f.amount ?? 0);
  });

  const flowTypeData = useMemo(() => {
    const totals: Record<string, number> = {};
    filteredFlows.forEach((f) => {
      const inst = f.capitalInstrumentIds.length
        ? maps.instrumentById.get(f.capitalInstrumentIds[0])
        : undefined;
      const t = inst?.name ?? f.type ?? 'Unknown';
      totals[t] = (totals[t] ?? 0) + (f.amount ?? 0);
    });
    return Object.entries(totals)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredFlows, maps]);

  const impactData = useMemo(() => {
    const counts: Record<string, { count: number; type: string; iconUrl?: string | null }> = {};
    data.organizations.forEach((o) => {
      if (!filteredOrgIds.has(o.id)) return;
      [...o.sdgIds, ...o.sectorIds, ...o.populationIds, ...o.ownershipIds].forEach((dimId) => {
        const dim = maps.impactDimensionById.get(dimId);
        if (dim) {
          if (!counts[dim.label]) counts[dim.label] = { count: 0, type: dim.type, iconUrl: dim.iconUrl };
          counts[dim.label].count++;
        }
      });
    });
    return Object.entries(counts)
      .map(([label, { count, type, iconUrl }]) => ({ label, count, type, iconUrl }))
      .sort((a, b) => b.count - a.count);
  }, [data, filteredOrgIds, maps]);

  const locationsWithOrgs = data.locations.filter(
    (l) => l.organizationIds.some((oid) => filteredOrgIds.has(oid)),
  );

  return (
    <div className="space-y-6">
      <StatCards
        orgCount={filteredOrgs.length}
        flowCount={filteredFlows.length}
        totalCapital={totalCapital}
        instrumentCount={data.capitalInstruments.length}
        locationCount={locationsWithOrgs.length}
        impactDimensionCount={data.impactDimensions.length}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <OverviewMap organizations={filteredOrgs} />
          <p className="text-xs text-slate-400 mt-1">
            {mappedCount} mapped organization{mappedCount !== 1 ? 's' : ''}.
            {filteredOrgs.length - mappedCount > 0 && ` ${filteredOrgs.length - mappedCount} without coordinates hidden.`}
          </p>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Capital by Segment</h3>
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
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: SEGMENT_STYLES[s as Segment].color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SegmentDonut counts={segmentCounts} />
        <FlowTypeBar data={flowTypeData} />
        <ImpactBreakdown data={impactData} />
      </div>

      {locationsWithOrgs.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Place-Based Universes</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {locationsWithOrgs
              .sort((a, b) => {
                const aGA = a.stateName === 'GA' || a.stateName === 'Georgia' ? 1 : 0;
                const bGA = b.stateName === 'GA' || b.stateName === 'Georgia' ? 1 : 0;
                if (aGA !== bGA) return bGA - aGA;
                return b.organizationIds.length - a.organizationIds.length;
              })
              .slice(0, 12)
              .map((l) => (
                <LocationCard key={l.id} location={l} />
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function OrganizationsTab() {
  const { data } = useData();
  const { filteredOrgIds, hasActiveFilters } = useFilters();
  const [expanded, setExpanded] = useState<Set<Segment>>(new Set(SEGMENT_ORDER));
  if (!data) return null;

  const filteredOrgs = data.organizations.filter((o) => filteredOrgIds.has(o.id));

  const flowCountByOrg: Record<string, number> = {};
  data.capitalFlows.forEach((f) => {
    if (f.sourceId) flowCountByOrg[f.sourceId] = (flowCountByOrg[f.sourceId] ?? 0) + 1;
    if (f.recipientId) flowCountByOrg[f.recipientId] = (flowCountByOrg[f.recipientId] ?? 0) + 1;
  });

  const orgsBySegment: Record<string, typeof filteredOrgs> = {};
  filteredOrgs.forEach((o) => {
    (orgsBySegment[o.segment] ??= []).push(o);
  });

  return (
    <div>
      <p className="text-sm text-slate-500 mb-4">
        {filteredOrgs.length} organization{filteredOrgs.length === 1 ? '' : 's'}
        {hasActiveFilters ? ' matching filters' : ''} grouped by segment
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
        />
      ))}
    </div>
  );
}

function FlowsTab() {
  const { data } = useData();
  const { filteredFlowIds } = useFilters();
  if (!data) return null;

  const flows = data.capitalFlows.filter((f) => filteredFlowIds.has(f.id));

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {flows.map((f) => (
        <CapitalFlowCard key={f.id} flow={f} />
      ))}
    </div>
  );
}

function InstrumentsTab() {
  const { data } = useData();
  if (!data) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {data.capitalInstruments.map((i) => (
        <InstrumentCard key={i.id} instrument={i} />
      ))}
    </div>
  );
}

function LocationsTab() {
  const { data } = useData();
  const { filteredOrgIds } = useFilters();
  if (!data) return null;

  const locations = data.locations
    .filter((l) => l.organizationIds.some((oid) => filteredOrgIds.has(oid)))
    .sort((a, b) => {
      const aGA = a.stateName === 'GA' || a.stateName === 'Georgia' ? 1 : 0;
      const bGA = b.stateName === 'GA' || b.stateName === 'Georgia' ? 1 : 0;
      if (aGA !== bGA) return bGA - aGA;
      return b.organizationIds.length - a.organizationIds.length;
    });

  return (
    <div>
      <p className="text-sm text-slate-500 mb-4">{locations.length} location{locations.length !== 1 ? 's' : ''} with associated organizations</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {locations.map((l) => (
          <LocationCard key={l.id} location={l} />
        ))}
      </div>
    </div>
  );
}
