import type { CapitalInstrument } from '../types';
import { SEGMENT_STYLES } from '../types';

export function InstrumentCard({ instrument }: { instrument: CapitalInstrument }) {
  const style = instrument.segment ? SEGMENT_STYLES[instrument.segment] : null;

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
      <div className="flex items-start gap-2">
        <span
          className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ background: style?.color ?? '#64748b' }}
        />
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
        {instrument.segment && (
          <div className="flex gap-2">
            <dt className="text-slate-400 w-20 shrink-0">Segment</dt>
            <dd className="text-slate-700">{instrument.segment}</dd>
          </div>
        )}
      </dl>

      {instrument.description && (
        <p className="text-xs text-slate-500 mt-3 line-clamp-3">{instrument.description}</p>
      )}
    </div>
  );
}
