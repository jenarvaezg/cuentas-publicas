# Sync Report — Roadmaps ↔ Código

> Auditoría: **14 mayo 2026**. Fuente de verdad usada: `scripts/sources/`, `src/data/*.json`, `src/hooks/useData.ts`, `src/App.tsx`, `public/api/v1/`.
>
> Este documento no propone cambios — solo lista discrepancias verificadas. Iteración futura con `/grill-with-docs` en otra sesión.

## 1. Inventario real (verificado)

### 1.1 Pipelines ETL (`scripts/sources/`, 17 scripts)

```
aeat.mjs                      hacienda-fiscal-balance.mjs
bde.mjs                       igae.mjs
ccaa-deficit.mjs              ine.mjs
ccaa-foral-flows.mjs          living-conditions.mjs
ccaa-spending.mjs             pensions-regional.mjs
eurostat.mjs                  regional-accounts.mjs
flows-sankey.mjs              seguridad-social.mjs
                              social-economy.mjs
                              ss-sustainability.mjs
                              unemployment-regional.mjs
```

### 1.2 Datasets publicados (`src/data/*.json` y `public/api/v1/`, 20 datasets + meta + index)

`budget`, `ccaa-debt`, `ccaa-deficit`, `ccaa-fiscal-balance`, `ccaa-foral-flows`, `ccaa-spending`, `debt`, `demographics`, `eurostat`, `flows`, `living-conditions`, `pensions`, `pensions-regional`, `regional-accounts`, `revenue`, `social-economy`, `ss-sustainability`, `tax-revenue`, `unemployment-regional`, `meta`.

Verificado: `useData.ts` importa los 20 + `meta`. `public/api/v1/` publica los 20 + `meta.json` + `index.json`.

### 1.3 Bloques renderizados en `src/App.tsx` (10 bloques, agrupados en 5 capítulos)

| Capítulo | Sección | Componente |
|---|---|---|
| C1 El Gran Balance | resumen | RealtimeCounter (deuda + déficit) |
| C1 El Gran Balance | mapa-fiscal | FlowsSankeyBlock |
| C2 La Máquina de Recaudar | ingresos-gastos | RevenueDashboardBlock |
| C2 La Máquina de Recaudar | gasto-cofog | BudgetBlock |
| C3 El Invierno Demográfico | demografia | DemographicsBlock (compact) |
| C3 El Invierno Demográfico | pensiones | PensionsBlock |
| C3 El Invierno Demográfico | sostenibilidad-ss | SustainabilityBlock |
| C4 La Hipoteca Nacional | deuda | DebtBlock |
| C4 La Hipoteca Nacional | coste-deuda | DebtImplicationsBlock |
| C5 El Juego Territorial | ccaa | CcaaDebtBlock |
| C5 El Juego Territorial | ue | ComparativaEUBlock |
| C5 El Juego Territorial | metodologia | MethodologySection |

## 2. Discrepancias confirmadas

### 2.1 `README.md` — desactualizado

| Reclamo en README | Realidad |
|---|---|
| "7 fuentes de datos" | 11 fuentes oficiales activas (faltan Min. Hacienda, Gobierno de Navarra, Gobierno Vasco, Ageing Report) |
| "Scripts: `{bde,ine,seguridad-social,igae,eurostat,aeat,social-economy}.mjs`" | 17 scripts en `scripts/sources/` |
| "Endpoints: `{debt,pensions,demographics,budget,revenue,eurostat,ccaa-debt,tax-revenue,social-economy,meta}.json`" (10) | 20 endpoints + `meta` + `index` |
| Funcionalidades listadas | Omite: SustainabilityBlock, FlowsSankeyBlock, RevenueDashboardBlock con drill-down, DebtImplicationsBlock, PersonalCalculator, pirámide de población, ECV/AROPE |

### 2.2 `CLAUDE.md` — desactualizado

| Reclamo en CLAUDE.md | Realidad |
|---|---|
| Tabla "Data sources" lista 6 fuentes | 11 fuentes (faltan Hacienda, Navarra, Euskadi, Ageing Report, INE Cuenta Satélite Economía Social, INE ECV) |
| Bloque "Data flow": `scripts/sources/{bde,ine,seguridad-social,igae,eurostat,aeat}.mjs` | 17 scripts |
| "Section components (DebtBlock, PensionsBlock, RevenueBlock, BudgetBlock, etc.)" | RevenueBlock ya no es de primer nivel: vive dentro de RevenueDashboardBlock |

### 2.3 `DATA-REGISTRY.md` — drift estructural

- Resumen ejecutivo: "9 fuentes" → reales **11+** (Living Conditions, Regional Accounts no se cuentan como fuente nueva pero falta su sección).
- "14 archivos JSON (13 datasets + meta.json)" → reales **20 + meta**.
- **Mapa de archivos final omite**: `ccaa-deficit.json`, `pensions-regional.json`, `unemployment-regional.json`, `regional-accounts.json`, `living-conditions.json`.
- **Secciones faltantes**: no hay capítulo dedicado para `regional-accounts.mjs` ni para `unemployment-regional.mjs` ni `living-conditions.mjs` (sí aparecen en la tabla resumen pero sin metodología). `pensions-regional.mjs` está en una subsección 3.1 sin URL del Excel y sin ejemplo de fallback.
- Numeración duplicada: hay **dos secciones "16."** ("TABLA RESUMEN" y "MAPA DE ARCHIVOS").
- Fecha de auditoría declarada: "29 abril 2026" → desfase de ~15 días respecto al estado real.

