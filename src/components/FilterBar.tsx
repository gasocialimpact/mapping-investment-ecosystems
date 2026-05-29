import { Search, X, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { useData } from '../context/DataContext';
import { useFilters } from '../context/FilterContext';
import { SEGMENT_ORDER, SEGMENT_STYLES } from '../types';
import type { Segment } from '../types';

export function FilterBar() {
  const { data } = useData();
  const filters = useFilters();
  const [showAdvanced, setShowAdvanced] = useState(false);

  if (!data) return null;

  const locationOptions = data.locations
    .filter((l) => l.organizationIds.length > 0)
    .sort((a, b) => a.cityName.localeCompare(b.cityName));

  const dimTypes = [...new Set(data.impactDimensions.map((d) => d.type))];

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-3 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => filters.setSearch(e.target.value)}
            placeholder="Search organizations..."
            className="w-full text-sm border border-slate-200 rounded-md pl-8 pr-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-indigo/30 focus:border-brand-indigo"
          />
        </div>

        <div className="flex gap-1">
          {SEGMENT_ORDER.filter((s) => s !== 'Uncategorized').map((s) => (
            <SegmentChip
              key={s}
              segment={s}
              active={filters.segments.has(s)}
              onClick={() => filters.toggleSegment(s)}
            />
          ))}
        </div>

        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border transition-colors ${
            showAdvanced ? 'border-brand-indigo text-brand-indigo bg-brand-indigo-soft/30' : 'border-slate-200 text-slate-500 hover:border-slate-300'
          }`}
        >
          <SlidersHorizontal size={12} /> Filters
        </button>

        {filters.hasActiveFilters && (
          <button
            onClick={filters.clearAll}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 px-2 py-1.5"
          >
            <X size={12} /> Clear
          </button>
        )}
      </div>

      {showAdvanced && (
        <div className="flex gap-3 flex-wrap pt-1 border-t border-slate-100">
          <FilterSelect
            label="Location"
            value=""
            options={locationOptions.map((l) => ({ id: l.id, label: [l.cityName, l.stateName].filter(Boolean).join(', ') }))}
            selected={filters.locationIds}
            onToggle={filters.toggleLocation}
          />
          {dimTypes.map((type) => (
            <FilterSelect
              key={type}
              label={type}
              value=""
              options={data.impactDimensions.filter((d) => d.type === type).map((d) => ({ id: d.id, label: d.label }))}
              selected={filters.impactDimensionIds}
              onToggle={filters.toggleImpactDimension}
            />
          ))}
          <FilterSelect
            label="Instrument"
            value=""
            options={data.capitalInstruments.map((i) => ({ id: i.id, label: i.name }))}
            selected={filters.instrumentIds}
            onToggle={filters.toggleInstrument}
          />
        </div>
      )}
    </div>
  );
}

function SegmentChip({ segment, active, onClick }: { segment: Segment; active: boolean; onClick: () => void }) {
  const style = SEGMENT_STYLES[segment];
  const short = segment.replace('Capital ', '');
  return (
    <button
      onClick={onClick}
      className="text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors"
      style={{
        background: active ? style.color : style.soft,
        color: active ? '#fff' : style.color,
        borderColor: active ? style.color : 'transparent',
      }}
    >
      {short}
    </button>
  );
}

function FilterSelect({
  label, options, selected, onToggle,
}: {
  label: string;
  value: string;
  options: { id: string; label: string }[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  const activeCount = options.filter((o) => selected.has(o.id)).length;
  return (
    <div className="relative">
      <select
        className="text-xs border border-slate-200 rounded-md pl-2 pr-6 py-1.5 bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-brand-indigo/30"
        value=""
        onChange={(e) => {
          if (e.target.value) onToggle(e.target.value);
        }}
      >
        <option value="">
          {label}{activeCount > 0 ? ` (${activeCount})` : ''}
        </option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {selected.has(o.id) ? '✓ ' : ''}{o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
