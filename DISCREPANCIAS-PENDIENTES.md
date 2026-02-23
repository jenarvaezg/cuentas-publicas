# Discrepancias Pendientes

Última revisión interna: **23 febrero 2026**.

## Estado actual

No hay discrepancias abiertas de severidad media/alta.

## AEAT — Índices de columna para subcategorías IIEE y Resto (resuelto)

**Severidad previa**: Media.

Se ha sustituido la lectura por índices hardcodeados por **detección dinámica de columnas por cabecera** en `scripts/sources/aeat.mjs`, con fallback a índices legacy solo cuando no se detectan cabeceras válidas.

**Controles añadidos**:
- Test unitario en `scripts/__tests__/aeat.test.mjs` para validar que un desplazamiento de columnas sigue parseando correctamente.
- Test de integridad en `scripts/__tests__/data-integrity.test.mjs` para validar consistencia agregada de `tax-revenue.json`.

**Riesgo residual**:
- Si AEAT renombra radicalmente las cabeceras, el parser entra en fallback y deja traza en logs.
