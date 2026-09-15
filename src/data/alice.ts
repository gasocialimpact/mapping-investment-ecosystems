// United For ALICE county time series, built by scripts/build-alice-data.mjs.
// Counts are whole households; shares are computed at render time.

export interface AliceRow {
  county_fips: string;
  county_name: string;
  year: number;
  households: number;
  poverty_households: number;
  alice_households: number;
  above_alice_households: number;
  source_window: string | null; // '1-Year' | '3-Year' | '5-Year' ACS estimate
  record_count: number;
}

export interface AliceData {
  generatedAt: string;
  source: string;
  years: number[];
  rows: AliceRow[];
}

// ALICE bands: below-poverty is the most strained, above-threshold the least.
// Orange/gold adjacency is validated in the shared program palette.
export const ALICE_COLORS: Record<string, string> = {
  'Below Federal Poverty Level': '#f15921',
  'ALICE (above poverty, below survival budget)': '#d4a72c',
  'Above ALICE Threshold': '#279a49',
};

let promise: Promise<AliceData> | null = null;

export function loadAliceData(): Promise<AliceData> {
  promise ??= fetch(`${import.meta.env.BASE_URL}data/alice-counties.json`).then((r) => {
    if (!r.ok) throw new Error(`Failed to load ALICE data (${r.status})`);
    return r.json();
  });
  return promise;
}
