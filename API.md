# API pública (versionada)

Fecha de actualización de esta documentación: **23 febrero 2026**.

El proyecto expone una API estática versionada en JSON bajo:

- `/api/v1/`

No requiere autenticación y está pensada para consumo de lectura (dashboards, análisis y automatizaciones ligeras).

## Endpoints v1

- `/api/v1/index.json` — catálogo de endpoints y metadatos de frescura
- `/api/v1/debt.json` — deuda pública PDE e histórico
- `/api/v1/pensions.json` — pensiones, nómina y métricas derivadas
- `/api/v1/demographics.json` — población, EPA, PIB, salario, IPC, vital statistics y pirámide demográfica
- `/api/v1/budget.json` — gasto COFOG por año/categoría
- `/api/v1/revenue.json` — ingresos y gastos públicos (Eurostat)
- `/api/v1/eurostat.json` — comparativa UE por indicador
- `/api/v1/ccaa-debt.json` — deuda por comunidad autónoma
- `/api/v1/tax-revenue.json` — recaudación tributaria por impuesto y CCAA (AEAT)
- `/api/v1/ccaa-fiscal-balance.json` — impuestos cedidos vs transferencias por CCAA (régimen común, Hacienda)
- `/api/v1/ccaa-spending.json` — gasto funcional COFOG por CCAA (administración regional, IGAE)
- `/api/v1/ccaa-deficit.json` — déficit/superávit (B.9) por CCAA (Contabilidad Nacional, IGAE)
- `/api/v1/ccaa-foral-flows.json` — flujos forales de Navarra y País Vasco (aportación/cupo) y recaudación tributaria (`taxRevenue`)
- `/api/v1/flows.json` — red de flujos balanceada (nodos y enlaces Sankey) consolidando ingresos y gastos
- `/api/v1/social-economy.json` — Cuenta Satélite de la Economía Social: VAB, empleo y PIB (INE)
- `/api/v1/living-conditions.json` — Encuesta de Condiciones de Vida: Tasa AROPE, Gini y renta media (INE)
- `/api/v1/ss-sustainability.json` — sostenibilidad SS: cotizaciones, gasto pensiones, Fondo de Reserva, cotizantes/pensionista y proyecciones
- `/api/v1/meta.json` — estado del pipeline y frescura por fuente
- `/api/openapi.json` — especificación OpenAPI mínima del contrato público

### demographics.json — Schema

Contiene datos de población, económicos y demográficos (vitalStats, lifeExpectancy, pyramid con desglose por origen migratorio, ratios de dependencia e inmigración).

```
vitalStats: {                          // 30-year time series
  birthRate: [{ year, value }],        // per 1000 hab
  deathRate: [{ year, value }],        // per 1000 hab
  fertilityRate: [{ year, value }],    // children/woman
  naturalGrowth: [{ year, value }],    // per 1000 hab
}
lifeExpectancy: {                      // 30-year time series
  both: [{ year, value }],             // years
  male: [{ year, value }],
  female: [{ year, value }],
}
pyramid: {                             // population by age/sex/origin
  years: number[],
  ageGroups: string[],                 // "0-4" to "90+"
  regions: string[],                   // 6 birth-region keys
  byYear: { [year]: { male: { [region]: number[] }, female: { [region]: number[] } } }
}
dependencyRatio: {                     // derived from pyramid
  oldAge: number,                      // pop65+ / pop15-64
  youth: number,                       // pop0-14 / pop15-64
  total: number,
}
immigrationShare: {                    // derived from pyramid
  total: number,                       // fraction foreign-born
  byRegion: { [region]: number },
  historical: [{ year, share }],
}
```

### flows.json — Schema

Contiene los nodos, los enlaces balanceados y el agregado macro para el diagrama de Sankey.

```json
{
  nodes: [{ 
    id: string, 
    label: string, 
    group: string,         // e.g., "income", "expense"
    amount: number,        // absolute value
    format: string         // "currency", "percentage", "none"
  }],
  links: [{ 
    id: string, 
    source: string, 
    target: string, 
    amount: number, 
    label: string 
  }],
  macro: {
    revenue: number,
    expenditure: number,
    deficit: number,
    surplus: number
  }
}
```

### ccaa-deficit.json — Schema

Déficit o superávit oficial por Comunidad Autónoma según Contabilidad Nacional (B.9 SEC 2010).

```json
{
  latestYear: number,
  data: {
    [ccaaCode]: number     // CA01...CA17 in MIO_EUR
  },
  sourceAttribution: { ccaaDeficit: DataSourceAttribution }
}
```

### ss-sustainability.json — Schema

