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

The dashboard reads `public/data/ecosystem.json`. The current file is **representative sample
data** for the Georgia ecosystem — enough to exercise every view. The shape is defined in
`src/types.ts` (`EcosystemData`).

### Refreshing from Airtable

The deployed page can't call Airtable (or the Airtable MCP) directly — the MCP is an
authoring-time tool, and a browser can't hold a token safely. Instead, regenerate the snapshot
with the export script, then redeploy:

```bash
AIRTABLE_TOKEN=pat...                 \
AIRTABLE_BASE_ID=appAi19SJ3WzFEIvj    \
npm run export-data
```

This writes a fresh `public/data/ecosystem.json`. The script (`scripts/export-airtable.mjs`):

- discovers the Organizations / Capital Flows / Capital Instruments tables by name,
- maps fields using the candidate names from the uploaded `index.tsx` fodder
  (`Segment`, `Org. Name`, `city_name`, `state_id`, `lat`, `lng`, `Amount`, `Year`, …),
- prints exactly which tables/fields it matched so you can tweak the `CONFIG` block if your
  field names differ,
- resolves capital-flow source/recipient names to organization records for the drill-down.

> Run it from your own machine — this project's cloud sandbox blocks `api.airtable.com`.

### Connecting the real base (`appAi19SJ3WzFEIvj`)

At build time the Airtable MCP token in this workspace returns **403** for that base. To pull
it via the MCP, add base `appAi19SJ3WzFEIvj` to the connector's Personal Access Token at
<https://airtable.com/create/tokens> (scopes: `schema.bases:read`, `data.records:read`), or
reconnect the connector with a token that already has access. Until then, use the local
`export-data` route above.

## Security notes

- **No secrets are committed.** Tokens are read from the environment by the export script only;
  `.env*` files are git-ignored.
- A Google Maps API key was provided during setup but is **not used** — the map runs on free
  Leaflet/OpenStreetMap tiles. If you don't plan to use that key elsewhere, restrict or delete it.
- Any Airtable token shared in chat should be **rotated**, since chat history persists it.

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
