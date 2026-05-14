# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Spanish fiscal dashboard showing real-time public debt, pension spending, and government expenditure (COFOG). Static SPA deployed to GitHub Pages with data refreshed weekly via GitHub Actions.

## Commands

```bash
npm run dev              # Vite dev server (HMR)
npm run build            # TypeScript check + Vite production build
npm run test             # Vitest (run once)
npm run test:coverage    # Vitest + coverage report
npm run test:watch       # Vitest (watch mode)
npm run test:e2e         # Playwright smoke suite
npm run lint             # Biome check src/ scripts/
npm run format           # Biome format src/ scripts/ --write
npm run download-data    # Fetch all data sources → src/data/*.json
```

## Architecture

### Two runtimes, one repo

1. **Node scripts** (`scripts/`) — data pipeline that fetches from official Spanish government APIs/files and writes JSON to `src/data/`. Runs in CI weekly or locally via `npm run download-data`. Pure ESM (`.mjs`), uses `xlsx` for Excel parsing.

2. **React SPA** (`src/`) — Vite + React 19 + TypeScript + Tailwind. Imports the JSON files at build time. No backend, no API calls at runtime.

### Data flow

```
scripts/sources/{bde,ine,seguridad-social,igae,eurostat,aeat}.mjs
  → scripts/download-data.mjs (orchestrator, parallel Promise.allSettled)
    → src/data/{debt,demographics,pensions,budget,eurostat,ccaa-debt,revenue,tax-revenue,meta}.json
      → src/hooks/useData.ts (single useMemo, returns all data)
        → Section components (DebtBlock, PensionsBlock, RevenueBlock, BudgetBlock, etc.)
```

### Data sources

| Source | File | What it fetches |
|--------|------|-----------------|
| Banco de España | `bde.mjs` | Monthly debt CSV (be11b.csv), quarterly debt/GDP ratio (be1101.csv) |
| INE (Tempus API) | `ine.mjs` | Population, active population (EPA), GDP, avg salary, CPI (IPC) |
| Seguridad Social | `seguridad-social.mjs` | Pension payroll Excel (scraped from HTML page, UUID URLs) |
| IGAE | `igae.mjs` | COFOG functional expenditure Excel (Total AAPP, S.13) |
| Eurostat | `eurostat.mjs` | EU comparison indicators + Spain revenue/expenditure time series |
| AEAT | `aeat.mjs` | Tax revenue by type (national monthly series) + by CCAA (delegaciones) |

All fetches use `scripts/lib/fetch-utils.mjs` (retry with exponential backoff + `AbortSignal.timeout`). Each source has hardcoded fallback/reference data used when downloads fail.

### Key patterns

- **Realtime counters**: `useRealtimeCounter` uses `requestAnimationFrame` + direct DOM mutation via refs (zero React re-renders). Returns `{ displayRef, ariaRef }` — no state.
- **Data types**: All data shapes defined in `src/data/types.ts` (`DebtData`, `PensionData`, `BudgetData`, `DemographicsData`).
- **Source attribution**: Every displayed metric links back to its source via `DataSourceAttribution` objects. UI sources defined in `src/data/sources.ts`.
- **COFOG columns**: `igae.mjs` first detects columns dynamically from header codes (`XX.N`), then falls back to hardcoded constants if detection fails.
- **Spanish locale**: All number formatting uses `es-ES` locale (comma decimal, dot thousands). CSV parsing handles Spanish format.
- **Linear regression**: Debt counter extrapolates from last 24 months of BdE data using slope/intercept stored in `debt.json.regression`.
- **CPI deflation**: `useDeflator` hook provides `deflate(amount, year)` using CPI data from `demographics.json.cpi`. Base year = latest COFOG year (2024). Used in BudgetBlock comparison mode to show euros reales vs corrientes.

### UI components

- `src/components/ui/` — shadcn/ui primitives (Card, Tooltip)
- `StatCard` — reusable metric card with optional sparkline, trend indicator, and source attribution popover
- `BudgetChart` — Recharts horizontal bar chart with drilldown into COFOG subcategories
- `SparklineChart` — minimal inline chart for StatCards

## Conventions

