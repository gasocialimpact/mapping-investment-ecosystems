# Mapping Investment Ecosystems

A layered **Ecosystem Dashboard** for the Georgia impact-investing capital ecosystem,
modeled on a relational Airtable base (Organizations → Capital Flows → Capital Instruments).

Built with **React + Vite + TypeScript + Tailwind**, with a **Leaflet / OpenStreetMap**
map view. It reads a baked JSON **snapshot** of the Airtable data, so it deploys as a
static site with no backend or API keys in the browser.

## Views

- **Overview** — headline counts, capital deployed by source segment, and the largest flows.
- **Organizations** — grouped by ecosystem segment (Capital Aggregator / Allocator / Enabler / Seeker),
  collapsible, with search + segment filters. Click any org for a relational drill-down drawer
  showing its inbound/outbound capital flows.
- **Capital Flows** — every source → recipient transaction with amount, year, and instrument type.
- **Capital Instruments** — the financial instruments (PRIs, recoverable grants, blended finance, …).
- **Map** — Leaflet/OSM plot of every organization with coordinates, colored by segment.
  Records without `lat`/`lng` are skipped (and the count of skipped records is shown).

## Run locally

```bash
npm install
npm run dev      # dev server at http://localhost:5173
npm run build    # type-check + production build to dist/
npm run preview  # serve the production build
```

Deploy `dist/` to any static host (GitHub Pages, Netlify, S3, …). `vite.config.ts` uses a
relative `base`, so it works from a domain root or a subpath.

## Data: how it flows

The dashboard reads `public/data/ecosystem.json`, defined by `src/types.ts` (`EcosystemData`).
A nightly GitHub Action (`.github/workflows/sync-airtable.yml`) regenerates it from the
Airtable base and commits the result. To refresh manually:

```bash
AIRTABLE_TOKEN=<your token> npm run export-data
```

The export script (`scripts/export-airtable.mjs`) pulls the base's tables, resolves the
relationships between organizations, capital flows, instruments, and locations, downloads
impact-dimension icons, and enriches locations with county CVI scores.

## Security & privacy notes

- **No secrets are committed.** The Airtable token lives only in the `AIRTABLE_TOKEN`
  GitHub Actions secret (or your local environment); `.env*` files are git-ignored.
- **No personal contact data is published.** The export intentionally excludes the
  Contacts table — this repo and the deployed site are public.

## Project layout

```
public/data/ecosystem.json     # the snapshot the app reads
scripts/export-airtable.mjs    # regenerate the snapshot from Airtable
src/
  types.ts                     # EcosystemData model + segment styling
  data/loadData.ts             # fetches the snapshot at runtime
  components/                  # StatCards, SegmentSection, *Card, MapView
  App.tsx                      # tabs, filters, relational drill-down drawer
```
