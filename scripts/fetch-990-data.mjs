#!/usr/bin/env node
// Builds a Georgia extract of IRS Form 990 / 990-EZ e-file returns:
//   public/data/irs990-georgia.json
//
// Source: the rectangular tables produced by the Nonprofit Open Data
// Collective's `ef2` pipeline (external/nodc/ef2) and published by the Urban
// Institute's National Center for Charitable Statistics (NCCS) on S3. One CSV
// per table per tax year, nationwide (~50-90 MB each). We stream them, keep
// only filers whose address is in the target state, and never store the raw
// files. Field labels come from the NODC Master Concordance File
// (external/nodc/irs-efile-master-concordance-file/concordance.csv).
//
// This script only READS from external/nodc/. It never writes there.
//
// Env overrides:
//   IRS990_YEARS=2020-2022   or   IRS990_YEARS=2019,2021   (default: latest 3 available)
//   IRS990_STATE=GA          two-letter state of the filer's address
//   IRS990_BASE_URL=...      alternate host for the parsed tables
//   IRS990_SKIP_MISSION=1    skip the Part III mission table (saves ~50 MB/year)

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outPath = join(root, 'public', 'data', 'irs990-georgia.json');
const ecosystemPath = join(root, 'public', 'data', 'ecosystem.json');
const concordanceLocal = join(root, 'external', 'nodc', 'irs-efile-master-concordance-file', 'concordance.csv');
const concordanceRemote =
  'https://raw.githubusercontent.com/Nonprofit-Open-Data-Collective/irs-efile-master-concordance-file/master/concordance.csv';

const BASE_URL = process.env.IRS990_BASE_URL || 'https://nccs-efile.s3.us-east-1.amazonaws.com/parsed';
const STATE = (process.env.IRS990_STATE || 'GA').toUpperCase();
const SKIP_MISSION = process.env.IRS990_SKIP_MISSION === '1';

const TABLES = {
  header: 'F9-P00-T00-HEADER',
  summary: 'F9-P01-T00-SUMMARY',
  balance: 'F9-P10-T00-BALANCE-SHEET',
  mission: 'F9-P03-T00-MISSION',
};

// IRS Exempt Organizations Business Master File: every currently exempt org
// (including 990-PF and 990-N filers that the e-file tables do not cover),
// with subsection, NTEE and foundation codes. Four regional files, refreshed
// monthly by the IRS. Documented in external/nodc/irs-exempt-org-business-master-file.
const BMF_URLS = [1, 2, 3, 4].map((i) => `https://www.irs.gov/pub/irs-soi/eo${i}.csv`);
const SKIP_BMF = process.env.IRS990_SKIP_BMF === '1';
const bmfOutPath = join(root, 'public', 'data', 'irs-bmf-georgia.json');

// IRS foundation code descriptions (Publication 78 / eo_info.pdf).
const FOUNDATION_CODES = {
  '00': 'Not a 501(c)(3)',
  '02': 'Private operating foundation (exempt from excise tax on investment income)',
  '03': 'Private operating foundation',
  '04': 'Private non-operating foundation',
  '09': 'Suspense',
  '10': 'Church 170(b)(1)(A)(i)',
  '11': 'School 170(b)(1)(A)(ii)',
  '12': 'Hospital or medical research organization 170(b)(1)(A)(iii)',
  '13': 'Organization operating for the benefit of a governmental college or university 170(b)(1)(A)(iv)',
  '14': 'Governmental unit 170(b)(1)(A)(v)',
  '15': 'Public charity: publicly supported 170(b)(1)(A)(vi)',
  '16': 'Public charity: program-service supported 509(a)(2)',
  '17': 'Supporting organization 509(a)(3)',
  '18': 'Public safety testing organization 509(a)(4)',
  '21': 'Supporting organization 509(a)(3) Type I',
  '22': 'Supporting organization 509(a)(3) Type II',
  '23': 'Supporting organization 509(a)(3) Type III functionally integrated',
  '24': 'Supporting organization 509(a)(3) Type III not functionally integrated',
};