### 2.4 `API.md` — endpoints incompletos

- Lista de endpoints v1 omite: `pensions-regional.json`, `unemployment-regional.json`, `regional-accounts.json` (los 3 están publicados en `public/api/v1/`).
- Tiene **schema** documentado de `pensions-regional.json` al final, pero **no aparece** en la lista de endpoints arriba (inconsistencia interna).
- Falta schema para `unemployment-regional.json` y `regional-accounts.json`.

### 2.5 `ROADMAP.md` (Markdown) ↔ `RoadmapSection.tsx` (UI) — drift

| Tema | ROADMAP.md | RoadmapSection.tsx |
|---|---|---|
| Desglose provincial (Fase 4) | `⏳ pendiente` | `✅ hecho (52 provincias, Padrón INE)` |
| Proyecciones demográficas INE | `⏳ pendiente` | `✅ hecho (20-30 años)` |
| Comparativas internacionales demografía | Listado 2 veces (duplicado L52 y L57) | Solo una vez |
| Flujos migratorios | `⏳ pendiente` | No se menciona |

Decisión pendiente: cuál es el documento de verdad (el archivo MD o el componente que ve el usuario).

### 2.6 `RoadmapSection.tsx` — huérfano

- El componente existe (`src/components/RoadmapSection.tsx`) y tiene tests.
- **No es importado por `src/App.tsx`** ni por ningún otro componente de runtime (solo por su propio test).
- Resultado: el roadmap visible al usuario que dice CLAUDE.md (`"Roadmap visible en la web"` ✅) **no existe** en producción.

### 2.7 `ROADMAP-TERRITORIAL.md` — duplicado y obsoleto

- Duplica contenido de `ROADMAP.md § Simulador Territorial` con menos detalle y sin checkmarks actualizados.
- Usa paths `scripts/etl/...` que **no existen** (los scripts están en `scripts/sources/`).
- Todas las fases marcadas `[ ]` cuando en realidad Fases 1, 4, 5 están ✅.

### 2.8 `REFACTOR_UX_PLAN.md` — parcialmente aplicado, sin actualización

- Afirma que App.tsx "renderiza **15 secciones distintas**". Real actual: **~10 bloques agrupados en 5 capítulos** (refactor parcialmente aplicado).
- Critica fragmentación de `RevenueBlock` + `TaxRevenueBlock` → ya consolidados en `RevenueDashboardBlock`.
- Critica `EquivalenciasBlock` e `InequalityBlock` → **no existen** en `src/components/` (ya eliminados o nunca renderizados; el dato AROPE/Gini sí existe en `living-conditions.json` sin componente).
- Recomendación "Reducir de 15 a 5 dashboards" → **ya implementado** (capítulos C1-C5).
- Estado: documento debería marcarse como "histórico/aplicado" o eliminarse.

### 2.9 Roadmap Wishlists — items posiblemente cerrados sin marcar

`RoadmapSection.tsx` Wishlist —  candidatos a revisar:

- "Tipo de interés medio de la deuda" — sigue como pendiente. `debt.json` tiene `interestExpense` hardcodeado en 39.000 M€; no hay automatización del tipo medio.
- "Serie histórica de pensiones real" — sigue pendiente. `pensions.json` mezcla 11 puntos interpolados con el último real.
- "SMI automático" — sigue manual.

### 2.10 `DISCREPANCIAS-PENDIENTES.md` referenciado pero ausente

`README.md` referencia `DISCREPANCIAS-PENDIENTES.md` (sección "Discrepancias conocidas"). **No existe** en el repo root.

## 3. Resumen ejecutivo de drift

| Documento | Severidad | Acción sugerida |
|---|---|---|
| README.md | Alta — usuario externo lo lee primero | Reescribir tablas de fuentes, endpoints, funcionalidades |
| CLAUDE.md | Alta — guía a Claude en todas las tareas | Actualizar tablas de fuentes y data flow |
| DATA-REGISTRY.md | Media — interno pero canónico | Añadir secciones faltantes + corregir numeración + actualizar fecha |
| API.md | Media | Añadir 3 endpoints + 2 schemas |
| ROADMAP.md vs RoadmapSection.tsx | Media | Decidir cuál es la verdad y sincronizar |
| RoadmapSection.tsx huérfano | Baja-Media | Decidir: reintegrar o borrar (y borrar test) |
| ROADMAP-TERRITORIAL.md | Baja | Borrar o marcar como `ARCHIVE/` |
| REFACTOR_UX_PLAN.md | Baja | Marcar como aplicado o archivar |
| DISCREPANCIAS-PENDIENTES.md ausente | Baja | Crear stub o quitar referencia de README |

## 4. Lo que SÍ está bien sincronizado

- `useData.ts` ↔ `src/data/*.json` ↔ `public/api/v1/*.json`: los 20 datasets están alineados.
- `meta.json.sources` contiene las 19 claves que coinciden con los pipelines reales (todos excepto `flows-sankey` que sí aparece como `flowsSankey`).
- `MethodologySection.tsx` (no auditado a fondo aquí) parece estar actualizado — verificar en sesión de grill.
- ETL territorial (`pensions-regional`, `unemployment-regional`, `regional-accounts`, `ccaa-spending`, `ccaa-deficit`, `ccaa-foral-flows`, `ccaa-fiscal-balance`) está implementado y publicado conforme al plan en `ROADMAP.md § Simulador Territorial`.
