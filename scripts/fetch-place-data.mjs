#!/usr/bin/env node
// Fetches the Georgia Community Data Explorer bundle and reshapes it into two
// static JSON files consumed by the app:
//   public/data/place-counties.json  — eager: county records, CVI benchmarks,
//                                      CIE investment data, county shapes
//   public/data/place-tracts.json    — lazy: census-tract records + shapes,
//                                      fetched only when a county is drilled into
//
// The source bundle is a published mirror (window.CVI_DATA = {...}); we never
// copy its code, only its data. Override the source with PLACE_DATA_URL, or
// point PLACE_DATA_FILE at a local copy for offline runs.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const DEFAULT_URL =
  'https://raw.githubusercontent.com/gasocialimpact/georgia-community-data-explorer/main/data/cvi_region_georgia.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'data');

async function loadSource() {
  if (process.env.PLACE_DATA_FILE) {
    console.log(`Reading local bundle: ${process.env.PLACE_DATA_FILE}`);
    return readFileSync(process.env.PLACE_DATA_FILE, 'utf8');
  }
  const url = process.env.PLACE_DATA_URL || DEFAULT_URL;
  console.log(`Fetching ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  return res.text();
}

function evaluate(src) {
  // The bundle is a single `window.CVI_DATA = {...};` assignment. Evaluate in
  // an isolated VM context rather than regex-slicing the JSON out.
  const sandbox = { window: {} };
  vm.runInNewContext(src, sandbox, { timeout: 10_000 });
  const data = sandbox.window.CVI_DATA;
  if (!data) throw new Error('Bundle did not define window.CVI_DATA');
  return data;
}

function assert(cond, msg) {
  if (!cond) throw new Error(`Validation failed: ${msg}`);
}

function validate(d) {
  assert(d.scope === 'GEORGIA', `unexpected scope ${d.scope}`);
  assert(Array.isArray(d.counties) && d.counties.length === 159, `expected 159 counties, got ${d.counties?.length}`);
  assert(d.metricKeys?.length === 3, 'expected 3 metricKeys');
  assert(d.demographics?.labels?.length === 17, 'expected 17 demographic labels');
  assert(d.shapes?.features?.length === d.counties.length, 'county shape count mismatch');
  assert(Array.isArray(d.tracts) && d.tracts.length > 2000, `suspiciously few tracts: ${d.tracts?.length}`);
  assert(d.tractShapes?.features?.length === d.tracts.length, 'tract shape count mismatch');
  const areas = d.cie?.areas || {};
  for (const c of d.counties) {
    assert(typeof c.fips === 'string' && c.fips.length === 5, `bad fips on ${c.county}`);
    assert(c.cieArea in areas, `cieArea "${c.cieArea}" (${c.county}) missing from cie.areas`);
  }
  const countyFips = new Set(d.counties.map((c) => c.fips));
  for (const t of d.tracts) {
    assert(countyFips.has(t.county), `tract ${t.geoid} references unknown county ${t.county}`);
  }
}

async function main() {
  const raw = await loadSource();
  const d = evaluate(raw);
  validate(d);

  const generatedAt = new Date().toISOString();
  const source = 'gasocialimpact/georgia-community-data-explorer (U.S. Climate Vulnerability Index, CDC/ATSDR SVI, Fed CIE)';

  const counties = {
    generatedAt,
    source,
    sources: d.sources,
    metricKeys: d.metricKeys,
    metricLabels: d.metricLabels,
    nationalMedians: d.nationalMedians,
    demographics: d.demographics,
    profile: d.profile,
    parMeasures: d.parMeasures,
    cie: d.cie,
    counties: d.counties.map(({ state, ...c }) => c),
    shapes: d.shapes,
  };

  const tracts = {
    generatedAt,
    source,
    tracts: d.tracts.map(({ fed, ...t }) => t),
    tractShapes: d.tractShapes,
  };

  mkdirSync(outDir, { recursive: true });
  const countyPath = join(outDir, 'place-counties.json');
  const tractPath = join(outDir, 'place-tracts.json');
  writeFileSync(countyPath, JSON.stringify(counties));
  writeFileSync(tractPath, JSON.stringify(tracts));

  const kb = (p) => `${Math.round(readFileSync(p).length / 1024)} KB`;
  console.log(`Wrote ${countyPath} (${kb(countyPath)}) — ${counties.counties.length} counties`);
  console.log(`Wrote ${tractPath} (${kb(tractPath)}) — ${tracts.tracts.length} tracts`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
