import { Globe, MapPin } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { useDetail } from '../../context/DetailContext';
import { SEGMENT_STYLES } from '../../types';
import { formatCurrencyFull } from '../../lib/format';

const MAX_VISIBLE = 6;

export function OrgDetail({ id }: { id: string }) {
  const { data, maps } = useData();
  const { open } = useDetail();
  const org = maps.orgById.get(id);
  if (!org) return <p className="text-sm text-slate-400">Organization not found.</p>;

  const style = SEGMENT_STYLES[org.segment];
  const loc = org.locationId ? maps.locationById.get(org.locationId) : null;
  const city = loc?.cityName ?? (org.city?.startsWith('rec') ? null : org.city);
  const state = loc?.stateName ?? (org.state?.startsWith('rec') ? null : org.state);
  const location = [city, state].filter(Boolean).join(', ');

  const outbound = data!.capitalFlows.filter((f) => f.sourceId === org.id);
  const inbound = data!.capitalFlows.filter((f) => f.recipientId === org.id);

  const allDimIds = [...org.sdgIds, ...org.sectorIds, ...org.populationIds, ...org.ownershipIds];
  const dims = allDimIds.map((did) => maps.impactDimensionById.get(did)).filter(Boolean);
  const dimsByType = new Map<string, typeof dims>();
  dims.forEach((d) => {
    if (!d) return;
    const arr = dimsByType.get(d.type) ?? [];
    arr.push(d);
    dimsByType.set(d.type, arr);
  });

  return (
    <div>
      <span
        className="inline-block text-[10px] font-semibold px-2.5 py-0.5 rounded-full text-white"
        style={{ background: style.color }}
      >
        {org.segment}
      </span>
      <h2 className="text-lg font-bold text-slate-800 mt-2">{org.name}</h2>
      {org.orgType && <p className="text-xs text-slate-500 mt-0.5">{org.orgType}</p>}

      {location && (
        <button
          className="flex items-center gap-1.5 text-xs text-slate-500 mt-1 hover:text-brand-indigo"
          onClick={() => loc && open('location', loc.id)}
        >
          <MapPin size={12} /> {location}
        </button>
      )}

      {org.website && (
        <a href={org.website} target="_blank" rel="noopener" className="flex items-center gap-1.5 text-xs text-blue-600 mt-1">
          <Globe size={12} /> {org.website}
        </a>
      )}

      {org.description && <p className="text-sm text-slate-600 mt-3">{org.description}</p>}

      <FlowSection title="Capital Deployed (Outbound)" flows={outbound} counterpartKey="recipientId" />
      <FlowSection title="Capital Received (Inbound)" flows={inbound} counterpartKey="sourceId" />

      {outbound.length === 0 && inbound.length === 0 && (
        <p className="text-xs text-slate-400 mt-4">No capital flows recorded.</p>
      )}

      {dimsByType.size > 0 && (
        <Section title="Impact Dimensions">
          {[...dimsByType.entries()].map(([type, items]) => (
            <div key={type} className="mb-2">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{type}</p>
              <div className="flex flex-wrap gap-1.5">
                {items.map((d) => d && (
                  <button
                    key={d.id}
                    onClick={() => open('impactDimension', d.id, items.map((x) => x!.id))}
                    className="flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-lg bg-brand-teal-soft text-brand-teal-light hover:opacity-80 border border-brand-teal-soft"
                  >
                    {d.iconUrl && <img src={d.iconUrl} alt="" className="w-5 h-5 rounded-sm shrink-0" />}
                    <span className="truncate">{d.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{title}</h3>
      {children}
    </div>
  );
}

function FlowSection({
  title, flows, counterpartKey,
}: {
  title: string;
  flows: { id: string; sourceId: string | null; sourceName: string | null; recipientId: string | null; recipientName: string | null; amount: number | null }[];
  counterpartKey: 'sourceId' | 'recipientId';
}) {
  const { maps } = useData();
  const { open } = useDetail();
  if (flows.length === 0) return null;

  const visible = flows.slice(0, MAX_VISIBLE);
  const remaining = flows.length - visible.length;
  // Siblings cover every flow in the section, so the modal's ‹ › pager reaches
  // the ones the preview cuts off.
  const ids = flows.map((f) => f.id);

  return (
    <Section title={`${title} (${flows.length})`}>
      <ul className="space-y-1.5">
        {visible.map((f) => {
          const cpId = f[counterpartKey];
          const cp = cpId ? maps.orgById.get(cpId) : undefined;
          const cpName = cp?.name ?? (counterpartKey === 'sourceId' ? f.sourceName : f.recipientName) ?? 'Unknown';
          return (
            <li key={f.id}>
              <button
                onClick={() => open('flow', f.id, ids)}
                className="w-full flex items-center justify-between text-sm border border-slate-100 rounded-md px-3 py-2 hover:border-slate-300 transition-colors"
              >
                <span className="text-slate-600 truncate">{cpName}</span>
                <span className="font-semibold text-brand-green ml-2 shrink-0">{formatCurrencyFull(f.amount)}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {remaining > 0 && (
        <p className="text-xs text-slate-400 mt-2">
          +{remaining} more — see Capital Flows tab for full list
        </p>
      )}
    </Section>
  );
}
