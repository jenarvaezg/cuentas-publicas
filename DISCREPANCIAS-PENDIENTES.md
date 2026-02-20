# Discrepancias Pendientes

Última revisión interna: **20 febrero 2026**.

## AEAT — Índices de columna para subcategorías IIEE y Resto

**Severidad**: Media — afecta al drilldown de subcategorías, no a los totales.

Los índices de columna hardcodeados en `scripts/sources/aeat.mjs` (constante `COL`) para las subcategorías de Impuestos Especiales (IIEE) y Resto pueden estar desalineados respecto al Excel real. Se observan diferencias significativas entre los datos de referencia del plan y los datos descargados:

| Subcategoría IIEE | Referencia (plan) | Descargado (2024) |
|---|---|---|
| alcohol | 371 | 824 |
| cerveza | 464 | 346 |
| mediosTransporte | 2.321 | 0 |
| carbon | 0 | 20 |

Los totales de IIEE sí cuadran (22.150 vs 22.128 — diferencia de redondeo), por lo que el índice del total IIEE (`COL.iieeTotal = 137`) es correcto. El problema está en los sub-índices (142-175).

**Acción pendiente**: Verificar manualmente las cabeceras de columna del Excel "Cuadros_estadisticos_series_es_es.xlsx", hoja "Ingresos tributarios", y ajustar los índices `COL.iiee*` y `COL.resto*` si es necesario. Los datos de referencia (fallback) en `REFERENCE_NATIONAL` también deben actualizarse una vez confirmados los índices correctos.

**Impacto**: El desglose por subcategoría en el drilldown de IIEE y Resto puede mostrar valores incorrectos en las categorías individuales. Los 6 impuestos principales (IRPF, IVA, Sociedades, IIEE, IRNR, Resto) y sus totales NO están afectados.
