# Cuentas Públicas de España

Dashboard fiscal interactivo que muestra en tiempo real la deuda pública, el gasto en pensiones y el gasto público por funciones (COFOG) de España, utilizando exclusivamente datos oficiales.

**[Ver el dashboard](https://jenarvaezg.github.io/cuentas-publicas/)**

## Funcionalidades

- **Contador de deuda en tiempo real** — extrapola desde los últimos 24 meses del Banco de España mediante regresión lineal
- **Gasto en pensiones** — nómina mensual, pensión media, ratio afiliados/pensionistas
- **Gasto público COFOG (1995-2024)** — clasificación funcional con drilldown por subcategorías
- **Comparativa interanual** — modos absoluto, % peso y % cambio, con opción de euros reales (ajustados por IPC) o corrientes
- **Modo oscuro/claro** — respeta la preferencia del sistema

## Fuentes de datos

| Fuente | Datos | Frecuencia |
|--------|-------|------------|
| [Banco de España](https://www.bde.es) | Deuda PDE mensual, déficit trimestral | Mensual |
| [INE (API Tempus)](https://www.ine.es) | Población, EPA, PIB, salario medio, IPC | Trimestral/Anual |
| [Seguridad Social](https://www.seg-social.es) | Nómina de pensiones contributivas | Mensual |
| [IGAE](https://www.igae.pap.hacienda.gob.es) | Gasto funcional COFOG (Total AAPP) | Anual |

Los datos se actualizan automáticamente cada lunes a las 08:00 UTC via GitHub Actions. Si una fuente falla, el dashboard sigue funcionando con los últimos datos conocidos (patrón fallback).

## Tech stack

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS
- **Charts**: Recharts
- **UI primitives**: shadcn/ui (Card, Tooltip)
- **Data pipeline**: Node.js scripts (ESM), xlsx para parsing de Excel
- **Lint/Format**: Biome
- **Tests**: Vitest
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

# Lint y formato
npm run lint           # verificar
npm run format         # auto-fix
```

## Arquitectura

El proyecto tiene dos runtimes en un solo repo:

1. **Scripts de datos** (`scripts/`) — pipeline Node.js que descarga de APIs/ficheros oficiales y genera JSON en `src/data/`. Se ejecuta en CI semanalmente o localmente con `npm run download-data`.

2. **SPA React** (`src/`) — importa los JSON en build time. Sin backend, sin llamadas a API en runtime.

```
scripts/sources/{bde,ine,seguridad-social,igae}.mjs
  → scripts/download-data.mjs (orquestador, Promise.allSettled)
    → src/data/{debt,demographics,pensions,budget,meta}.json
      → src/hooks/useData.ts (useMemo, retorna todos los datos)
        → Componentes (DebtBlock, PensionsBlock, BudgetBlock, etc.)
```

## CI/CD

| Workflow | Trigger | Acciones |
|----------|---------|----------|
| `deploy.yml` | Push a `main` | lint → test → build → deploy GitHub Pages |
| `update-data.yml` | Lunes 08:00 UTC / manual | download-data → auto-commit si hay cambios |

## Metodología

El dashboard incluye una sección de Metodología expandible que documenta en detalle cada fuente de datos, los cálculos derivados (per cápita, ratios, regresión lineal) y la fórmula de deflación IPC para la comparativa en euros reales.

## Licencia

Proyecto educativo con fines informativos. Los datos provienen de fuentes oficiales públicas. Para datos oficiales y actualizados, consulta siempre las fuentes primarias.
