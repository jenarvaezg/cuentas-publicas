# Roadmap — Dashboard Fiscal de España

Estado validado contra el código actual: **25 febrero 2026**.

Leyenda: `✅` hecho, `🟡` parcial, `⏳` pendiente.

## Fase 1: Deuda + Pensiones (MVP) ✅

- Dashboard con contadores en tiempo real
- Deuda PDE: total, per cápita, ratio PIB, desglose subsectores
- Coste de la deuda: intereses anuales, intereses/segundo
- Pensiones: gasto/segundo, nómina mensual, déficit contributivo
- Datos del Banco de España, INE y Seguridad Social
- Dark/light mode
- PWA
- Deploy automático a GitHub Pages
- Actualización semanal de datos via GitHub Actions

## Fase 2: Gasto Público + Comparativas ✅

- ✅ Script IGAE para ejecución presupuestaria (clasificación COFOG)
- ✅ Bloque de gasto público con desglose por funciones (sanidad, educación, defensa, etc.)
- ✅ Script Eurostat para comparativas internacionales
- ✅ Bloque comparativas: ranking EU-27 en deuda/PIB, gasto social, paro
- ✅ Bloque equivalencias: "La deuda equivale a X meses de SMI por persona"
- ✅ Ingresos vs gastos públicos: 30 años de datos Eurostat (TR, TE, B9, D2REC, D5REC, D61REC)

## Fase 3: CCAA + Polish

- ✅ Datos desglosados por CCAA (CSV be1309/be1310 del BdE) — ranking general
- ✅ Selector de Comunidad Autónoma (incluye persistencia en URL)
- ✅ Recaudación tributaria por impuesto y por CCAA (AEAT series + delegaciones)
- [x] (Q1 2026) **Visión consolidada (Sankey)**: Diagrama de flujos cuadradando ingresos totales, déficit y gasto por categoría (motor de simulación para "qué pasaría si..."). -> **CONSTRUIDO (flows.json)**
- [x] (Q1 2026) **Deuda, déficit y gasto por comunidad**: Ampliar el desglose a nivel de CCAA (datos Banco de España y Contabilidad Nacional Regional). -> **INTEGRADO OFICIALMENTE (ccaa-deficit.json, ccaa-spending.json, etc.)**
- [x] (Q1 2026) **Resolución del Agujero Foral**: Inyección de aportaciones forales neta (Cupo/Aportación) para equiparar CA15 y CA16 en balanzas y simulación Sankey. -> **INTEGRADO EN FRONTEND**
- [x] (Q1 2026) **Sostenibilidad del estado de bienestar**: Sección dedicada (`SustainabilityBlock`) con déficit contributivo histórico (2006+), % PIB, evolución Fondo de Reserva, ratio cotizantes/pensionista y proyecciones Ageing Report. -> **INTEGRADO EN FRONTEND**.
- ✅ SEO pre-render + SSG multi-ruta: snapshot estático, sitemap y páginas por sección (`/secciones/*`, `/en/sections/*`)
- ✅ Compartir: hash + URL state (`section`, `ccaa`, `ccaaMetric`) + export PNG por bloque
- ✅ PWA offline hardening: runtime caching, fallback offline y registro SW con actualización
- ✅ Tests E2E con Playwright (smoke suite)
- ✅ i18n de interfaz y contenidos largos (castellano + inglés): selector, UI principal, metodología y roadmap

## Fase 4: Demografía 🟡

