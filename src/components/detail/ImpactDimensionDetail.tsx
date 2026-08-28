import { useData } from '../../context/DataContext';
import { useDetail } from '../../context/DetailContext';
import { SEGMENT_STYLES } from '../../types';

const MAX_VISIBLE = 8;

export function ImpactDimensionDetail({ id }: { id: string }) {
  const { data, maps } = useData();
  const { open } = useDetail();
  const dim = maps.impactDimensionById.get(id);
  if (!dim) return <p className="text-sm text-slate-400">Impact dimension not found.</p>;

  const relatedOrgs = data!.organizations.filter((o) =>
    [...o.sdgIds, ...o.sectorIds, ...o.populationIds, ...o.ownershipIds].includes(dim.id),
  );

  const relatedFlows = data!.capitalFlows.filter((f) =>
    f.impactDimensionIds.includes(dim.id),
  );

  return (
    <div>
      <div className="flex items-start gap-3">
        {dim.iconUrl && (
          <img src={dim.iconUrl} alt="" className="w-12 h-12 rounded-lg shrink-0 border border-slate-100" />
        )}
        <div>
          <span className="inline-block text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-brand-teal-soft text-brand-teal-light">
            {dim.type}
          </span>
          <h2 className="text-lg font-bold text-slate-800 mt-1">{dim.label}</h2>
        </div>
      </div>

      {dim.notes && <p className="text-sm text-slate-600 mt-3">{dim.notes}</p>}

      {relatedOrgs.length > 0 && (
        <CappedList
          title="Organizations"
          items={relatedOrgs}
          hint="see Organizations tab to browse all"
          renderItem={(o, ids) => (
            <button
              onClick={() => open('organization', o.id, ids)}
              className="w-full flex items-center gap-2 text-sm text-left border border-slate-100 rounded-md px-3 py-2 hover:border-slate-300"
            >
              <span className="h-2 w-2 rounded-full shrink-0" style={{ background: SEGMENT_STYLES[o.segment].color }} />
              <span className="text-slate-700 truncate">{o.name}</span>
            </button>
          )}
        />
      )}

      {relatedFlows.length > 0 && (
        <CappedList
          title="Capital Flows"
          items={relatedFlows}
          hint="see Capital Flows tab for full list"
          renderItem={(f, ids) => (
            <button
              onClick={() => open('flow', f.id, ids)}
              className="w-full text-left text-sm border border-slate-100 rounded-md px-3 py-2 hover:border-slate-300"
            >
              {f.sourceName ?? 'Unknown'} → {f.recipientName ?? 'Unknown'}
            </button>
          )}
        />
      )}
    </div>
  );
}

function CappedList<T extends { id: string }>({ title, items, hint, renderItem }: { title: string; items: T[]; hint: string; renderItem: (item: T, ids: string[]) => React.ReactNode }) {
  const visible = items.slice(0, MAX_VISIBLE);
  const remaining = items.length - visible.length;
  // The whole list pages inside the modal, including the capped-off tail.
  const ids = items.map((item) => item.id);

  return (
    <div className="mt-5">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
        {title} ({items.length})
      </h3>
      <ul className="space-y-1.5">
        {visible.map((item) => (
          <li key={item.id}>{renderItem(item, ids)}</li>
        ))}
      </ul>
      {remaining > 0 && (
        <p className="text-xs text-slate-400 mt-2">
          +{remaining} more — {hint}
        </p>
      )}
    </div>
  );
}
