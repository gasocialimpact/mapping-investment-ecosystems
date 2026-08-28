# Mapping Investment Ecosystems

**Georgia's Impact Investing Ecosystem Map** — a place-first view of the state's impact
investing ecosystem, combining community data (climate vulnerability, Populations at Risk,
community investment) with the organizations, capital flows, and instruments working in
each place.

Built with **React + Vite + TypeScript + Tailwind** and **Leaflet / OpenStreetMap**.
Deploys as a static site (GitHub Pages) — no backend, no API keys in the browser.

## Tabs

- **Explore** — the heart of the tool, modeled on the
  [Georgia Community Data Explorer](https://gasocialimpact.github.io/georgia-community-data-explorer/):
  a county choropleth (CVI layers + 17 demographic indicators) with organization markers on
  top, Highest & Lowest rankings, score distribution, and a compact Investment Gaps card.
  Selecting a county loads its full report — CVI category profile, top vulnerability drivers,
  Populations at Risk vs. Georgia/U.S. benchmarks, per-capita community investment — plus the
  ecosystem layers for that place (organizations, capital flows, instruments). Census-tract
  scope adds tract-level shading and a tract table.
- **Framing Our Ecosystem** — the Core Functions framework. Each stakeholder type unfurls
  the records behind it (organizations / capital flows / instruments as pill sub-tabs);
  segment headers browse a whole column.
- **Glossary & Key Terms** — investment terminology and impact investing strategies.

## Run locally

```bash
npm install
npm run dev      # dev server at http://localhost:5173
npm run build    # type-check + production build to dist/
npm run preview  # serve the production build
```

## Embedding

The tool is built to sit in an iframe. It measures the part of the frame that is actually
on screen (`src/lib/useVisibleBand.ts`) and keeps the header, tabs and record modals inside
it, so a frame taller than the browser window still behaves.

```html
<iframe src="https://…/" width="100%" height="1200" allow="clipboard-write"></iframe>
```

`allow="clipboard-write"` is what lets the **snapshot buttons** (the camera icon on cards,
charts, tables and record modals) copy a PNG straight to the clipboard — a cross-origin
iframe does not get that permission by default. Without it nothing breaks: the button
falls back to downloading the PNG instead.

## Data pipeline

Two static datasets under `public/data/`, both refreshed by the nightly GitHub Action
(`.github/workflows/sync-airtable.yml`):

| File | Source | Contents |
|---|---|---|
| `ecosystem.json` | Airtable via `scripts/export-airtable.mjs` | organizations, capital flows, instruments, locations (with county FIPS + CVI scores), impact dimensions |
| `place-counties.json` / `place-tracts.json` | Community Data Explorer via `scripts/fetch-place-data.mjs` | county & tract CVI scores, demographics, vulnerability drivers, Fed CIE investment data, boundary geometry |

Manual refresh:

```bash
AIRTABLE_TOKEN=<your token> npm run export-data   # Airtable → ecosystem.json
npm run fetch-place-data                          # Data Explorer → place-*.json
```

The two datasets join on 5-digit county FIPS codes.

## Security & privacy notes

- **No secrets are committed.** The Airtable token lives only in the `AIRTABLE_TOKEN`
  GitHub Actions secret (or your local environment); `.env*` files are git-ignored.
- **No personal contact data is published.** The export intentionally excludes the
  Contacts table — this repo and the deployed site are public.

## Project layout

```
public/data/                     # the static snapshots the app reads
scripts/export-airtable.mjs      # Airtable → ecosystem.json
scripts/fetch-place-data.mjs     # Community Data Explorer → place-*.json
src/
  types.ts, types/place.ts       # data models
  context/                       # Data / Place / Detail providers
  components/explore/            # map, sidebar cards, place report, ecosystem layers
  components/FramingTab.tsx      # Core Functions framework + record unfurls
  components/FrameworkTab.tsx    # glossary & investment strategies
  components/detail/             # click-through detail drawer panels
  App.tsx                        # header + three tabs
```

Data sources: U.S. Climate Vulnerability Index (Lewis et al. 2023) · CDC/ATSDR SVI 2022
(ACS 5-year estimates) · Federal Reserve Bank of St. Louis Community Investment Explorer.
