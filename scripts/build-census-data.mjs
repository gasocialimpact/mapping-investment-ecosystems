#!/usr/bin/env node
// Builds the Topline Local Data datasets:
//
//   public/data/census-counties.json — all 159 GA counties + a "state" row
//                                      (the GA benchmark ticks), ACS 5-year
//                                      2023 + CDC PLACES
//   public/data/census-tracts.json   — all GA census tracts (2020 vintage,
//                                      matching the tool's tract GEOIDs)
//
// Requires CENSUS_API_KEY in the environment (never committed — it lives in
// the repo's GitHub Secrets and in the local shell). CDC PLACES needs no key.
//
// Conventions: metrics are computed here, not in the UI; ACS suppression
// sentinels (-666666666 and friends) become null; every geo carries the same
// metric keys so a missing value is always a deliberate null.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const KEY = process.env.CENSUS_API_KEY;
if (!KEY) {
  console.error('Missing CENSUS_API_KEY in the environment.');
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'data');
const ACS = 'https://api.census.gov/data/2023/acs/acs5';
const DEC = 'https://api.census.gov/data/2020/dec/dhc';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return await res.json();
    } catch (e) {
      if (i === tries - 1) throw new Error(`${e.message} — ${url.slice(0, 120)}`);
      await sleep(1500 * (i + 1));
    }
  }
}

// One ACS call for a set of variables at a geography; returns rows keyed by
// geo id (state 2-digit / county 5-digit / tract 11-digit).
async function acs(dataset, vars, geo, base = ACS) {
  const forIn = geo === 'state' ? 'for=state:13'
    : geo === 'county' ? 'for=county:*&in=state:13'
    : 'for=tract:*&in=state:13';
  const url = `${base}${dataset}?get=${vars.join(',')}&${forIn}&key=${KEY}`;
  const rows = await fetchJson(url);
  const header = rows[0];
  const out = new Map();
  for (const row of rows.slice(1)) {
    const rec = Object.fromEntries(header.map((h, i) => [h, row[i]]));
    const id = geo === 'state' ? rec.state
      : geo === 'county' ? rec.state + rec.county
      : rec.state + rec.county + rec.tract;
    out.set(id, rec);
  }
  return out;
}

// ACS numeric parse: suppression/absence sentinels → null.
function num(v) {
  if (v == null || v === '' || v === 'N' || v === '(X)') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= -111111111) return null;
  return n;
}
const sum = (rec, keys) => {
  let total = 0;
  for (const k of keys) {
    const v = num(rec[k]);
    if (v == null) return null;
    total += v;
  }
  return total;
};
const share = (part, whole) => (part == null || whole == null || whole === 0 ? null : Math.round((part / whole) * 1000) / 10);
const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10);

// --- Variable sets ----------------------------------------------------------

