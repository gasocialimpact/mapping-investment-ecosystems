import { useData } from '../../context/DataContext';
import { useDetail } from '../../context/DetailContext';
import { formatCurrencyFull } from '../../lib/format';

const MAX_VISIBLE = 8;

export function InstrumentDetail({ id }: { id: string }) {
  const { data, maps } = useData();
  const { open } = useDetail();
  const inst = maps.instrumentById.get(id);
  if (!inst) return <p className="text-sm text-slate-400">Instrument not found.</p>;

  const relatedFlows = data!.capitalFlows.filter((f) =>
    f.capitalInstrumentIds.includes(inst.id),
  );

  return (
    <div>
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Capital Instrument</p>
      <h2 className="text-lg font-bold text-slate-800 mt-1">{inst.name}</h2>

      <dl className="mt-4 space-y-2 text-sm">
        {inst.capitalFlowType && (
          <div className="flex gap-2">
            <dt className="text-slate-400 w-24 shrink-0">Flow Type</dt>
            <dd className="text-slate-700">{inst.capitalFlowType}</dd>
          </div>
        )}
        {inst.investmentStrategy && (
          <div className="flex gap-2">
            <dt className="text-slate-400 w-24 shrink-0">Strategy</dt>
            <dd className="text-slate-700">{inst.investmentStrategy}</dd>
          </div>
        )}
      </dl>

      {inst.description && <p className="text-sm text-slate-600 mt-3">{inst.description}</p>}

      {relatedFlows.length > 0 && (
        <FlowList flows={relatedFlows} open={open} />
      )}
    </div>
  );
}

function FlowList({ flows, open }: { flows: any[]; open: (type: 'flow', id: string) => void }) {
  const visible = flows.slice(0, MAX_VISIBLE);
  const remaining = flows.length - visible.length;

  return (
    <div className="mt-5">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
        Related Flows ({flows.length})
      </h3>
      <ul className="space-y-1.5">
        {visible.map((f) => (
          <li key={f.id}>
            <button
              onClick={() => open('flow', f.id)}
              className="w-full flex items-center justify-between text-sm border border-slate-100 rounded-md px-3 py-2 hover:border-slate-300"
            >
              <span className="text-slate-600 truncate">
                {f.sourceName ?? 'Unknown'} → {f.recipientName ?? 'Unknown'}
              </span>
              <span className="font-semibold text-brand-green ml-2 shrink-0">
                {formatCurrencyFull(f.amount)}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {remaining > 0 && (
        <p className="text-xs text-slate-400 mt-2">
          +{remaining} more — see Capital Flows tab for full list
        </p>
      )}
    </div>
  );
}
