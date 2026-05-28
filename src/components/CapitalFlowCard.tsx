import type { CapitalFlow } from '../types';
import { formatCurrencyFull } from '../lib/format';

export function CapitalFlowCard({ flow }: { flow: CapitalFlow }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-500">{flow.label}</span>
        {flow.year != null && (
          <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{flow.year}</span>
        )}
      </div>

      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium text-slate-700 truncate">{flow.sourceName ?? 'Unknown source'}</span>
        <span className="text-slate-400">→</span>
        <span className="font-medium text-slate-700 truncate">{flow.recipientName ?? 'Unknown recipient'}</span>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-base font-bold text-green-700">{formatCurrencyFull(flow.amount)}</span>
        {flow.type && (
          <span className="text-[10px] font-medium text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
            {flow.type}
          </span>
        )}
      </div>

      {flow.description && <p className="text-xs text-slate-500 mt-2 line-clamp-2">{flow.description}</p>}
    </div>
  );
}
