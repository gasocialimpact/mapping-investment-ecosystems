import { useEffect, useState } from 'react';
import { Briefcase, Home, Wallet, HeartPulse } from 'lucide-react';
import {
  loadCensusCounties, loadCensusTracts,
  RACE_GROUPS, GENDER_GROUPS, AGE_GROUPS, NATIVITY_GROUPS, INCOME_GROUPS,
} from '../../data/census';
import type { CensusMetrics, GroupValues, RuralUrbanBenchmarks } from '../../data/census';
import { SnapshotCard } from '../SnapshotButton';

// The Topline Local Data sub-tab: key Census indicators in four categories,
// re-cuttable by a demographic lens. Works at county and tract level; the
// GA state row provides the benchmark ticks in both.

type Lens = 'all' | 'race' | 'income' | 'gender' | 'age' | 'nativity' | 'ruralurban';
type Fmt = 'pct' | 'usd' | 'yrs';
// Which direction is "better" — figures worse than the GA benchmark show red.
type Dir = 'up' | 'down';

// Everything but Rural/Urban lives in the filter dropdown; Rural/Urban keeps
// its own toggle button since it compares places rather than re-cutting them.
const DROPDOWN_LENSES: [Exclude<Lens, 'ruralurban'>, string][] = [
  ['all', 'All residents'], ['race', 'Race & Ethnicity'], ['income', 'Income Bracket'],
  ['gender', 'Sex'], ['age', 'Age Group'], ['nativity', 'Nativity & Citizenship'],
];

const CAT_COLORS = { econ: '#4750a2', housing: '#279a49', income: '#d4a72c', health: '#53c3c2' };
const WORSE = '#b93c11'; // matches the "worse than benchmark" red in the PAR tables

interface Row {
  key: keyof CensusMetrics | 'life_expectancy';
  label: string;
  fmt: Fmt;
  dir?: Dir;
  source?: string;
  /** Starts a labeled section inside the card (Income & Financial Wellness). */
  section?: string;
}

