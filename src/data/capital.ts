// Capital-over-time tables built by scripts/build-capital-tables.mjs.
// Amounts are whole dollars everywhere; format at render time.

export interface ProgramYearTotal {
  program: string;
  year: number;
  total_amount: number;
  record_count: number;
  rank_within_year: number;
  exclude_from_stack: boolean;
}

export interface ProgramIndexRow {
  program: string;
  year: number;
  total_amount: number;
  base_amount: number;
  index_value: number | null;
  record_count: number;
  highlight: boolean;
}

export interface LmiShareRow {
  program: string;
  year: number;
  total_amount: number;
  lmi_amount: number;
  lmi_share: number | null;
  direction: 'improved' | 'weakened' | 'flat' | null;
  record_count: number;
}

export interface IncomeMixRow {
  program_scope: 'federal_only' | 'all_programs';
  year: number;
  tract_income_level: string;
  income_level_order: number;
  total_amount: number;
  share_of_year: number | null;
  record_count: number;
}

export interface RegionShareRow {
  program_scope: 'federal_only' | 'all_programs';
  year: number;
  region: 'Atlanta core' | 'Rest of state';
  total_amount: number;
  share_of_year: number | null;
  record_count: number;
}

export interface CountyYearTotal {
  county_name: string;
  county_fips: string;
  year: number;
  total_amount: number;
  program_count: number;
  tract_count: number;
  record_count: number;
}

export interface CountyArrow {
  program_scope: 'federal_only';
  county_fips: string;
  county_name: string;
  amount_2018: number;
  amount_2022: number;
  change_direction: 'up' | 'down' | 'flat';
  record_count: number;
}

export interface CountyProgramYear {
  county_fips: string;
  program: string;
  year: number;
  total_amount: number;
  record_count: number;
}

export interface CapitalTables {
  generatedAt: string;
  source: string;
  years: number[];
  income_order: string[];
  atlanta_core: string[];
  program_year_totals: ProgramYearTotal[];
  program_index: ProgramIndexRow[];
  lmi_share_by_program: LmiShareRow[];
  income_mix_by_year: IncomeMixRow[];
  region_share_by_year: RegionShareRow[];
  county_year_totals: CountyYearTotal[];
  county_arrows: CountyArrow[];
  county_program_year: CountyProgramYear[];
}

export interface TractYearTotal {
  geoid: string;
  year: number;
  total_amount: number;
  programs: string[];
  record_count: number;
}

// Fixed categorical assignment, ordered by 2022 magnitude (stack order).
// Validated against the dataviz palette checks (light surface); the gold is
// darkened from the brand yellow to clear the lightness band.
export const PROGRAM_COLORS: Record<string, string> = {
  'CDFI': '#4750a2',
  'SBA 7(a)': '#279a49',
  'NMTC': '#53c3c2',
  'SBA 504': '#d4a72c',
  'Historic Tax Credit': '#f15921',
  'CDBG': '#929adf',
  'HOME': '#66b445',
  'LIHTC': '#9d5b8b',
  'CRA Small Business': '#64748b',
};

export const DIRECTION_COLORS: Record<string, string> = {
  improved: '#279a49',
  weakened: '#f15921',
  flat: '#94a3b8',
};

// Income levels: single-hue sequential, Low = darkest (ordinal, not categorical).
export const INCOME_COLORS: Record<string, string> = {
  Low: '#17632e',
  Moderate: '#279a49',
  Middle: '#93cb7b',
  Upper: '#def1d8',
};

export const REGION_COLORS: Record<string, string> = {
  'Atlanta core': '#4750a2',
  'Rest of state': '#53c3c2',
};

export function fmtDollars(v: number): string {
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

let tablesPromise: Promise<CapitalTables> | null = null;
let tractsPromise: Promise<TractYearTotal[]> | null = null;

export function loadCapitalTables(): Promise<CapitalTables> {
  tablesPromise ??= fetch(`${import.meta.env.BASE_URL}data/capital-tables.json`)
    .then((r) => {
      if (!r.ok) throw new Error(`Failed to load capital tables (${r.status})`);
      return r.json();
    });
  return tablesPromise;
}

export function loadCapitalTracts(): Promise<TractYearTotal[]> {
  tractsPromise ??= fetch(`${import.meta.env.BASE_URL}data/capital-tracts.json`)
    .then((r) => {
      if (!r.ok) throw new Error(`Failed to load capital tract data (${r.status})`);
      return r.json();
    })
    .then((d) => d.tract_year_totals as TractYearTotal[]);
  return tractsPromise;
}
