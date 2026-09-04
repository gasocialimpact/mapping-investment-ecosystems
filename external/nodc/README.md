# Nonprofit Open Data Collective (NODC) — vendored, read-only

Everything under `external/nodc/` is a **git submodule** pointing at a repository owned
by the [Nonprofit Open Data Collective](https://github.com/Nonprofit-Open-Data-Collective).
This project only *reads* from these directories. It never edits, builds into, or
commits to them, and it has no write access to the upstream repositories.

A submodule is just a pointer: our repo records *which commit* of theirs we rely on.
Their code stays in their repository, under their license and their history. Updating
the pointer (see below) is the only change we ever make here, and it is a change to
**our** repo, not theirs.

## What is here and why

| Directory | Upstream | Language | Why we track it |
|---|---|---|---|
| `ef2/` | [ef2](https://github.com/Nonprofit-Open-Data-Collective/ef2) | R | The current (Gen 2) pipeline that turns raw IRS 990 e-file XML into rectangular tables. It replaces the deprecated `irs990efile` package. NCCS publishes its output tables, which our adapter script consumes. |
| `irs-efile-master-concordance-file/` | [irs-efile-master-concordance-file](https://github.com/Nonprofit-Open-Data-Collective/irs-efile-master-concordance-file) | CSV + docs | The "Rosetta stone": maps ~10,000 XML xpaths to the standardized variable names (`F9_01_REV_TOT_CY`, …) used in the published tables. Our adapter reads `concordance.csv` to label the fields it exports. License: ODC-By 1.0. |
| `efile-download/` | [efile-download](https://github.com/Nonprofit-Open-Data-Collective/efile-download) | R | Reference script for pulling the raw yearly XML bundles from the IRS "Form 990 Series Download" page, should we ever need to go upstream of NCCS. |
| `irs-exempt-org-business-master-file/` | [irs-exempt-org-business-master-file](https://github.com/Nonprofit-Open-Data-Collective/irs-exempt-org-business-master-file) | R | Documents the IRS Business Master File (EIN, NTEE code, ruling date, subsection) and its four regional CSV URLs. Useful reference for matching organizations without EINs. |

The NODC tools are R packages. This project does not run R; instead
[`scripts/fetch-990-data.mjs`](../../scripts/fetch-990-data.mjs) streams the CSV tables
that ef2 produces (hosted by the Urban Institute's National Center for Charitable
Statistics) and filters them down to Georgia filers. See the root README, section
"IRS 990 data".

## Working with the submodules

Fresh clone (submodules are not fetched by default):

```bash
git clone --recurse-submodules https://github.com/gasocialimpact/mapping-investment-ecosystems.git
```

Existing clone:

```bash
git submodule update --init --depth 1
```

Move to the latest upstream commit (this is the *only* legitimate change in here):

```bash
git submodule update --remote --depth 1 external/nodc/<name>
git add external/nodc/<name>
git commit -m "chore: bump NODC <name> submodule"
```

## Rules

1. **Never edit files inside these directories.** If something upstream needs changing,
   open an issue or pull request on the NODC repository. Local edits would be invisible
   to our repo anyway (they live in the submodule's own git tree) and would be lost on
   the next update.
2. **Never write build output here.** Our adapter writes to `public/data/` only.
3. **Never `cd` into a submodule and push.** We have no write access, and there is no
   reason to try.
4. `npm run build`, `tsc`, and Vite do not look at `external/` (`tsconfig.json`
   includes only `src/`; Vite serves `public/`). The GitHub Pages deploy workflow checks
   out the repo *without* submodules, so the site never depends on them being present.

## Citation

If data derived from these tools is published, cite:

> Lecy, J. (2025). The irs990efile Package for R (v1.0.0). Zenodo. https://doi.org/10.5281/zenodo.14736813
>
> Lecy, J. (2024). IRS 990 Efiler Concordance File (v1.0.0) [Data set]. Zenodo. https://doi.org/10.5281/zenodo.14544301

Data dictionary for the published tables:
https://nonprofit-open-data-collective.github.io/irs990efile/data-dictionary/data-dictionary.html
