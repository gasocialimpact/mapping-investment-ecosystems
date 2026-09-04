#!/usr/bin/env node
// Merges the "Comprehensive Organizational Record Directory" table in the
// Data Libraries base into an Organizations table, field by field.
//
// Rules:
//   - match by normalized organization name (same key as the IRS sync)
//   - new names are CREATED as new organizations
//   - blank target fields are FILLED from the source
//   - a non-blank target value that disagrees with the source is a CONFLICT:
//     reported, never changed (the target is the source of truth)
//
// Safe by default: runs as a dry run and refuses to write to the production
// base unless --allow-production is passed. Point TARGET_BASE_ID at a
// duplicate of the production base to rehearse.
//
//   AIRTABLE_TOKEN=pat... TARGET_BASE_ID=appSandbox node scripts/merge-data-libraries.mjs            # dry run + plan file
//   AIRTABLE_TOKEN=pat... TARGET_BASE_ID=appSandbox node scripts/merge-data-libraries.mjs --apply    # create + fill
//
// Optional env: SOURCE_BASE_ID (default app8doAbLp1Zlz0Ca), SOURCE_TABLE,
// TARGET_ORG_TABLE, TARGET_LOCATION_TABLE (names; resolved via the metadata API),
// PLAN_OUT (default merge-plan.json in the working directory).

import { writeFileSync } from 'node:fs';
import { nameKey, cityKey } from './fetch-990-data.mjs';

const TOKEN = process.env.AIRTABLE_TOKEN;
const SOURCE_BASE = process.env.SOURCE_BASE_ID || 'app8doAbLp1Zlz0Ca';
const SOURCE_TABLE = process.env.SOURCE_TABLE || 'Comprehensive Organizational Record Directory';
const TARGET_BASE = process.env.TARGET_BASE_ID;
const TARGET_ORG_TABLE = process.env.TARGET_ORG_TABLE || 'Organizations';
const TARGET_LOC_TABLE = process.env.TARGET_LOCATION_TABLE || 'Location';
const PRODUCTION_BASE = 'appAi19SJ3WzFEIvj';
const PLAN_OUT = process.env.PLAN_OUT || 'merge-plan.json';
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const ALLOW_PROD = args.includes('--allow-production');
// Source rows that carry nothing but a name are listed for review, not created,
// unless --include-bare is passed. Most of them are national funders with no
// description, URL, type or location in the source either.
const INCLUDE_BARE = args.includes('--include-bare');

if (!TOKEN) die('Missing AIRTABLE_TOKEN.');
if (!TARGET_BASE) die('Missing TARGET_BASE_ID (use the sandbox copy of the production base).');
if (TARGET_BASE === PRODUCTION_BASE && APPLY && !ALLOW_PROD) {
  die('TARGET_BASE_ID is the production base. Rehearse on a duplicate first, or pass --allow-production.');
}

// Source column -> target column. Values flow only into blank target cells.
const FIELD_MAP = {
  'Org. Description': 'Description/focus',
  'Org. URL': 'Website',
  'Ecosystem Segment': 'Segment',
  'Org. Type': 'Org. Type',
  'Street Address': 'Street Address',
  'EIN/TIN': 'EIN',
  'Organizational Hierarchy': 'Organizational Hierarchy',
};
const SELECT_FIELDS = new Set(['Segment', 'Org. Type', 'Organizational Hierarchy']);
// Source self-links ("Related Organizations") map onto the target's own
// self-link field, resolved by organization name after creates are known.
const SOURCE_RELATED = 'Related Organizations';
const TARGET_RELATED = 'Organizations (Nested)';

const API = 'https://api.airtable.com/v0';
const headers = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function die(msg) {
  console.error(msg);
  process.exit(1);
}

async function tables(baseId) {
  const res = await fetch(`${API}/meta/bases/${baseId}/tables`, { headers });
  if (!res.ok) throw new Error(`Schema fetch failed for ${baseId}: ${res.status} ${await res.text()}`);
  return (await res.json()).tables;
}
function tableByName(list, name) {
  const t = list.find((x) => x.name.toLowerCase() === name.toLowerCase());
  if (!t) throw new Error(`Table "${name}" not found (have: ${list.map((x) => x.name).join(', ')})`);
  return t;
}
async function records(baseId, tableId) {
  const out = [];
  let offset;
  do {
    const url = new URL(`${API}/${baseId}/${tableId}`);
    url.searchParams.set('pageSize', '100');
    if (offset) url.searchParams.set('offset', offset);
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`Records fetch failed for ${tableId}: ${res.status} ${await res.text()}`);
    const json = await res.json();
    out.push(...json.records);
    offset = json.offset;
    await sleep(210);
  } while (offset);
  return out;
}
async function write(baseId, tableId, method, rows) {
  for (let i = 0; i < rows.length; i += 10) {
    const res = await fetch(`${API}/${baseId}/${tableId}`, {
      method,
      headers,
      body: JSON.stringify({ records: rows.slice(i, i + 10), typecast: false }),
    });
    if (!res.ok) throw new Error(`Airtable ${method} failed: ${res.status} ${await res.text()}`);
    await sleep(250);
  }
}

