#!/usr/bin/env node
/**
 * Full export of the investment-ecosystem Airtable base into ecosystem.json.
 * Pulls all 6 tables, resolves relationships, downloads impact dimension icons,
 * and enriches locations with CVI data from the local CVI repo.
 *
 *   AIRTABLE_TOKEN=pat...  node scripts/export-airtable.mjs
 *
 * Optional env:
 *   AIRTABLE_BASE_ID  — defaults to appAi19SJ3WzFEIvj
 *   CVI_CSV_PATH      — path to CVI-county-pct-comb.csv (auto-detected from sibling repo)
 */
import { writeFile, mkdir, readFile, access } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const TOKEN = process.env.AIRTABLE_TOKEN;
const BASE_ID = process.env.AIRTABLE_BASE_ID || 'appAi19SJ3WzFEIvj';

if (!TOKEN) {
  console.error('Missing AIRTABLE_TOKEN environment variable.');
  process.exit(1);
}

const API = 'https://api.airtable.com/v0';
const headers = { Authorization: `Bearer ${TOKEN}` };

// Table IDs (stable)
const TABLES = {
  organizations:      'tblHJEEWGTFNJDzO8',
  contacts:           'tbl26QtdDqBmLwrkN',
  locations:          'tbl7m5d3nz5y9lENv',
  capitalFlows:       'tblIXVCEFUgYfVAOm',
  capitalInstruments: 'tblaLHgRTe4UfbOpK',
  impactDimensions:   'tblEiApH9S0OsRnmF',
};

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

function slug(s, prefix = 'rec') {
  if (!s) return `${prefix}_unknown`;
  return `${prefix}_${s.toString().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`;
}

function linkIds(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter((v) => typeof v === 'string');
  return [];
}

// Download a file if it doesn't already exist
async function downloadIfMissing(url, destPath) {
  try {
    await access(destPath);
    return true;
  } catch {}
  try {
    const res = await fetch(url);
    if (!res.ok) return false;
    await pipeline(Readable.fromWeb(res.body), createWriteStream(destPath));
    return true;
  } catch {
    return false;
  }
}

// Load CVI county data
async function loadCVI() {
  const candidates = [
    process.env.CVI_CSV_PATH,
    resolve(ROOT, '../CVI/CVI-county-pct/CVI-county-pct-comb.csv'),
    resolve(ROOT, '../../CVI/CVI-county-pct/CVI-county-pct-comb.csv'),
  ].filter(Boolean);

  for (const p of candidates) {
    try {
      const raw = await readFile(p, 'utf8');
      const lines = raw.trim().split('\n');
      const byFips = {};
      const allScores = [];
      for (let i = 1; i < lines.length; i++) {
        const match = lines[i].match(/^\d+,"([^"]+)",(\d+),"([^"]+)",(.+)$/);
        if (!match) continue;
        const fips = match[2].padStart(5, '0');
        const scores = match[4].split(',').map(Number);
        byFips[fips] = scores;
        allScores.push(scores[0]);
      }
      allScores.sort((a, b) => a - b);
      console.log(`Loaded CVI data from ${p}: ${Object.keys(byFips).length} counties`);
      return { byFips, allScores };
    } catch {}
  }
  console.warn('CVI data not found — locations will have null CVI scores');
  return null;
}