- **Coverage**: target **90-95%** coverage for critical business logic and data scripts. Current baseline can be below target; every change should maintain or improve coverage and avoid regressions.
- **Language/i18n**: All user-facing UI text must be translatable and sourced from `src/i18n/messages.ts` with both `es` and `en` entries (no hardcoded strings in components, except source datasets). Code (variables, comments, commits) in English.
- **Translation delivery**: Whenever copy changes, update the matching English/Spanish entries in `messages.ts`, keep the static `public/en/sections/*.html` snapshots in sync, and document language-specific behavior (OG tags, canonical paths) in this guide so future contributors know to adjust both locales together.
- **Formatting**: Biome — 2-space indent, double quotes, trailing commas, semicolons, 100 char line width.
- **Path alias**: `@/` maps to `src/` (configured in tsconfig.json and vite.config.ts).
- **No mutation**: Return new objects, never mutate existing data structures.
- **Fallback pattern**: Every data source has reference data so the app works even if all downloads fail.
- **Methodology sync**: When adding/modifying a data source or derived metric, update `src/components/MethodologySection.tsx` to reflect the change. This section is the user-facing documentation of all sources and calculations.
- **README sync**: When changing architecture, data sources, tech stack, or commands, update `README.md` to match. README mirrors CLAUDE.md content in user-facing format.
- **Data registry sync**: When adding, removing, or modifying a data source, metric, or hardcoded value in `scripts/sources/`, update `DATA-REGISTRY.md` and `API.md` to reflect the change in the same PR. These files are the single source of truth for what data we have, how it's obtained, and what endpoints are published.
- **Roadmap sync**: When completing a feature listed in the roadmap/wishlist (`src/components/RoadmapSection.tsx`), move it from the wishlist to the completed items in the appropriate phase (both `es` and `en` copies). Always check the roadmap at the end of a feature implementation.
- **StatCard tooltip quality**: Every `StatCard` MUST have a `tooltip` prop with a meaningful, plain-language explanation (both `es` and `en`). Tooltips must explain the metric as if talking to a non-expert friend — what it is, why it matters, or what it compares against. NEVER use a generic description like "Este indicador muestra {label}." or just repeat the label. Good example: "Lo que debe cada habitante de España si repartiéramos la deuda por igual entre toda la población." Bad example: "Este indicador muestra deuda per cápita."
- **Domain language**: see `CONTEXT.md` for the canonical glossary. Key rules that come up constantly:
  - **"Déficit" a secas está prohibido** en copy nuevo, código y atribuciones. Tres conceptos canónicos: *Déficit público* (B.9 sobre S.13), *Déficit contributivo* (D61REC−D62PAY sobre S.1314), *Déficit contributivo acumulado* (integral desde 2009).
  - **"Coste de la deuda" solo como copy de UI**. En código, datasets y `sourceAttribution` usar *Intereses de la deuda* (pagos anuales por servicio financiero, sin amortizaciones). El ratio derivado se llama *Tipo medio de la deuda*.
  - **Cobertura territorial**: la UI opera sobre `CA01`–`CA17`. `CA18`/`CA19` (Ceuta/Melilla) solo existen en datasets nacionales donde excluirlas descuadre totales; declararlo con la bandera `includesCeutaMelilla`. Detalle: ADR-0001.
- **Roadmap dual update**: `ROADMAP.md` es la fuente única de verdad (ADR-0002). Al cerrar o abrir items, actualizar `ROADMAP.md` **y** `src/components/RoadmapSection.tsx` (ambas variantes `es`/`en`) en el mismo commit. RoadmapSection se renderiza tras la Metodología en `App.tsx`.

## CI/CD

- `.github/workflows/deploy.yml` — On push to main: lint → test → build → deploy to GitHub Pages.
- `.github/workflows/update-data.yml` — Weekly (Monday 08:00 UTC): run `download-data`, auto-commit if data changed. Only commits on `success()`.

## Agent skills

### Issue tracker

Issues live as GitHub issues on `jenarvaezg/cuentas-publicas`, managed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical defaults (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at the repo root (neither file exists yet — they'll be created lazily by `/grill-with-docs`). See `docs/agents/domain.md`.
