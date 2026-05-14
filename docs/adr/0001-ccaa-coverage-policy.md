# Cobertura territorial: 17 CCAA en UI, CA18/CA19 solo en ETL donde preservar totales

Los datasets territoriales heredados eran heterogéneos: `pensions-regional`, `unemployment-regional` e `ine` capturaban Ceuta (`CA18`) y Melilla (`CA19`); `regional-accounts` y `hacienda-fiscal-balance` los excluían explícitamente. Probable artefacto de pasadas iterativas de IA sin política unificada.

Decidido: `CA18` y `CA19` son códigos canónicos en `scripts/lib/ccaa-maps.mjs`. Cualquier dataset cuya suma nacional dependa de ellos (pensiones, paro, demografía) los incluye y lo declara con la bandera `includesCeutaMelilla = true`; el resto los excluye con `false` y lo justifica. La UI territorial (selector, Sankey What-If, rankings, `buildCcaaGraph`) opera exclusivamente sobre `CA01`–`CA17`.

Consecuencia: cualquier dataset territorial nuevo debe declarar la bandera; el código existente que no la declara debe auditarse para alinearse al criterio o documentar excepción.