async function main() {
  console.log('Fetching all tables from Airtable...');

  const [orgRecs, contactRecs, locRecs, flowRecs, instrRecs, dimRecs] = await Promise.all([
    getRecords(TABLES.organizations),
    getRecords(TABLES.contacts),
    getRecords(TABLES.locations),
    getRecords(TABLES.capitalFlows),
    getRecords(TABLES.capitalInstruments),
    getRecords(TABLES.impactDimensions),
  ]);

  console.log(`Fetched: ${orgRecs.length} orgs, ${contactRecs.length} contacts, ${locRecs.length} locations, ${flowRecs.length} flows, ${instrRecs.length} instruments, ${dimRecs.length} dimensions`);

  // Build Airtable recID -> slug ID maps
  const recIdToOrgId = new Map();
  const recIdToFlowId = new Map();
  const recIdToInstrId = new Map();
  const recIdToLocId = new Map();
  const recIdToContactId = new Map();
  const recIdToDimId = new Map();

  // --- Impact Dimensions ---
  const iconDir = join(ROOT, 'public/icons/impact');
  await mkdir(iconDir, { recursive: true });

  const impactDimensions = await Promise.all(dimRecs.map(async (r) => {
    const f = r.fields;
    const label = f['Notes'] || f['Label'] || `Dimension ${f['Null']}`;
    const id = slug(label, 'dim');
    recIdToDimId.set(r.id, id);

    let iconUrl = null;
    const icons = f['impact_icons'];
    if (icons && icons.length > 0) {
      const icon = icons[0];
      const filename = icon.filename;
      const localName = filename.toLowerCase().replace(/[^a-z0-9.]+/g, '_').replace(/^_/, '');
      const destPath = join(iconDir, localName);
      const ok = await downloadIfMissing(icon.url, destPath);
      if (ok) iconUrl = `icons/impact/${localName}`;
    }

    return {
      id,
      type: f['Impact Dimension'] || 'Unknown',
      label,
      notes: null,
      iconUrl,
    };
  }));

  // --- Locations ---
  locRecs.forEach((r) => {
    const f = r.fields;
    const city = f['city_name'] || 'Unknown';
    const state = f['state_id'] || f['state_name'] || '';
    const id = slug(`${city}_${state}`, 'loc');
    recIdToLocId.set(r.id, id);
  });

  // --- Contacts ---
  contactRecs.forEach((r) => {
    const f = r.fields;
    const name = f['Name'] || 'Unknown';
    const id = slug(name, 'contact');
    recIdToContactId.set(r.id, id);
  });

  // --- Capital Instruments ---
  instrRecs.forEach((r, i) => {
    const f = r.fields;
    const name = f['Lookup Field'] || `Instrument ${i + 1}`;
    const id = slug(name, 'inst');
    recIdToInstrId.set(r.id, id);
  });

  // --- Capital Flows ---
  flowRecs.forEach((r, i) => {
    const id = `flow_${i + 1}`;
    recIdToFlowId.set(r.id, id);
  });

  // --- Organizations ---
  orgRecs.forEach((r, i) => {
    const f = r.fields;
    const name = scalar(f['Org. Name']) || `Organization ${i + 1}`;
    const id = slug(name, 'org');
    recIdToOrgId.set(r.id, id);
  });

  // Now build full objects with resolved relationships

  const organizations = orgRecs.map((r) => {
    const f = r.fields;
    const name = scalar(f['Org. Name']) || 'Unknown';
    const id = recIdToOrgId.get(r.id);

    const locationRecIds = linkIds(f['city_name (from Location)']) || [];
    // Find location by looking at the org's linked location records
    // The location link is through the Location table
    let locationId = null;

    // Capital flows linked
    const capitalFlowIds = linkIds(f['Capital Flows']).map((rid) => recIdToFlowId.get(rid)).filter(Boolean);
    const capitalAllocationIds = linkIds(f['Capital Allocation']).map((rid) => recIdToFlowId.get(rid)).filter(Boolean);

    // Impact dimension links
    const sdgIds = linkIds(f['SDG Alignment']).map((rid) => recIdToDimId.get(rid)).filter(Boolean);
    const sectorIds = linkIds(f['Sector Focus']).map((rid) => recIdToDimId.get(rid)).filter(Boolean);
    const populationIds = linkIds(f['Population Focus']).map((rid) => recIdToDimId.get(rid)).filter(Boolean);
    const ownershipIds = linkIds(f['Ownership Focus']).map((rid) => recIdToDimId.get(rid)).filter(Boolean);

    const contactIds = linkIds(f['Organization Contacts']).map((rid) => recIdToContactId.get(rid)).filter(Boolean);

    return {
      id,
      name,
      segment: scalar(f['Segment']) || 'Uncategorized',
      orgType: scalar(f['Org. Type']) || null,
      city: scalar(f['City']) || scalar(f['city_name (from Location)']) || null,
      state: scalar(f['state_id (from Location)']) || null,
      lat: num(f['lat (from City)']),
      lng: num(f['lng (from City)']),
      website: scalar(f['Website']) || null,
      description: scalar(f['Description/focus']) || null,
      locationId,
      contactIds,
      capitalFlowIds,
      capitalAllocationIds,
      sdgIds,
      sectorIds,
      populationIds,
      ownershipIds,
    };
  });

  // Build org name->id map for flow resolution
  const orgNameToId = new Map();
  organizations.forEach((o) => orgNameToId.set(o.name.toLowerCase(), o.id));

  const capitalFlows = flowRecs.map((r, i) => {
    const f = r.fields;
    const id = recIdToFlowId.get(r.id);
    const sourceName = scalar(f['Allocation Source']) || scalar(f['Source']);
    const recipientName = scalar(f['Name (from Recipient)']) || scalar(f['Recipient']);

    const sourceId = sourceName ? orgNameToId.get(sourceName.toLowerCase()) ?? null : null;
    const recipientId = recipientName ? orgNameToId.get(recipientName.toLowerCase()) ?? null : null;

    const capitalInstrumentIds = linkIds(f['Definitions']).map((rid) => recIdToInstrId.get(rid)).filter(Boolean);
    const impactDimensionIds = linkIds(f['Impact Dimensions']).map((rid) => recIdToDimId.get(rid)).filter(Boolean);

    return {
      id,
      label: `Flow #${i + 1}`,
      sourceId,
      sourceName: sourceName || null,
      recipientId,
      recipientName: recipientName || null,
      amount: num(f['Amount']),
      year: num(f['Year']),
      type: scalar(f['Definitions']) || null,
      description: scalar(f['Notes']) || null,
      capitalInstrumentIds,
      impactDimensionIds,
    };
  });

  const capitalInstruments = instrRecs.map((r) => {
    const f = r.fields;
    const id = recIdToInstrId.get(r.id);
    const capitalFlowIds = linkIds(f['Capital Allocation']).map((rid) => recIdToFlowId.get(rid)).filter(Boolean);

    return {
      id,
      name: f['Lookup Field'] || 'Unknown',
      capitalFlowType: scalar(f['Capital Flow Type']) || null,
      investmentStrategy: scalar(f['Investment Strategy']) || null,
      description: scalar(f['Description']) || null,
      capitalFlowIds,
    };
  });

  // --- Locations (with org linking + CVI) ---
  const cvi = await loadCVI();

  // Build location recId -> org recIds from the Location table's "Organizations" field
  const locRecIdToOrgRecIds = new Map();
  locRecs.forEach((r) => {
    locRecIdToOrgRecIds.set(r.id, linkIds(r.fields['Organizations']));
  });

  // Also do city+state matching for orgs without explicit location links
  const cityStateToLocRecId = new Map();
  locRecs.forEach((r) => {
    const f = r.fields;
    const city = (f['city_name'] || '').toLowerCase().trim();
    const state = (f['state_id'] || f['state_name'] || '').toLowerCase().trim();
    if (city) cityStateToLocRecId.set(`${city}|${state}`, r.id);
  });

  // Assign locationId to orgs
  for (const org of organizations) {
    // Find which location record links to this org
    for (const [locRecId, orgRecIds] of locRecIdToOrgRecIds) {
      const orgRecId = [...recIdToOrgId.entries()].find(([, id]) => id === org.id)?.[0];
      if (orgRecId && orgRecIds.includes(orgRecId)) {
        org.locationId = recIdToLocId.get(locRecId) || null;
        break;
      }
    }
    // Fallback: match by city+state
    if (!org.locationId && org.city) {
      const key = `${org.city.toLowerCase().trim()}|${(org.state || '').toLowerCase().trim()}`;
      const locRecId = cityStateToLocRecId.get(key);
      if (locRecId) org.locationId = recIdToLocId.get(locRecId) || null;
    }
  }

  const locations = locRecs.map((r) => {
    const f = r.fields;
    const city = f['city_name'] || 'Unknown';
    const state = f['state_id'] || f['state_name'] || null;
    const id = recIdToLocId.get(r.id);
    const fipsCode = f['FIPS_combined_code'] || null;

    // Linked org IDs
    const orgRecIds = linkIds(f['Organizations']);
    const organizationIds = orgRecIds.map((rid) => recIdToOrgId.get(rid)).filter(Boolean);

    // Also add orgs matched by city+state that aren't already linked
    for (const org of organizations) {
      if (org.locationId === id && !organizationIds.includes(org.id)) {
        organizationIds.push(org.id);
      }
    }

    // CVI data
    let cviToxPi = num(f['CVI_ToxPi_Score']);
    let cviBaselineHealth = num(f['CVI_Baseline_Health']);
    let cviBaselineSocialEconomic = num(f['CVI_Baseline_SocialEconomic']);
    let cviBaselineInfrastructure = num(f['CVI_Baseline_Infrastructure']);
    let cviBaselineEnvironment = num(f['CVI_Baseline_Environmental']);
    let cviCCHealth = num(f['CVI_ClimateChange_Health']);
    let cviCCSocialEconomic = num(f['CVI_ClimateChange_SocialEconomic']);
    let cviCCExtremeEvents = num(f['CVI_ClimateChange_ExtremeEvents']);
    let cviNationalPercentile = null;

    // Override with CVI CSV if available (more complete)
    if (cvi && fipsCode) {
      const fips = String(fipsCode).padStart(5, '0');
      const scores = cvi.byFips[fips];
      if (scores) {
        cviToxPi = Math.round(scores[0] * 1e6) / 1e6;
        cviBaselineHealth = Math.round(scores[1] * 1e6) / 1e6;
        cviBaselineSocialEconomic = Math.round(scores[2] * 1e6) / 1e6;
        cviBaselineInfrastructure = Math.round(scores[3] * 1e6) / 1e6;
        cviBaselineEnvironment = Math.round(scores[4] * 1e6) / 1e6;
        cviCCHealth = Math.round(scores[5] * 1e6) / 1e6;
        cviCCSocialEconomic = Math.round(scores[6] * 1e6) / 1e6;
        cviCCExtremeEvents = Math.round(scores[7] * 1e6) / 1e6;
        const rank = cvi.allScores.filter((s) => s <= scores[0]).length;
        cviNationalPercentile = Math.round((rank / cvi.allScores.length) * 100);
      }
    }

    return {
      id,
      cityName: city,
      stateName: f['state_name'] || null,
      stateId: f['state_id'] || null,
      countyName: f['county_name'] || null,
      countryName: f['country_name'] || null,
      lat: num(f['lat']),
      lng: num(f['lng']),
      fipsCode,
      cviToxPi,
      cviBaselineHealth,
      cviBaselineSocialEconomic,
      cviBaselineInfrastructure,
      cviBaselineEnvironment,
      cviCCHealth,
      cviCCSocialEconomic,
      cviCCExtremeEvents,
      cviNationalPercentile,
      organizationIds,
    };
  });

  const contacts = contactRecs.map((r) => {
    const f = r.fields;
    const name = f['Name'] || 'Unknown';
    const id = recIdToContactId.get(r.id);
    const organizationIds = linkIds(f['Organization']).map((rid) => recIdToOrgId.get(rid)).filter(Boolean);

    return {
      id,
      name,
      email: f['Email address'] || null,
      organizationIds,
      isKeyContact: !!f['Org. Key Contact'],
    };
  });

  const snapshot = {
    generatedAt: new Date().toISOString(),
    source: `Airtable base ${BASE_ID}`,
    organizations,
    capitalFlows,
    capitalInstruments,
    locations,
    contacts,
    impactDimensions,
  };

  const outPath = join(ROOT, 'public/data/ecosystem.json');
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(snapshot, null, 2));

  const mapped = organizations.filter((o) => o.lat != null && o.lng != null).length;
  const withCvi = locations.filter((l) => l.cviToxPi != null).length;
  const withIcons = impactDimensions.filter((d) => d.iconUrl).length;

  console.log(`\nWrote ${outPath}`);
  console.log(`  ${organizations.length} organizations (${mapped} with coordinates)`);
  console.log(`  ${capitalFlows.length} capital flows`);
  console.log(`  ${capitalInstruments.length} capital instruments`);
  console.log(`  ${locations.length} locations (${withCvi} with CVI)`);
  console.log(`  ${contacts.length} contacts`);
  console.log(`  ${impactDimensions.length} impact dimensions (${withIcons} with icons)`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
