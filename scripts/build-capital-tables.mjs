#!/usr/bin/env node
// Builds the capital-over-time tables from the raw community-investment
// programs CSV (data/community-investment-programs-by-tract.csv):
//
//   public/data/capital-tables.json  — the six analysis tables + county/
//                                      program supplements (eager-loaded by
//                                      the Tracking Capital tab)
//   public/data/capital-tracts.json  — per-tract yearly totals (lazy-loaded
//                                      by tract reports)
//
// Conventions carried through every table:
//   - amounts are whole dollars; formatting happens at render time
//   - every table row carries record_count so thin cells can be suppressed
//     consistently and bad joins surface fast

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(root, 'data', 'community-investment-programs-by-tract.csv');
const outDir = join(root, 'public', 'data');

// Canonical program labels. The raw tract file and the Fed CIE sheet spell
// several programs differently — normalize once, here, in one lookup.
const PROGRAM_LOOKUP = {
  'CRA Small Business': 'CRA Small Business',
  'CRA Small Business Lending': 'CRA Small Business',
  'CRA Small-Business Lending': 'CRA Small Business',
  'CDFI': 'CDFI',
  'CDFI Investments': 'CDFI',
  'CDBG': 'CDBG',
  'Community Development Block Grants': 'CDBG',
  'HOME': 'HOME',
  'HOME Housing Grants': 'HOME',
  'LIHTC': 'LIHTC',
  'Low-Income Housing Tax Credit': 'LIHTC',
  'NMTC': 'NMTC',
  'New Markets Tax Credit': 'NMTC',
  'Historic Tax Credit': 'Historic Tax Credit',
  'HTC': 'Historic Tax Credit',
  'SBA 504': 'SBA 504',
  'SBA 504 Loans': 'SBA 504',
  'SBA 7A': 'SBA 7(a)',
  'SBA 7(a) Loans': 'SBA 7(a)',
};

const ATLANTA_CORE = new Set(['Fulton', 'DeKalb', 'Cobb', 'Gwinnett', 'Clayton']);
const CRA = 'CRA Small Business';
const INCOME_ORDER = ['Low', 'Moderate', 'Middle', 'Upper'];

// The full span present in the source file. Earlier builds clipped to 2018-2022
// because that window maximises the number of programs reporting at once, but
// clipping silently discarded $924M of real records: LIHTC 2016-2017 and the
// 2023 SBA rows. Every program is carried across its own reporting window now,
// and program_coverage below tells the UI which cells are genuinely absent so a
// gap is never drawn as a zero.
const YEARS = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023];

// Year used to order the stack and to anchor like-for-like comparisons: the
// last year with broad multi-program coverage.
const REFERENCE_YEAR = 2022;

// --- Load & derive ---------------------------------------------------------

function parseCsv(text) {
  const rows = [];
  let field = '', record = [], inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { record.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      record.push(field); field = '';
      if (record.some((f) => f !== '')) rows.push(record);
      record = [];
    } else field += c;
  }
  if (field !== '' || record.length) { record.push(field); if (record.some((f) => f !== '')) rows.push(record); }
  return rows;
}

const raw = parseCsv(readFileSync(SRC, 'utf8').replace(/^﻿/, ''));
const header = raw[0];
const col = (name) => {
  const i = header.indexOf(name);
  if (i < 0) throw new Error(`Missing column: ${name}`);
  return i;
};
const C = {
  program: col('Program'),
  tract: col('Census Tract'),
  county: col('County Name'),
  income: col('Tract Income Level'),
  year: col('Year'),
  amount: col('Amount'),
};

const records = [];
let dropped = 0;
for (const r of raw.slice(1)) {
  const amount = Number(r[C.amount]);
  const year = Number(r[C.year]);
  const program = PROGRAM_LOOKUP[r[C.program]];
  const geoid = r[C.tract];
  if (!program) throw new Error(`Unknown program label: "${r[C.program]}"`);
  if (!Number.isFinite(amount) || !Number.isFinite(year) || geoid.length !== 11) { dropped++; continue; }
  // County name in the raw file carries a trailing ", GA" that won't join
  // cleanly; strip it, and take the FIPS from the tract GEOID instead.
  const countyName = r[C.county].replace(/,\s*GA$/, '').replace(/ County$/, '');
  const income = r[C.income];
  records.push({
    program,
    geoid,
    countyFips: geoid.slice(0, 5),
    countyName,
    income,
    lmi_flag: income === 'Low' || income === 'Moderate',
    region: ATLANTA_CORE.has(countyName) ? 'Atlanta core' : 'Rest of state',
    year,
    amount,
  });
}
console.log(`Parsed ${records.length} records (${dropped} dropped for missing amount/year).`);

