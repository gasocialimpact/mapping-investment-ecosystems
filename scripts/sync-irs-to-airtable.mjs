#!/usr/bin/env node
// Writes IRS identity fields back to the Organizations table in Airtable:
//
//   EIN, EIN Match            — assigned by name (+ city) matching against the
//                               Georgia 990 / Business Master File extracts.
//                               Never overwrites an existing EIN, and never
//                               touches a record whose EIN Match is "Verified".
//   IRS Legal Name, IRS Subsection, NTEE Code, IRS Foundation Status,
//   IRS Ruling Year, IRS Address, IRS Last Synced
//                             — refreshed for every record that has an EIN.
//
// Inputs: public/data/irs990-georgia.json and irs-bmf-georgia.json
// (built by scripts/fetch-990-data.mjs). Airtable is the source of truth for
// the EIN; this script only fills gaps and keeps the derived fields current.
//
//   AIRTABLE_TOKEN=pat... node scripts/sync-irs-to-airtable.mjs [--dry-run] [--plan-out plan.json]
//
// Optional env: AIRTABLE_BASE_ID (default appAi19SJ3WzFEIvj), IRS990_STATE (default GA)

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { matchByName, nameKey } from './fetch-990-data.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const TOKEN = process.env.AIRTABLE_TOKEN;
const BASE_ID = process.env.AIRTABLE_BASE_ID || 'appAi19SJ3WzFEIvj';
const STATE = (process.env.IRS990_STATE || 'GA').toUpperCase();
const ORG_TABLE = 'tblHJEEWGTFNJDzO8';
const API = 'https://api.airtable.com/v0';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const planOut = args.includes('--plan-out') ? args[args.indexOf('--plan-out') + 1] : null;

// Airtable field names (created 2026-09-04; see README "IRS 990 data").
const F = {
  name: 'Org. Name',
  cityLookup: 'city_name (from Location)',
  stateLookup: 'state_id (from Location)',
  ein: 'EIN',
  einMatch: 'EIN Match',
  legalName: 'IRS Legal Name',
  subsection: 'IRS Subsection',
  ntee: 'NTEE Code',
  foundation: 'IRS Foundation Status',
  rulingYear: 'IRS Ruling Year',
  address: 'IRS Address',
  lastSynced: 'IRS Last Synced',
  // Curated columns: filled only when empty, never overwritten.
  streetAddress: 'Street Address',
  website: 'Website',
};

const isPoBox = (s) => /^\s*(P\.?\s*O\.?\s*BOX|POST OFFICE BOX|PMB)\b/i.test(s || '');

