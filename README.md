# Cuentas Públicas de España

Dashboard fiscal interactivo que muestra en tiempo real la deuda pública, el gasto en pensiones y el gasto público por funciones (COFOG) de España, usando fuentes oficiales y estimaciones explícitas cuando no existe API pública.

**[Ver el dashboard](https://jenarvaezg.github.io/cuentas-publicas/)**

## Funcionalidades

- **Contador de deuda en tiempo real** — extrapola desde los últimos 24 meses del Banco de España mediante regresión lineal
- **Gasto en pensiones** — nómina mensual, pensión media, ratio afiliados/pensionistas
- **Gasto público COFOG (1995-2024)** — clasificación funcional con drilldown por subcategorías
- **Ingresos vs gastos públicos (1995-2024)** — Eurostat (`TR`, `TE`, `B9`, `D2REC`, `D5REC`, `D61REC`)
- **Deuda por CCAA** — ranking de 17 comunidades con vista `% PIB` y `€`
- **Comparativa interanual** — modos absoluto, % peso y % cambio, con opción de euros reales (ajustados por IPC) o corrientes
- **Modo oscuro/claro** — respeta la preferencia del sistema
  - **i18n ES/EN (interfaz + contenidos largos)** — selector persistente (ruta `/en/` para la versión en inglés) + metodología/roadmap bilingües
- **PWA offline hardening** — caché runtime y fallback offline
- **SEO/SSG multi-ruta** — `seo-snapshot.html` + `sitemap.xml` + páginas por sección (`/secciones/*`, `/en/sections/*`)
- **Notificaciones RSS** — feed de actualizaciones en `/feed.xml`

## Fuentes de datos

| Fuente | Datos | Frecuencia |
|--------|-------|------------|
| [Banco de España](https://www.bde.es) | Deuda PDE mensual, ratio deuda/PIB trimestral | Mensual/Trimestral |
| [INE (API Tempus)](https://www.ine.es) | Población, EPA, PIB, salario medio, IPC | Trimestral/Anual |
| [Seguridad Social](https://www.seg-social.es) | Nómina de pensiones contributivas | Mensual |
| [IGAE](https://www.igae.pap.hacienda.gob.es) | Gasto funcional COFOG (Total AAPP) | Anual |
| [Eurostat](https://ec.europa.eu/eurostat) | Comparativa UE e ingresos/gastos públicos | Anual |

Los datos se actualizan automáticamente cada lunes a las 08:00 UTC via GitHub Actions. Si una fuente falla, el dashboard sigue funcionando con los últimos datos conocidos (patrón fallback).

## Tech stack

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS
- **Charts**: Recharts
- **UI primitives**: shadcn/ui (Card, Tooltip)
- **Data pipeline**: Node.js scripts (ESM), xlsx para parsing de Excel
- **Lint/Format**: Biome
- **Tests**: Vitest + Playwright (smoke E2E)
- **Git hooks**: Husky + lint-staged
- **Deploy**: GitHub Pages (via GitHub Actions)

## Desarrollo local

```bash
# Instalar dependencias
npm install

# Descargar datos frescos de todas las fuentes
npm run download-data

# Servidor de desarrollo (HMR)
npm run dev

# Tests
npm run test           # una vez
npm run test:watch     # modo watch
npm run test:e2e       # smoke E2E (Playwright)

# Lint y formato
npm run lint           # verificar
npm run format         # auto-fix
```

## Arquitectura

El proyecto tiene dos runtimes en un solo repo:

1. **Scripts de datos** (`scripts/`) — pipeline Node.js que descarga de APIs/ficheros oficiales y genera JSON en `src/data/`. Se ejecuta en CI semanalmente o localmente con `npm run download-data`.

2. **SPA React** (`src/`) — importa los JSON en build time. Sin backend, sin llamadas a API en runtime.

```
scripts/sources/{bde,ine,seguridad-social,igae,eurostat}.mjs
  → scripts/download-data.mjs (orquestador, Promise.allSettled)
    → src/data/{debt,demographics,pensions,budget,eurostat,ccaa-debt,revenue,meta}.json
    → public/api/v1/*.json + public/feed.xml + public/sitemap.xml + public/secciones/*.html + public/en/sections/*.html
      → src/hooks/useData.ts (useMemo, retorna todos los datos)
        → Componentes (DebtBlock, PensionsBlock, RevenueBlock, BudgetBlock, etc.)
```

## CI/CD

| Workflow | Trigger | Acciones |
|----------|---------|----------|
| `deploy.yml` | Push/PR a `main` | lint → test → build (deploy solo en push a `main`) |
| `update-data.yml` | Lunes 08:00 UTC / manual | download-data → auto-commit si hay cambios |

## API pública

La web expone una API JSON estática versionada en `/api/v1/`.

- Catálogo: `/api/v1/index.json`
- Datos: `/api/v1/{debt,pensions,demographics,budget,revenue,eurostat,ccaa-debt,meta}.json`
- OpenAPI: `/api/openapi.json`

Documentación y política de versionado: [`API.md`](API.md).

## Feed RSS

- Feed de actualización de datos: `/feed.xml`
- Incluye publicación global del último run y un item por fuente monitorizada.

## Metodología

El dashboard incluye una sección de Metodología expandible que documenta en detalle cada fuente de datos, los cálculos derivados (per cápita, ratios, regresión lineal) y la fórmula de deflación IPC para la comparativa en euros reales.

## Discrepancias conocidas

Las discrepancias no resueltas en esta iteración (p. ej. ramas de error aún mejorables o verificación externa pendiente) están documentadas en [`DISCREPANCIAS-PENDIENTES.md`](DISCREPANCIAS-PENDIENTES.md).

## Licencia

Proyecto educativo con fines informativos. Los datos provienen de fuentes oficiales públicas. Para datos oficiales y actualizados, consulta siempre las fuentes primarias.