const CATEGORIES: {
  id: keyof typeof CAT_COLORS; title: string; src: string;
  icon: typeof Briefcase; rows: Row[];
}[] = [
  {
    id: 'econ', title: 'Economic & Workforce', src: 'ACS 5-year (DP03, S2301, S2303)', icon: Briefcase,
    rows: [
      { key: 'lfp', label: 'Labor force participation', fmt: 'pct', dir: 'up' },
      { key: 'unemployment', label: 'Unemployment rate', fmt: 'pct', dir: 'down' },
      { key: 'underemployed_proxy', label: 'Working less than full-time, year-round¹', fmt: 'pct', dir: 'down' },
      { key: 'median_earnings', label: 'Median earnings (workers 16+)', fmt: 'usd', dir: 'up' },
      { key: 'ss_households', label: 'Households with Social Security income', fmt: 'pct' },
      { key: 'ssi_households', label: 'Households with SSI (disability) income', fmt: 'pct', dir: 'down' },
    ],
  },
  {
    id: 'housing', title: 'Housing', src: 'ACS 5-year (DP04, B25070, B25091)', icon: Home,
    rows: [
      { key: 'ownership', label: 'Homeownership rate', fmt: 'pct', dir: 'up' },
      { key: 'median_rent', label: 'Median gross rent', fmt: 'usd' },
      { key: 'rent_burden_30', label: 'Rent-burdened (30%+ of income)', fmt: 'pct', dir: 'down' },
      { key: 'rent_burden_50', label: 'Severely rent-burdened (50%+)', fmt: 'pct', dir: 'down' },
      { key: 'mtg_burden_30', label: 'Mortgage-burdened (30%+ of income)', fmt: 'pct', dir: 'down' },
      { key: 'mtg_burden_50', label: 'Severely mortgage-burdened (50%+)', fmt: 'pct', dir: 'down' },
      { key: 'crowded', label: 'Crowded housing (>1 person per room)', fmt: 'pct', dir: 'down' },
      { key: 'vacancy_rental', label: 'Rental vacancy rate', fmt: 'pct', dir: 'down' },
      { key: 'vacancy_owner', label: 'Homeowner vacancy rate', fmt: 'pct', dir: 'down' },
    ],
  },
  {
    id: 'income', title: 'Income & Financial Wellness',
    src: 'ACS 5-year (B19013, S1701, B19054/59, DP03/04) · HUD', icon: Wallet,
    rows: [
      { key: 'median_hh_income', label: 'Median household income', fmt: 'usd', dir: 'up' },
      { key: 'poverty', label: 'Poverty rate', fmt: 'pct', dir: 'down' },
      { key: 'median_home_value', label: 'Median home value (owner-occupied)', fmt: 'usd', section: 'Household wealth²' },
      { key: 'asset_income_households', label: 'Households with interest, dividend or rental income', fmt: 'pct', dir: 'up' },
      { key: 'retirement_income_households', label: 'Households with retirement income', fmt: 'pct', dir: 'up' },
      { key: 'snap_households', label: 'Households receiving SNAP', fmt: 'pct', dir: 'down', section: 'Government assistance' },
      { key: 'cash_assistance_households', label: 'Households with cash public assistance', fmt: 'pct', dir: 'down' },
      { key: 'hcv_households', label: 'Renter households using housing choice vouchers', fmt: 'pct', dir: 'down', source: 'HUD 2024' },
      { key: 'hud_assisted_households', label: 'Households in any HUD-subsidized housing', fmt: 'pct', dir: 'down', source: 'HUD 2024' },
    ],
  },
  {
    id: 'health', title: 'Health & Wellbeing', src: 'ACS 5-year (DP03, S1810) · CDC PLACES · USALEEP', icon: HeartPulse,
    rows: [
      { key: 'uninsured', label: 'Uninsured', fmt: 'pct', dir: 'down' },
      { key: 'disability', label: 'Living with a disability', fmt: 'pct' },
      { key: 'life_expectancy', label: 'Life expectancy (years)', fmt: 'yrs', dir: 'up', source: 'CVI source data' },
      { key: 'checkup', label: 'Routine checkup in the past year (adults)', fmt: 'pct', dir: 'up', source: 'CDC PLACES' },
      { key: 'mental_distress', label: 'Frequent mental distress (adults)', fmt: 'pct', dir: 'down', source: 'CDC PLACES' },
    ],
  },
];

// Metrics each grouped lens can re-cut — the full set the ACS publishes for
// that breakdown below the state level (which is why the lists differ: e.g.
// rent burden and home value exist by race nowhere below the state).
const LENS_METRICS: Record<'race' | 'gender' | 'age' | 'nativity', { key: string; label: string; fmt: Fmt }[]> = {
  race: [
    { key: 'median_hh_income', label: 'Median household income', fmt: 'usd' },
    { key: 'poverty', label: 'Poverty rate', fmt: 'pct' },
    { key: 'lfp', label: 'Labor force participation', fmt: 'pct' },
    { key: 'unemployment', label: 'Unemployment rate', fmt: 'pct' },
    { key: 'ownership', label: 'Homeownership rate', fmt: 'pct' },
    { key: 'snap_households', label: 'Households receiving SNAP', fmt: 'pct' },
    { key: 'uninsured', label: 'Uninsured', fmt: 'pct' },
    { key: 'disability', label: 'Living with a disability', fmt: 'pct' },
  ],
  gender: [
    { key: 'median_earnings', label: 'Median earnings', fmt: 'usd' },
    { key: 'lfp', label: 'Labor force participation', fmt: 'pct' },
    { key: 'unemployment', label: 'Unemployment rate', fmt: 'pct' },
    { key: 'underemployed_proxy', label: 'Working less than full-time, year-round¹', fmt: 'pct' },
    { key: 'poverty', label: 'Poverty rate', fmt: 'pct' },
    { key: 'uninsured', label: 'Uninsured', fmt: 'pct' },
    { key: 'disability', label: 'Living with a disability', fmt: 'pct' },
  ],
  age: [
    { key: 'median_hh_income', label: 'Median household income (age of householder)', fmt: 'usd' },
    { key: 'lfp', label: 'Labor force participation', fmt: 'pct' },
    { key: 'unemployment', label: 'Unemployment rate', fmt: 'pct' },
    { key: 'poverty', label: 'Poverty rate', fmt: 'pct' },
  ],
  nativity: [
    { key: 'median_hh_income', label: 'Median household income', fmt: 'usd' },
    { key: 'poverty', label: 'Poverty rate', fmt: 'pct' },
    { key: 'unemployment', label: 'Unemployment rate', fmt: 'pct' },
    { key: 'ownership', label: 'Homeownership rate', fmt: 'pct' },
    { key: 'snap_households', label: 'Households receiving SNAP', fmt: 'pct' },
  ],
};