const sum = (rows) => rows.reduce((s, r) => s + r.amount, 0);
const groupBy = (rows, keyFn) => {
  const m = new Map();
  for (const r of rows) {
    const k = keyFn(r);
    (m.get(k) ?? m.set(k, []).get(k)).push(r);
  }
  return m;
};

// Everything. Per-table windows are applied explicitly where they are needed.
const inYears = records;

// --- Table 0: program_coverage --------------------------------------------
// Which years each program actually reports. This is what lets the UI print an
// em dash for "not reported" instead of a zero, and footnote the gap.
const program_coverage = [];
{
  for (const [program, group] of groupBy(records, (r) => r.program)) {
    const years = [...new Set(group.map((r) => r.year))].sort((a, b) => a - b);
    program_coverage.push({
      program,
      years,
      first_year: years[0],
      last_year: years[years.length - 1],
      record_count: group.length,
      total_amount: Math.round(sum(group)),
      // A program is only comparable across the whole span if it reports in all of it.
      spans_all_years: years.length === YEARS.length,
    });
  }
  program_coverage.sort((a, b) => b.total_amount - a.total_amount);
}

// --- Table 1: program_year_totals (2019–2022) ------------------------------

const program_year_totals = [];
{
  for (const [key, group] of groupBy(records, (r) => `${r.program}|${r.year}`)) {
    const [program, year] = key.split('|');
    program_year_totals.push({
      program,
      year: Number(year),
      total_amount: Math.round(sum(group)),
      record_count: group.length,
      exclude_from_stack: program === CRA,
    });
  }
  // rank within year by total, 1 = largest
  for (const year of YEARS) {
    const inYear = program_year_totals.filter((r) => r.year === year).sort((a, b) => b.total_amount - a.total_amount);
    inYear.forEach((r, i) => { r.rank_within_year = i + 1; });
  }
  // stack order: by reference-year magnitude descending (largest band at the bottom)
  const order2022 = program_year_totals
    .filter((r) => r.year === REFERENCE_YEAR && !r.exclude_from_stack)
    .sort((a, b) => b.total_amount - a.total_amount)
    .map((r) => r.program);
  program_year_totals.sort((a, b) => {
    const ai = order2022.indexOf(a.program), bi = order2022.indexOf(b.program);
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi) || a.year - b.year;
  });
}

// --- Table 2: program_index (2018–2022, SBA dropped, 2018 = 100) -----------

const program_index = [];
{
  for (const [program, group] of groupBy(records, (r) => r.program)) {
    const byYear = groupBy(group, (r) => r.year);
    // Each program is indexed to its own first reporting year rather than a
    // shared 2018. SBA has no 2018 and used to be dropped from this chart
    // entirely; now it is charted from 2019, its actual base.
    const base_year = Math.min(...byYear.keys());
    const base = byYear.get(base_year);
    const base_amount = Math.round(sum(base));
    for (const year of YEARS) {
      const yearRows = byYear.get(year);
      if (!yearRows) continue; // absent year stays absent — never a zero
      const total_amount = Math.round(sum(yearRows));
      program_index.push({
        program,
        year,
        base_year,
        total_amount,
        base_amount,
        index_value: base_amount > 0 ? Math.round((total_amount / base_amount) * 1000) / 10 : null,
        record_count: yearRows.length,
        // Reserved emphasis column — repoint it later without touching charts.
        highlight: program === 'CDFI',
      });
    }
  }
  program_index.sort((a, b) => a.program.localeCompare(b.program) || a.year - b.year);
}

// --- Table 3: lmi_share_by_program (2018–2022) -----------------------------

