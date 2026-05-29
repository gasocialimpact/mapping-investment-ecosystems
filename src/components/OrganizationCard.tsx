import { MapPin, ArrowRightLeft } from 'lucide-react';
import type { Organization } from '../types';
import { SEGMENT_STYLES } from '../types';
import { useDetail } from '../context/DetailContext';

interface Props {
  org: Organization;
  flowCount: number;
}

export function OrganizationCard({ org, flowCount }: Props) {
  const style = SEGMENT_STYLES[org.segment];
  const location = [org.city, org.state].filter(Boolean).join(', ') || 'Location not set';
  const { open } = useDetail();

  return (
    <button
      type="button"
      onClick={() => open('organization', org.id)}
      className="text-left bg-white rounded-lg border border-slate-200 p-4 shadow-sm hover:shadow-md hover:border-slate-300 transition-all w-full"
    >
      <div className="flex items-start gap-2">
        <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: style.color }} />
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-800 truncate">{org.name}</h3>
          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
            <MapPin size={10} /> {location}
          </p>
        </div>
      </div>
      {org.description && (
        <p className="text-xs text-slate-600 mt-2 line-clamp-2">{org.description}</p>
      )}
      <div className="flex items-center justify-between mt-3">
        <span
          className="text-[10px] font-medium px-2 py-0.5 rounded-full text-white"
          style={{ background: style.color }}
        >
          {org.segment}
        </span>
        <div className="flex items-center gap-2 text-[10px] text-slate-400">
          {flowCount > 0 && (
            <span className="flex items-center gap-0.5">
              <ArrowRightLeft size={10} /> {flowCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
