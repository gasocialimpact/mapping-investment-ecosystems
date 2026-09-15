#!/usr/bin/env node
// Builds public/data/alice-counties.json from the United For ALICE Georgia
// data sheet (data/alice-georgia.xlsx, County sheet).
//
// One row per county per survey year: household counts below poverty, between
// poverty and the ALICE threshold, and above the threshold. Counts are stored
// whole; shares are computed at render time. Every row carries the raw
// household total so thin/odd cells stay inspectable.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(root, 'data', 'alice-georgia.xlsx');
const OUT = join(root, 'public', 'data', 'alice-counties.json');

// --- Minimal xlsx reading (zip + sheet XML with inline strings) ------------

function unzipEntry(buf, name) {
  // Walk the central directory to find the entry, then inflate it.
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const cdOffset = buf.readUInt32LE(eocd + 16);
  const count = buf.readUInt16LE(eocd + 10);
  let p = cdOffset;
  for (let i = 0; i < count; i++) {
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const entryName = buf.toString('utf8', p + 46, p + 46 + nameLen);
    const localOffset = buf.readUInt32LE(p + 42);
    if (entryName === name) {
      const lNameLen = buf.readUInt16LE(localOffset + 26);
      const lExtraLen = buf.readUInt16LE(localOffset + 28);
      const method = buf.readUInt16LE(localOffset + 8);
      const compSize = buf.readUInt32LE(localOffset + 18);
      const start = localOffset + 30 + lNameLen + lExtraLen;
      const data = buf.subarray(start, start + compSize);
      return method === 0 ? data : inflateRawSync(data);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error(`Entry not found in xlsx: ${name}`);
}

function parseSheet(xml) {
  const rows = [];
  for (const rowMatch of xml.matchAll(/<row [^>]*?r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = {};
    for (const cellMatch of rowMatch[2].matchAll(/<c ([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = cellMatch[1];
      const col = /r="([A-Z]+)\d+"/.exec(attrs)?.[1];
      if (!col) continue;
      const type = / t="(\w+)"/.exec(` ${attrs}`)?.[1];
      if (type === 'inlineStr') {
        cells[col] = [...cellMatch[2].matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((m) => m[1]).join('');
      } else {
        const v = /<v>([^<]*)<\/v>/.exec(cellMatch[2]);
        if (v) cells[col] = v[1];
      }
    }
    rows.push(cells);
  }
  return rows;
}

// --- Transform --------------------------------------------------------------

const buf = readFileSync(SRC);
// Workbook sheet order: Meta, County, Subcounty → County is sheet2.
const rows = parseSheet(unzipEntry(buf, 'xl/worksheets/sheet2.xml').toString('utf8'));

const records = [];
for (const c of rows) {
  const fips = (c.C ?? '').trim();
  const year = Number(c.B);
  if (!/^13\d{3}$/.test(fips) || !Number.isFinite(year)) continue;
  const households = Number(c.G);
  const poverty = Number(c.H);
  const alice = Number(c.I);
  const above = Number(c.J);
  if (![households, poverty, alice, above].every(Number.isFinite)) continue;
  records.push({
    county_fips: fips,
    county_name: (c.E ?? c.D ?? '').replace(/ County.*$/, ''),
    year,
    households,
    poverty_households: poverty,
    alice_households: alice,
    above_alice_households: above,
    source_window: c.M ?? null, // e.g. "5-Year" ACS estimate
    record_count: 1,
  });
}

records.sort((a, b) => a.county_fips.localeCompare(b.county_fips) || a.year - b.year);

const years = [...new Set(records.map((r) => r.year))].sort((a, b) => a - b);
const counties = new Set(records.map((r) => r.county_fips));
if (counties.size !== 159) throw new Error(`Expected 159 counties, got ${counties.size}`);

writeFileSync(OUT, JSON.stringify({
  generatedAt: new Date().toISOString(),
  source: 'United For ALICE, 2026 Georgia data sheet (ACS-based; early years use 3-year estimates)',
  years,
  rows: records,
}));

console.log(`Wrote ${OUT}: ${records.length} rows · ${counties.size} counties · years ${years.join(', ')}`);
