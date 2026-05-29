import { Building2, ArrowRightLeft, DollarSign, Briefcase, MapPin, Target } from 'lucide-react';
import { formatCurrency } from '../lib/format';

interface Props {
  orgCount: number;
  flowCount: number;
  totalCapital: number;
  instrumentCount: number;
  locationCount: number;
  impactDimensionCount: number;
}

export function StatCards({ orgCount, flowCount, totalCapital, instrumentCount, locationCount, impactDimensionCount }: Props) {
  const stats = [
    { label: 'Organizations', value: String(orgCount), icon: Building2, color: '#4750a2' },
    { label: 'Capital Flows', value: String(flowCount), icon: ArrowRightLeft, color: '#279a49' },
    { label: 'Total Capital', value: formatCurrency(totalCapital), icon: DollarSign, color: '#279a49' },
    { label: 'Instruments', value: String(instrumentCount), icon: Briefcase, color: '#53c3c2' },
    { label: 'Locations', value: String(locationCount), icon: MapPin, color: '#f15921' },
    { label: 'Impact Dimensions', value: String(impactDimensionCount), icon: Target, color: '#f1d25b' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {stats.map((s) => (
        <div key={s.label} className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <s.icon size={16} style={{ color: s.color }} />
            <p className="text-xs text-slate-500">{s.label}</p>
          </div>
          <p className="text-2xl font-bold text-slate-800">{s.value}</p>
        </div>
      ))}
    </div>
  );
}
