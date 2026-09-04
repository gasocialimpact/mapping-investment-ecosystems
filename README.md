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

Paste both tags. The script is what makes the embed behave — without it the frame is a
fixed box that the content either overflows or rattles around inside.

```html
<iframe
  src="https://gasocialimpact.github.io/mapping-investment-ecosystems/"
  data-ecosystem-map
  width="100%" height="1200"
  title="Georgia's Impact Investing Ecosystem Map"
  allow="clipboard-write"
  style="border:none;border-radius:8px;display:block;width:100%"></iframe>
<script src="https://gasocialimpact.github.io/mapping-investment-ecosystems/embed.js"></script>
```

`public/embed.js` resizes the frame to the content and tells the tool where the browser
window sits. The tool (`src/lib/embed.ts`, `src/context/EmbedContext.tsx`) then lays out in
one continuous flow — no scrollbar inside a scrollbar — and opens record modals in view
rather than at the top of a tall frame. Content height is reported from a `ResizeObserver`,
so the frame follows tab switches, accordions and county reports.

Three layout modes, picked automatically:

| Mode | When | Behavior |
|---|---|---|
| `standalone` | not in a frame | fills the viewport, scrolls internally |
| `framed` | in a frame, no snippet | fills the frame, scrolls internally |
| `flow` | host snippet answered | grows to content; the page owns the scrollbar |

Notes on the two attributes that are easy to drop:

- `data-ecosystem-map` is how the script finds the frame. Without it nothing happens.
- `allow="clipboard-write"` lets the **snapshot buttons** copy a PNG straight to the
  clipboard — a cross-origin iframe does not get that permission by default. Without it
  the button downloads the PNG instead.

The `height` is only what shows before the tool reports its own.

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

### IRS 990 data (Nonprofit Open Data Collective)

Two IRS extracts feed the **Organizational Financials** layer and fill in basic
organizational details (EIN, legal name, IRS codes) automatically:

| File | Source | Contents |
|---|---|---|
| `irs990-georgia.json` | NCCS-published tables from the NODC `ef2` pipeline | Every Georgia Form 990 / 990-EZ e-filer, latest three tax years: Part I financials (revenue, expenses, assets, grants paid, staff, volunteers), Part X balance sheet (securities, program-related investments, cash, loans, debt, net-asset classes), mission text |
| `irs-bmf-georgia.json` | IRS Exempt Organizations Business Master File | Every currently exempt Georgia organization (~62k): subsection, NTEE code, foundation status, ruling year, address, latest assets / income / revenue. Also covers 990-PF and 990-N filers, which the e-file tables do not |

Both extracts are Georgia-first but not Georgia-only: any EIN already recorded in Airtable (and
therefore present in `ecosystem.json`) is kept from the national files whatever its state, so
out-of-state funders such as Kresge or Casey get IRS data at their actual location.

Both are built by `scripts/fetch-990-data.mjs`. The
[Nonprofit Open Data Collective](https://github.com/Nonprofit-Open-Data-Collective)
repositories are vendored as **read-only git submodules** under
[`external/nodc/`](external/nodc/README.md); this project never modifies them. Their
tools are R packages, so rather than running them we stream their published output
(nationwide CSVs, ~250 MB per year plus ~350 MB of BMF) and keep only Georgia rows.
Nothing raw is stored.

**How the join works.** Airtable holds the `EIN` on each Organization and is the
source of truth. `scripts/sync-irs-to-airtable.mjs` fills in missing EINs by matching
organization name and city against both extracts (recording how in `EIN Match`; set it
to *Verified* to lock an EIN), and refreshes the read-only IRS fields (`IRS Legal
Name`, `IRS Subsection`, `NTEE Code`, `IRS Foundation Status`, `IRS Ruling Year`, `IRS
Address`, `IRS Last Synced`). It also fills a blank `Street Address` (from the BMF, skipping
PO boxes) or `Website` (from the latest 990) but never overwrites a value you entered, and
skips gap-filling entirely on records whose `EIN Match` is *Verified* (set that to keep a
field deliberately blank).
The Airtable export then attaches an `irs` block to each
organization in `ecosystem.json`, which the organization record modal renders as the
IRS Profile, Financials, Balance Sheet Detail and Trend sections.

```bash
git submodule update --init --depth 1               # optional: field labels come from the concordance submodule
npm run fetch-990-data                              # NCCS + BMF → irs990-georgia.json, irs-bmf-georgia.json
IRS990_YEARS=2019-2022 npm run fetch-990-data       # pick tax years
AIRTABLE_TOKEN=<token> npm run sync-irs -- --dry-run   # preview EIN assignments
AIRTABLE_TOKEN=<token> npm run sync-irs             # write EINs + IRS fields to Airtable
AIRTABLE_TOKEN=<token> npm run export-data          # rebuild ecosystem.json with the irs block
```

### Merging the Data Libraries directory

`scripts/merge-data-libraries.mjs` folds the *Comprehensive Organizational Record Directory*
(Data Libraries base) into an Organizations table by normalized name: new names are created,
blank fields (description, website, segment, type, street address, EIN, City link) are filled,
and disagreements are reported as conflicts but never applied. It is a dry run by default and
refuses to write to production unless `--allow-production` is passed, so rehearse on a
duplicate of the base first:

```bash
AIRTABLE_TOKEN=<token> TARGET_BASE_ID=<sandbox base id> npm run merge-data-libraries            # plan only
AIRTABLE_TOKEN=<token> TARGET_BASE_ID=<sandbox base id> npm run merge-data-libraries -- --apply
```

Rows with nothing but a name are listed under `bareNamesNotCreated` in the plan rather than
created (`--include-bare` overrides).

The extracts are refreshed quarterly and on demand by `.github/workflows/sync-irs990.yml`;
the nightly `sync-airtable.yml` runs the EIN sync before the export so new organizations
pick up their IRS data the next morning.

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
scripts/fetch-990-data.mjs       # NCCS / NODC 990 tables + IRS BMF → irs990-georgia.json, irs-bmf-georgia.json
scripts/sync-irs-to-airtable.mjs # EIN matching + IRS fields → Airtable Organizations
external/nodc/                   # read-only NODC submodules (ef2, concordance, …)
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
