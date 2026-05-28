import type { EcosystemData } from '../types';

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