const DETAIL_A = [
  'B19013_001E', 'B19013B_001E', 'B19013D_001E', 'B19013G_001E', 'B19013H_001E', 'B19013I_001E',
  'B25003_001E', 'B25003_002E', 'B25003_003E', 'B25003B_001E', 'B25003B_002E', 'B25003D_001E', 'B25003D_002E',
  'B25003G_001E', 'B25003G_002E', 'B25003H_001E', 'B25003H_002E', 'B25003I_001E', 'B25003I_002E',
  'B20002_002E', 'B20002_003E',
  // Wealth proxies: households with interest/dividend/net-rental income and
  // with retirement income (the ACS has no direct wealth table below the US).
  'B19054_001E', 'B19054_002E', 'B19059_001E', 'B19059_002E',
];
const DETAIL_B = [
  ...Array.from({ length: 11 }, (_, i) => `B25070_${String(i + 1).padStart(3, '0')}E`),
  ...Array.from({ length: 11 }, (_, i) => `B25091_${String(i + 2).padStart(3, '0')}E`),
  ...Array.from({ length: 17 }, (_, i) => `B19001_${String(i + 1).padStart(3, '0')}E`),
];
// SNAP receipt by race of householder + tenure by household income.
const DETAIL_E = [
  ...['B', 'D', 'G', 'H', 'I'].flatMap((r) => [`B22005${r}_001E`, `B22005${r}_002E`]),
  ...Array.from({ length: 25 }, (_, i) => `B25118_${String(i + 1).padStart(3, '0')}E`),
];
// B25118 rows (owner 003–013 / renter 015–025) per income bracket.
const TENURE_INCOME_ROWS = {
  under_25k: [3, 4, 5, 6, 7], k25_50: [8, 9], k50_100: [10, 11], k100_150: [12], k150_plus: [13],
};
const PROFILE = [
  'DP03_0002PE', 'DP03_0009PE', 'DP03_0066PE', 'DP03_0070PE', 'DP03_0072PE', 'DP03_0074PE',
  'DP03_0092E', 'DP03_0099PE',
  'DP04_0004E', 'DP04_0005E', 'DP04_0046PE', 'DP04_0078PE', 'DP04_0079PE', 'DP04_0089E', 'DP04_0134E',
];
const SUBJECT = [
  'S2303_C02_033E', 'S2303_C04_033E', 'S2303_C06_033E',
  ...Array.from({ length: 9 }, (_, i) => `S2301_C04_${String(i + 12).padStart(3, '0')}E`),
  'S2301_C04_022E', 'S2301_C04_023E', 'S2301_C02_022E', 'S2301_C02_023E',
  'S1701_C03_001E', 'S1810_C03_001E',
  // Age rows 002–011 (16–19 … 75+): population, LFP rate, unemployment rate.
  ...Array.from({ length: 10 }, (_, i) => `S2301_C01_${String(i + 2).padStart(3, '0')}E`),
  ...Array.from({ length: 10 }, (_, i) => `S2301_C02_${String(i + 2).padStart(3, '0')}E`),
  ...Array.from({ length: 10 }, (_, i) => `S2301_C04_${String(i + 2).padStart(3, '0')}E`),
];
// Race and sex rows of the poverty / insurance / disability / LFP subject
// tables (a second call — the API caps a request at 50 variables).
const SUBJECT_B = [
  ...Array.from({ length: 9 }, (_, i) => `S2301_C02_${String(i + 12).padStart(3, '0')}E`), // LFP by race
  'S1701_C03_011E', 'S1701_C03_012E', // poverty by sex
  'S1701_C03_014E', 'S1701_C03_016E', 'S1701_C03_019E', 'S1701_C03_020E', 'S1701_C03_021E', // poverty by race
  'S2701_C05_014E', 'S2701_C05_015E', // uninsured by sex
  'S2701_C05_017E', 'S2701_C05_019E', 'S2701_C05_022E', 'S2701_C05_023E', 'S2701_C05_024E', // uninsured by race
  'S1810_C03_002E', 'S1810_C03_003E', // disability by sex
  'S1810_C03_005E', 'S1810_C03_007E', 'S1810_C03_010E', 'S1810_C03_011E', 'S1810_C03_012E', // disability by race
];
// Median household income by householder age + poverty status by age (B17001:
// male below 004–016, female below 018–030, male above 033–045, female above
// 047–059 — thirteen age bands each, summed into the four lens bands).
const DETAIL_C = [
  ...Array.from({ length: 5 }, (_, i) => `B19049_${String(i + 1).padStart(3, '0')}E`),
  ...Array.from({ length: 13 }, (_, i) => `B17001_${String(i + 4).padStart(3, '0')}E`),
  ...Array.from({ length: 13 }, (_, i) => `B17001_${String(i + 33).padStart(3, '0')}E`),
];
const DETAIL_D = [
  ...Array.from({ length: 13 }, (_, i) => `B17001_${String(i + 18).padStart(3, '0')}E`),
  ...Array.from({ length: 13 }, (_, i) => `B17001_${String(i + 47).padStart(3, '0')}E`),
];
// B17001 age-band index (0-based within each 13-row run) → lens band.
const AGE_BANDS = { under_25: [0, 1, 2, 3, 4, 5, 6], a25_44: [7, 8], a45_64: [9, 10], a65_plus: [11, 12] };
// S2301 age rows 002–011 → lens band.
const S2301_AGE_BANDS = { under_25: [2, 3], a25_44: [4, 5, 6], a45_64: [7, 8, 9], a65_plus: [10, 11] };