// Fill-if-empty values for the curated columns. Street comes from the BMF
// (skipping PO boxes and mail drops); website from the latest 990 header.
function gapFillFor(ein, bmf, f990) {
  const b = bmf.get(ein);
  const n = f990.get(ein);
  const out = {};
  if (b?.street && !isPoBox(b.street)) out[F.streetAddress] = titleCase(b.street);
  if (n?.website) {
    const w = n.website.trim().toLowerCase().replace(/\s+/g, '');
    if (/^[a-z0-9.-]+\.[a-z]{2,}/.test(w.replace(/^https?:\/\//, ''))) {
      out[F.website] = /^https?:\/\//.test(w) ? w : `https://${w}`;
    }
  }
  return out;
}

function titleCase(s) {
  return s
    .toLowerCase()
    .replace(/\b([a-z])/g, (c) => c.toUpperCase())
    .replace(/\b(Ne|Nw|Se|Sw|Po|Ste|Us|Ga)\b/g, (m) => m.toUpperCase());
}
const MATCH_LABEL = { 'name+city': 'Auto: name + city', name: 'Auto: name only' };

if (!TOKEN) {
  console.error('Missing AIRTABLE_TOKEN environment variable.');
  process.exit(1);
}
const headers = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchOrgs() {
  const out = [];
  let offset;
  do {
    const url = new URL(`${API}/${BASE_ID}/${ORG_TABLE}`);
    url.searchParams.set('pageSize', '100');
    for (const f of Object.values(F)) url.searchParams.append('fields[]', f);
    if (offset) url.searchParams.set('offset', offset);
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`Airtable list failed: ${res.status} ${await res.text()}`);
    const json = await res.json();
    out.push(...json.records);
    offset = json.offset;
  } while (offset);
  return out;
}

async function patch(records) {
  for (let i = 0; i < records.length; i += 10) {
    const batch = records.slice(i, i + 10);
    const res = await fetch(`${API}/${BASE_ID}/${ORG_TABLE}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ records: batch, typecast: true }),
    });
    if (!res.ok) throw new Error(`Airtable update failed: ${res.status} ${await res.text()}`);
    await sleep(250); // stay under the 5 req/s limit
  }
}

function loadJson(rel) {
  const p = join(root, rel);
  if (!existsSync(p)) throw new Error(`${rel} not found — run \`npm run fetch-990-data\` first`);
  return JSON.parse(readFileSync(p, 'utf8'));
}

const first = (v) => (Array.isArray(v) ? v[0] ?? null : v ?? null);
const digits = (v) => (v ? String(v).replace(/\D/g, '') : '');
const normEin = (v) => {
  const d = digits(v);
  return d.length === 9 ? d : d.length > 0 && d.length < 9 ? d.padStart(9, '0') : null;
};

function irsFieldsFor(ein, bmf, f990) {
  const b = bmf.get(ein);
  const n = f990.get(ein);
  if (!b && !n) return null;
  const address = b
    ? [b.street, b.city, [STATE, b.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')
    : [n.city, [STATE, n.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return {
    [F.legalName]: b?.name ?? n?.name ?? null,
    [F.subsection]: b?.subsection ?? (n?.is501c3 ? '501(c)(3)' : null),
    [F.ntee]: b?.ntee ?? null,
    [F.foundation]: b?.foundation ?? null,
    [F.rulingYear]: b?.rulingYear ?? null,
    [F.address]: address || null,
  };
}

async function main() {
  const irs990 = loadJson('public/data/irs990-georgia.json');
  const bmfData = loadJson('public/data/irs-bmf-georgia.json');
  const f990 = new Map(irs990.organizations.map((o) => [o.ein, o]));
  const bmf = new Map(bmfData.organizations.map((o) => [o.ein, o]));

  // Name index over both sources (same construction as fetch-990-data.mjs).
  const index = new Map();
  const add = (name, rec) => {
    const k = nameKey(name);
    if (!k) return;
    if (!index.has(k)) index.set(k, []);
    if (!index.get(k).some((x) => x.ein === rec.ein)) index.get(k).push(rec);
  };
  for (const o of irs990.organizations) add(o.name, { ein: o.ein, city: o.city });
  for (const o of bmfData.organizations) add(o.name, { ein: o.ein, city: o.city });

  console.log(`Fetching Organizations from Airtable base ${BASE_ID}…`);
  const recs = await fetchOrgs();
  console.log(`  ${recs.length} records`);

  // 1. Assign EINs where missing.
  const unmatched = recs
    .filter((r) => !normEin(r.fields[F.ein]))
    .filter((r) => {
      const st = first(r.fields[F.stateLookup]);
      return !st || st === STATE || st === '-';
    })
    .map((r) => ({ id: r.id, name: r.fields[F.name], city: first(r.fields[F.cityLookup]) }));
  const matches = matchByName(unmatched, index);
  const matchById = new Map(matches.map((m) => [m.id, m]));

  const updates = [];
  const today = new Date().toISOString().slice(0, 10);
  const stats = { einAssigned: 0, noMatchFlagged: 0, ambiguous: 0, irsRefreshed: 0, gapsFilled: 0, unchanged: 0, verified: 0 };

  for (const r of recs) {
    const f = r.fields;
    const fields = {};
    let ein = normEin(f[F.ein]);
    const verified = f[F.einMatch] === 'Verified';
    if (verified) stats.verified++;

    if (!ein) {
      const m = matchById.get(r.id);
      if (m?.ein) {
        ein = m.ein;
        fields[F.ein] = ein;
        fields[F.einMatch] = MATCH_LABEL[m.confidence];
        stats.einAssigned++;
      } else if (m && !m.ein) {
        stats.ambiguous++;
      } else if (!f[F.einMatch] && unmatched.some((u) => u.id === r.id)) {
        fields[F.einMatch] = 'No match found';
        stats.noMatchFlagged++;
      }
    } else if (f[F.ein] !== ein) {
      fields[F.ein] = ein; // normalize formatting (dashes, spaces)
    }

    if (ein) {
      const irs = irsFieldsFor(ein, bmf, f990);
      if (irs) {
        for (const [k, v] of Object.entries(irs)) {
          const cur = f[k] ?? null;
          if ((v ?? null) !== cur) fields[k] = v;
        }
      }
      // Gap fill: only where the curated column is blank.
      for (const [k, v] of Object.entries(gapFillFor(ein, bmf, f990))) {
        if (!f[k] || !String(f[k]).trim()) {
          fields[k] = v;
          stats.gapsFilled++;
        }
      }
    }

    if (Object.keys(fields).length) {
      fields[F.lastSynced] = today;
      updates.push({ id: r.id, fields, name: f[F.name] });
      if (ein && !fields[F.ein]) stats.irsRefreshed++;
    } else {
      stats.unchanged++;
    }
  }

  console.log('\nPlan:');
  console.log(`  EINs assigned:        ${stats.einAssigned}`);
  console.log(`  flagged no match:     ${stats.noMatchFlagged}`);
  console.log(`  ambiguous (skipped):  ${stats.ambiguous}`);
  console.log(`  IRS fields refreshed: ${stats.irsRefreshed}`);
  console.log(`  blank Street/Website filled: ${stats.gapsFilled}`);
  console.log(`  verified EINs kept:   ${stats.verified}`);
  console.log(`  unchanged:            ${stats.unchanged}`);
  console.log(`  records to update:    ${updates.length}`);

  if (planOut) {
    writeFileSync(planOut, JSON.stringify({ generatedAt: new Date().toISOString(), stats, updates }, null, 2));
    console.log(`Plan written to ${planOut}`);
  }
  if (DRY_RUN) {
    console.log('\n--dry-run: nothing written to Airtable.');
    return;
  }
  if (!updates.length) return;

  await patch(updates.map(({ id, fields }) => ({ id, fields })));
  console.log(`\nUpdated ${updates.length} records in Airtable.`);
}

main().catch((err) => {
  console.error(err.stack || err.message || err);
  process.exit(1);
});
