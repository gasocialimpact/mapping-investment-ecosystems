import type { Organization, Segment } from '../types';
import { SEGMENT_STYLES } from '../types';
import { OrganizationCard } from './OrganizationCard';

interface Props {
  segment: Segment;
  organizations: Organization[];
  flowCountByOrg: Record<string, number>;
  isExpanded: boolean;
  onToggle: () => void;
  onSelectOrg: (org: Organization) => void;
}

export function SegmentSection({
  segment,
  organizations,
  flowCountByOrg,
  isExpanded,
  onToggle,
  onSelectOrg,
}: Props) {
  const style = SEGMENT_STYLES[segment];

  return (
    <section className="mb-4">
      <button
        type="button"
        onClick={onToggle}
        className={`w-full flex items-center justify-between p-3 rounded-lg border ${style.chip} hover:opacity-90 transition-opacity`}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs">{isExpanded ? '▾' : '▸'}</span>
          <span className="font-semibold text-sm">{segment}</span>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full bg-white/70">{organizations.length}</span>
      </button>
      {isExpanded && (
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 pl-1">
          {organizations.length === 0 ? (
            <p className="text-xs text-slate-400 p-3">No organizations match the current filters.</p>
          ) : (
            organizations.map((org) => (
              <OrganizationCard
                key={org.id}
                org={org}
                flowCount={flowCountByOrg[org.id] ?? 0}
                onSelect={onSelectOrg}
              />
            ))
          )}
        </div>
      )}
    </section>
  );
}