// S2301 race rows _012.._020 in table order.
const S2301_RACE = {
  white: 'S2301_C04_012E', black: 'S2301_C04_013E', aian: 'S2301_C04_014E',
  asian: 'S2301_C04_015E', nhpi: 'S2301_C04_016E', other: 'S2301_C04_017E',
  two_plus: 'S2301_C04_018E', hispanic: 'S2301_C04_019E', white_nh: 'S2301_C04_020E',
};

// --- Metric assembly --------------------------------------------------------

function buildMetrics(a, b, p, s, c, d, e) {
  const rentDenom = num(b.B25070_001E) != null && num(b.B25070_011E) != null ? num(b.B25070_001E) - num(b.B25070_011E) : null;
  const mtgDenom = num(b.B25091_002E) != null && num(b.B25091_012E) != null ? num(b.B25091_002E) - num(b.B25091_012E) : null;
  const inc = (keys) => share(sum(b, keys), num(b.B19001_001E));
  const ftyr = num(s.S2303_C02_033E);

  // Poverty by age: below-poverty ÷ (below + above) across the male/female
  // 13-band runs of B17001.
  const b17 = (start, idx) => num((start === 4 || start === 33 ? c : d)[`B17001_${String(start + idx).padStart(3, '0')}E`]);
  const povertyByAge = (band) => {
    let below = 0, above = 0;
    for (const i of AGE_BANDS[band]) {
      const bl = (b17(4, i) ?? NaN) + (b17(18, i) ?? NaN);
      const ab = (b17(33, i) ?? NaN) + (b17(47, i) ?? NaN);
      if (!Number.isFinite(bl) || !Number.isFinite(ab)) return null;
      below += bl; above += ab;
    }
    return share(below, below + above);
  };
  // LFP / unemployment by age: population-weighted across S2301 age rows
  // (unemployment weighted by each row's labor force, not raw population).
  const s2301 = (col, row) => num(s[`S2301_${col}_${String(row).padStart(3, '0')}E`]);
  const workforceByAge = (band, rate) => {
    let wNum = 0, wDen = 0;
    for (const row of S2301_AGE_BANDS[band]) {
      const pop = s2301('C01', row), lfp = s2301('C02', row);
      if (pop == null || lfp == null) return null;
      const weight = rate === 'lfp' ? pop : pop * (lfp / 100);
      const v = rate === 'lfp' ? lfp : s2301('C04', row);
      if (v == null) return null;
      wNum += weight * v; wDen += weight;
    }
    return wDen > 0 ? r1(wNum / wDen) : null;
  };
  const byAge = (fn) => ({
    under_25: fn('under_25'), a25_44: fn('a25_44'), a45_64: fn('a45_64'), a65_plus: fn('a65_plus'),
  });
  return {
    // Economic & Workforce
    lfp: num(p.DP03_0002PE),
    unemployment: num(p.DP03_0009PE),
    underemployed_proxy: ftyr == null ? null : r1(100 - ftyr),
    median_earnings: num(p.DP03_0092E),
    ss_households: num(p.DP03_0066PE),
    ssi_households: num(p.DP03_0070PE),
    cash_assistance_households: num(p.DP03_0072PE),
    // Housing
    ownership: num(p.DP04_0046PE),
    median_rent: num(p.DP04_0134E),
    rent_burden_30: share(sum(b, ['B25070_007E', 'B25070_008E', 'B25070_009E', 'B25070_010E']), rentDenom),
    rent_burden_50: share(num(b.B25070_010E), rentDenom),
    mtg_burden_30: share(sum(b, ['B25091_008E', 'B25091_009E', 'B25091_010E', 'B25091_011E']), mtgDenom),
    mtg_burden_50: share(num(b.B25091_011E), mtgDenom),
    crowded: num(p.DP04_0078PE) == null || num(p.DP04_0079PE) == null ? null : r1(num(p.DP04_0078PE) + num(p.DP04_0079PE)),
    vacancy_rental: num(p.DP04_0005E),
    vacancy_owner: num(p.DP04_0004E),
    // Income & Financial Wellness
    median_hh_income: num(a.B19013_001E),
    poverty: num(s.S1701_C03_001E),
    median_home_value: num(p.DP04_0089E),
    asset_income_households: share(num(a.B19054_002E), num(a.B19054_001E)),
    retirement_income_households: share(num(a.B19059_002E), num(a.B19059_001E)),
    snap_households: num(p.DP03_0074PE),
    // HUD Picture of Subsidized Households merges in at county level only.
    hcv_households: null,
    hud_assisted_households: null,
    // Denominators kept for the HUD merge and any later derived shares.
    total_households: num(a.B25003_001E),
    renter_households: num(a.B25003_003E),
    // 2020 Decennial urban share merges in after the ACS pass.
    urban_pct: null,
    // Brackets aligned with B25118 so ownership can be cut the same way.
    income_dist: {
      under_25k: inc(['B19001_002E', 'B19001_003E', 'B19001_004E', 'B19001_005E']),
      k25_50: inc(['B19001_006E', 'B19001_007E', 'B19001_008E', 'B19001_009E', 'B19001_010E']),
      k50_100: inc(['B19001_011E', 'B19001_012E', 'B19001_013E']),
      k100_150: inc(['B19001_014E', 'B19001_015E']),
      k150_plus: inc(['B19001_016E', 'B19001_017E']),
    },
    ownership_by_income: Object.fromEntries(Object.entries(TENURE_INCOME_ROWS).map(([key, rows]) => {
      const own = sum(e, rows.map((r) => `B25118_${String(r).padStart(3, '0')}E`));
      const rent = sum(e, rows.map((r) => `B25118_${String(r + 12).padStart(3, '0')}E`));
      return [key, own == null || rent == null ? null : share(own, own + rent)];
    })),
    // Health & Wellbeing (uninsured/disability here; checkup & mental
    // distress merge in from CDC PLACES; life expectancy renders from the
    // tool's existing place data)
    uninsured: num(p.DP03_0099PE),
    disability: num(s.S1810_C03_001E),
    // Lenses
    by_race: {
      median_hh_income: {
        white_nh: num(a.B19013H_001E), black: num(a.B19013B_001E), asian: num(a.B19013D_001E),
        hispanic: num(a.B19013I_001E), two_plus: num(a.B19013G_001E),
      },
      unemployment: {
        white_nh: num(s[S2301_RACE.white_nh]), black: num(s[S2301_RACE.black]), asian: num(s[S2301_RACE.asian]),
        hispanic: num(s[S2301_RACE.hispanic]), two_plus: num(s[S2301_RACE.two_plus]),
      },
      ownership: {
        white_nh: share(num(a.B25003H_002E), num(a.B25003H_001E)),
        black: share(num(a.B25003B_002E), num(a.B25003B_001E)),
        asian: share(num(a.B25003D_002E), num(a.B25003D_001E)),
        hispanic: share(num(a.B25003I_002E), num(a.B25003I_001E)),
        two_plus: share(num(a.B25003G_002E), num(a.B25003G_001E)),
      },
      lfp: {
        white_nh: num(s.S2301_C02_020E), black: num(s.S2301_C02_013E), asian: num(s.S2301_C02_015E),
        hispanic: num(s.S2301_C02_019E), two_plus: num(s.S2301_C02_018E),
      },
      poverty: {
        white_nh: num(s.S1701_C03_021E), black: num(s.S1701_C03_014E), asian: num(s.S1701_C03_016E),
        hispanic: num(s.S1701_C03_020E), two_plus: num(s.S1701_C03_019E),
      },
      uninsured: {
        white_nh: num(s.S2701_C05_024E), black: num(s.S2701_C05_017E), asian: num(s.S2701_C05_019E),
        hispanic: num(s.S2701_C05_023E), two_plus: num(s.S2701_C05_022E),
      },
      disability: {
        white_nh: num(s.S1810_C03_011E), black: num(s.S1810_C03_005E), asian: num(s.S1810_C03_007E),
        hispanic: num(s.S1810_C03_012E), two_plus: num(s.S1810_C03_010E),
      },
      snap_households: {
        white_nh: share(num(e.B22005H_002E), num(e.B22005H_001E)),
        black: share(num(e.B22005B_002E), num(e.B22005B_001E)),
        asian: share(num(e.B22005D_002E), num(e.B22005D_001E)),
        hispanic: share(num(e.B22005I_002E), num(e.B22005I_001E)),
        two_plus: share(num(e.B22005G_002E), num(e.B22005G_001E)),
      },
    },
    by_age: {
      median_hh_income: {
        under_25: num(c.B19049_002E), a25_44: num(c.B19049_003E),
        a45_64: num(c.B19049_004E), a65_plus: num(c.B19049_005E),
      },
      lfp: byAge((band) => workforceByAge(band, 'lfp')),
      unemployment: byAge((band) => workforceByAge(band, 'unemployment')),
      poverty: byAge(povertyByAge),
    },
    by_gender: {
      median_earnings: { male: num(a.B20002_002E), female: num(a.B20002_003E) },
      lfp: { male: num(s.S2301_C02_022E), female: num(s.S2301_C02_023E) },
      unemployment: { male: num(s.S2301_C04_022E), female: num(s.S2301_C04_023E) },
      underemployed_proxy: {
        male: num(s.S2303_C04_033E) == null ? null : r1(100 - num(s.S2303_C04_033E)),
        female: num(s.S2303_C06_033E) == null ? null : r1(100 - num(s.S2303_C06_033E)),
      },
      poverty: { male: num(s.S1701_C03_011E), female: num(s.S1701_C03_012E) },
      uninsured: { male: num(s.S2701_C05_014E), female: num(s.S2701_C05_015E) },
      disability: { male: num(s.S1810_C03_002E), female: num(s.S1810_C03_003E) },
    },
  };
}