// NTEE major groups (first letter of the NTEE code).
const NTEE_MAJOR = {
  A: 'Arts, Culture & Humanities', B: 'Education', C: 'Environment', D: 'Animal-Related',
  E: 'Health Care', F: 'Mental Health & Crisis Intervention', G: 'Voluntary Health Associations & Medical Disciplines',
  H: 'Medical Research', I: 'Crime & Legal-Related', J: 'Employment', K: 'Food, Agriculture & Nutrition',
  L: 'Housing & Shelter', M: 'Public Safety, Disaster Preparedness & Relief', N: 'Recreation & Sports',
  O: 'Youth Development', P: 'Human Services', Q: 'International, Foreign Affairs & National Security',
  R: 'Civil Rights, Social Action & Advocacy', S: 'Community Improvement & Capacity Building',
  T: 'Philanthropy, Voluntarism & Grantmaking Foundations', U: 'Science & Technology',
  V: 'Social Science', W: 'Public & Societal Benefit', X: 'Religion-Related', Y: 'Mutual & Membership Benefit',
  Z: 'Unknown',
};

const subsectionLabel = (code) => {
  const n = Number(code);
  if (!Number.isFinite(n) || n === 0) return null;
  if (n === 40) return '501(d)';
  if (n === 50) return '501(e)';
  if (n === 60) return '501(f)';
  if (n === 70) return '501(k)';
  if (n === 71) return '501(n)';
  if (n === 81) return '501(c)(29)';
  if (n === 82) return '527';
  return `501(c)(${n})`;
};

// Variables we carry through, keyed by the name they get in our JSON.
// The right-hand names are NODC concordance variable names (see data dictionary).
const HEADER_VARS = {
  city: 'F9_00_ORG_ADDR_CITY',
  zip: 'F9_00_ORG_ADDR_ZIP',
  website: 'F9_00_ORG_WEBSITE',
  yearFormation: 'F9_00_YEAR_FORMATION',
  is501c3: 'F9_00_EXEMPT_STAT_501C3_X',
  groupReturn: 'F9_00_GROUP_RETURN_AFFIL_X',
  periodEnd: 'F9_00_TAX_PERIOD_END_DATE',
  returnTimestamp: 'F9_00_RETURN_TIME_STAMP',
};
const SUMMARY_VARS = {
  employees: 'F9_01_ACT_GVRN_EMPL_TOT',
  volunteers: 'F9_01_ACT_GVRN_VOL_TOT',
  contributions: 'F9_01_REV_CONTR_TOT_CY',
  programRevenue: 'F9_01_REV_PROG_TOT_CY',
  investmentIncome: 'F9_01_REV_INVEST_TOT_CY',
  revenue: 'F9_01_REV_TOT_CY',
  grantsPaid: 'F9_01_EXP_GRANT_SIMILAR_CY',
  salaries: 'F9_01_EXP_SAL_ETC_CY',
  expenses: 'F9_01_EXP_TOT_CY',
  netIncome: 'F9_01_EXP_REV_LESS_EXP_CY',
  assetsEOY: 'F9_01_NAFB_ASSET_TOT_EOY',
  liabilitiesEOY: 'F9_01_NAFB_LIAB_TOT_EOY',
  netAssetsEOY: 'F9_01_NAFB_TOT_EOY',
};
// Part X balance sheet (full 990 only; 990-EZ has no Part X). End-of-year
// values. These are the investment-side details the Financials layer shows.
const BALANCE_VARS = {
  cashEOY: 'F9_10_ASSET_CASH_EOY',
  savingsEOY: 'F9_10_ASSET_SAVING_EOY',
  cashAndSavingsEOY: 'F9_10_ASSET_CASH_SAVING_EOY',
  pledgesReceivableEOY: 'F9_10_ASSET_PLEDGE_NET_EOY',
  notesLoansReceivableEOY: 'F9_10_ASSET_NOTE_LOAN_NET_EOY',
  landBuildingsNetEOY: 'F9_10_ASSET_LAND_BLDG_NET_EOY',
  investPublicSecuritiesEOY: 'F9_10_ASSET_INVEST_SEC_EOY',
  investOtherSecuritiesEOY: 'F9_10_ASSET_INVEST_SEC_OTH_EOY',
  investProgramRelatedEOY: 'F9_10_ASSET_INVEST_PROG_RLTD_EOY',
  otherAssetsEOY: 'F9_10_ASSET_OTH_EOY',
  grantsPayableEOY: 'F9_10_LIAB_GRANT_PAYABLE_EOY',
  taxExemptBondsEOY: 'F9_10_LIAB_TAX_EXEMPT_BOND_EOY',
  mortgagesNotesPayableEOY: 'F9_10_LIAB_MTG_NOTE_EOY',
  unsecuredNotesPayableEOY: 'F9_10_LIAB_NOTE_UNSEC_EOY',
  netAssetsUnrestrictedEOY: 'F9_10_NAFB_UNRESTRICT_EOY',
  netAssetsTempRestrictedEOY: 'F9_10_NAFB_RESTRICT_TEMP_EOY',
  netAssetsPermRestrictedEOY: 'F9_10_NAFB_RESTRICT_PERM_EOY',
};
const MISSION_VAR = 'F9_03_ORG_MISSION_PURPOSE';
const MISSION_MAX_CHARS = 600;

