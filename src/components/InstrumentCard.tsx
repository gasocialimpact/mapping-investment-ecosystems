import { Briefcase } from 'lucide-react';
import type { CapitalInstrument } from '../types';
import { useDetail } from '../context/DetailContext';

export function InstrumentCard({ instrument }: { instrument: CapitalInstrument }) {
  const { open } = useDetail();

  return (
    <button
      onClick={() => open('instrument', instrument.id)}
      className="w-full text-left bg-white rounded-lg border border-slate-200 p-4 shadow-sm hover:shadow-md hover:border-slate-300 transition-all"
    >
      <div className="flex items-start gap-2">
        <Briefcase size={14} className="text-brand-teal mt-0.5 shrink-0" />
        <h3 className="text-sm font-semibold text-slate-800">{instrument.name}</h3>
      </div>

      <dl className="mt-3 space-y-1.5 text-xs">
        {instrument.capitalFlowType && (
          <div className="flex gap-2">
            <dt className="text-slate-400 w-20 shrink-0">Flow type</dt>
            <dd className="text-slate-700">{instrument.capitalFlowType}</dd>
          </div>
        )}
        {instrument.investmentStrategy && (
          <div className="flex gap-2">
            <dt className="text-slate-400 w-20 shrink-0">Strategy</dt>
            <dd className="text-slate-700">{instrument.investmentStrategy}</dd>
          </div>
        )}
      </dl>

      {instrument.description && (
        <p className="text-xs text-slate-500 mt-3 line-clamp-3">{instrument.description}</p>
      )}
    </button>
  );
}