// --- Nativity (S0501, county + state only) ----------------------------------

async function nativity(geo) {
  // Resolve rows by label so a table revision doesn't silently shift values.
  const meta = await fetchJson(`${ACS}/subject/groups/S0501.json`);
  const findRow = (needle) => {
    const hit = Object.entries(meta.variables).find(([k, v]) =>
      k.startsWith('S0501_C01_') && k.endsWith('E') && v.label.toLowerCase().includes(needle));
    if (!hit) throw new Error(`S0501 row not found: ${needle}`);
    return hit[0].slice(-4, -1); // row number
  };
  const rows = {
    median_hh_income: findRow('median household income'),
    poverty: findRow('below 100 percent'),
    ownership: findRow('owner-occupied housing units'),
    unemployment: findRow('percent of civilian labor force'),
    snap_households: findRow('food stamp/snap'),
  };
  const vars = Object.values(rows).flatMap((r) => ['C01', 'C02', 'C04'].map((c) => `S0501_${c}_${r}E`));
  const data = await acs('/subject', ['NAME', ...vars], geo);
  const out = new Map();
  for (const [id, rec] of data) {
    const metric = {};
    for (const [key, row] of Object.entries(rows)) {
      metric[key] = {
        total: num(rec[`S0501_C01_${row}E`]),
        native: num(rec[`S0501_C02_${row}E`]),
        foreign_born: num(rec[`S0501_C04_${row}E`]),
      };
    }
    out.set(id, metric);
  }
  return out;
}

