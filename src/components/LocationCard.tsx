import { MapPin, Building2 } from 'lucide-react';
import type { Location } from '../types';
import { useData } from '../context/DataContext';
import { useDetail } from '../context/DetailContext';

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function LocationCard({ location }: { location: Location }) {
  const { maps } = useData();
  const { open } = useDetail();

  const orgCount = location.organizationIds.length;
  const locationLabel = [location.cityName, location.countyName ? `${location.countyName} Co.` : null, location.stateName]
    .filter(Boolean)
    .join(', ');

  const cvi = location.cviToxPi;

  const segmentCounts: Record<string, number> = {};
  location.organizationIds.forEach((oid) => {
    const o = maps.orgById.get(oid);
    if (o) segmentCounts[o.segment] = (segmentCounts[o.segment] ?? 0) + 1;
  });

  return (
    <button
      onClick={() => open('location', location.id)}
      className="w-full text-left bg-white rounded-lg border border-slate-200 p-4 shadow-sm hover:shadow-md hover:border-slate-300 transition-all"
    >
      <div className="flex items-start gap-2">
        <MapPin size={14} className="text-brand-orange mt-0.5 shrink-0" />
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-800 truncate">{locationLabel}</h3>
          {location.fipsCode && (
            <p className="text-[10px] text-slate-400">FIPS: {location.fipsCode}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 mt-3 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <Building2 size={12} /> {orgCount} org{orgCount !== 1 ? 's' : ''}
        </span>
        {cvi != null && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-orange-soft text-brand-orange font-medium" title={`ToxPi Score: ${cvi.toFixed(3)}`}>
            CVI: {cvi.toFixed(3)}
            {location.cviNationalPercentile != null && ` (${ordinal(location.cviNationalPercentile)} %ile)`}
          </span>
        )}
      </div>
    </button>
  );
}