// ---------------------------------------------------------------------------
// Streaming CSV reader. Handles quoted fields, "" escapes, embedded newlines,
// CRLF, and quote characters that straddle chunk boundaries. Calls onHeader
// once with the column array, then onRow(cells) for every record.
async function streamCsv(url, onHeader, onRow, label = url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed for ${label}: ${res.status} ${res.statusText}`);
  const total = Number(res.headers.get('content-length')) || 0;
  const decoder = new TextDecoder('utf-8');

  let field = '';
  let row = [];
  let inQuotes = false;
  let quoteSeen = false; // saw a `"` inside quotes; waiting to see if it is doubled
  let header = null;
  let rows = 0;
  let bytes = 0;
  let lastLog = Date.now();

  const endField = () => {
    row.push(field);
    field = '';
  };
  const endRow = () => {
    endField();
    if (!header) {
      header = row;
      onHeader(header);
    } else if (!(row.length === 1 && row[0] === '')) {
      rows++;
      onRow(row);
    }
    row = [];
  };

  const consume = (text) => {
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQuotes) {
        if (quoteSeen) {
          quoteSeen = false;
          if (ch === '"') {
            field += '"';
            continue;
          }
          inQuotes = false; // the quote closed the field; fall through to unquoted handling
        } else {
          if (ch === '"') quoteSeen = true;
          else field += ch;
          continue;
        }
      }
      if (ch === '"' && field === '') inQuotes = true;
      else if (ch === ',') endField();
      else if (ch === '\n') endRow();
      else if (ch !== '\r') field += ch;
    }
  };

  for await (const chunk of res.body) {
    bytes += chunk.length;
    consume(decoder.decode(chunk, { stream: true }));
    if (total && Date.now() - lastLog > 5000) {
      lastLog = Date.now();
      process.stdout.write(`    ${label}: ${Math.round((bytes / total) * 100)}% (${rows.toLocaleString()} rows)\n`);
    }
  }
  consume(decoder.decode());
  if (quoteSeen) inQuotes = false;
  if (field !== '' || row.length) endRow();
  return rows;
}

const clean = (v) => (v === undefined || v === '' || v === 'NA' ? null : v);
const num = (v) => {
  const c = clean(v);
  if (c === null) return null;
  const n = Number(c);
  return Number.isFinite(n) ? n : null;
};
const flag = (v) => {
  const c = clean(v);
  return c === null ? false : c === 'X' || c.toLowerCase() === 'true' || c === '1';
};
const padEin = (v) => {
  const c = clean(v);
  return c ? c.replace(/\D/g, '').padStart(9, '0') : null;
};

function columnPicker(header, wanted) {
  const idx = {};
  for (const [key, col] of Object.entries(wanted)) {
    const i = header.indexOf(col);
    if (i === -1) throw new Error(`Column ${col} not found in table (header has ${header.length} columns)`);
    idx[key] = i;
  }
  return idx;
}