// --- CDC PLACES --------------------------------------------------------------

async function places(level) {
  const dataset = level === 'county' ? 'swc5-untb' : 'cwsq-ngmh';
  const out = new Map();
  for (const measure of ['CHECKUP', 'MHLTH']) {
    let offset = 0;
    for (;;) {
      const url = `https://data.cdc.gov/resource/${dataset}.json?stateabbr=GA&measureid=${measure}` +
        (level === 'county' ? '&datavaluetypeid=AgeAdjPrv' : '&datavaluetypeid=CrdPrv') +
        `&$limit=5000&$offset=${offset}`;
      const rows = await fetchJson(url);
      for (const r of rows) {
        const id = level === 'county' ? r.locationid : r.locationname;
        if (!id?.startsWith('13')) continue;
        const cur = out.get(id) ?? {};
        cur[measure === 'CHECKUP' ? 'checkup' : 'mental_distress'] = num(r.data_value);
        out.set(id, cur);
      }
      if (rows.length < 5000) break;
      offset += 5000;
    }
    await sleep(400);
  }
  return out;
}

// --- Main --------------------------------------------------------------------

async function buildGeo(geo) {
  console.log(`Fetching ACS for ${geo}…`);
  const [a, b, p, s1, s2, c, d, e] = [
    await acs('', DETAIL_A, geo),
    await acs('', DETAIL_B, geo),
    await acs('/profile', PROFILE, geo),
    await acs('/subject', SUBJECT, geo),
    await acs('/subject', SUBJECT_B, geo),
    await acs('', DETAIL_C, geo),
    await acs('', DETAIL_D, geo),
    await acs('', DETAIL_E, geo),
  ];
  const out = new Map();
  for (const id of a.keys()) {
    if (!b.has(id) || !p.has(id) || !s1.has(id) || !s2.has(id) || !c.has(id) || !d.has(id) || !e.has(id)) continue;
    const s = { ...s1.get(id), ...s2.get(id) };
    out.set(id, buildMetrics(a.get(id), b.get(id), p.get(id), s, c.get(id), d.get(id), e.get(id)));
  }
  return out;
}

