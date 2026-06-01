import { ArrowRight } from 'lucide-react';
import type { CapitalFlow } from '../types';
import { formatCurrencyFull } from '../lib/format';
import { useDetail } from '../context/DetailContext';
import { useData } from '../context/DataContext';

export function CapitalFlowCard({ flow }: { flow: CapitalFlow }) {
  const { open } = useDetail();
  const { maps } = useData();
  const inst = flow.capitalInstrumentIds.length
    ? maps.instrumentById.get(flow.capitalInstrumentIds[0])
    : undefined;
  const typeLabel = inst?.name ?? (flow.type?.startsWith('rec') ? null : flow.type);

  return (
    <button
      onClick={() => open('flow', flow.id)}
      className="w-full text-left bg-white rounded-lg border border-slate-200 p-4 shadow-sm hover:shadow-md hover:border-slate-300 transition-all"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-500">{flow.label}</span>
        {flow.year != null && (
          <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{flow.year}</span>
        )}
      </div>

      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium text-slate-700 truncate">{flow.sourceName ?? 'Unknown source'}</span>
        <ArrowRight size={14} className="text-slate-400 shrink-0" />
        <span className="font-medium text-slate-700 truncate">{flow.recipientName ?? 'Unknown recipient'}</span>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-base font-bold text-brand-green">{formatCurrencyFull(flow.amount)}</span>
        {typeLabel && (
          <span className="text-[10px] font-medium text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
            {typeLabel}
          </span>
        )}
      </div>

      {flow.description && <p className="text-xs text-slate-500 mt-2 line-clamp-2">{flow.description}</p>}
    </button>
  );
}
