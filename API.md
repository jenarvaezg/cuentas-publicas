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
- `/api/v1/ccaa-foral-flows.json` — flujos forales de Navarra y País Vasco (aportación/cupo)
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

## Contrato de versión

- `v1` es estable para campos existentes.
- Nuevos campos se añadirán de forma **aditiva** cuando sea posible.
- Cambios incompatibles se publicarán bajo una nueva versión (`/api/v2/...`).

## Frescura y fallback

- La actualización automática se ejecuta semanalmente (GitHub Actions).
- Cuando una fuente oficial falla, pueden aparecer valores de fallback con trazabilidad en `sourceAttribution`.
- En pensiones, si falla todo el scraping de Seguridad Social, `meta.json` marcará `criticalFallback` y CI abrirá alerta automática.

## Ejemplos de uso

```bash
curl -s https://cuentas-publicas.es/api/v1/debt.json | jq '.current.totalDebt'
curl -s https://cuentas-publicas.es/api/v1/meta.json | jq '.sources'
```
