import { formatCurrency } from '../../lib/format';

interface Props {
  data: { label: string; value: number }[];
}

const COLORS = ['#4750a2', '#279a49', '#53c3c2', '#f1d25b', '#f15921', '#929adf', '#66b445'];

export function FlowTypeBar({ data }: Props) {
  if (data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.value));

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Capital by Instrument Type</h3>
      <div className="space-y-2">
        {data.slice(0, 8).map((d, i) => (
          <div key={d.label}>
            <div className="flex justify-between text-xs mb-0.5">
              <span className="text-slate-600 truncate">{d.label}</span>
              <span className="text-slate-500 ml-2 shrink-0">{formatCurrency(d.value)}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${(d.value / max) * 100}%`, background: COLORS[i % COLORS.length] }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
