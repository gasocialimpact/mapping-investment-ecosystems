import { Building2, TrendingUp } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { useDetail, type OpenDetail } from '../../context/DetailContext';
import { usePlace } from '../../context/PlaceContext';
import { SEGMENT_STYLES, type Organization } from '../../types';
import { formatCurrency } from '../../lib/format';

const MAX_VISIBLE = 8;

const CVI_BASELINE: { key: string; label: string; color: string }[] = [
  { key: 'cviBaselineHealth', label: 'Health', color: '#53c3c2' },
  { key: 'cviBaselineSocialEconomic', label: 'Social & Economic', color: '#f1d25b' },
  { key: 'cviBaselineInfrastructure', label: 'Infrastructure', color: '#279a49' },
  { key: 'cviBaselineEnvironment', label: 'Environment', color: '#66b445' },
];

const CVI_CLIMATE: { key: string; label: string; color: string }[] = [
  { key: 'cviCCHealth', label: 'Health', color: '#53c3c2' },
  { key: 'cviCCSocialEconomic', label: 'Social & Economic', color: '#f1d25b' },
  { key: 'cviCCExtremeEvents', label: 'Extreme Events', color: '#f15921' },
];

export function LocationDetail({ id }: { id: string }) {
  const { data, maps } = useData();
  const { open } = useDetail();
  const { countyByFips } = usePlace();
  const loc = maps.locationById.get(id);
  if (!loc) return <p className="text-sm text-slate-400">Location not found.</p>;

  const placeCounty = loc.fipsCode ? countyByFips.get(loc.fipsCode) : undefined;
  // The snapshot's percentile field has historically been null; the place
  // dataset carries the authoritative national percentile per county.
  const nationalPercentile = loc.cviNationalPercentile ?? placeCounty?.pctiles[0] ?? null;

  const orgs = loc.organizationIds.map((oid) => maps.orgById.get(oid)).filter((o): o is Organization => !!o);
  const totalCapital = data!.capitalFlows
    .filter((f) => {
      const src = f.sourceId ? maps.orgById.get(f.sourceId) : null;
      const rec = f.recipientId ? maps.orgById.get(f.recipientId) : null;
      return (src && src.locationId === loc.id) || (rec && rec.locationId === loc.id);
    })
    .reduce((sum, f) => sum + (f.amount ?? 0), 0);

  const locationParts = [loc.cityName, loc.countyName ? `${loc.countyName} County` : null, loc.stateName].filter(Boolean);

  const rec = loc as unknown as Record<string, unknown>;
  const hasCvi = loc.cviToxPi != null;

  return (
    <div>
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Location</p>
      <h2 className="text-lg font-bold text-slate-800 mt-1">{locationParts.join(', ')}</h2>
      {loc.fipsCode && <p className="text-xs text-slate-400 mt-0.5">FIPS: {loc.fipsCode}</p>}

      <div className="flex gap-4 mt-4">
        <div className="flex items-center gap-1.5 text-sm">
          <Building2 size={14} className="text-brand-indigo" />
          <span className="font-semibold">{orgs.length}</span>
          <span className="text-slate-500">org{orgs.length !== 1 ? 's' : ''}</span>
        </div>
        {totalCapital > 0 && (
          <div className="flex items-center gap-1.5 text-sm">
            <TrendingUp size={14} className="text-brand-green" />
            <span className="font-semibold text-brand-green">{formatCurrency(totalCapital)}</span>
          </div>
        )}
      </div>

      {hasCvi && (
        <div className="mt-5">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Climate Vulnerability Index
          </h3>
          <p className="text-[10px] text-slate-400 mb-3">
            County-level vulnerability scores from the{' '}
            <a
              href="https://map.climatevulnerabilityindex.org/map/cvi_overall/usa?mapBoundaries=Tract&mapFilter=0&reportBoundaries=Tract&geoContext=State"
              target="_blank"
              rel="noopener"
              className="text-blue-500 underline"
            >
              U.S. Climate Vulnerability Index
            </a>
            . Scores range 0–1 (higher = more vulnerable). Combines baseline community conditions with projected climate change risks across health, economic, infrastructure, and environmental dimensions.
          </p>
          <div className="mb-3">
            <div className="flex justify-between text-xs mb-0.5">
              <span className="text-slate-700 font-semibold">Overall ToxPi Score</span>
              <span className="font-bold text-slate-800">{loc.cviToxPi!.toFixed(3)}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${Math.min(loc.cviToxPi! * 100, 100)}%`, background: '#4750a2' }} />
            </div>
            {nationalPercentile != null && (
              <p className="text-[10px] text-slate-500 mt-1">
                More vulnerable than <span className="font-semibold text-slate-700">{Math.round(nationalPercentile)}%</span> of U.S. counties
              </p>
            )}
          </div>

          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Baseline Vulnerability</p>
          <div className="space-y-1.5 mb-3">
            {CVI_BASELINE.map((c) => {
              const val = rec[c.key] as number | null;
              if (val == null) return null;
              return (
                <div key={c.key}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-slate-600">{c.label}</span>
                    <span className="font-medium text-slate-700">{val.toFixed(3)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(val * 100, 100)}%`, background: c.color }} />
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Climate Change Risk</p>
          <div className="space-y-1.5">
            {CVI_CLIMATE.map((c) => {
              const val = rec[c.key] as number | null;
              if (val == null) return null;
              return (
                <div key={c.key}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-slate-600">{c.label}</span>
                    <span className="font-medium text-slate-700">{val.toFixed(3)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(val * 100, 100)}%`, background: c.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {orgs.length > 0 && (
        <OrgList orgs={orgs} open={open} />
      )}
    </div>
  );
}

function OrgList({ orgs, open }: { orgs: Organization[]; open: OpenDetail }) {
  const visible = orgs.slice(0, MAX_VISIBLE);
  const ids = orgs.map((o) => o.id);
  const remaining = orgs.length - visible.length;

  return (
    <div className="mt-5">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Organizations ({orgs.length})</h3>
      <ul className="space-y-1.5">
        {visible.map((o) => (
          <li key={o.id}>
            <button
              onClick={() => open('organization', o.id, ids)}
              className="w-full flex items-center gap-2 text-sm text-left border border-slate-100 rounded-md px-3 py-2 hover:border-slate-300"
            >
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ background: SEGMENT_STYLES[o.segment].color }}
              />
              <span className="text-slate-700 truncate">{o.name}</span>
              <span className="text-[10px] text-slate-400 ml-auto shrink-0">{o.segment}</span>
            </button>
          </li>
        ))}
      </ul>
      {remaining > 0 && (
        <p className="text-xs text-slate-400 mt-2">
          +{remaining} more — see Organizations tab to browse all
        </p>
      )}
    </div>
  );
}