// ---------------------------------------------------------------------------
// Year discovery: newest tax year whose HEADER table exists on the host.
async function latestAvailableYear() {
  const thisYear = new Date().getUTCFullYear();
  for (let y = thisYear; y >= 2009; y--) {
    const res = await fetch(`${BASE_URL}/${TABLES.header}-${y}.csv`, { method: 'HEAD' });
    if (res.ok) return y;
  }
  throw new Error(`No ${TABLES.header} tables found at ${BASE_URL}`);
}

function parseYears(spec, latest) {
  if (!spec) return [latest - 2, latest - 1, latest];
  const m = spec.match(/^(\d{4})-(\d{4})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    return Array.from({ length: b - a + 1 }, (_, i) => a + i);
  }
  return spec.split(',').map((s) => Number(s.trim())).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Concordance: variable_name -> { label, description, location }.
async function loadConcordance(vars) {
  let src;
  let from;
  if (existsSync(concordanceLocal)) {
    src = readFileSync(concordanceLocal, 'utf8');
    from = 'external/nodc/irs-efile-master-concordance-file/concordance.csv (submodule)';
  } else {
    const res = await fetch(concordanceRemote);
    if (!res.ok) throw new Error(`Concordance fetch failed: ${res.status}`);
    src = await res.text();
    from = concordanceRemote + ' (submodule not checked out)';
  }
  console.log(`Concordance from ${from}`);

  const want = new Set(vars);
  const fields = {};
  parseCsvString(src, (header, row) => {
    const get = (c) => row[header.indexOf(c)];
    const name = get('variable_name');
    if (!want.has(name) || fields[name]) return;
    fields[name] = {
      label: clean(get('label')),
      description: clean(get('description')),
      location: clean(get('location_code')),
      table: clean(get('rdb_table')),
    };
  });
  return fields;
}

// Small in-memory CSV parser (same grammar as streamCsv) for the concordance.
function parseCsvString(text, onRow) {
  let header = null;
  let field = '';
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
      continue;
    }
    if (ch === '"' && field === '') inQuotes = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      field = '';
      if (!header) header = row;
      else if (!(row.length === 1 && row[0] === '')) onRow(header, row);
      row = [];
    } else if (ch !== '\r') field += ch;
  }
  if (field !== '' || row.length) {
    row.push(field);
    if (header) onRow(header, row);
  }
}

// ---------------------------------------------------------------------------
// Name normalization for matching ecosystem organizations to filers.
const STOPWORDS = new Set(['INC', 'INCORPORATED', 'LLC', 'CORP', 'CORPORATION', 'CO', 'LTD', 'THE', 'OF']);
function nameKey(name) {
  if (!name) return '';
  return name
    .toUpperCase()
    .replace(/&/g, ' AND ')
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w))
    .join(' ');
}
const cityKey = (c) => (c ? c.toUpperCase().replace(/[^A-Z]/g, '') : '');

// Match a list of {id, name, city} records against an index of
// nameKey -> [{ein, city, ...}]. Shared with scripts/sync-irs-to-airtable.mjs.
export function matchByName(records, index) {
  const matches = [];
  for (const o of records) {
    const hits = index.get(nameKey(o.name));
    if (!hits || !hits.length) continue;
    const sameCity = hits.filter((h) => cityKey(h.city) === cityKey(o.city));
    if (sameCity.length === 1) matches.push({ id: o.id, ein: sameCity[0].ein, confidence: 'name+city' });
    else if (hits.length === 1) matches.push({ id: o.id, ein: hits[0].ein, confidence: 'name' });
    else matches.push({ id: o.id, ein: null, candidates: hits.map((h) => h.ein), confidence: 'ambiguous' });
  }
  return matches;
}

function matchEcosystem(index) {
  if (!existsSync(ecosystemPath)) return { matches: [], considered: 0 };
  const eco = JSON.parse(readFileSync(ecosystemPath, 'utf8'));
  const candidates = (eco.organizations || []).filter((o) => !o.state || o.state === STATE || o.state === '-');
  const matches = matchByName(candidates, index).map(({ id, ...m }) => ({ orgId: id, ...m }));
  return { matches, considered: candidates.length };
}

