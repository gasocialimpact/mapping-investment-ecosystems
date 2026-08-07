import type { EcosystemData } from '../types';
import type { PlaceCountyData, PlaceTractData } from '../types/place';

// The dashboard reads a baked snapshot rather than calling Airtable directly,
// because the Airtable MCP / API token cannot run in the browser. Regenerate
// the snapshot with `npm run export-data` once a base token is available.
const SNAPSHOT_URL = `${import.meta.env.BASE_URL}data/ecosystem.json`;

export async function loadEcosystemData(): Promise<EcosystemData> {
  const res = await fetch(SNAPSHOT_URL, { cache: 'no-cache' });
  if (!res.ok) {
    throw new Error(`Failed to load ecosystem snapshot (${res.status}). Expected at ${SNAPSHOT_URL}.`);
  }
  return (await res.json()) as EcosystemData;
}

async function loadJson<T>(path: string): Promise<T> {
  const url = `${import.meta.env.BASE_URL}${path}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load ${path} (${res.status}).`);
  }
  return (await res.json()) as T;
}

// County-level place data (~65 KB gzipped) — loaded eagerly alongside the
// ecosystem snapshot. Tract data (~1 MB gzipped) is only fetched when the
// user drills into a county on the map.
export function loadCountyPlaceData(): Promise<PlaceCountyData> {
  return loadJson<PlaceCountyData>('data/place-counties.json');
}

export function loadTractPlaceData(): Promise<PlaceTractData> {
  return loadJson<PlaceTractData>('data/place-tracts.json');
}
