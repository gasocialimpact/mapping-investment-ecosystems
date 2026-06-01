import { ArrowRight } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { useDetail } from '../../context/DetailContext';
import { SEGMENT_STYLES } from '../../types';
import { formatCurrencyFull } from '../../lib/format';

export function FlowDetail({ id }: { id: string }) {
  const { maps } = useData();
  const { open } = useDetail();
  const flow = maps.flowById.get(id);
  if (!flow) return <p className="text-sm text-slate-400">Capital flow not found.</p>;

  const source = flow.sourceId ? maps.orgById.get(flow.sourceId) ?? null : null;
  const recipient = flow.recipientId ? maps.orgById.get(flow.recipientId) ?? null : null;

  const instruments = flow.capitalInstrumentIds
    .map((iid) => maps.instrumentById.get(iid))
    .filter(Boolean);

  const dims = flow.impactDimensionIds
    .map((did) => maps.impactDimensionById.get(did))
    .filter(Boolean);

  return (
    <div>
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{flow.label}</p>
      <div className="flex items-center gap-2 mt-3">
        <OrgChip org={source} name={flow.sourceName} onClick={() => source && open('organization', source.id)} />
        <ArrowRight size={16} className="text-slate-400 shrink-0" />
        <OrgChip org={recipient} name={flow.recipientName} onClick={() => recipient && open('organization', recipient.id)} />
      </div>

      <div className="mt-4 flex items-baseline gap-3">
        <span className="text-2xl font-bold text-brand-green">{formatCurrencyFull(flow.amount)}</span>
        {flow.year && <span className="text-sm text-slate-400">{flow.year}</span>}
      </div>

      {(() => {
        const inst0 = instruments[0];
        const typeLabel = inst0?.name ?? (flow.type?.startsWith('rec') ? null : flow.type);
        return typeLabel ? (
          <span className="inline-block mt-2 text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
            {typeLabel}
          </span>
        ) : null;
      })()}

      {flow.description && <p className="text-sm text-slate-600 mt-3">{flow.description}</p>}

      {instruments.length > 0 && (
        <div className="mt-5">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Capital Instruments</h3>
          <div className="space-y-1.5">
            {instruments.map((inst) => inst && (
              <button
                key={inst.id}
                onClick={() => open('instrument', inst.id)}
                className="w-full text-left text-sm border border-slate-100 rounded-md px-3 py-2 hover:border-slate-300"
              >
                {inst.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {dims.length > 0 && (
        <div className="mt-5">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Impact Dimensions</h3>
          <div className="flex flex-wrap gap-1">
            {dims.map((d) => d && (
              <button
                key={d.id}
                onClick={() => open('impactDimension', d.id)}
                className="text-[11px] px-2 py-0.5 rounded-full bg-brand-teal-soft text-brand-teal-light hover:opacity-80"
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function OrgChip({
  org, name, onClick,
}: {
  org: { name: string; segment: string } | null;
  name: string | null;
  onClick: () => void;
}) {
  const label = org?.name ?? name ?? 'Unknown';
  const color = org ? SEGMENT_STYLES[org.segment as keyof typeof SEGMENT_STYLES]?.color ?? '#94a3b8' : '#94a3b8';

  return (
    <button
      onClick={onClick}
      disabled={!org}
      className="flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-brand-indigo disabled:hover:text-slate-700 disabled:cursor-default truncate"
    >
      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: color }} />
      <span className="truncate">{label}</span>
    </button>
  );
}