// The Rural/Urban lens compares this place against the median majority-urban
// and majority-rural geography at the same level (the classification itself
// comes from the 2020 Decennial urban/rural population split).
const RU_METRICS: { key: string; label: string; fmt: Fmt }[] = [
  { key: 'median_hh_income', label: 'Median household income', fmt: 'usd' },
  { key: 'poverty', label: 'Poverty rate', fmt: 'pct' },
  { key: 'unemployment', label: 'Unemployment rate', fmt: 'pct' },
  { key: 'lfp', label: 'Labor force participation', fmt: 'pct' },
  { key: 'ownership', label: 'Homeownership rate', fmt: 'pct' },
  { key: 'median_rent', label: 'Median gross rent', fmt: 'usd' },
  { key: 'rent_burden_30', label: 'Rent-burdened (30%+ of income)', fmt: 'pct' },
  { key: 'snap_households', label: 'Households receiving SNAP', fmt: 'pct' },
  { key: 'uninsured', label: 'Uninsured', fmt: 'pct' },
  { key: 'median_home_value', label: 'Median home value', fmt: 'usd' },
];

const fmtVal = (v: number | null | undefined, fmt: Fmt) =>
  v == null ? '—' : fmt === 'usd' ? `$${Math.round(v).toLocaleString()}` : fmt === 'yrs' ? `${v}` : `${v}%`;

interface Props {
  level: 'county' | 'tract';
  id: string;
  label: string;
  lifeExpectancy: number | null;
  stateLifeExpectancy: number | null;
}

