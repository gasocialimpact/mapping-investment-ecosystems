import { formatCurrency } from '../lib/format';

interface Props {
  orgCount: number;
  flowCount: number;
  totalCapital: number;
  instrumentCount: number;
  mappedCount: number;
}

interface Stat {
  label: string;
  value: string;
  accent: string;
}

export function StatCards({ orgCount, flowCount, totalCapital, instrumentCount, mappedCount }: Props) {
  const stats: Stat[] = [
    { label: 'Organizations', value: String(orgCount), accent: 'text-purple-700' },
    { label: 'Capital Flows', value: String(flowCount), accent: 'text-green-700' },
    { label: 'Total Capital Flow', value: formatCurrency(totalCapital), accent: 'text-blue-700' },
    { label: 'Capital Instruments', value: String(instrumentCount), accent: 'text-teal-700' },
    { label: 'Mapped Locations', value: String(mappedCount), accent: 'text-orange-700' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {stats.map((s) => (
        <div key={s.label} className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
          <p className={`text-2xl font-bold ${s.accent}`}>{s.value}</p>
          <p className="text-xs text-slate-500 mt-1">{s.label}</p>
        </div>
      ))}
    </div>
  );
}