const first = (v) => (Array.isArray(v) ? v[0] ?? null : v ?? null);
const text = (v) => {
  const s = first(v);
  return s === null || s === undefined ? '' : String(typeof s === 'object' && s.name ? s.name : s).trim();
};
const normEin = (v) => {
  const d = text(v).replace(/\D/g, '');
  return d.length === 9 ? d : '';
};
const normUrl = (v) => text(v).toLowerCase().replace(/\/+$/, '').replace(/^https?:\/\/(www\.)?/, '');
const same = (field, a, b) => {
  if (field === 'Website') return normUrl(a) === normUrl(b);
  if (field === 'EIN') return normEin(a) === normEin(b);
  return text(a).toLowerCase().replace(/\s+/g, ' ') === text(b).toLowerCase().replace(/\s+/g, ' ');
};

async function main() {
  console.log(`Source: ${SOURCE_BASE} / ${SOURCE_TABLE}`);
  console.log(`Target: ${TARGET_BASE}${TARGET_BASE === PRODUCTION_BASE ? ' (PRODUCTION)' : ' (sandbox)'} / ${TARGET_ORG_TABLE}`);
  const [srcTables, tgtTables] = await Promise.all([tables(SOURCE_BASE), tables(TARGET_BASE)]);
  const srcT = tableByName(srcTables, SOURCE_TABLE);
  const orgT = tableByName(tgtTables, TARGET_ORG_TABLE);
  const locT = tableByName(tgtTables, TARGET_LOC_TABLE);
  const choices = {};
  for (const f of orgT.fields) if (f.options?.choices) choices[f.name] = new Set(f.options.choices.map((c) => c.name));
  if (!orgT.fields.some((f) => f.name === 'Organizational Hierarchy')) {
    if (!APPLY) console.log('  note: target lacks "Organizational Hierarchy"; it will be created on --apply');
    else {
      const res = await fetch(`${API}/meta/bases/${TARGET_BASE}/tables/${orgT.id}/fields`, {
        method: 'POST', headers,
        body: JSON.stringify({ name: 'Organizational Hierarchy', type: 'singleSelect', options: { choices: [{ name: 'Parent or Holding Company' }, { name: 'Subsidiary or Related Entity' }] } }),
      });
      if (!res.ok) throw new Error(`Could not create Organizational Hierarchy field: ${res.status} ${await res.text()}`);
      choices['Organizational Hierarchy'] = new Set(['Parent or Holding Company', 'Subsidiary or Related Entity']);
    }
  }
  const srcNameById = new Map();

  const [src, tgt, locs] = await Promise.all([records(SOURCE_BASE, srcT.id), records(TARGET_BASE, orgT.id), records(TARGET_BASE, locT.id)]);
  console.log(`  ${src.length} source rows, ${tgt.length} target organizations, ${locs.length} target locations`);

  for (const r of src) srcNameById.set(r.id, text(r.fields['Org. Name']));
  const relatedPlan = []; // { sourceName, relatedNames[] } resolved after creates
  const tgtByKey = new Map();
  for (const r of tgt) {
    const k = nameKey(r.fields['Org. Name']);
    if (k && !tgtByKey.has(k)) tgtByKey.set(k, r);
  }
  const locByKey = new Map();
  for (const l of locs) {
    const k = `${cityKey(l.fields.city_name)}|${text(l.fields.state_id).toUpperCase()}`;
    if (!locByKey.has(k)) locByKey.set(k, l.id);
  }

  const plan = { creates: [], bare: [], fills: [], conflicts: [], skipped: [], missingLocations: [], unknownChoices: [] };
  const seen = new Set();

  for (const s of src) {
    const f = s.fields;
    const name = text(f['Org. Name']);
    const k = nameKey(name);
    if (!k) continue;
    if (seen.has(k)) {
      plan.skipped.push({ name, reason: 'duplicate name inside source' });
      continue;
    }
    seen.add(k);

    // Location: source has city_name / state_id lookups; map to a target Locations record.
    const city = text(f['city_name (from Location)']) || text(f['City']);
    const state = text(f['state_id (from Location)']).toUpperCase();
    const locId = city ? locByKey.get(`${cityKey(city)}|${state}`) ?? null : null;
    if (city && !locId) plan.missingLocations.push({ name, city, state });

    const incoming = {};
    for (const [sf, tf] of Object.entries(FIELD_MAP)) {
      let v = tf === 'EIN' ? normEin(f[sf]) : text(f[sf]);
      if (!v) continue;
      if (SELECT_FIELDS.has(tf) && choices[tf] && !choices[tf].has(v)) {
        plan.unknownChoices.push({ name, field: tf, value: v });
        continue;
      }
      incoming[tf] = v;
    }

    const related = (f[SOURCE_RELATED] || []).map((id) => srcNameById.get(id)).filter(Boolean);
    if (related.length) relatedPlan.push({ name, related });

    const t = tgtByKey.get(k);
    if (!t) {
      const fields = { 'Org. Name': name, ...incoming };
      if (locId) fields.City = [locId];
      if (!Object.keys(incoming).length && !locId && !INCLUDE_BARE) plan.bare.push({ name });
      else plan.creates.push({ name, fields, city, state });
      continue;
    }
    for (const [tf, v] of Object.entries(incoming)) {
      const cur = t.fields[tf];
      if (!text(cur)) plan.fills.push({ id: t.id, name, field: tf, value: v });
      else if (!same(tf, cur, v)) plan.conflicts.push({ id: t.id, name, field: tf, target: text(cur), source: v });
    }
    if (locId && !(t.fields.City || []).length) plan.fills.push({ id: t.id, name, field: 'City', value: [locId], display: `${city}, ${state}` });
  }

  // Related-organization links: only where the target's self-link is empty,
  // and only to organizations that exist in the target (or are being created).
  plan.relatedLinks = [];
  plan.relatedUnresolved = [];
  const createdKeys = new Set(plan.creates.map((c) => nameKey(c.name)));
  for (const { name, related } of relatedPlan) {
    const t = tgtByKey.get(nameKey(name));
    const targets = related.map((n) => ({ n, rec: tgtByKey.get(nameKey(n)), pending: createdKeys.has(nameKey(n)) }));
    const missing = targets.filter((x) => !x.rec && !x.pending).map((x) => x.n);
    if (missing.length) plan.relatedUnresolved.push({ name, missing });
    const ids = targets.filter((x) => x.rec).map((x) => x.rec.id);
    if (!t || !ids.length) continue;
    if ((t.fields[TARGET_RELATED] || []).length) continue;
    plan.relatedLinks.push({ id: t.id, name, related: targets.filter((x) => x.rec).map((x) => x.n) });
    plan.fills.push({ id: t.id, name, field: TARGET_RELATED, value: ids, display: targets.filter((x) => x.rec).map((x) => x.n).join('; ') });
  }

  const fillsByRecord = new Map();
  for (const x of plan.fills) {
    if (!fillsByRecord.has(x.id)) fillsByRecord.set(x.id, { id: x.id, fields: {} });
    fillsByRecord.get(x.id).fields[x.field] = x.value;
  }
  const summary = {
    creates: plan.creates.length,
    bareNamesNotCreated: plan.bare.length,
    fills: plan.fills.length,
    recordsFilled: fillsByRecord.size,
    conflicts: plan.conflicts.length,
    relatedLinks: plan.relatedLinks.length,
    relatedUnresolved: plan.relatedUnresolved.length,
    missingLocations: plan.missingLocations.length,
    unknownChoices: plan.unknownChoices.length,
    skipped: plan.skipped.length,
  };
  writeFileSync(PLAN_OUT, JSON.stringify({ generatedAt: new Date().toISOString(), source: SOURCE_BASE, target: TARGET_BASE, summary, ...plan }, null, 2));
  console.log('\nPlan:', summary);
  console.log(`Plan written to ${PLAN_OUT}`);

  if (!APPLY) {
    console.log('\nDry run. Re-run with --apply to create new organizations and fill blank fields (conflicts are never applied).');
    return;
  }
  if (plan.creates.length) {
    await write(TARGET_BASE, orgT.id, 'POST', plan.creates.map((c) => ({ fields: c.fields })));
    console.log(`Created ${plan.creates.length} organizations.`);
  }
  if (fillsByRecord.size) {
    await write(TARGET_BASE, orgT.id, 'PATCH', [...fillsByRecord.values()]);
    console.log(`Filled ${plan.fills.length} blank fields on ${fillsByRecord.size} organizations.`);
  }
  console.log(`${plan.conflicts.length} conflicts left for review in ${PLAN_OUT}.`);
}

main().catch((e) => die(e.stack || e.message));