const lmi_share_by_program = [];
{
  const byProgramYear = groupBy(inYears, (r) => `${r.program}|${r.year}`);
  // First pass: totals per program-year, suppressing thin cells (<20 records)
  const kept = new Map();
  for (const [key, group] of byProgramYear) {
    if (group.length < 20) continue; // HOME/LIHTC swing wildly on 1-2 projects
    kept.set(key, group);
  }
  // direction: 2022 share vs 2018 share, flat under 2 percentage points
  const shareOf = (key) => {
    const g = kept.get(key);
    if (!g) return null;
    const total = sum(g);
    return total > 0 ? sum(g.filter((r) => r.lmi_flag)) / total : null;
  };
  // Direction spans each program's own first and last *kept* year, so a
  // program that stops reporting is not scored against a year it never had.
  const directions = new Map();
  const spans = new Map();
  for (const program of new Set(records.map((r) => r.program))) {
    const kept_years = YEARS.filter((y) => kept.has(`${program}|${y}`));
    const first = kept_years[0];
    const last = kept_years[kept_years.length - 1];
    let direction = null;
    if (first != null && last != null && first !== last) {
      const delta = shareOf(`${program}|${last}`) - shareOf(`${program}|${first}`);
      direction = Math.abs(delta) < 0.02 ? 'flat' : delta > 0 ? 'improved' : 'weakened';
    }
    directions.set(program, direction);
    spans.set(program, { first, last });
  }
  for (const [key, group] of kept) {
    const [program, year] = key.split('|');
    const total_amount = Math.round(sum(group));
    const lmi_amount = Math.round(sum(group.filter((r) => r.lmi_flag)));
    lmi_share_by_program.push({
      program,
      year: Number(year),
      total_amount,
      lmi_amount,
      lmi_share: total_amount > 0 ? Math.round((lmi_amount / total_amount) * 1000) / 1000 : null,
      direction: directions.get(program),
      direction_from: spans.get(program)?.first ?? null,
      direction_to: spans.get(program)?.last ?? null,
      record_count: group.length,
    });
  }
  lmi_share_by_program.sort((a, b) => a.program.localeCompare(b.program) || a.year - b.year);
}

// --- Table 4: income_mix_by_year (both program scopes) ---------------------

const income_mix_by_year = [];
{
  for (const scope of ['federal_only', 'all_programs']) {
    const rows = inYears.filter(
      (r) => INCOME_ORDER.includes(r.income) && (scope === 'all_programs' || r.program !== CRA),
    );
    const byYear = groupBy(rows, (r) => r.year);
    for (const year of YEARS) {
      const yearRows = byYear.get(year) ?? [];
      const yearTotal = sum(yearRows);
      for (const level of INCOME_ORDER) {
        const group = yearRows.filter((r) => r.income === level);
        income_mix_by_year.push({
          program_scope: scope,
          year,
          programs_reporting: new Set(yearRows.map((r) => r.program)).size,
          tract_income_level: level,
          income_level_order: INCOME_ORDER.indexOf(level), // never sort alphabetically
          total_amount: Math.round(sum(group)),
          share_of_year: yearTotal > 0 ? Math.round((sum(group) / yearTotal) * 1000) / 1000 : null,
          record_count: group.length,
        });
      }
    }
  }
}

// --- Table 5: region_share_by_year (both program scopes) -------------------

const region_share_by_year = [];
{
  for (const scope of ['federal_only', 'all_programs']) {
    const rows = inYears.filter((r) => scope === 'all_programs' || r.program !== CRA);
    const byYear = groupBy(rows, (r) => r.year);
    for (const year of YEARS) {
      const yearRows = byYear.get(year) ?? [];
      const yearTotal = sum(yearRows);
      for (const region of ['Atlanta core', 'Rest of state']) {
        const group = yearRows.filter((r) => r.region === region);
        region_share_by_year.push({
          program_scope: scope,
          year,
          programs_reporting: new Set(yearRows.map((r) => r.program)).size,
          region,
          total_amount: Math.round(sum(group)),
          share_of_year: yearTotal > 0 ? Math.round((sum(group) / yearTotal) * 1000) / 1000 : null,
          record_count: group.length,
        });
      }
    }
  }
}

// --- Table 6: county_year_totals (all 159 counties, zeros included) --------

const place = JSON.parse(readFileSync(join(outDir, 'place-counties.json'), 'utf8'));
const allCounties = place.counties.map((c) => ({ fips: c.fips, name: c.county.replace(/ County$/, '') }));

const county_year_totals = [];
const countyArrowSource = new Map();
{
  const byCountyYear = groupBy(inYears, (r) => `${r.countyFips}|${r.year}`);
  for (const { fips, name } of allCounties) {
    for (const year of YEARS) {
      const group = byCountyYear.get(`${fips}|${year}`) ?? [];
      const total = Math.round(sum(group));
      county_year_totals.push({
        county_name: name,
        county_fips: fips,
        year,
        total_amount: total,
        program_count: new Set(group.map((r) => r.program)).size,
        tract_count: new Set(group.map((r) => r.geoid)).size,
        record_count: group.length,
      });
      // Arrow view uses federal-only dollars: with CRA included, 75 counties
      // clear the bar and the chart becomes the 159-county hairball the
      // threshold exists to avoid.
      if (year === 2018 || year === 2022) {
        const fed = group.filter((r) => r.program !== CRA);
        const cur = countyArrowSource.get(fips) ?? { county_name: name, amount_2018: 0, amount_2022: 0, records: 0 };
        cur[`amount_${year}`] = Math.round(sum(fed));
        cur.records += fed.length;
        countyArrowSource.set(fips, cur);
      }
    }
  }
}