// --- 2020 Decennial urban/rural split ----------------------------------------

async function urbanShare(geo) {
  const data = await acs('', ['P2_001N', 'P2_002N'], geo, DEC);
  const out = new Map();
  for (const [id, rec] of data) out.set(id, share(num(rec.P2_002N), num(rec.P2_001N)));
  return out;
}

// --- HUD Picture of Subsidized Households (county level, FY2024) -------------
// data/hud-psh-ga-county-2024.csv is extracted from HUD's COUNTY_2024 file
// (huduser.gov blocks unattended downloads, so the GA slice is checked in).

function hudCounty() {
  const text = readFileSync(join(root, 'data', 'hud-psh-ga-county-2024.csv'), 'utf8');
  const [header, ...lines] = text.trim().split('\n').map((l) => l.split(','));
  const col = Object.fromEntries(header.map((h, i) => [h, i]));
  const out = new Map(); // fips → { hcv, all }
  for (const row of lines) {
    const fips = row[col.code];
    const reported = num(row[col.number_reported]);
    const households = reported == null || reported < 0 ? null : reported; // HUD sentinels are negative
    const cur = out.get(fips) ?? { hcv: null, all: null };
    if (row[col.program_label] === 'Housing Choice Vouchers') cur.hcv = households;
    if (row[col.program_label] === 'Summary of All HUD Programs') cur.all = households;
    out.set(fips, cur);
  }
  return out;
}

