# Sankey Fiscal + Regla de 1.000 EUR

Estado: borrador de producto y datos (23 febrero 2026).

## Objetivo

Responder con máximo detalle a:

1. En qué se gasta cada euro público.
2. De cada 1.000 EUR que entran en el Estado, cómo se reparten.

## Qué debe mostrar

1. Flujo de ingresos -> asignación presupuestaria -> destino final del gasto.
2. Vista consolidada y vista territorial (Estado/CCAA/Provincia/Ayuntamiento).
3. Desglose multinivel con zoom progresivo:
   - Nivel 1: grandes bolsas (ingresos tributarios, cotizaciones, otros).
   - Nivel 2: figura concreta (IRPF, IVA, Sociedades, etc.).
   - Nivel 3+: función/política/programa/capítulo/artículo/concepto.

## Regla narrativa de 1.000 EUR

Para cada corte (año, territorio, administración):

1. `peso = partida / ingresos_totales`
2. `euros_por_1000 = peso * 1000`
3. Mostrar ranking de destinos de mayor a menor `euros_por_1000`.

Ejemplo de copy esperado:

- "De cada 1.000 EUR ingresados, X EUR van a protección social, Y EUR a sanidad, Z EUR a educación..."

## Modelo de datos mínimo (propuesto)

Archivo sugerido: `src/data/flows.json` (y espejo en `public/api/v1/flows.json`).

Cada nodo/enlace debe incluir:

1. `id`
2. `parentId` (null en raíz)
3. `label`
4. `amount`
5. `year`
6. `territoryLevel` (`state|ccaa|province|municipality`)
7. `territoryCode` (ej: `ES`, `CA10`, `PR28`, `MU28079`)
8. `adminLevel` (`state|ccaa|local|social_security|consolidated`)
9. `source`
10. `sourceUrl`
11. `sourceDate`
12. `quality` (`official|proxy|estimate`)
13. `fallback` (`true|false`)

## Reglas de calidad

1. Fallback en cualquier tramo critico => error de pipeline.
2. No mezclar codificaciones territoriales inconsistentes.
3. Todo enlace debe ser trazable a fuente y fecha.
4. Si una capa no existe para un territorio, debe mostrarse como "no disponible", nunca inventada.

## MVP por fases

1. Fase A (rapida): Sankey nacional anual (ingresos vs gasto funcional COFOG) + bloque de 1.000 EUR.
2. Fase B: CCAA con datos ya disponibles y extension al gasto funcional CCAA cuando se integre fuente oficial.
3. Fase C: provincia y ayuntamiento, empezando por grandes entidades y luego cobertura completa.

## Dependencias para arrancar

1. Cerrar checklist territorial CCAA (especialmente gasto funcional por comunidad).
2. Definir esquema de codigos para provincia/municipio.
3. Crear agregador de flujos en `scripts/download-data.mjs`.