// Business Master File pass: stream all four regional files, keep in-state rows.
async function loadBmf() {
  const bmf = new Map();
  let pick;
  for (const url of BMF_URLS) {
    let kept = 0;
    const total = await streamCsv(
      url,
      (h) => {
        pick = columnPicker(h, {
          ein: 'EIN', name: 'NAME', street: 'STREET', city: 'CITY', state: 'STATE', zip: 'ZIP',
          subsection: 'SUBSECTION', classification: 'CLASSIFICATION', ruling: 'RULING',
          deductibility: 'DEDUCTIBILITY', foundation: 'FOUNDATION', organization: 'ORGANIZATION',
          status: 'STATUS', taxPeriod: 'TAX_PERIOD', filingReq: 'FILING_REQ_CD', pfFilingReq: 'PF_FILING_REQ_CD',
          assetAmt: 'ASSET_AMT', incomeAmt: 'INCOME_AMT', revenueAmt: 'REVENUE_AMT', ntee: 'NTEE_CD',
        });
      },
      (r) => {
        if ((clean(r[pick.state]) || '').toUpperCase() !== STATE) return;
        const ein = padEin(r[pick.ein]);
        if (!ein) return;
        kept++;
        const ruling = clean(r[pick.ruling]);
        const ntee = clean(r[pick.ntee]);
        const foundation = clean(r[pick.foundation]);
        bmf.set(ein, {
          ein,
          name: clean(r[pick.name]),
          street: clean(r[pick.street]),
          city: clean(r[pick.city]),
          zip: (clean(r[pick.zip]) || '').slice(0, 5) || null,
          subsection: subsectionLabel(r[pick.subsection]),
          subsectionCode: clean(r[pick.subsection]),
          classification: clean(r[pick.classification]),
          rulingYear: ruling && ruling.length >= 4 ? Number(ruling.slice(0, 4)) || null : null,
          deductible: clean(r[pick.deductibility]) === '1',
          foundationCode: foundation,
          foundation: foundation ? FOUNDATION_CODES[foundation] || `Code ${foundation}` : null,
          organizationCode: clean(r[pick.organization]),
          status: clean(r[pick.status]),
          ntee,
          nteeMajor: ntee ? NTEE_MAJOR[ntee[0]] || null : null,
          filingReq: clean(r[pick.filingReq]),
          pfFilingReq: clean(r[pick.pfFilingReq]),
          taxPeriod: clean(r[pick.taxPeriod]),
          assets: num(r[pick.assetAmt]),
          income: num(r[pick.incomeAmt]),
          revenue: num(r[pick.revenueAmt]),
        });
      },
      url.split('/').pop(),
    );
    console.log(`  ${url.split('/').pop()}: ${total.toLocaleString()} orgs, ${kept.toLocaleString()} in ${STATE}`);
  }
  return bmf;
}