Sostenibilidad del sistema de Seguridad Social: serie histórica de cotizaciones vs gasto contributivo (D62PAY), Fondo de Reserva, ratio cotizantes/pensionista y proyecciones del Ageing Report.

```
latestYear: number,
years: number[],
byYear: {
  [year]: {
    socialContributions: number,   // M EUR
    pensionExpenditure: number,    // M EUR (gasto contributivo en efectivo)
    ssBalance: number,             // cotizaciones - gasto
    pensionToGDP: number,          // % PIB
  }
},
pensionToGDP: {
  spain: { years: number[], byYear: { [year]: number } },
  eu27:  { years: number[], byYear: { [year]: number } },
},
reserveFund: [{ year: number, balance: number }],          // M EUR, 2000-2025
contributorsPerPensioner: [{ year: number, ratio: number }], // 2006-2025
projections: {
  source: string,
  url: string,
  spain: [{ year: number, pensionToGDP: number }],         // 2022-2070
  eu27:  [{ year: number, pensionToGDP: number }],
},
sourceAttribution: { ssSustainability: DataSourceAttribution }
```

### social-economy.json — Schema

Cuenta Satélite de la Economía Social del INE: peso económico y laboral de cooperativas, mutuas y otras entidades del sector.

```json
{
  "lastUpdated": "string (ISO)",
  "vab": number,           // Valor Añadido Bruto en euros
  "pibShare": number,      // % sobre el PIB nacional
  "employmentShare": number, // % sobre el empleo total
  "totalJobs": number,     // Número de empleos directos
  "referenceYear": number, // Año de referencia de los datos
  "sourceAttribution": DataSourceAttribution
}
```

### living-conditions.json — Schema

Encuesta de Condiciones de Vida (INE): indicadores de riesgo de pobreza, desigualdad y renta.

```json
{
  "lastUpdated": "string (ISO)",
  "arope": number,         // Tasa AROPE (%)
  "gini": number,          // Índice de Gini (0-100)
  "averageIncome": number, // Renta media neta anual por persona (EUR)
  "referenceYear": number,
  "sourceAttribution": {
    "arope": DataSourceAttribution,
    "gini": DataSourceAttribution,
    "averageIncome": DataSourceAttribution
  }
}
```

### pensions-regional.json — Schema

Pensión media y total mensual y anual distribuida por Comunidades Autónomas, obtenida desde el informe "CA Total Sistema" (EST24).

```
latestYear: number,
byYear: {
  [year]: {
    year: number,
    date: string,
    dateLabel: string,
    entries: [
      {
        code: string,         // e.g. "CA01"
        name: string,         // e.g. "ANDALUCÍA"
        annualAmount: number, // EUR
        monthlyAmount: number, // EUR
        pensionsCount: number
      }
    ]
  }
},
source: string,
url: string
```

## Contrato de versión

- `v1` es estable para campos existentes.
- Nuevos campos se añadirán de forma **aditiva** cuando sea posible.
- Cambios incompatibles se publicarán bajo una nueva versión (`/api/v2/...`).

## Frescura y fallback

- La actualización automática se ejecuta semanalmente (GitHub Actions).
- Cuando una fuente oficial falla, pueden aparecer valores de fallback con trazabilidad en `sourceAttribution`.
- En pensiones, si falla todo el scraping de Seguridad Social, `meta.json` marcará `criticalFallback` y CI abrirá alerta automática.

## Tipos de atribución de fuente (`sourceAttribution`)

Los objetos `DataSourceAttribution` pueden presentar los siguientes tipos:

- `"api"` — dato descargado de una API oficial (INE, Eurostat).
- `"csv"` / `"xlsx"` — dato parseado de fichero CSV o Excel oficial (BdE, IGAE, SS).
- `"fallback"` — dato de referencia hardcodeado que se activa cuando la fuente oficial no responde.
- `"derived"` — calculado a partir de otros campos (e.g. déficit = gasto − ingresos).
- `"cross-reference"` — dato enriquecido desde otro pipeline interno. En `pensions.json`, los campos `socialContributions`, `reserveFund` y `affiliates` usan este tipo: se obtienen del pipeline `ss-sustainability` (Eurostat `gov_10a_main` D61REC, serie RESERVE_FUND_HISTORY y ratio cotizantes/pensionista respectivamente) en lugar de estimaciones hardcodeadas.

## Ejemplos de uso

```bash
curl -s https://cuentas-publicas.es/api/v1/debt.json | jq '.current.totalDebt'
curl -s https://cuentas-publicas.es/api/v1/meta.json | jq '.sources'
```