// Median value of a metric across the majority-urban vs majority-rural geos at
// one level — the comparison rows behind the Rural/Urban lens.
const RU_METRICS = [
  'median_hh_income', 'poverty', 'unemployment', 'lfp', 'ownership', 'median_rent',
  'rent_burden_30', 'snap_households', 'uninsured', 'median_home_value',
];
function ruralUrbanBenchmarks(metricsMap) {
  const median = (vals) => {
    const s = vals.filter((v) => v != null).sort((x, y) => x - y);
    return s.length ? s[Math.floor(s.length / 2)] : null;
  };
  const out = { urban: {}, rural: {} };
  for (const cls of ['urban', 'rural']) {
    const geos = [...metricsMap.values()].filter((m) =>
      m.urban_pct != null && (cls === 'urban' ? m.urban_pct >= 50 : m.urban_pct < 50));
    for (const key of RU_METRICS) out[cls][key] = median(geos.map((m) => m[key]));
    out[cls].geo_count = geos.length;
  }
  return out;
}

const generatedAt = new Date().toISOString();
const source = 'American Community Survey 5-year estimates (2019–2023) · CDC PLACES 2024 release (BRFSS 2023) · HUD Picture of Subsidized Households (Dec 2024) · 2020 Decennial Census urban/rural';

// Counties + the GA benchmark row
const countyMetrics = await buildGeo('county');
const stateMetrics = await buildGeo('state');
const countyNativity = await nativity('county');
const stateNativity = await nativity('state');
const countyPlaces = await places('county');
const countyUrban = await urbanShare('county');
const stateUrban = await urbanShare('state');
const hud = hudCounty();

const counties = {};
for (const [fips, m] of countyMetrics) {
  const h = hud.get(fips);
  counties[fips] = {
    ...m,
    urban_pct: countyUrban.get(fips) ?? null,
    hcv_households: share(h?.hcv ?? null, m.renter_households),
    hud_assisted_households: share(h?.all ?? null, m.total_households),
    by_nativity: countyNativity.get(fips) ?? null,
    ...(countyPlaces.get(fips) ?? {}),
  };
}
const state = { ...stateMetrics.get('13'), by_nativity: stateNativity.get('13') ?? null };
state.urban_pct = stateUrban.get('13') ?? null;
{
  // GA voucher/assisted shares: county households summed over the state denominators.
  const sumBy = (k) => [...hud.values()].reduce((t, v) => t + (v[k] ?? 0), 0);
  state.hcv_households = share(sumBy('hcv'), state.renter_households);
  state.hud_assisted_households = share(sumBy('all'), state.total_households);
}
// GA statewide PLACES benchmark: population-weighted mean is overkill for a
// tick — use the median county value.
for (const key of ['checkup', 'mental_distress']) {
  const vals = [...countyPlaces.values()].map((v) => v[key]).filter((v) => v != null).sort((x, y) => x - y);
  state[key] = vals.length ? vals[Math.floor(vals.length / 2)] : null;
}

if (Object.keys(counties).length !== 159) throw new Error(`Expected 159 counties, got ${Object.keys(counties).length}`);

const countyRU = ruralUrbanBenchmarks(new Map(Object.entries(counties)));
writeFileSync(join(outDir, 'census-counties.json'),
  JSON.stringify({ generatedAt, source, acs_vintage: '2019–2023', state, rural_urban: countyRU, counties }));

// Tracts
const tractMetrics = await buildGeo('tract');
const tractPlaces = await places('tract');
const tractUrban = await urbanShare('tract');
const tracts = {};
for (const [geoid, m] of tractMetrics) {
  tracts[geoid] = { ...m, urban_pct: tractUrban.get(geoid) ?? null, ...(tractPlaces.get(geoid) ?? {}) };
}
const tractRU = ruralUrbanBenchmarks(new Map(Object.entries(tracts)));
writeFileSync(join(outDir, 'census-tracts.json'),
  JSON.stringify({ generatedAt, source, acs_vintage: '2019–2023', rural_urban: tractRU, tracts }));

console.log(`Wrote census-counties.json — ${Object.keys(counties).length} counties + state benchmark`);
console.log(`Wrote census-tracts.json — ${Object.keys(tracts).length} tracts`);
