// Topline Local Data — ACS 5-year + CDC PLACES + HUD Picture of Subsidized
// Households + 2020 Decennial urban/rural, built by
// scripts/build-census-data.mjs. Metrics are precomputed; null means the
// source suppressed or does not publish the cell, never zero.

export type GroupValues = Record<string, number | null>;

export interface CensusMetrics {
  lfp: number | null;
  unemployment: number | null;
  underemployed_proxy: number | null;
  median_earnings: number | null;
  ss_households: number | null;
  ssi_households: number | null;
  cash_assistance_households: number | null;
  ownership: number | null;
  median_rent: number | null;
  rent_burden_30: number | null;
  rent_burden_50: number | null;
  mtg_burden_30: number | null;
  mtg_burden_50: number | null;
  crowded: number | null;
  vacancy_rental: number | null;
  vacancy_owner: number | null;
  median_hh_income: number | null;
  poverty: number | null;
  median_home_value: number | null;
  asset_income_households: number | null;
  retirement_income_households: number | null;
  snap_households: number | null;
  hcv_households: number | null;
  hud_assisted_households: number | null;
  total_households: number | null;
  renter_households: number | null;
  urban_pct: number | null;
  income_dist: GroupValues;
  ownership_by_income: GroupValues;
  uninsured: number | null;
  disability: number | null;
  checkup?: number | null;
  mental_distress?: number | null;
  by_race: Record<string, GroupValues>;
  by_gender: Record<string, GroupValues>;
  by_age: Record<string, GroupValues>;
  by_nativity?: Record<string, GroupValues> | null;
}

/** Median metric values across majority-urban vs majority-rural geographies. */
export interface RuralUrbanBenchmarks {
  urban: GroupValues;
  rural: GroupValues;
}

export interface CensusCounties {
  generatedAt: string;
  source: string;
  acs_vintage: string;
  state: CensusMetrics;
  rural_urban: RuralUrbanBenchmarks;
  counties: Record<string, CensusMetrics>;
}

export interface CensusTracts {
  rural_urban: RuralUrbanBenchmarks;
  tracts: Record<string, CensusMetrics>;
}

export const RACE_GROUPS: [string, string][] = [
  ['white_nh', 'White (non-Hispanic)'], ['black', 'Black'], ['asian', 'Asian'],
  ['hispanic', 'Hispanic'], ['two_plus', 'Two or more races'],
];
export const GENDER_GROUPS: [string, string][] = [['male', 'Male'], ['female', 'Female']];
export const AGE_GROUPS: [string, string][] = [
  ['under_25', 'Under 25'], ['a25_44', '25–44'], ['a45_64', '45–64'], ['a65_plus', '65 and over'],
];
export const NATIVITY_GROUPS: [string, string][] = [
  ['total', 'All residents'], ['native', 'Native-born'], ['foreign_born', 'Foreign-born'],
];
export const INCOME_GROUPS: [string, string][] = [
  ['under_25k', 'Under $25K'], ['k25_50', '$25K–$50K'], ['k50_100', '$50K–$100K'],
  ['k100_150', '$100K–$150K'], ['k150_plus', '$150K+'],
];

let countiesPromise: Promise<CensusCounties> | null = null;
let tractsPromise: Promise<CensusTracts> | null = null;
let tractPlacesPromise: Promise<Record<string, string>> | null = null;

export function loadCensusCounties(): Promise<CensusCounties> {
  countiesPromise ??= fetch(`${import.meta.env.BASE_URL}data/census-counties.json`).then((r) => {
    if (!r.ok) throw new Error(`Failed to load census county data (${r.status})`);
    return r.json();
  });
  return countiesPromise;
}

export function loadCensusTracts(): Promise<CensusTracts> {
  tractsPromise ??= fetch(`${import.meta.env.BASE_URL}data/census-tracts.json`).then((r) => {
    if (!r.ok) throw new Error(`Failed to load census tract data (${r.status})`);
    return r.json();
  });
  return tractsPromise;
}

/** GEOID → the city/CDP the tract sits in (see scripts/build-tract-places.mjs). */
export function loadTractPlaces(): Promise<Record<string, string>> {
  tractPlacesPromise ??= fetch(`${import.meta.env.BASE_URL}data/tract-places.json`)
    .then((r) => (r.ok ? r.json() : { places: {} }))
    .then((d) => d.places as Record<string, string>);
  return tractPlacesPromise;
}