- 🟡 **Sección de demografía**: Bloque completo con indicadores vitales, pirámide de población e inmigración
  - ✅ Indicadores demográficos básicos: natalidad, mortalidad, fecundidad, crecimiento natural
  - ✅ Esperanza de vida: series 30-year con desglose por sexo
  - ✅ Pirámide de población: desglose por grupos de edad, sexo y origen migratorio (6 regiones)
  - ✅ Selector de año para evolución histórica de la pirámide
  - ✅ Gráficos de tendencias históricas (vital stats, life expectancy, inmigración)
  - ✅ Ratios de dependencia (old-age, youth, total) derivados de la pirámide
  - ⏳ Desglose provincial
  - ⏳ Proyecciones demográficas (INE a 20-30 años, poner diferentes estimaciones historicas para demostrar como se suelen equivocar https://x.com/rdomenechv/status/2014716812143816827, https://x.com/ocdeenespanol/status/2014020615791898800)
  - ⏳ Permitir comparar diferentes proyecciones entre paises
  - ✅ Comparativas internacionales (natalidad, mortalidad, esperanza de vida, fecundidad) — gráfico de barras horizontales con 8 países EU + media UE-27, datos Eurostat
  - ⏳ Datos de flujos migratorios (entradas/salidas)
  - ⏳ Poblacion actual y diferentes estimados, teniendo en cuenta flujos migratorios y natalidad/mortalidad

---

## Simulador Territorial (Sankey Avanzado) 🟡

El objetivo es transformar la herramienta actual en un **simulador macroeconómico 100% fidedigno** mediante Data Lakes de archivos JSON estáticos (matrices "CCAA -> COFOG -> EUROS") autogenerados por ETLs y conectados matemáticamente a los Nodos/Enlaces del Sankey.

### Fase 1: Pensiones y Desempleo (El Gran Gasto Social) ✅
Las transferencias directas a familias suponen el grueso del gasto estatal.

- ✅ **1.1. Pensiones Territorializadas:**
  - **Script ETL:** `scripts/sources/pensions-regional.mjs` — parseo de estadísticas de la Seg. Social por CCAA.
  - **Output JSON:** `src/data/pensions-regional.json` (19 CCAA, gasto anual en pensiones).
  - **Integración Sankey:** Resta directa al nodo `GASTO_PENSIONES` y enlace desde `CONSOLIDADO`.
- ✅ **1.2. Prestaciones por Desempleo (Eurostat):**
  - **Script ETL:** `scripts/sources/unemployment-regional.mjs` — reescrito con API Eurostat (`lfst_r_lfu3pers` + `gov_10a_exp` GF1005).
  - **Output JSON:** `src/data/unemployment-regional.json` (19 CCAA, distribución proporcional por parados NUTS2).
  - **Integración Sankey:** Resta al nodo `COFOG_10_RESTO` (Protección Social excl. pensiones).

### Fase 2: Inversiones Reales y Subvenciones ⏳
El Estado Central asume la construcción de infraestructuras interregionales y rescates a empresas.

- ⏳ **2.1. Licitaciones y Obra Pública (Cap. 6):**
  - **Script ETL:** Scraper de la Plataforma de Contratos mapeado por CCAA y Función COFOG.
  - **Integración Sankey:** Restar del nodo COFOG correspondiente (ej. `COFOG_04`).
- ⏳ **2.2. Subvenciones del Estado (Cap. 4 y 7):**
  - **Script ETL:** Consumir la base de datos BDNS y agrupar por CCAA fiscal.
  - **Integración Sankey:** Restar proporcionalmente de las áreas subvencionadas.

### Fase 3: Nóminas de la Administración General del Estado (AGE) ⏳
Sueldos de policías, jueces, militares y delegaciones ministeriales ubicados físicamente en la región.

- ⏳ **3.1. Distribución de Funcionarios del Estado:**
  - **Script ETL:** Extraer efectivos del Boletín de Personal AAPP y cruzar con sueldos PGE.
  - **Integración Sankey:** Restar del nodo respectivo (`COFOG_01_RESTO`, `COFOG_02`, `COFOG_03`).

### Fase 4: Bienes Públicos Indivisibles (Proxy PIB) ✅
Gastos no localizables geográficamente (ej. Exteriores, Corona, Congreso, Deudas).

- ✅ **4.1. Extracción de Pesos PIB Regional:**
  - **Cálculo:** % PIB regional sobre España desde `regional-accounts.json`.
  - **Integración Sankey:** Resta proporcional al PIB de los residuos centrales (gasto Sankey − suma regional COFOG) en cada nodo de gasto, incluyendo `GASTO_INTERESES`, `COFOG_01_RESTO` a `COFOG_09`, `GASTO_PENSIONES` y `COFOG_10_RESTO`.

### Fase 5: El Balance de Masas (Déficit y Consolidado) ✅
Motor matemático central (`useMemo` en `FlowsSankeyBlock.tsx`).

- ✅ **1. Ingresos Excluidos:** Resta impuestos cedidos, cotizaciones sociales y otros ingresos proporcionales al PIB.
- ✅ **2. Gastos Excluidos (Fases 1-4):** Resta gasto COFOG regional, pensiones, desempleo y residuos centrales.
- ✅ **3. Diferencial (Déficit):** `DEFICIT` = `max(0, Gastos − Ingresos)` tras exclusiones.
- ✅ **4. Nodo Consolidado:** Reajuste automático: `CONSOLIDADO` = `Ingresos + Déficit`.
- ✅ **5. Bug fix COFOG key mapping:** Divisiones "01"/"10" → nodos `COFOG_01_RESTO`/`COFOG_10_RESTO` (antes silenciosamente perdidos).
- ✅ **Validación:** Excluir las 17 CCAA resta exactamente 725.001 M€ (100% del presupuesto consolidado).

### Fase 6: Residuos tributarios centrales ✅
Corrección del gap de ~80.000 M€ en la simulación What-If.

- ✅ **Diagnóstico:** Los nodos tributarios del Sankey usan totales nacionales Eurostat, pero los datos regionales AEAT solo cubren impuestos gestionados a nivel CCAA. La parte gestionada centralmente (IVA nacional, IRPF central, etc.) no estaba atribuida a ninguna región.
- ✅ **Solución:** Calcular `taxResiduals` (Sankey node − suma regional) y distribuirlos GDP-proporcionalmente al excluir regiones, mismo patrón que los residuos de gasto central.
- ✅ **Resultado:** Excluir las 17 CCAA deja residuo de ~542 M€ (0,07%) por redondeo acumulado, vs ~80.000 M€ antes.
- ✅ **Documentación:** Tooltip expandible con metodología completa del What-If (fuentes, supuestos, limitaciones).

### Mejoras pendientes del Simulador Territorial

- ⏳ **Proxies refinados por categoría de gasto:** En vez de usar PIB para todo, usar deuda/deuda total para intereses, población para defensa, y PIB para administración general. Mayor fidelidad económica.
- ✅ **Tooltip de transparencia:** Al pasar el ratón sobre un nodo restado, muestra desglose "X M€ directos + Y M€ proporcional (proxy PIB)" con `whatIfAttribution` en `SankeyNode`.
- ⏳ **Inversiones Reales y Subvenciones (Fase 2 original):** Licitaciones PLACSP y subvenciones BDNS por CCAA.
- ⏳ **Nóminas AGE (Fase 3 original):** Distribución de funcionarios del Estado por CCAA y rama.

---

## Follow the Money — De tu nómina al servicio público 🟡

Objetivo final: que cualquier ciudadano pueda ver cómo fluyen sus impuestos desde su nómina hasta el servicio público concreto que recibe en su municipio. Plan detallado en [`.claude/plans/follow-the-money.md`](.claude/plans/follow-the-money.md).

### Fase A: Sankey por CCAA ✅
Selector de scope integrado en el `FlowsSankeyBlock` existente: España → CCAA individual. El mismo componente, misma interacción, distinto grafo. Muestra ingresos recaudados, gasto COFOG regional, transferencias Estado↔CCAA, pensiones, desempleo y balance. **Sin ETLs nuevos** — reorganiza datos existentes (AEAT, IGAE, fiscal balance, cuentas regionales). **IMPLEMENTADO** (commit be629a1).

### Fase B: Calculadora personal ✅
Input: salario bruto + estimación de consumo. Output: desglose de IRPF (por tramos), SS, IVA estimado. Se conecta al Sankey: tus euros personales fluyen por el diagrama. **IMPLEMENTADO** (commit 354ad02).

### Fase C: Presupuestos municipales (top 50) ⏳
ETL nuevo sobre liquidaciones presupuestarias de MINHAP (datos.gob.es). Mapear categorías municipales a COFOG-like. Empezar por las 50 ciudades más grandes.

### Fase D: Atribución multinivel ⏳
Conectar Nacional → CCAA → Municipio. Proxy inicial: proporción poblacional. Refinar con datos reales (áreas sanitarias, distritos educativos, inversiones localizadas).

### Fase E: Sankey personal completo ⏳
Vista unificada: tu nómina → tus impuestos → nivel nacional → CCAA → municipio → servicios concretos. Comparador: "¿Y si vivieras en otra ciudad?"

---

## Wishlist

Ideas de funcionalidades y datos que nos gustaría añadir. Sin orden de prioridad fijo.

### Datos fiscales detallados

- **🟡 Tipos efectivos por impuesto**: proxy implementado (IRPF, IVA y Sociedades sobre recaudación neta total + evolución temporal). Pendiente versión canónica sobre bases imponibles para tipo efectivo económico estricto.
- **✅ Recaudación por CCAA (balanzas fiscales)**: comparativa de impuestos cedidos vs transferencias recibidas con liquidaciones oficiales de Hacienda para CCAA de régimen común (2019+).

### Mejoras de datos existentes

| Dato | Por qué | Fuente potencial | Dificultad |
|------|---------|-------------------|------------|
| Afiliados SS automatizados | Dato crucial para ratio cotizantes/pensionista | SS `EST211` — scraping similar al de pensiones | ALTA (UUID) |
| Cotizaciones sociales reales | Base del déficit contributivo | AEAT recaudación o liquidación presupuestaria SS | ALTA |
| Serie histórica pensiones real | Los 11 puntos actuales son interpolados | Histórico EST24 o Anuario Estadístico SS | MEDIA |
| SMI automático | Actualización manual cada enero | Tabla INE si existe, o historial hardcodeado | MEDIA |
| CPI 2026 | La serie suele llegar hasta el último año cerrado; limita deflación del año en curso | INE publica media anual al cierre del año | BAJA (esperar) |
| Tipo interés medio de la deuda | Calcular coste intereses dinámicamente | Tesoro Público — tipos medios emisión | MEDIA |
| Inflación anual actual | Dato de contexto muy demandado | INE API — IPC variación anual (ya tenemos serie) | BAJA |
| Déficit acumulado recalculado | Eliminar hardcoded 300 mm€ | Script que sume gasto vs cotizaciones anualmente | MEDIA |

### Nuevas visualizaciones

- **✅ Sankey fiscal ultra detallado**: visualización interactiva de flujos desde ingresos territoriales hacia usos finales del gasto, con simulador "What-If" para CCAA. Incluye balance de masas completo (ingresos + gastos), atribución directa (pensiones, desempleo, COFOG regional, impuestos cedidos, cotizaciones) y proxy PIB para bienes indivisibles.
- **✅ "De cada 1.000€ que entran, se reparten así"**: Integrado en el visor Sankey como herramienta proporcional del presupuesto consolidado.
- **✅ Sankey multi-año (2012-2024)**: Selector de año que permite navegar la evolución del presupuesto consolidado. What-If desactivado para años sin datos regionales completos.
- **Proyecciones demográficas**: Pirámide de población actual + proyecciones INE a 20-30 años (ratio dependencia futuro).
- **Población por provincia**: Desglose demográfico a nivel provincial. Fuente: INE (padrón continuo, estadísticas de nacimientos/defunciones, estadística de migraciones). Dificultad: ALTA.
- **Sostenibilidad de la Seguridad Social**: Sección dedicada con serie histórica del déficit contributivo (ingresos vs gastos contributivos desde 2006), déficit como % PIB y % gasto contributivo, saldo contributivo por CCAA, evolución del Fondo de Reserva y patrimonio neto de la SS. Fuentes: Fedea (Ángel de la Fuente, series de SS Ampliada), IGAE, García (2023) para CCAA, Ageing Report 2024 (proyecciones UE). Referencia: informe Hespérides «La (in)sostenibilidad de la Seguridad Social» (gráficos 7-15). Dificultad: ALTA.
- **Deuda hogares/empresas**: No solo deuda pública — incluir deuda privada para ver el panorama completo (BdE cuentas financieras).
- **Simulador de ajuste fiscal**: "¿Qué pasaría si subimos/bajamos X impuesto un Y%?" — calculadora interactiva.
- **Timeline de hitos**: Eventos económicos importantes (crisis 2008, COVID, reformas) superpuestos en los gráficos históricos.
- **Rating crediticio**: Indicador confianza deuda (Moody's/S&P/Fitch — sin API pública, dificultad MUY ALTA).
- **⏳ Contratación pública (Licitaciones)**: Volumen anual, tipo de contrato, procedimiento (abierto vs negociado), competencia media, participación PYME y tasa de desiertos. Fuente: PLACSP sindicación. Ver [plan detallado](#contratación-pública-licitaciones-).

### Robustez del pipeline

1. **✅ IGAE: Detectar columnas por header en vez de por índice** — Leer fila cabecera, buscar códigos COFOG (01, 02...) y calcular índices dinámicamente. Elimina el problema de desplazamiento.
2. **✅ SS: Fallback + alerta automática** — Prueba múltiples URLs (scrape + fallback local) y crea/actualiza issue automática cuando entra en fallback crítico.
3. **✅ Validación cruzada COFOG** — Verificar que suma de 10 divisiones = total general. Si no cuadra, log warning + mantener datos anteriores.
4. **✅ SS: Validación de cabeceras** — Comprobar que las columnas del Excel coinciden con el esquema esperado antes de procesar.

### Infraestructura y UX

- **✅ Explicación detallada por métrica**: El botón de información (ℹ) abre un panel clicable (desktop + móvil) con explicación de qué es, cómo se calcula, por qué importa y fuentes.
- **✅ Roadmap visible en la web**: Sección integrada en el dashboard (`RoadmapSection`).
- **✅ Compartir gráficos individuales**: Botón para exportar cada bloque como imagen (PNG).
- **✅ Notificaciones de datos nuevos (RSS)**: Feed en `/feed.xml` con publicaciones de actualización.
- **✅ API pública**: endpoints versionados en `/api/v1` + catálogo `index.json` + documentación `API.md`.
- **✅ Alertas de datos stale**: Si un dato supera su umbral de antigüedad por fuente (mensual/trimestral/anual), crear/actualizar GitHub Issue automática.
- **✅ Ampliar meta.json**: `lastRealDataDate` y `lastFetchAt` añadidos por fuente.
- **✅ Tests de integridad**: suite explícita (`scripts/__tests__/data-integrity.test.mjs`) para datasets y metadatos.
- **✅ Sincronización de documentación técnica de datasets**: `DATA-REGISTRY.md`, `API.md` y `openapi.json` alineados con todos los datasets publicados en `/api/v1` (incluidos `ccaa-spending` y `ccaa-foral-flows`).

---

## Checklist Territorial — CCAA -> Provincia -> Ayuntamiento ⏳

Objetivo: Construir cobertura fiscal territorial máxima y fresca para responder, con trazabilidad, a la pregunta: **en qué se gasta cada euro público en España**, bajando desde CCAA hasta ayuntamiento.

### Reglas de calidad
1. **Fallback = error** en pipeline: no se considera descarga válida.
2. **Identificador territorial canónico**: usar siempre códigos `CA01...CA17`.
3. **Trazabilidad obligatoria** por dataset.
4. **No publicar capa territorial incompleta** sin dejar explícito alcance y exclusiones.

### Avances ya cerrados
- ✅ Unificación de códigos `CAxx` entre BdE, AEAT y Hacienda para evitar cruces erróneos.
- ✅ Integración en UI CCAA de saldo oficial de Hacienda (cuando aplica), manteniendo proxy como apoyo.
- ✅ Test de integridad para detectar desalineación de códigos CCAA entre datasets.
- ✅ Integración de gasto funcional oficial por CCAA (IGAE COFOG detalle, 17/17) en pipeline, API y bloque CCAA.

### Pendientes transversales (documentación y gobernanza)
- ✅ Registrar formalmente `ccaa-foral-flows` en `DATA-REGISTRY.md`.
- ✅ Verificar que `API.md` documenta el endpoint `/api/v1/ccaa-foral-flows.json`.
- ✅ Añadir regla operativa: alta de dataset en pipeline/API implica actualización obligatoria.

### Checklist operativo por comunidad (Gasto Provincial/Municipal)
- ⏳ CA01 Andalucía: completar provincia y ayuntamientos.
- ⏳ CA02 Aragón: completar provincia y ayuntamientos.
- ⏳ CA03 Asturias: completar provincia y ayuntamientos.
- ⏳ CA04 Illes Balears: completar nivel insular/provincial y ayuntamientos.
- ⏳ CA05 Canarias: completar nivel insular/provincial y ayuntamientos.
- ⏳ CA06 Cantabria: completar ayuntamientos.
- ⏳ CA07 Castilla y León: completar provincia y ayuntamientos.
- ⏳ CA08 Castilla-La Mancha: completar provincia y ayuntamientos.
- ⏳ CA09 Cataluña: completar provincia y ayuntamientos.
- ⏳ CA10 C. Valenciana: completar provincia y ayuntamientos.
- ⏳ CA11 Extremadura: completar provincia y ayuntamientos.
- ⏳ CA12 Galicia: completar provincia y ayuntamientos.
- ⏳ CA13 Madrid: completar ayuntamientos.
- ⏳ CA14 Murcia: completar ayuntamientos.
- ⏳ CA15 Navarra: bajar a nivel provincial y ayuntamientos (fuente foral agregada).
- ⏳ CA16 País Vasco: bajar a nivel provincial y ayuntamientos (fuente foral agregada).
- ⏳ CA17 La Rioja: completar ayuntamientos.

---

## Contratación Pública (Licitaciones) ⏳

Integración de datos de contratación pública desde la **Plataforma de Contratación del Sector Público (PLACSP)**.

Inspirado por [BquantFinance/licitaciones-espana](https://github.com/BquantFinance/licitaciones-espana) (~42M registros), pero consumiendo directamente los feeds oficiales de sindicación PLACSP para mantener el pipeline ligero y sin dependencias de terceros.

### Fuente de datos

Feeds de sindicación abiertos de PLACSP (sin autenticación):

- **Anuales (2012–2024)**: `https://contrataciondelsectorpublico.gob.es/sindicacion/sindicacion_643/licitacionesPerfilesContratanteCompleto3_{YYYY}.zip`
- **Mensuales (2025+)**: `…/licitacionesPerfilesContratanteCompleto3_{YYYYMM}.zip`

Formato: ZIP → ATOM/XML (namespace CODICE). Licencia: reutilización abierta (datos.gob.es).

### Estrategia: ligero por diseño

**Problema**: Los ZIPs anuales pesan 100–300 MB y contienen ~500K–1M registros/año. Descargar todo el histórico sería >1.5 GB.

**Solución**:
1. **Histórico (2012–2024)**: Agregados anuales hardcodeados como `REFERENCE_DATA`. Son ~13 filas de totales, calculadas una vez localmente.
2. **Reciente (últimos 2–3 meses)**: Descargar solo ZIPs mensuales (~20–50 MB/mes). Parsear XML en streaming (SAX), agregar en memoria, descartar raw.
3. **Output**: `src/data/licitaciones.json` de ~50–100 KB.

**Estimación CI**: +1–2 min al pipeline actual.

### Campos a extraer (8 de ~40 disponibles)

| Campo | Uso |
|-------|-----|
| `importe_sin_iva` | Volumen total € |
| `importe_adjudicacion` | Importe adjudicado (cálculo de ahorro) |
| `tipo_contrato` | Desglose: Obras / Servicios / Suministros / Concesiones |
| `procedimiento` | Abierto / Negociado / Acuerdo marco → indicador de transparencia |
| `estado` | Adjudicada / Desierta / Anulada → tasas de resolución |
| `num_ofertas` | Competencia media por licitación |
| `es_pyme` | Participación PYME |
| `fecha_publicacion` | Serie temporal mensual |

**Valores decodificados**:
- **tipo_contrato**: Suministros (1), Servicios (2), Obras (3), Gestión Servicios Públicos (21), Concesión Obras (31), Concesión Servicios (40), Administrativo Especial (7), Privado (8), Patrimonial (50).
- **procedimiento**: Abierto (1), Restringido (2), Negociado con publicidad (3), Negociado sin publicidad (4), Diálogo competitivo (5), Asociación innovación (6), Basado en acuerdo marco (100), Otros (999).
- **estado**: Publicada (PUB), En evaluación (EV), Adjudicada (ADJ), Resuelta (RES), Anulada (ANUL), Desierta (DES).

### Arquitectura técnica

**Script** (`scripts/sources/licitaciones.mjs`):
```
1. Determinar últimos 2–3 meses disponibles (YYYYMM)
2. Descargar ZIPs mensuales con fetchWithRetry() (~20–50 MB c/u)
3. Descomprimir en memoria (zlib, sin temp files)
4. Parsear ATOM/XML en streaming (SAX, no DOM)
   → Por cada <entry>: extraer 8 campos, actualizar contadores, descartar registro
5. Combinar contadores live con REFERENCE_DATA histórico
6. Emitir licitaciones.json
```

**Gestión de memoria** — no acumular registros:
```javascript
for await (const entry of parseAtomEntries(zipStream)) {
  const { tipo, procedimiento, importe, ... } = extractFields(entry);
  aggregates.byYear[year].totalImporte += importe;
  aggregates.byYear[year].byTipo[tipo].count++;
  // ~2 KB de memoria por año, no 500K registros
}
```

**Dependencias**: `sax` o `fast-xml-parser` (~50 KB) + built-in `zlib`.

**Fallback**: `REFERENCE_DATA` con agregados 2022–2025 hardcodeados (patrón estándar del proyecto).

### Tipos (`src/data/types.ts`)

```typescript
interface LicitacionesData {
  lastUpdated: string;
  current: {
    totalLicitaciones: number;      // nº contratos año en curso
    importeTotal: number;           // € sin IVA año en curso
    importeAdjudicado: number;      // € adjudicado año en curso
    tasaAdjudicacion: number;       // % adjudicadas / publicadas
    tasaDesierta: number;           // % desiertas
    ofertasMedia: number;           // media de ofertas por licitación
    participacionPyme: number;      // % adjudicadas a PYMEs
  };
  byYear: Record<string, {
    count: number; importe: number; adjudicado: number;
    byTipo: Record<string, { count: number; importe: number }>;
    byProcedimiento: Record<string, { count: number; importe: number }>;
    byEstado: Record<string, number>;
    ofertasMedia: number; pctPyme: number;
  }>;
  byMonth: Array<{ date: string; count: number; importe: number }>;
  sourceAttribution: Record<string, DataSourceAttribution>;
}
```

### Componente UI: `LicitacionesBlock.tsx`

**Ubicación**: Después de `BudgetBlock` (COFOG), antes de `RevenueBlock`.
Narrativa: "El Estado gasta en estas funciones (COFOG) → ejecuta ese gasto así (contratación) → lo financia con estos ingresos."

**StatCards** (6–8 tarjetas):

| Métrica | Tooltip (es) |
|---------|-------------|
| Volumen anual (€) | Importe total de contratos públicos publicados este año, sin IVA |
| Licitaciones/día | Media de nuevos contratos publicados cada día hábil |
| € por habitante | Si repartiéramos el gasto en contratación pública entre toda la población |
| Ofertas de media | Cuántas empresas compiten de media por cada contrato público |
| % Proc. abierto | Porcentaje de contratos por concurso abierto (máxima competencia y transparencia) |
| % PYMEs | Proporción de contratos adjudicados a pequeñas y medianas empresas |
| Tasa de desiertos | Licitaciones sin ofertas válidas — refleja problemas en diseño del contrato o del mercado |
| Ahorro medio | Diferencia media entre presupuesto y adjudicación en licitaciones resueltas |

**Gráficos**:
1. Barras horizontales por tipo de contrato (Obras / Servicios / Suministros) — reutilizar `BudgetChart`.
2. Sparklines en StatCards (serie mensual 12–24 meses).
3. Donut de procedimientos (Abierto / Negociado / Acuerdo marco) — transparencia visual.

### Integración Sankey (V2)

Nodo "Contratación Pública" mostrando qué parte del gasto se ejecuta mediante contratos vs. transferencias directas. Requiere cruzar con COFOG. Segunda iteración.

### Checklist de implementación

- [ ] `scripts/sources/licitaciones.mjs` — script descarga + agregación streaming
- [ ] `src/data/types.ts` — interfaz `LicitacionesData`
- [ ] `scripts/download-data.mjs` — registrar source con `metaExtractor`
- [ ] `src/hooks/useData.ts` — importar JSON, exponer en hook
- [ ] `src/data/sources.ts` — atribución PLACSP
- [ ] `src/i18n/messages.ts` — textos es/en
- [ ] `src/components/LicitacionesBlock.tsx` — componente UI
- [ ] `src/components/MethodologySection.tsx` — documentar fuente y metodología
- [ ] `DATA-REGISTRY.md` — registrar dataset
- [ ] `API.md` — documentar endpoint `/api/v1/licitaciones.json`
- [ ] Tests unitarios del script (Vitest)
- [ ] E2E smoke test del bloque

### Riesgos y mitigaciones

| Riesgo | Prob. | Mitigación |
|--------|-------|------------|
| URLs mensuales cambian de pattern | Media | Detección dinámica + fallback a mes anterior + REFERENCE_DATA |
| XML schema cambia (CODICE) | Baja | Campos estables desde 2012; validación con warning |
| Parseo XML lento (>3 min en CI) | Media | SAX streaming + solo 8 campos + skip entries sin importe |
| PLACSP caído en CI | Media | REFERENCE_DATA hardcodeado |
| ZIP mensual >100 MB | Baja | Limitar a último mes; timeout generoso (60s) |

### Orden de implementación

1. Script de descarga con REFERENCE_DATA + parseo streaming
2. Tipos TypeScript
3. Registro pipeline + hook useData
4. Tests del script (Vitest, mock ZIP)
5. Componente UI + i18n
6. Docs sync (Methodology, DATA-REGISTRY, API)
7. E2E smoke test

---

## Orden Propuesto de Ejecución

1. **Completar CCAA (déficit y gasto por comunidad)**
   Último gran bloque funcional pendiente antes de nuevas líneas de producto.
2. **Ejecutar checklist territorial CCAA→Provincia→Ayuntamiento**
   Seguir la sección "Checklist operativo por comunidad" comunidad a comunidad, con foco en máxima profundidad y frescura.
3. ~~**Cerrar deuda documental del inventario de datos**~~
   ✅ `DATA-REGISTRY.md`, `API.md` y `openapi.json` alineados con los 11 datasets publicados en `/api/v1`.
4. **Contratación Pública (Licitaciones)**
   Integrar datos PLACSP según [plan detallado](#contratación-pública-licitaciones-).
