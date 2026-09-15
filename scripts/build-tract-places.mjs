#!/usr/bin/env node
// Labels each census tract with the incorporated place / CDP its centroid
// falls in ("Decatur", "Candler-McAfee CDP", …) — the local shorthand the
// tract picker shows next to the bare tract number. Census tracts have no
// names of their own and CDC PLACES carries none either, so this joins the
// tract shapes already in public/data/place-tracts.json against the Census
// cartographic place boundaries (data/cb_2023_13_place_500k.shp/.dbf, from
// www2.census.gov/geo/tiger/GENZ2023/shp/).
//
//   node scripts/build-tract-places.mjs → public/data/tract-places.json

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// --- Minimal shapefile reader (polygons only) --------------------------------

function readShp(path) {
  const buf = readFileSync(path);
  const shapes = [];
  let off = 100; // main file header
  while (off < buf.length) {
    const len = buf.readInt32BE(off + 4) * 2; // record length in bytes
    const rec = off + 8;
    const type = buf.readInt32LE(rec);
    if (type === 5) { // polygon
      const numParts = buf.readInt32LE(rec + 36);
      const numPoints = buf.readInt32LE(rec + 40);
      const parts = [];
      for (let i = 0; i < numParts; i++) parts.push(buf.readInt32LE(rec + 44 + i * 4));
      const ptsOff = rec + 44 + numParts * 4;
      const rings = [];
      for (let p = 0; p < numParts; p++) {
        const start = parts[p];
        const end = p + 1 < numParts ? parts[p + 1] : numPoints;
        const ring = [];
        for (let i = start; i < end; i++) {
          ring.push([buf.readDoubleLE(ptsOff + i * 16), buf.readDoubleLE(ptsOff + i * 16 + 8)]);
        }
        rings.push(ring);
      }
      shapes.push({
        bbox: [buf.readDoubleLE(rec + 4), buf.readDoubleLE(rec + 12), buf.readDoubleLE(rec + 20), buf.readDoubleLE(rec + 28)],
        rings,
      });
    } else {
      shapes.push(null);
    }
    off = rec + len;
  }
  return shapes;
}

function readDbf(path) {
  const buf = readFileSync(path);
  const numRecords = buf.readInt32LE(4);
  const headerSize = buf.readInt16LE(8);
  const recordSize = buf.readInt16LE(10);
  const fields = [];
  for (let off = 32; buf[off] !== 0x0d; off += 32) {
    fields.push({
      name: buf.toString('ascii', off, off + 11).replace(/\0.*$/, ''),
      len: buf[off + 16],
    });
  }
  const rows = [];
  for (let r = 0; r < numRecords; r++) {
    let off = headerSize + r * recordSize + 1; // +1 skips the deletion flag
    const row = {};
    for (const f of fields) {
      row[f.name] = buf.toString('utf8', off, off + f.len).trim();
      off += f.len;
    }
    rows.push(row);
  }
  return rows;
}

// Even-odd ray casting across every ring handles holes for free.
function contains(shape, [x, y]) {
  const [minX, minY, maxX, maxY] = shape.bbox;
  if (x < minX || x > maxX || y < minY || y > maxY) return false;
  let inside = false;
  for (const ring of shape.rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i]; const [xj, yj] = ring[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

// Area-weighted centroid of the largest ring (good enough for a label join).
function centroid(rings) {
  let best = rings[0];
  for (const r of rings) if (r.length > best.length) best = r;
  let a = 0, cx = 0, cy = 0;
  for (let i = 0, j = best.length - 1; i < best.length; j = i++) {
    const cross = best[j][0] * best[i][1] - best[i][0] * best[j][1];
    a += cross; cx += (best[j][0] + best[i][0]) * cross; cy += (best[j][1] + best[i][1]) * cross;
  }
  if (a === 0) return best[0];
  return [cx / (3 * a), cy / (3 * a)];
}

// --- Join --------------------------------------------------------------------

const shapes = readShp(join(root, 'data', 'cb_2023_13_place_500k.shp'));
const attrs = readDbf(join(root, 'data', 'cb_2023_13_place_500k.dbf'));
const places = shapes.map((s, i) => s && { shape: s, name: attrs[i].NAMELSAD || attrs[i].NAME }).filter(Boolean);

const tractData = JSON.parse(readFileSync(join(root, 'public', 'data', 'place-tracts.json'), 'utf8'));
const out = {};
let hits = 0;
for (const f of tractData.tractShapes.features) {
  if (!f.geometry) continue;
  const rings = f.geometry.type === 'Polygon' ? f.geometry.coordinates
    : f.geometry.coordinates.flat(); // MultiPolygon → all rings; largest wins in centroid()
  const c = centroid(rings);
  const hit = places.find((p) => contains(p.shape, c));
  if (hit) { out[f.id] = hit.name; hits++; }
}

writeFileSync(join(root, 'public', 'data', 'tract-places.json'), JSON.stringify({
  generatedAt: new Date().toISOString(),
  source: 'Census cartographic boundary places (cb_2023_13_place_500k); tract centroid within place boundary',
  places: out,
}));
console.log(`Labeled ${hits} of ${tractData.tractShapes.features.length} tracts with a place name`);
