interface Props {
  data: { label: string; count: number; type: string; iconUrl?: string | null }[];
}

const TYPE_COLORS: Record<string, string> = {
  'SDG Alignment': '#4750a2',
  'Population Focus': '#f15921',
  'Sector Focus': '#279a49',
  'Alternative Ownership Component': '#53c3c2',
  'IMM Classification': '#f1d25b',
};

export function ImpactBreakdown({ data }: Props) {
  if (data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.count));

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Top Impact Dimensions</h3>
      <div className="space-y-2">
        {data.slice(0, 10).map((d) => (
          <div key={d.label}>
            <div className="flex items-center justify-between text-xs mb-0.5 gap-1">
              <span className="flex items-center gap-1 text-slate-600 truncate min-w-0">
                {d.iconUrl && <img src={d.iconUrl} alt="" className="w-4 h-4 rounded-sm shrink-0" />}
                <span className="truncate">{d.label}</span>
              </span>
              <span className="text-slate-400 ml-2 shrink-0">{d.count} orgs</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${(d.count / max) * 100}%`, background: TYPE_COLORS[d.type] ?? '#94a3b8' }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
