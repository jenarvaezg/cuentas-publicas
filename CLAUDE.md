# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Spanish fiscal dashboard showing real-time public debt, pension spending, and government expenditure (COFOG). Static SPA deployed to GitHub Pages with data refreshed weekly via GitHub Actions.

## Commands

```bash
npm run dev              # Vite dev server (HMR)
npm run build            # TypeScript check + Vite production build
npm run test             # Vitest (run once)
npm run test:watch       # Vitest (watch mode)
npm run lint             # Biome check src/
npm run format           # Biome format src/ --write
npm run download-data    # Fetch all data sources → src/data/*.json
```

## Architecture

### Two runtimes, one repo

1. **Node scripts** (`scripts/`) — data pipeline that fetches from official Spanish government APIs/files and writes JSON to `src/data/`. Runs in CI weekly or locally via `npm run download-data`. Pure ESM (`.mjs`), uses `xlsx` for Excel parsing.

2. **React SPA** (`src/`) — Vite + React 19 + TypeScript + Tailwind. Imports the JSON files at build time. No backend, no API calls at runtime.

### Data flow

```
scripts/sources/{bde,ine,seguridad-social,igae}.mjs
  → scripts/download-data.mjs (orchestrator, parallel Promise.allSettled)
    → src/data/{debt,demographics,pensions,budget,meta}.json
      → src/hooks/useData.ts (single useMemo, returns all data)
        → Section components (DebtBlock, PensionsBlock, BudgetBlock, etc.)
```

### Data sources

| Source | File | What it fetches |
|--------|------|-----------------|
| Banco de España | `bde.mjs` | Monthly debt CSV (be11b.csv), quarterly deficit (be1101.csv) |
| INE (Tempus API) | `ine.mjs` | Population, active population (EPA), GDP, avg salary, CPI (IPC) |
| Seguridad Social | `seguridad-social.mjs` | Pension payroll Excel (scraped from HTML page, UUID URLs) |
| IGAE | `igae.mjs` | COFOG functional expenditure Excel (Total AAPP, S.13) |

All fetches use `scripts/lib/fetch-utils.mjs` (retry with exponential backoff + `AbortSignal.timeout`). Each source has hardcoded fallback/reference data used when downloads fail.

### Key patterns

- **Realtime counters**: `useRealtimeCounter` uses `requestAnimationFrame` + direct DOM mutation via refs (zero React re-renders). Returns `{ displayRef, ariaRef }` — no state.
- **Data types**: All data shapes defined in `src/data/types.ts` (`DebtData`, `PensionData`, `BudgetData`, `DemographicsData`).
- **Source attribution**: Every displayed metric links back to its source via `DataSourceAttribution` objects. UI sources defined in `src/data/sources.ts`.
- **COFOG columns**: `igae.mjs` has hardcoded column indices for the IGAE Excel structure (division totals, subcategory ranges). These are stable across AACC and AAPP files.
- **Spanish locale**: All number formatting uses `es-ES` locale (comma decimal, dot thousands). CSV parsing handles Spanish format.
- **Linear regression**: Debt counter extrapolates from last 24 months of BdE data using slope/intercept stored in `debt.json.regression`.
- **CPI deflation**: `useDeflator` hook provides `deflate(amount, year)` using CPI data from `demographics.json.cpi`. Base year = latest COFOG year (2024). Used in BudgetBlock comparison mode to show euros reales vs corrientes.

### UI components

- `src/components/ui/` — shadcn/ui primitives (Card, Tooltip)
- `StatCard` — reusable metric card with optional sparkline, trend indicator, and source attribution popover
- `BudgetChart` — Recharts horizontal bar chart with drilldown into COFOG subcategories
- `SparklineChart` — minimal inline chart for StatCards

## Conventions

- **Language**: UI text is in Spanish. Code (variables, comments, commits) in English.
- **Formatting**: Biome — 2-space indent, double quotes, trailing commas, semicolons, 100 char line width.
- **Path alias**: `@/` maps to `src/` (configured in tsconfig.json and vite.config.ts).
- **No mutation**: Return new objects, never mutate existing data structures.
- **Fallback pattern**: Every data source has reference data so the app works even if all downloads fail.
- **Methodology sync**: When adding/modifying a data source or derived metric, update `src/components/MethodologySection.tsx` to reflect the change. This section is the user-facing documentation of all sources and calculations.

## CI/CD

- `.github/workflows/deploy.yml` — On push to main: lint → test → build → deploy to GitHub Pages.
- `.github/workflows/update-data.yml` — Weekly (Monday 08:00 UTC): run `download-data`, auto-commit if data changed. Only commits on `success()`.
