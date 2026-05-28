import type { Organization } from '../types';
import { SEGMENT_STYLES } from '../types';

interface Props {
  org: Organization;
  /** Number of capital flows this org participates in. */
  flowCount: number;
  onSelect?: (org: Organization) => void;
}

export function OrganizationCard({ org, flowCount, onSelect }: Props) {
  const style = SEGMENT_STYLES[org.segment];
  const location = [org.city, org.state].filter(Boolean).join(', ') || 'Location not set';

  return (
    <button
      type="button"
      onClick={() => onSelect?.(org)}
      className="text-left bg-white rounded-lg border border-slate-200 p-4 shadow-sm hover:shadow-md hover:border-slate-300 transition-all w-full"
    >
      <div className="flex items-start gap-2">
        <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: style.color }} />
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-800 truncate">{org.name}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{location}</p>
        </div>
      </div>
      {org.description && (
        <p className="text-xs text-slate-600 mt-2 line-clamp-2">{org.description}</p>
      )}
      <div className="flex items-center justify-between mt-3">
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${style.chip}`}>
          {org.segment}
        </span>
        <div className="flex items-center gap-2 text-[10px] text-slate-400">
          {flowCount > 0 && <span>{flowCount} flow{flowCount === 1 ? '' : 's'}</span>}
          {org.lat != null && org.lng != null ? (
            <span title="Mapped">📍</span>
          ) : (
            <span title="No coordinates — hidden on map">⚪</span>
          )}
        </div>
      </div>
    </button>
  );
}
