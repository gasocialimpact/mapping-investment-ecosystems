#!/usr/bin/env node
/**
 * Exports the layered investment-ecosystem base from Airtable into the snapshot
 * the dashboard reads (public/data/ecosystem.json).
 *
 * Run it from a machine that can reach api.airtable.com (the cloud sandbox cannot):
 *
 *   AIRTABLE_TOKEN=pat...   \
 *   AIRTABLE_BASE_ID=appAi19SJ3WzFEIvj  \
 *   npm run export-data
 *
 * The field names below mirror the uploaded `index.tsx` fodder. If your base uses
 * different names, edit the CONFIG block — each entry is a list of candidate field
 * names and the first one that exists on the table wins. The script prints which
 * tables/fields it matched so you can adjust.
 *
 * NEVER commit your token. Pass it via the environment only.
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TOKEN = process.env.AIRTABLE_TOKEN;
const BASE_ID = process.env.AIRTABLE_BASE_ID || 'appAi19SJ3WzFEIvj';

if (!TOKEN) {
  console.error('Missing AIRTABLE_TOKEN environment variable.');
  process.exit(1);
}

// Candidate names per concept. Matching is case-insensitive and substring-based.
const CONFIG = {
  tables: {
    organizations: ['organizations', 'organization'],
    capitalFlows: ['capital flows', 'capital flow'],
    capitalInstruments: ['capital instruments', 'capital instrument'],
  },
  org: {
    name: ['org. name', 'org name', 'organization name', 'name'],
    segment: ['segment'],
    city: ['city_name', 'city'],
    state: ['state_id', 'state'],
    lat: ['lat', 'latitude'],
    lng: ['lng', 'long', 'longitude'],
    website: ['website', 'url'],
    description: ['description', 'overview', 'notes'],
  },
  flow: {
    sourceName: ['allocation source', 'source', 'name (from source)'],
    recipientName: ['name (from recipient)', 'recipient'],
    amount: ['amount'],
    year: ['year'],
    type: ['definitions', 'capital flow type', 'type'],
    description: ['description', 'notes'],
  },
  instrument: {
    name: ['lookup field', 'name', 'instrument'],
    capitalFlowType: ['capital flow type', 'flow type'],
    investmentStrategy: ['investment strategy', 'strategy'],
    segment: ['segment'],
    description: ['description', 'notes'],
  },
};

const API = 'https://api.airtable.com/v0';
const headers = { Authorization: `Bearer ${TOKEN}` };

async function getSchema() {
  const res = await fetch(`${API}/meta/bases/${BASE_ID}/tables`, { headers });
  if (!res.ok) throw new Error(`Schema fetch failed: ${res.status} ${await res.text()}`);
  return (await res.json()).tables;
}

async function getRecords(tableId) {
  const out = [];
  let offset;
  do {
    const url = new URL(`${API}/${BASE_ID}/${tableId}`);
    url.searchParams.set('pageSize', '100');
    if (offset) url.searchParams.set('offset', offset);
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`Records fetch failed for ${tableId}: ${res.status}`);
    const json = await res.json();
    out.push(...json.records);
    offset = json.offset;
  } while (offset);
  return out;
}

function findTable(tables, candidates) {
  return tables.find((t) => candidates.some((c) => t.name.toLowerCase().includes(c)));
}

// Build a name->fieldName resolver for a table given the CONFIG candidate map.
function resolveFields(table, candidateMap) {
  const resolved = {};
  const fieldNames = table.fields.map((f) => f.name);
  for (const [key, candidates] of Object.entries(candidateMap)) {
    const match = fieldNames.find((n) => candidates.some((c) => n.toLowerCase() === c)) ||
      fieldNames.find((n) => candidates.some((c) => n.toLowerCase().includes(c)));
    if (match) resolved[key] = match;
  }
  return resolved;
}

// Airtable returns linked records / lookups as arrays; normalize to a scalar.
function scalar(value) {
  if (Array.isArray(value)) {
    const first = value[0];
    if (first && typeof first === 'object') return first.name ?? first.text ?? null;
    return first ?? null;
  }
  if (value && typeof value === 'object') return value.name ?? null;
  return value ?? null;
}

function num(value) {
  const s = scalar(value);
  if (s === null || s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function slug(s, i) {
  return (s || `rec_${i}`).toString().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

async function main() {
  const tables = await getSchema();
  console.log('Tables in base:', tables.map((t) => t.name).join(', '));

  const orgTable = findTable(tables, CONFIG.tables.organizations);
  const flowTable = findTable(tables, CONFIG.tables.capitalFlows);
  const instrTable = findTable(tables, CONFIG.tables.capitalInstruments);

  if (!orgTable) throw new Error('Could not find an Organizations table. Edit CONFIG.tables.organizations.');

  const orgFields = resolveFields(orgTable, CONFIG.org);
  console.log('Organization field mapping:', orgFields);

  const orgRecords = await getRecords(orgTable.id);
  const nameToId = new Map();
  const organizations = orgRecords.map((r, i) => {
    const f = r.fields;
    const name = scalar(f[orgFields.name]) ?? `Organization ${i + 1}`;
    const id = `org_${slug(name, i)}`;
    nameToId.set(name.toLowerCase(), id);
    return {
      id,
      name,
      segment: scalar(f[orgFields.segment]) ?? 'Uncategorized',
      city: scalar(f[orgFields.city]),
      state: scalar(f[orgFields.state]),
      lat: num(f[orgFields.lat]),
      lng: num(f[orgFields.lng]),
      website: scalar(f[orgFields.website]),
      description: scalar(f[orgFields.description]),
    };
  });

  let capitalFlows = [];
  if (flowTable) {
    const flowFields = resolveFields(flowTable, CONFIG.flow);
    console.log('Capital flow field mapping:', flowFields);
    const flowRecords = await getRecords(flowTable.id);
    capitalFlows = flowRecords.map((r, i) => {
      const f = r.fields;
      const sourceName = scalar(f[flowFields.sourceName]);
      const recipientName = scalar(f[flowFields.recipientName]);
      return {
        id: `flow_${i + 1}`,
        label: `Flow #${i + 1}`,
        sourceId: sourceName ? nameToId.get(sourceName.toLowerCase()) ?? null : null,
        sourceName,
        recipientId: recipientName ? nameToId.get(recipientName.toLowerCase()) ?? null : null,
        recipientName,
        amount: num(f[flowFields.amount]),
        year: num(f[flowFields.year]),
        type: scalar(f[flowFields.type]),
        description: scalar(f[flowFields.description]),
      };
    });
  } else {
    console.warn('No Capital Flows table found — exporting empty list.');
  }

  let capitalInstruments = [];
  if (instrTable) {
    const instrFields = resolveFields(instrTable, CONFIG.instrument);
    console.log('Capital instrument field mapping:', instrFields);
    const instrRecords = await getRecords(instrTable.id);
    capitalInstruments = instrRecords.map((r, i) => {
      const f = r.fields;
      return {
        id: `inst_${i + 1}`,
        name: scalar(f[instrFields.name]) ?? `Instrument ${i + 1}`,
        capitalFlowType: scalar(f[instrFields.capitalFlowType]),
        investmentStrategy: scalar(f[instrFields.investmentStrategy]),
        segment: scalar(f[instrFields.segment]),
        description: scalar(f[instrFields.description]),
      };
    });
  } else {
    console.warn('No Capital Instruments table found — exporting empty list.');
  }

  const snapshot = {
    generatedAt: new Date().toISOString(),
    source: `Airtable base ${BASE_ID}`,
    organizations,
    capitalFlows,
    capitalInstruments,
  };

  const outPath = resolve(dirname(fileURLToPath(import.meta.url)), '../public/data/ecosystem.json');
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(snapshot, null, 2));
  const mapped = organizations.filter((o) => o.lat != null && o.lng != null).length;
  console.log(
    `\nWrote ${outPath}\n  ${organizations.length} organizations (${mapped} with coordinates)\n` +
      `  ${capitalFlows.length} capital flows\n  ${capitalInstruments.length} capital instruments`,
  );
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