// Narrow arrow-chart view: counties clearing $25M (federal-only) in either year.
const county_arrows = [...countyArrowSource.entries()]
  .filter(([, c]) => c.amount_2018 >= 25_000_000 || c.amount_2022 >= 25_000_000)
  .map(([fips, c]) => ({
    program_scope: 'federal_only',
    county_fips: fips,
    county_name: c.county_name,
    amount_2018: c.amount_2018,
    amount_2022: c.amount_2022,
    change_direction: c.amount_2022 > c.amount_2018 ? 'up' : c.amount_2022 < c.amount_2018 ? 'down' : 'flat',
    record_count: c.records,
  }))
  .sort((a, b) => b.amount_2022 - a.amount_2022);

// --- Supplements: per-county program mix and per-tract yearly totals -------

const county_program_year = [];
for (const [key, group] of groupBy(inYears, (r) => `${r.countyFips}|${r.program}|${r.year}`)) {
  const [county_fips, program, year] = key.split('|');
  county_program_year.push({
    county_fips,
    program,
    year: Number(year),
    total_amount: Math.round(sum(group)),
    record_count: group.length,
  });
}
county_program_year.sort((a, b) => a.county_fips.localeCompare(b.county_fips) || a.program.localeCompare(b.program) || a.year - b.year);

const tract_year_totals = [];
for (const [key, group] of groupBy(inYears, (r) => `${r.geoid}|${r.year}`)) {
  const [geoid, year] = key.split('|');
  tract_year_totals.push({
    geoid,
    year: Number(year),
    total_amount: Math.round(sum(group)),
    programs: [...new Set(group.map((r) => r.program))].sort(),
    record_count: group.length,
  });
}
tract_year_totals.sort((a, b) => a.geoid.localeCompare(b.geoid) || a.year - b.year);

// --- Write -----------------------------------------------------------------

const generatedAt = new Date().toISOString();
const source = 'Community investment programs by census tract (CRA, CDFI, CDBG, HOME, LIHTC, NMTC, HTC, SBA), 2016–2023';

mkdirSync(outDir, { recursive: true });
const tablesPath = join(outDir, 'capital-tables.json');
writeFileSync(tablesPath, JSON.stringify({
  generatedAt,
  source,
  years: YEARS,
  reference_year: REFERENCE_YEAR,
  income_order: INCOME_ORDER,
  atlanta_core: [...ATLANTA_CORE],
  program_coverage,
  program_year_totals,
  program_index,
  lmi_share_by_program,
  income_mix_by_year,
  region_share_by_year,
  county_year_totals,
  county_arrows,
  county_program_year,
}));

const tractsPath = join(outDir, 'capital-tracts.json');
writeFileSync(tractsPath, JSON.stringify({ generatedAt, source, tract_year_totals }));

const kb = (p) => `${Math.round(readFileSync(p).length / 1024)} KB`;
console.log(`Wrote ${tablesPath} (${kb(tablesPath)})`);
console.log('  T0 program_coverage:');
for (const c of program_coverage) {
  console.log(`     ${c.program.padEnd(20)} ${c.first_year}-${c.last_year}  ${String(c.record_count).padStart(6)} rows  $${c.total_amount.toLocaleString()}`);
}
console.log(`  T1 program_year_totals: ${program_year_totals.length} rows`);
console.log(`  T2 program_index:       ${program_index.length} rows`);
console.log(`  T3 lmi_share:           ${lmi_share_by_program.length} rows`);
console.log(`  T4 income_mix:          ${income_mix_by_year.length} rows (2 scopes)`);
console.log(`  T5 region_share:        ${region_share_by_year.length} rows (2 scopes)`);
console.log(`  T6 county_year_totals:  ${county_year_totals.length} rows · arrows: ${county_arrows.length}`);
console.log(`  supplement county_program_year: ${county_program_year.length} rows`);
console.log(`Wrote ${tractsPath} (${kb(tractsPath)}) — ${tract_year_totals.length} tract-year rows`);