export function ToplineLocalData({ level, id, label, lifeExpectancy, stateLifeExpectancy }: Props) {
  const [lens, setLens] = useState<Lens>('all');
  const [local, setLocal] = useState<CensusMetrics | null>(null);
  const [state, setState] = useState<CensusMetrics | null>(null);
  const [ru, setRu] = useState<RuralUrbanBenchmarks | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLocal(null);
    Promise.all([
      loadCensusCounties(),
      level === 'tract' ? loadCensusTracts() : Promise.resolve(null),
    ]).then(([counties, tractFile]) => {
      setState(counties.state);
      setLocal(level === 'county' ? counties.counties[id] ?? null : tractFile?.tracts[id] ?? null);
      setRu(level === 'county' ? counties.rural_urban : tractFile?.rural_urban ?? null);
    }).catch((e) => setError(e.message));
  }, [level, id]);

  useEffect(() => {
    // Nativity is published at county level only.
    if (level === 'tract' && lens === 'nativity') setLens('all');
  }, [level, lens]);

  if (error) return <p className="text-sm text-red-500 mt-5">{error}</p>;
  if (!local || !state) return <p className="text-sm text-slate-400 mt-5">Loading Census data…</p>;

  const life = { local: lifeExpectancy, state: stateLifeExpectancy };
  const value = (key: Row['key']): number | null =>
    key === 'life_expectancy' ? life.local : ((local[key as keyof CensusMetrics] as number | null) ?? null);
  const benchmark = (key: Row['key']): number | null =>
    key === 'life_expectancy' ? life.state : ((state[key as keyof CensusMetrics] as number | null) ?? null);

  return (
    <div className="mt-5">
      {/* Lens row: filter dropdown + the Rural/Urban comparison toggle */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm px-3 py-2.5 flex flex-wrap items-center gap-2.5 print:hidden">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400" htmlFor="topline-lens">Filter by</label>
        <select
          id="topline-lens"
          value={lens === 'ruralurban' ? '' : lens}
          onChange={(e) => e.target.value && setLens(e.target.value as Lens)}
          className="text-xs font-semibold border border-slate-200 rounded-md px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-green/40"
        >
          {lens === 'ruralurban' && <option value="" hidden>Choose a filter…</option>}
          {DROPDOWN_LENSES.map(([key, name]) => {
            const disabled = key === 'nativity' && level === 'tract';
            return (
              <option key={key} value={key} disabled={disabled}>
                {name}{disabled ? ' (county level only)' : ''}
              </option>
            );
          })}
        </select>
        <button
          onClick={() => setLens(lens === 'ruralurban' ? 'all' : 'ruralurban')}
          className={`text-xs font-semibold rounded-full px-3.5 py-1.5 border transition-colors ${
            lens === 'ruralurban' ? 'bg-brand-green text-white border-brand-green'
            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
          }`}
        >
          Rural vs. Urban
        </button>
        <span className="text-[11px] text-slate-400 ml-auto">
          {lens === 'all' ? `${label} vs. Georgia (tick) — red = worse than Georgia`
            : lens === 'ruralurban' ? 'Compared against Georgia’s urban and rural medians'
            : 'All indicators the Census publishes for this breakdown; a dash is not a zero'}
        </span>
      </div>

      {lens === 'all' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 pdf:grid-cols-2 gap-5 mt-4 items-start">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <SnapshotCard
                key={cat.id}
                snapshotLabel={cat.title}
                title={
                  <span className="flex items-center gap-2">
                    <Icon size={17} style={{ color: CAT_COLORS[cat.id] }} aria-hidden />
                    {cat.title}
                  </span>
                }
                sub={`${cat.src} — ${label} vs. Georgia (tick).`}
              >
                <div className="space-y-3 mt-2">
                  {cat.rows.map((row) => (
                    <div key={row.key}>
                      {row.section && (
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 pt-1.5 pb-0.5">{row.section}</p>
                      )}
                      <MeterRow
                        label={row.label}
                        source={row.source}
                        value={value(row.key)}
                        bench={benchmark(row.key)}
                        fmt={row.fmt}
                        dir={row.dir}
                        color={CAT_COLORS[cat.id]}
                      />
                    </div>
                  ))}
                  {cat.id === 'income' && level === 'tract' && (
                    <p className="text-[10px] text-slate-400">
                      HUD reports voucher and subsidized-housing counts at the county level only.
                    </p>
                  )}
                  {cat.id === 'health' && (
                    <p className="text-[10px] text-slate-400">
                      Food-desert designation (USDA Food Access Research Atlas) is pending — its tract
                      geography predates the 2020 boundaries used here.
                    </p>
                  )}
                </div>
              </SnapshotCard>
            );
          })}
        </div>
      )}

      {lens === 'income' && (
        <div className="mt-4">
          <SnapshotCard title={`${label} by income bracket`} sub={`ACS B19001 and B25118 — ${label} vs. Georgia (tick).`}>
            <div className="grid grid-cols-1 lg:grid-cols-2 pdf:grid-cols-2 gap-x-10 gap-y-5 mt-3">
              <div>
                <p className="text-[13px] font-bold text-slate-700 mb-2">Share of households in each bracket</p>
                <div className="space-y-3">
                  {INCOME_GROUPS.map(([key, name]) => (
                    <MeterRow key={key} label={name} value={local.income_dist[key] ?? null} bench={state.income_dist[key] ?? null} fmt="pct" color={CAT_COLORS.income} />
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[13px] font-bold text-slate-700 mb-2">Homeownership rate within each bracket</p>
                <div className="space-y-3">
                  {INCOME_GROUPS.map(([key, name]) => (
                    <MeterRow key={key} label={name} value={local.ownership_by_income?.[key] ?? null} bench={state.ownership_by_income?.[key] ?? null} fmt="pct" color={CAT_COLORS.income} />
                  ))}
                </div>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-3 max-w-2xl">
              The ACS publishes most indicators for households overall rather than within each income
              bracket — homeownership (tenure by income) is the exception it reports at this level.
            </p>
          </SnapshotCard>
        </div>
      )}

      {(lens === 'race' || lens === 'gender' || lens === 'age' || lens === 'nativity') && (
        <GroupedLens
          lens={lens}
          label={label}
          groups={lens === 'race' ? RACE_GROUPS : lens === 'gender' ? GENDER_GROUPS : lens === 'age' ? AGE_GROUPS : NATIVITY_GROUPS}
          data={(lens === 'race' ? local.by_race
            : lens === 'gender' ? local.by_gender
            : lens === 'age' ? local.by_age
            : local.by_nativity ?? {}) as Record<string, GroupValues>}
        />
      )}

      {lens === 'ruralurban' && (
        <RuralUrbanLens label={label} level={level} local={local} ru={ru} />
      )}

      <p className="text-[10px] text-slate-400 mt-4 max-w-3xl">
        ¹ Share of workers 16–64 who did not work full-time, year-round (ACS S2303) — a proxy; the
        Census does not publish a direct underemployment measure below the state level.
        ² The Census publishes no direct household-wealth measure below the national level — home
        value and asset-income shares are the standard local proxies. Voucher and subsidized-housing
        shares come from HUD's Picture of Subsidized Households (Dec 2024). Group estimates carry
        wider margins of error than totals; suppressed cells show a dash.
      </p>
    </div>
  );
}

function MeterRow({ label, value, bench, fmt, dir, color, source }: {
  label: string; value: number | null; bench: number | null; fmt: Fmt; dir?: Dir; color: string; source?: string;
}) {
  const max = fmt === 'pct' ? 100 : Math.max(value ?? 0, bench ?? 0) * 1.15 || 1;
  const worse = dir != null && value != null && bench != null &&
    (dir === 'up' ? value < bench : value > bench);
  return (
    <div>
      <div className="flex justify-between gap-3 text-[13px] mb-1">
        <span className="text-slate-600 min-w-0">
          {label}
          {source && <span className="text-[9px] text-slate-400 ml-1.5 uppercase tracking-wide">{source}</span>}
        </span>
        <b className="tabular-nums shrink-0" style={worse ? { color: WORSE } : undefined}>
          {fmtVal(value, fmt)}
          <span className="text-slate-400 font-normal text-xs"> · GA {fmtVal(bench, fmt)}</span>
        </b>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden relative">
        {value != null && <div className="h-full rounded-full" style={{ width: `${Math.min((value / max) * 100, 100)}%`, background: worse ? WORSE : color }} />}
        {bench != null && <div className="absolute top-0 h-full w-0.5 bg-slate-500/70" style={{ left: `${Math.min((bench / max) * 100, 100)}%` }} />}
      </div>
    </div>
  );
}

function GroupedLens({ lens, label, groups, data }: {
  lens: 'race' | 'gender' | 'age' | 'nativity';
  label: string;
  groups: [string, string][];
  data: Record<string, GroupValues>;
}) {
  const metrics = LENS_METRICS[lens].filter((m) => data[m.key]);
  if (!metrics.length) {
    return <p className="text-sm text-slate-400 mt-5">The Census does not publish this breakdown for {label}.</p>;
  }
  const byWord = lens === 'race' ? 'race & ethnicity' : lens === 'gender' ? 'sex' : lens === 'age' ? 'age group' : 'nativity';
  return (
    <div className="mt-4">
      <SnapshotCard
        title={`${label} by ${byWord}`}
        sub="Within each metric, bars share one scale; a dash is a cell the Census does not publish, not a zero."
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 pdf:grid-cols-2 gap-x-10 gap-y-5 mt-3">
          {metrics.map((m) => {
            const values = data[m.key];
            const nums = groups.map(([g]) => values[g]).filter((v): v is number => v != null);
            const max = Math.max(...nums, 1) * (m.fmt === 'usd' ? 1.1 : 1);
            return (
              <div key={m.key}>
                <p className="text-[13px] font-bold text-slate-700 mb-2">{m.label}</p>
                <div className="space-y-2">
                  {groups.map(([g, name]) => {
                    const v = values[g];
                    return (
                      <div key={g} className="grid grid-cols-[150px_1fr_84px] gap-2.5 items-center text-[13px]">
                        <span className="text-slate-500 text-right truncate">{name}</span>
                        <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                          {v != null && <div className="h-full rounded-full bg-brand-indigo" style={{ width: `${Math.min((v / (m.fmt === 'pct' ? Math.max(max, 1) : max)) * 100, 100)}%` }} />}
                        </div>
                        <b className="tabular-nums text-slate-700">
                          {v != null ? fmtVal(v, m.fmt) : <span className="text-slate-300 font-normal">— not published</span>}
                        </b>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </SnapshotCard>
    </div>
  );
}

function RuralUrbanLens({ label, level, local, ru }: {
  label: string;
  level: 'county' | 'tract';
  local: CensusMetrics;
  ru: RuralUrbanBenchmarks | null;
}) {
  if (!ru) return <p className="text-sm text-slate-400 mt-5">Rural/urban benchmarks are unavailable.</p>;
  const geoWord = level === 'county' ? 'counties' : 'tracts';
  const cls = local.urban_pct == null ? null : local.urban_pct >= 50 ? 'urban' : 'rural';
  const rows: [string, string][] = [['here', label], ['urban', `Urban Georgia ${geoWord} (median)`], ['rural', `Rural Georgia ${geoWord} (median)`]];
  return (
    <div className="mt-4">
      <SnapshotCard
        title={`${label} vs. urban and rural Georgia`}
        sub={`The 2020 Census classifies population as urban or rural block by block; a majority-urban ${level} counts as urban here. Medians span ${ru.urban.geo_count ?? '—'} urban and ${ru.rural.geo_count ?? '—'} rural Georgia ${geoWord}.`}
      >
        {local.urban_pct != null && (
          <p className="text-sm text-slate-600 mt-2">
            <b>{label}</b> is <b>{local.urban_pct}% urban</b> by population
            {cls && <> — {cls === 'urban' ? 'an urban' : 'a rural'} {level} on this classification</>}.
          </p>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-2 pdf:grid-cols-2 gap-x-10 gap-y-5 mt-3">
          {RU_METRICS.map((m) => {
            const vals: GroupValues = {
              here: (local[m.key as keyof CensusMetrics] as number | null) ?? null,
              urban: ru.urban[m.key] ?? null,
              rural: ru.rural[m.key] ?? null,
            };
            if (vals.here == null && vals.urban == null && vals.rural == null) return null;
            const nums = Object.values(vals).filter((v): v is number => v != null);
            const max = Math.max(...nums, 1) * (m.fmt === 'usd' ? 1.1 : 1);
            return (
              <div key={m.key}>
                <p className="text-[13px] font-bold text-slate-700 mb-2">{m.label}</p>
                <div className="space-y-2">
                  {rows.map(([g, name]) => {
                    const v = vals[g];
                    return (
                      <div key={g} className="grid grid-cols-[190px_1fr_84px] gap-2.5 items-center text-[13px]">
                        <span className={`text-right truncate ${g === 'here' ? 'text-slate-700 font-semibold' : 'text-slate-500'}`}>{name}</span>
                        <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                          {v != null && <div className={`h-full rounded-full ${g === 'here' ? 'bg-brand-indigo' : 'bg-slate-300'}`} style={{ width: `${Math.min((v / (m.fmt === 'pct' ? Math.max(max, 1) : max)) * 100, 100)}%` }} />}
                        </div>
                        <b className="tabular-nums text-slate-700">
                          {v != null ? fmtVal(v, m.fmt) : <span className="text-slate-300 font-normal">—</span>}
                        </b>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-slate-400 mt-3 max-w-2xl">
          The ACS does not re-cut indicators by urban vs. rural population within a single {level}, so
          this lens compares the whole {level} against Georgia's urban and rural medians instead.
        </p>
      </SnapshotCard>
    </div>
  );
}
