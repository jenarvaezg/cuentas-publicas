# API pública (versionada)

Fecha de actualización de esta documentación: **21 febrero 2026**.

El proyecto expone una API estática versionada en JSON bajo:

- `/api/v1/`

No requiere autenticación y está pensada para consumo de lectura (dashboards, análisis y automatizaciones ligeras).

## Endpoints v1

- `/api/v1/index.json` — catálogo de endpoints y metadatos de frescura
- `/api/v1/debt.json` — deuda pública PDE e histórico
- `/api/v1/pensions.json` — pensiones, nómina y métricas derivadas
- `/api/v1/demographics.json` — población, EPA, PIB, salario e IPC
- `/api/v1/budget.json` — gasto COFOG por año/categoría
- `/api/v1/revenue.json` — ingresos y gastos públicos (Eurostat)
- `/api/v1/eurostat.json` — comparativa UE por indicador
- `/api/v1/ccaa-debt.json` — deuda por comunidad autónoma
- `/api/v1/tax-revenue.json` — recaudación tributaria por impuesto y CCAA (AEAT)
- `/api/v1/meta.json` — estado del pipeline y frescura por fuente
- `/api/openapi.json` — especificación OpenAPI mínima del contrato público

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