function submoduleCommit(rel) {
  try {
    return execSync(`git -C ${JSON.stringify(join(root, rel))} rev-parse HEAD`, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
async function main() {
  const latest = await latestAvailableYear();
  const years = parseYears(process.env.IRS990_YEARS, latest);
  console.log(`Latest tax year on host: ${latest}. Building ${STATE} extract for ${years.join(', ')}.`);

  // filings: objectId -> filing record; orgs: ein -> org record
  const filingsByObject = new Map();
  const orgs = new Map();
  const filingsByYear = {}; // taxYear -> { nationwide, inState }; a low nationwide count means NCCS has only partially published that year

  for (const year of years) {
    console.log(`\n== Tax year ${year}`);

    // 1. HEADER: identity + address. Establishes the set of in-state filings.
    let pick;
    let kept = 0;
    const headerUrl = `${BASE_URL}/${TABLES.header}-${year}.csv`;
    const total = await streamCsv(
      headerUrl,
      (h) => {
        pick = columnPicker(h, {
          objectId: 'OBJECTID',
          ein: 'ORG_EIN',
          name1: 'ORG_NAME_L1',
          name2: 'ORG_NAME_L2',
          form: 'RETURN_TYPE',
          taxYear: 'TAX_YEAR',
          state: 'F9_00_ORG_ADDR_STATE',
          ...HEADER_VARS,
        });
      },
      (r) => {
        if ((clean(r[pick.state]) || '').toUpperCase() !== STATE) return;
        const ein = padEin(r[pick.ein]);
        if (!ein) return;
        const form = clean(r[pick.form]);
        if (form !== '990' && form !== '990EZ') return; // ef2 tables cover 990 and 990-EZ only
        kept++;
        const objectId = r[pick.objectId];
        const name = [clean(r[pick.name1]), clean(r[pick.name2])].filter(Boolean).join(' ');
        filingsByObject.set(objectId, {
          objectId,
          ein,
          name,
          form,
          taxYear: num(r[pick.taxYear]) ?? year,
          periodEnd: clean(r[pick.periodEnd]),
          returnTimestamp: clean(r[pick.returnTimestamp]),
          city: clean(r[pick.city]),
          zip: (clean(r[pick.zip]) || '').slice(0, 5) || null,
          website: clean(r[pick.website]),
          yearFormation: num(r[pick.yearFormation]),
          is501c3: flag(r[pick.is501c3]),
          groupReturn: flag(r[pick.groupReturn]),
          fin: {},
          mission: null,
        });
      },
      `${TABLES.header}-${year}`,
    );
    console.log(`  HEADER: ${total.toLocaleString()} filings nationwide, ${kept.toLocaleString()} in ${STATE}`);
    filingsByYear[year] = { nationwide: total, inState: kept };

    // 2. SUMMARY (Part I): the core financials. 990-EZ Part I is mapped onto
    //    the same variables by the concordance, so one pass covers both forms.
    let spick;
    let matched = 0;
    await streamCsv(
      `${BASE_URL}/${TABLES.summary}-${year}.csv`,
      (h) => {
        spick = columnPicker(h, { objectId: 'OBJECTID', ...SUMMARY_VARS });
      },
      (r) => {
        const f = filingsByObject.get(r[spick.objectId]);
        if (!f) return;
        matched++;
        for (const key of Object.keys(SUMMARY_VARS)) f.fin[key] = num(r[spick[key]]);
      },
      `${TABLES.summary}-${year}`,
    );
    console.log(`  SUMMARY: financials attached to ${matched.toLocaleString()} of ${kept.toLocaleString()} filings`);

    // 3. BALANCE SHEET (Part X): investment holdings, receivables, debt, net
    //    asset classes. Full 990 filers only.
    let bpick;
    let balanced = 0;
    await streamCsv(
      `${BASE_URL}/${TABLES.balance}-${year}.csv`,
      (h) => {
        bpick = columnPicker(h, { objectId: 'OBJECTID', ...BALANCE_VARS });
      },
      (r) => {
        const f = filingsByObject.get(r[bpick.objectId]);
        if (!f) return;
        balanced++;
        for (const key of Object.keys(BALANCE_VARS)) f.fin[key] = num(r[bpick[key]]);
        // Older schemas report cash and savings as one line; newer ones split them.
        if (f.fin.cashAndSavingsEOY === null && (f.fin.cashEOY !== null || f.fin.savingsEOY !== null)) {
          f.fin.cashAndSavingsEOY = (f.fin.cashEOY || 0) + (f.fin.savingsEOY || 0);
        }
        delete f.fin.cashEOY;
        delete f.fin.savingsEOY;
      },
      `${TABLES.balance}-${year}`,
    );
    console.log(`  BALANCE SHEET: Part X attached to ${balanced.toLocaleString()} filings`);

    // 4. MISSION (Part III): mission statement text.
    if (!SKIP_MISSION) {
      let mpick;
      let withMission = 0;
      await streamCsv(
        `${BASE_URL}/${TABLES.mission}-${year}.csv`,
        (h) => {
          mpick = columnPicker(h, { objectId: 'OBJECTID', mission: MISSION_VAR });
        },
        (r) => {
          const f = filingsByObject.get(r[mpick.objectId]);
          if (!f) return;
          const m = clean(r[mpick.mission]);
          if (!m) return;
          withMission++;
          f.mission = m.replace(/\s+/g, ' ').trim().slice(0, MISSION_MAX_CHARS);
        },
        `${TABLES.mission}-${year}`,
      );
      console.log(`  MISSION: text for ${withMission.toLocaleString()} filings`);
    }
  }

  // Collapse filings into organizations. One filing per EIN + tax year; when an
  // org filed more than once for a year (amendments), keep the latest return.
  const byEinYear = new Map();
  for (const f of filingsByObject.values()) {
    const k = `${f.ein}|${f.taxYear}`;
    const prev = byEinYear.get(k);
    if (!prev || (f.returnTimestamp || '') > (prev.returnTimestamp || '')) byEinYear.set(k, f);
  }
  let dropped = filingsByObject.size - byEinYear.size;

  for (const f of byEinYear.values()) {
    let o = orgs.get(f.ein);
    if (!o) {
      o = { ein: f.ein, name: null, city: null, zip: null, website: null, yearFormation: null, is501c3: false, mission: null, latestTaxYear: -1, filings: [] };
      orgs.set(f.ein, o);
    }
    o.filings.push({
      taxYear: f.taxYear,
      form: f.form,
      periodEnd: f.periodEnd,
      groupReturn: f.groupReturn || undefined,
      ...f.fin,
    });
    if (f.taxYear > o.latestTaxYear) {
      o.latestTaxYear = f.taxYear;
      o.name = f.name;
      o.city = f.city;
      o.zip = f.zip;
      o.website = f.website;
      o.yearFormation = f.yearFormation;
      o.is501c3 = f.is501c3;
      o.mission = f.mission;
    }
  }
  const organizations = [...orgs.values()]
    .map((o) => ({ ...o, nameKey: nameKey(o.name), filings: o.filings.sort((a, b) => a.taxYear - b.taxYear) }))
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  // Business Master File: IRS codes for every in-state exempt org, and the
  // superset used for name matching (covers foundations and small filers).
  let bmf = new Map();
  if (!SKIP_BMF) {
    console.log('\n== IRS Business Master File');
    bmf = await loadBmf();
  }
  for (const o of organizations) {
    const b = bmf.get(o.ein);
    if (!b) continue;
    o.irs = {
      legalName: b.name,
      subsection: b.subsection,
      ntee: b.ntee,
      nteeMajor: b.nteeMajor,
      foundation: b.foundation,
      foundationCode: b.foundationCode,
      rulingYear: b.rulingYear,
    };
  }

  // Crosswalk to ecosystem.json organizations by normalized name (+ city).
  // One index over both sources: an EIN appears once, with its 990 name and
  // its BMF name both pointing at it.
  const index = new Map();
  const addToIndex = (name, rec) => {
    const k = nameKey(name);
    if (!k) return;
    if (!index.has(k)) index.set(k, []);
    const arr = index.get(k);
    if (!arr.some((x) => x.ein === rec.ein)) arr.push(rec);
  };
  for (const o of organizations) addToIndex(o.name, { ein: o.ein, city: o.city, in990: true });
  for (const b of bmf.values()) addToIndex(b.name, { ein: b.ein, city: b.city, in990: orgs.has(b.ein) });
  const { matches, considered } = matchEcosystem(index);
  for (const m of matches) if (m.ein) m.in990 = orgs.has(m.ein);

  const fields = await loadConcordance([
    ...Object.values(HEADER_VARS), ...Object.values(SUMMARY_VARS), ...Object.values(BALANCE_VARS), MISSION_VAR,
  ]);

  const out = {
    generatedAt: new Date().toISOString(),
    state: STATE,
    taxYears: years,
    source: {
      description:
        'IRS Form 990 and 990-EZ e-file returns, parsed into rectangular tables by the Nonprofit Open Data Collective ef2 pipeline and published by the Urban Institute National Center for Charitable Statistics (NCCS).',
      tables: Object.values(TABLES).filter((t) => !(SKIP_MISSION && t === TABLES.mission)),
      baseUrl: BASE_URL,
      dataDictionary: 'https://nonprofit-open-data-collective.github.io/irs990efile/data-dictionary/data-dictionary.html',
      concordanceLicense: 'ODC-By 1.0',
      citation: [
        'Lecy, J. (2025). The irs990efile Package for R (v1.0.0). Zenodo. https://doi.org/10.5281/zenodo.14736813',
        'Lecy, J. (2024). IRS 990 Efiler Concordance File (v1.0.0) [Data set]. Zenodo. https://doi.org/10.5281/zenodo.14544301',
      ],
      nodcCommits: {
        ef2: submoduleCommit('external/nodc/ef2'),
        concordance: submoduleCommit('external/nodc/irs-efile-master-concordance-file'),
      },
      notes: [
        'Filers are selected by the organization address state on the return header.',
        'Private foundations (990-PF) and 990-N postcard filers are not included in these tables.',
        'One filing per EIN per tax year; amended returns replace the original when the return timestamp is later.',
        'Mission text is from the latest filing and is truncated to ' + MISSION_MAX_CHARS + ' characters.',
        'nameKey is an uppercase, punctuation-free, stopword-free form of the name for joining.',
        'Keys with no reported value are omitted. Compare counts.filingsByYear.nationwide across years: a much lower figure means NCCS has published only part of that tax year so far.',
      ],
    },
    fieldMap: {
      header: HEADER_VARS,
      filing: { ...SUMMARY_VARS, ...BALANCE_VARS },
      mission: MISSION_VAR,
    },
    fields,
    counts: {
      organizations: organizations.length,
      filings: byEinYear.size,
      filingsByYear,
      duplicateFilingsDropped: dropped,
      ecosystemOrgsConsidered: considered,
      ecosystemMatches: matches.filter((m) => m.ein).length,
      ecosystemAmbiguous: matches.filter((m) => !m.ein).length,
      bmfOrganizations: bmf.size,
      organizationsWithIrsCodes: organizations.filter((o) => o.irs).length,
    },
    ecosystemMatches: matches,
    organizations,
  };

  mkdirSync(dirname(outPath), { recursive: true });
  // Null-valued keys are omitted to keep the file small; consumers should
  // treat a missing key as "not reported".
  writeFileSync(outPath, JSON.stringify(out, (_k, v) => (v === null ? undefined : v)));
  const kb = (p) => Math.round(readFileSync(p).length / 1024).toLocaleString();
  console.log(`\nWrote ${outPath} (${kb(outPath)} KB)`);
  console.log(`  ${out.counts.organizations.toLocaleString()} organizations, ${out.counts.filings.toLocaleString()} filings, ${out.counts.organizationsWithIrsCodes.toLocaleString()} with BMF codes`);
  console.log(`  ecosystem crosswalk: ${out.counts.ecosystemMatches} matched, ${out.counts.ecosystemAmbiguous} ambiguous, of ${considered} considered`);

  if (!SKIP_BMF) {
    const bmfOut = {
      generatedAt: out.generatedAt,
      state: STATE,
      source: {
        description: 'IRS Exempt Organizations Business Master File extract, all currently exempt organizations in the state. Financial amounts are the most recent the IRS has on file and may lag the 990 tables.',
        urls: BMF_URLS,
        documentation: 'https://www.irs.gov/pub/irs-soi/eo_info.pdf',
        codes: { foundation: FOUNDATION_CODES, nteeMajor: NTEE_MAJOR },
      },
      counts: { organizations: bmf.size, with990Filings: [...bmf.keys()].filter((e) => orgs.has(e)).length },
      organizations: [...bmf.values()].sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    };
    writeFileSync(bmfOutPath, JSON.stringify(bmfOut, (_k, v) => (v === null ? undefined : v)));
    console.log(`Wrote ${bmfOutPath} (${kb(bmfOutPath)} KB) — ${bmf.size.toLocaleString()} exempt organizations`);
  }
}

// Only run when executed directly; sync-irs-to-airtable.mjs imports helpers.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error(err.stack || err.message || err);
    process.exit(1);
  });
}

export { nameKey, cityKey };
