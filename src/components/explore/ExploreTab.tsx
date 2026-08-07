import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { usePlace } from '../../context/PlaceContext';
import type { PlaceScope } from '../../context/PlaceContext';
import { formatCurrency } from '../../lib/format';
import { ExploreMap } from './ExploreMap';
import { HighLowCard, DistributionCard, GapsCard } from './ExploreSidebar';
import { PlaceReport } from './PlaceReport';

// The Explore tab: the Community Data Explorer's information structure with
// the Ecosystem Map's branding, and the ecosystem layered into each place.
export function ExploreTab() {
  const { data } = useData();
  const { place, scope, setScope, selectedFips, setSelectedFips, selectedGeoid, ensureTracts } = usePlace();
  const prevSelection = useRef<string | null>(null);

  // Scroll to the report when a county or tract is newly selected.
  useEffect(() => {
    const current = selectedGeoid ?? selectedFips;
    if (current && current !== prevSelection.current) {
      setTimeout(() => document.getElementById('place-report')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }
    prevSelection.current = current;
  }, [selectedFips, selectedGeoid]);

  const stats = useMemo(() => {
    const orgCount = data?.organizations.length ?? 0;
    const totalCapital = (data?.capitalFlows ?? []).reduce((s, f) => s + (f.amount ?? 0), 0);
    let medianCvi: number | null = null;
    if (place) {
      const scores = place.counties.map((c) => c.scores[0]).sort((a, b) => a - b);
      medianCvi = scores[Math.floor(scores.length / 2)];
    }
    return { orgCount, totalCapital, medianCvi };
  }, [data, place]);

  const counties = useMemo(
    () => [...(place?.counties ?? [])].sort((a, b) => a.county.localeCompare(b.county)),
    [place],
  );

  return (
    <div className="pb-10">
      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        <StatTile value="159" label="Counties" bg="bg-brand-green-soft" fg="text-[#17632e]" />
        <StatTile value={stats.medianCvi != null ? stats.medianCvi.toFixed(2) : '—'} label="Median overall CVI" bg="bg-brand-green-soft" fg="text-[#17632e]" />
        <StatTile value={String(stats.orgCount)} label="Organizations mapped" bg="bg-brand-indigo-soft" fg="text-brand-indigo" />
        <StatTile value={formatCurrency(stats.totalCapital)} label="Tracked capital" bg="bg-[#fbf3d3]" fg="text-[#8a6d00]" />
      </div>

      {/* Scope tabs + picker */}
      <div className="flex gap-7 border-b border-slate-200 mt-8">
        {(['county', 'tract'] as PlaceScope[]).map((s) => (
          <button
            key={s}
            onClick={() => { setScope(s); if (s === 'tract') ensureTracts(); }}
            className={`text-[15px] font-bold pb-2 border-b-[3px] transition-colors ${
              scope === s ? 'border-brand-green text-slate-800' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            {s === 'county' ? 'Topline County Data' : 'Census Tract Data'}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3 flex-wrap mt-4">
        <button
          onClick={() => setSelectedFips(null)}
          className={`text-[13px] font-bold rounded-full px-4 py-2 transition-colors ${
            !selectedFips ? 'bg-brand-green text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
          }`}
        >
          All counties
        </button>
        <select
          value={selectedFips ?? ''}
          onChange={(e) => {
            const fips = e.target.value || null;
            setSelectedFips(fips);
            if (fips) ensureTracts();
          }}
          className="text-[13px] font-semibold border border-slate-200 rounded-full px-4 py-2 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-green"
        >
          <option value="">Choose a county…</option>
          {counties.map((c) => (
            <option key={c.fips} value={c.fips}>{c.county}</option>
          ))}
        </select>
        {scope === 'tract' && (
          <span className="text-xs text-slate-400">Click any tract on the map to load its report.</span>
        )}
      </div>

      {/* Map + sidebar — the map card stretches to match the sidebar height */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.55fr_1fr] gap-5 mt-5">
        <ExploreMap organizations={data?.organizations ?? []} />
        <div className="space-y-5">
          <HighLowCard />
          <DistributionCard />
          <GapsCard />
        </div>
      </div>

      {/* Place report */}
      <PlaceReport />

      {/* Context accordions */}
      <div className="mt-10 bg-white rounded-xl border border-slate-200 p-4 space-y-2.5 shadow-sm">
        <IntroAccordion summary="What is the Climate Vulnerability Index?">
          The CVI (Lewis et al. 2023) combines 184 measures of community health, income, housing,
          infrastructure, environment, and climate-related risk into one score for every U.S. county
          and census tract. Higher scores mean greater vulnerability; percentiles rank each place
          against all 3,143 U.S. counties.
        </IntroAccordion>
        <IntroAccordion summary="What is the Populations at Risk data?">
          Demographic and economic-security indicators from the CDC/ATSDR Social Vulnerability Index
          (ACS 2018–22 five-year estimates), benchmarked against Georgia and the United States, with
          change since 2010–14 where available.
        </IntroAccordion>
        <IntroAccordion summary="Who is in the ecosystem map?">
          {stats.orgCount} organizations — capital allocators, aggregators, enablers, and seekers —
          plus {data?.capitalFlows.length ?? 0} tracked capital flows and{' '}
          {data?.capitalInstruments.length ?? 0} instruments, synced nightly from the ecosystem
          database and mapped to the places on this page. See Framing Our Ecosystem for how the
          pieces fit together.
        </IntroAccordion>
      </div>

      <p className="text-[11px] text-slate-400 mt-6 max-w-3xl">
        Data: U.S. Climate Vulnerability Index (Lewis et al. 2023) · CDC/ATSDR SVI 2022 (ACS 5-year
        estimates) · Federal Reserve Bank of St. Louis Community Investment Explorer · Ecosystem
        database synced nightly from Airtable.
      </p>
    </div>
  );
}

function IntroAccordion({ summary, children }: { summary: string; children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border border-slate-200 rounded-lg">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2.5 px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
      >
        <ChevronRight size={14} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
        {summary}
      </button>
      {isOpen && <p className="px-4 pb-3.5 pl-[42px] text-[13px] text-slate-500 max-w-3xl">{children}</p>}
    </div>
  );
}

function StatTile({ value, label, bg, fg }: { value: string; label: string; bg: string; fg: string }) {
  return (
    <div className={`rounded-xl px-5 py-5 ${bg}`}>
      <div className={`text-[26px] font-bold tabular-nums ${fg}`}>{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}
