# Data Registry — Dashboard Fiscal de España

Inventario técnico de todos los datos del dashboard: clasificación, fuentes, fragilidad y estado. Para wishlist, recomendaciones y roadmap, ver [`ROADMAP.md`](ROADMAP.md).

> **Última auditoría**: febrero 2026

## Resumen Ejecutivo

El dashboard utiliza 5 fuentes de datos oficiales (BdE, INE, SS, IGAE, Eurostat) descargadas semanalmente (lunes 08:00 UTC) por GitHub Actions. Se generan 8 archivos JSON en `src/data/` (7 datasets + `meta.json`) y su espejo público en `public/api/v1/`, además de artefactos SEO/SSG (`sitemap.xml`, `seo-snapshot.html`, rutas por sección ES/EN) y feed RSS (`feed.xml`). La SPA sigue sin llamadas API en runtime para el contenido principal (build-time data import). Cada fuente tiene fallback hardcodeado para garantizar continuidad operativa.

**Estado general**: De ~40 métricas mostradas, **~22 son automatizadas**, **~5 son semi-automatizadas** (frágiles), **~7 son hardcodeadas/manuales**, y **~7 son derivadas** por cálculo.

---

## 1. BANCO DE ESPAÑA — Deuda Pública

**Script**: `scripts/sources/bde.mjs` | **Output**: `src/data/debt.json`

| Dato | Clasificación | Método | Frecuencia | Fragilidad |
|------|---------------|--------|------------|------------|
| Deuda total PDE | **AUTOMATIZADO** | CSV `be11b.csv` descarga directa | Mensual (~15d retraso) | MEDIA — parsing columnas por keyword |
| Desglose por subsector (Estado, CCAA, CCLL, SS) | **AUTOMATIZADO** | CSV `be11b.csv` columnas | Mensual | MEDIA — keyword matching en headers |
| Ratio deuda/PIB | **AUTOMATIZADO** | CSV `be1101.csv` col 11 (deuda PDE) / col 12 (PIB) | Trimestral | MEDIA — keyword matching en headers |
| Variación interanual | **DERIVADO** | (mes actual - mismo mes año anterior) / anterior × 100 | Mensual | BAJA |
| Gasto en intereses | **HARDCODEADO** (estimación PGE 2025) | 39.000 M€ — sin CSV disponible, fallback en script | Anual | MEDIA — actualizar con cada PGE |
| Pendiente regresión (€/segundo) | **DERIVADO** | Regresión lineal últimos 24 meses | Mensual | BAJA |
| Serie histórica | **AUTOMATIZADO** | CSV completo | 373 puntos (dic 1994 - dic 2025) | BAJA |

**URLs** (estables):
- `https://www.bde.es/webbe/es/estadisticas/compartido/datos/csv/be11b.csv`
- `https://www.bde.es/webbe/es/estadisticas/compartido/datos/csv/be1101.csv`
- API: `https://app.bde.es/bierest/resources/srdatosapp?series=DTNPDE2010_P0000P_PS_APU`

**Problemas detectados**:
1. CSV transposed format: BdE usa formato invertido (series como columnas). Si cambian la estructura, falla el parser.
2. Meses en español hardcodeados (`ENE, FEB...DIC`). Si BdE cambia formato, falla el date parsing.

---

## 2. INE — Demografía y Economía

**Script**: `scripts/sources/ine.mjs` | **Output**: `src/data/demographics.json`

| Dato | Clasificación | Serie INE | Frecuencia real | Dato actual | Fragilidad |
|------|---------------|-----------|-----------------|-------------|------------|
| Población total | **AUTOMATIZADO** | `ECP320` (Tabla 56934) | Anual | 49.570.725 (dic 2025) | MEDIA — serie conocida por dar datos antiguos |
| Población activa (EPA) | **AUTOMATIZADO** | `EPA387794` (Tabla 65080) | Trimestral | 24.940.400 (Q3 2025) | BAJA |
| PIB nominal | **AUTOMATIZADO** | `CNTR6597` (Tabla 30679) | Trimestral (suma 4Q) | 1,686 B€ | BAJA |
| Salario medio | **AUTOMATIZADO** pero MUY DESFASADO | `EAES741` (Tabla 28191) | Anual (~2 años lag) | 28.050€ (**dato 2022**) | ALTA |
| SMI | **HARDCODEADO** | — (BOE) | Anual | 1.221€/mes (2026) | ALTA — actualizar a mano cada enero |
| IPC (31 años) | **AUTOMATIZADO** | `IPC278296` + `IPC290750` | Anual | 1995-2025, base 2024 | MEDIA |

**URLs** (estables — API Tempus):
- Base: `https://servicios.ine.es/wstempus/js/ES/DATOS_SERIE/{SERIE}?nult=N`

**Problemas detectados**:
1. **Salario medio con 3+ años de retraso**: El dato actual (28.050€) es de 2022. INE publica la Encuesta de Estructura Salarial con ~2 años de lag.
2. **SMI requiere actualización manual** cada enero cuando se publica en el BOE.
3. **Población (ECP320)**: Tabla 56934 conocida por devolver datos antiguos. Sanity check (40M-60M) no detecta datos viejos.
4. **CPI limitado al último año cerrado**: actualmente llega hasta 2025 (base 2024). La serie del año en curso se consolida al cierre anual.

---

## 3. SEGURIDAD SOCIAL — Pensiones

**Script**: `scripts/sources/seguridad-social.mjs` | **Output**: `src/data/pensions.json`

| Dato | Clasificación | Fuente real | Dato actual | Fragilidad |
|------|---------------|-------------|-------------|------------|
| Nómina mensual SS | **SEMI-AUTOMATIZADO** | Excel scrapeado de seg-social.es | 14.250 M€ (ene 2026) | MUY ALTA — UUID URLs |
| Nómina Clases Pasivas | **HARDCODEADO** | Ministerio Hacienda (sin API) | 1.659 M€ (estimación) | MUY ALTA |
| N.° pensiones | **SEMI-AUTOMATIZADO** | Mismo Excel SS | 10.452.674 | MUY ALTA |
| Pensión media jubilación | **SEMI-AUTOMATIZADO** | Mismo Excel SS | 1.563,56€ | MUY ALTA |
| N.° afiliados | **HARDCODEADO** | No hay API pública | 21.300.000 (estimación) | MUY ALTA |
| Cotizaciones sociales | **HARDCODEADO** | PGE 2025 | 180.000 M€/año | ALTA |
| Déficit contributivo anual | **DERIVADO** | gasto anual - cotizaciones | 42.736 M€ | MEDIA |
| Déficit acumulado (desde 2011) | **HARDCODEADO** | UV-Eje, Fedea SSA, BdE | 300.000 M€ (base ene 2026) | MUY ALTA |
| Fondo de Reserva | **HARDCODEADO** | Ministerio | 2.100 M€ | ALTA |
| Gasto por segundo | **DERIVADO** | nómina × 14 / 365,25 / 86400 | 7.058 €/s | BAJA |
| Serie histórica | **HARDCODEADA** | 11 puntos interpolados a mano + último punto live/fallback | 2020-2026 | MUY ALTA |

**Proceso de scraping** (el más frágil del pipeline):
```
1. GET https://www.seg-social.es/.../EST24  (HTML)
2. Regex: /href=['"]([^'"]*REG\d{6}\.xlsx[^'"]*)['"]/i
3. GET Excel encontrado (UUID URL cambia cada mes)
4. Parse hoja "Régimen_clase", fila "Total sistema"
5. Columnas: [1]=pensiones, [2]=nómina, [3]=pensión media
```

**Problemas detectados**:
1. **UUID URLs**: Las URLs del Excel cambian cada mes. Si cambian el patrón `REG*.xlsx`, el regex falla.
2. **HTML scraping frágil**: Depende de la estructura HTML de seg-social.es.
3. **Índices de columna hardcodeados** (`[1]`, `[2]`, `[3]`) — si SS reordena columnas, valores erróneos sin error visible.
4. **"Total sistema" como ancla**: Si cambian a "TOTAL SISTEMA" o "Total del Sistema", no encuentra la fila.
5. **Clases Pasivas sin fuente**: No hay API ni archivo descargable. Se estima como ~11,6% de la nómina SS.
6. **Serie histórica inventada**: Los 11 puntos base (2020-2025) son valores interpolados a mano, no descargados.
7. **Afiliados sin fuente**: 21.3M es estimación. SS publica afiliados pero no en formato fácilmente automatizable.
8. **Cotizaciones sociales**: 180.000 M€ del PGE 2025. Actualizar manualmente con cada PGE.
9. **Déficit acumulado 300.000 M€**: Estimación conservadora basada en literatura. Requiere revisión manual periódica.

---

## 4. IGAE — Gasto Público COFOG

**Script**: `scripts/sources/igae.mjs` | **Output**: `src/data/budget.json`

| Dato | Clasificación | Método | Cobertura | Fragilidad |
|------|---------------|--------|-----------|------------|
| Gasto total por año | **AUTOMATIZADO** | Excel COFOG, fila "GASTO TOTAL" | 30 años (1995-2024) | BAJA — detección dinámica de fila |
| 10 divisiones COFOG | **AUTOMATIZADO** | Detección dinámica por header | 30 años | MEDIA — validación cruzada implementada |
| ~70 subcategorías | **SEMI-AUTOMATIZADO** | Detección dinámica de rangos | 30 años | MEDIA |
| Nombres de categorías | **HARDCODEADO** | Mapa estático | Fijo | BAJA |
| Porcentajes | **DERIVADO** | (categoría / total) × 100 | — | BAJA |

**URL** (estable): `https://www.igae.pap.hacienda.gob.es/sitios/igae/es-ES/Contabilidad/ContabilidadNacional/Publicaciones/Documents/AAPP_A/COFOG_A_AAPP.xlsx`

**Mejoras de robustez**:
1. **Detección dinámica de columnas**: El script escanea la fila 7 buscando códigos COFOG (`XX.N`) para identificar automáticamente los índices de columnas de subcategorías y totales.
2. **Validación cruzada**: Se verifica que la suma de las 10 divisiones coincida con el gran total (tolerancia 1%) para detectar errores de parsing.
3. **Fallback**: Si la detección dinámica falla, el script utiliza constantes de respaldo y emite un aviso.

---

## 5. EUROSTAT — Comparativa Europea

**Script**: `scripts/sources/eurostat.mjs` | **Output**: `src/data/eurostat.json`

| Dato | Clasificación | Dataset Eurostat | Cobertura | Fragilidad |
|------|---------------|------------------|-----------|------------|
| Deuda/PIB por país | **AUTOMATIZADO** | `gov_10dd_edpt1` (na_item=GD) | 8 países, último año | BAJA |
| Déficit/superávit | **AUTOMATIZADO** | `gov_10dd_edpt1` (na_item=B9) | 8 países, último año | BAJA |
| Gasto público/PIB | **AUTOMATIZADO** | `gov_10a_main` (na_item=TE) | 8 países, último año | BAJA |
| Gasto social/PIB | **AUTOMATIZADO** | `gov_10a_exp` (cofog99=GF10) | 8 países, último año | BAJA |
| Tasa de paro | **AUTOMATIZADO** | `une_rt_a` (age=Y15-74) | 8 países, último año | BAJA |

**Países**: ES (España), DE (Alemania), FR (Francia), IT (Italia), PT (Portugal), EL (Grecia), NL (Países Bajos), EU27_2020 (media UE-27).

**URL** (estable — API pública REST):
- Base: `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/{DATASET}`
- Formato: JSON-stat 2.0
- Sin autenticación necesaria

**Método**: API REST con filtros por dimensión (freq, unit, sector, na_item, geo, time). Se solicitan los últimos 3 años y se toma el más reciente con datos disponibles. Parsing del formato JSON-stat 2.0 (flat value array con cross-product de dimensiones).

**Desfase**: Eurostat publica con ~1-2 años de retraso. Los datos más recientes suelen ser del año anterior o el previo.

**Fallback**: Valores de referencia hardcodeados (Eurostat 2023) que se usan si la API no responde.

---

## 6. BANCO DE ESPAÑA — Deuda por Comunidades Autónomas

**Script**: `scripts/sources/bde.mjs` (función `downloadCcaaDebtData`) | **Output**: `src/data/ccaa-debt.json`

| Dato | Clasificación | Método | Frecuencia | Fragilidad |
|------|---------------|--------|------------|------------|
| Deuda CCAA como % del PIB regional | **AUTOMATIZADO** | CSV `be1310.csv` formato transpuesto | Trimestral | BAJA — mismo formato que be11b |
| Deuda CCAA absoluta (miles de €) | **AUTOMATIZADO** | CSV `be1309.csv` formato transpuesto | Trimestral | BAJA |
| Total nacional (suma ponderada) | **DERIVADO** | Suma de 17 CCAA | Trimestral | BAJA |

**URLs** (estables):
- `https://www.bde.es/webbe/es/estadisticas/compartido/datos/csv/be1310.csv`
- `https://www.bde.es/webbe/es/estadisticas/compartido/datos/csv/be1309.csv`

**Cobertura**: 17 Comunidades Autónomas, datos trimestrales desde MAR 1995.

**Método de parsing**: Mismo formato transpuesto que be11b. Series como columnas con sufijo numérico (`.1` a `.17`) que mapea a cada CCAA. Se extrae el último trimestre con datos disponibles.

**Fallback**: Valores de referencia hardcodeados (Q3 2025) para las 17 CCAA, mismo patrón que el resto de fuentes.

---

## 7. EUROSTAT — Ingresos y Gastos Públicos

**Script**: `scripts/sources/eurostat.mjs` (función `downloadRevenueData`) | **Output**: `src/data/revenue.json`

| Dato | Clasificación | Indicador Eurostat | Cobertura | Fragilidad |
|------|---------------|-------------------|-----------|------------|
| Ingresos totales (TR) | **AUTOMATIZADO** | `gov_10a_main` na_item=TR, MIO_EUR | 30 años (1995-2024) | BAJA |
| Gastos totales (TE) | **AUTOMATIZADO** | `gov_10a_main` na_item=TE, MIO_EUR | 30 años | BAJA |
| Déficit/superávit (B9) | **AUTOMATIZADO** | `gov_10a_main` na_item=B9, MIO_EUR | 30 años | BAJA |
| Impuestos indirectos (D2REC) | **AUTOMATIZADO** | `gov_10a_main` na_item=D2REC, MIO_EUR | 30 años | BAJA |
| Impuestos directos (D5REC) | **AUTOMATIZADO** | `gov_10a_main` na_item=D5REC, MIO_EUR | 30 años | BAJA |
| Cotizaciones sociales (D61REC) | **AUTOMATIZADO** | `gov_10a_main` na_item=D61REC, MIO_EUR | 30 años | BAJA |
| Otros ingresos | **DERIVADO** | TR - D2REC - D5REC - D61REC | 30 años | BAJA |
| Presión fiscal | **DERIVADO** | TR / PIB × 100 | — | BAJA |

**URL** (estable — API pública REST):
- Base: `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/gov_10a_main`
- Formato: JSON-stat 2.0
- Sin autenticación necesaria
- Filtros: `freq=A`, `unit=MIO_EUR`, `sector=S13`, `geo=ES`, `sinceTimePeriod=1995`

**Método**: Mismo API REST de Eurostat que la comparativa europea. Se descargan 6 indicadores en paralelo como series temporales para España (S.13). Se parsea con `parseJsonStatTimeSeries` (variante del parser existente que extrae todos los años para un solo país). Los datos se fusionan por año con cálculo derivado de `otherRevenue`.

**Desfase**: ~1-2 años (mismo que el resto de Eurostat).

**Fallback**: Valores de referencia hardcodeados (2024) que se usan si la API no responde.

---

## 8. AEAT — Recaudación Tributaria

**Script**: `scripts/sources/aeat.mjs` | **Output**: `src/data/tax-revenue.json`

| Dato | Clasificación | Método | Frecuencia | Fragilidad |
|------|---------------|--------|------------|------------|
| Total recaudación neta | **AUTOMATIZADO** | Excel Series mensuales, col 6 | Mensual | MEDIA — índices de columna hardcodeados |
| IRPF netos | **AUTOMATIZADO** | Excel Series mensuales, col 29 | Mensual | MEDIA |
| IVA netos | **AUTOMATIZADO** | Excel Series mensuales, col 107 | Mensual | MEDIA |
| Sociedades netos | **AUTOMATIZADO** | Excel Series mensuales, col 65 | Mensual | MEDIA |
| IRNR netos | **AUTOMATIZADO** | Excel Series mensuales, col 82 | Mensual | MEDIA |
| IIEE total netos | **AUTOMATIZADO** | Excel Series mensuales, col 137 | Mensual | MEDIA |
| IIEE sub-desglose (9 conceptos) | **AUTOMATIZADO** | Excel Series mensuales, cols 142-175 | Mensual | MEDIA |
| Resto impuestos netos | **AUTOMATIZADO** | Excel Series mensuales, col 178 | Mensual | MEDIA |
| Resto sub-desglose (7 conceptos) | **AUTOMATIZADO** | Excel Series mensuales, cols 180-188 | Mensual | MEDIA |
| Recaudación por CCAA (17 comunidades) | **AUTOMATIZADO** | Excel Delegaciones, columnas D.E. | Mensual | MEDIA — matching headers CCAA |
| Recaudación per cápita | **DERIVADO** | Total netos × 1M / población INE | — | BAJA |

**URLs** (estables, sobreescritas en cada actualización AEAT):
- Series mensuales: `https://sede.agenciatributaria.gob.es/.../Cuadros_estadisticos_series_es_es.xlsx` (~1,6 MB)
- Delegaciones: `https://sede.agenciatributaria.gob.es/.../Ingresos_por_Delegaciones.xlsx` (~11 MB, timeout 60s)

**Validación**: suma de componentes ≈ total (tolerancia 1%).

**Desfase**: ~1 mes (datos publicados con retraso de un mes).

**Fallback**: Valores de referencia hardcodeados (2024: total=295.028 M€, IRPF=129.538, IVA=90.631, Sociedades=39.136, IIEE=22.150, IRNR=4.039, resto=9.535).

**Nota foral**: Navarra y País Vasco recaudan tributos propios; las cifras de delegaciones reflejan solo la cuota estatal.

---

## 9. INFRAESTRUCTURA CI/CD

| Workflow | Trigger | Qué hace |
|----------|---------|----------|
| `deploy.yml` | Push/PR a main | lint -> test -> build (deploy solo en push a main) |
| `update-data.yml` | Lunes 08:00 UTC + manual | `npm run download-data` -> check stale -> auto-commit |

**Lógica de robustez en CI**:
1. **Éxito parcial**: El script de descarga devuelve exit 0 si las fuentes críticas (deuda, demografía, pensiones, presupuestos) son correctas, permitiendo fallos temporales en fuentes secundarias (Eurostat, CCAA).
2. **Alertas de datos obsoletos (Stale)**: Tras la descarga, el workflow verifica si alguna fuente tiene un desfase > 14 días. Si es así, crea automáticamente una GitHub Issue detallando el problema.
3. **Auto-commit**: Solo se guardan cambios si las fuentes críticas están OK (datasets + API pública + artefactos SEO/SSG + RSS).
4. **Validación de cabeceras**: Los scripts de Seguridad Social e IGAE validan la estructura del Excel antes de procesar, emitiendo avisos ante cambios de formato.

---

## 10. TABLA RESUMEN: CLASIFICACIÓN DE TODOS LOS DATOS

### AUTOMATIZADOS (se actualizan solos cada lunes)
| Dato | Fuente | Frescura | Confiabilidad |
|------|--------|----------|---------------|
| Deuda total PDE | BdE CSV | Mensual (~15d lag) | Alta |
| Deuda por subsector | BdE CSV | Mensual | Alta |
| Ratio deuda/PIB | BdE CSV be1101 | Trimestral | Alta |
| Variación interanual deuda | Derivado | Mensual | Alta |
| Regresión deuda (€/s) | Derivado | Mensual | Alta |
| Población total | INE API ECP320 | Anual | Media |
| Población activa (EPA) | INE API EPA387794 | Trimestral | Alta |
| PIB nominal | INE API CNTR6597 | Trimestral | Alta |
| IPC (1995-2025) | INE API IPC278296+290750 | Anual | Alta |
| Gasto COFOG (10 div × 30 años) | IGAE Excel | Anual | Media (detección dinámica + fallback) |
| Deuda/PIB comparativa EU | Eurostat API | Anual (~1-2a lag) | Alta |
| Déficit/superávit EU | Eurostat API | Anual | Alta |
| Gasto público/PIB EU | Eurostat API | Anual | Alta |
| Gasto social/PIB EU | Eurostat API | Anual | Alta |
| Tasa de paro EU | Eurostat API | Anual | Alta |
| Deuda CCAA % PIB | BdE CSV be1310 | Trimestral | Alta |
| Deuda CCAA absoluta | BdE CSV be1309 | Trimestral | Alta |
| Ingresos totales (TR) | Eurostat API gov_10a_main | Anual (~1-2a lag) | Alta |
| Gastos totales (TE) | Eurostat API gov_10a_main | Anual | Alta |
| Déficit/superávit (B9) | Eurostat API gov_10a_main | Anual | Alta |
| Impuestos indirectos (D2REC) | Eurostat API gov_10a_main | Anual | Alta |
| Impuestos directos (D5REC) | Eurostat API gov_10a_main | Anual | Alta |
| Cotizaciones sociales (D61REC) | Eurostat API gov_10a_main | Anual | Alta |

### SEMI-AUTOMATIZADOS (se descargan pero con riesgo de rotura)
| Dato | Fuente | Riesgo |
|------|--------|--------|
| Nómina pensiones SS | Seg. Social Excel | MUY ALTO — UUID URLs + scraping |
| N.° pensiones | Seg. Social Excel | MUY ALTO |
| Pensión media jubilación | Seg. Social Excel | MUY ALTO |
| Subcategorías COFOG (~70) | IGAE Excel | MEDIA — detección dinámica con fallback a rangos hardcodeados |
| Salario medio | INE API EAES741 | MEDIO — dato de hace 3 años |

### HARDCODEADOS / MANUALES (requieren intervención humana)
| Dato | Valor actual | Cuándo actualizar | Dónde |
|------|-------------|-------------------|-------|
| SMI | 1.221€/mes (2026) | Cada enero (BOE) | `ine.mjs` -> valor hardcodeado `smi: 1_221` |
| Clases Pasivas | 1.659 M€/mes | Cuando haya datos | `seguridad-social.mjs` -> `REFERENCE_DATA` |
| N.° afiliados | 21.300.000 | Trimestralmente | `seguridad-social.mjs` -> `REFERENCE_DATA` |
| Cotizaciones sociales | 180.000 M€/año | Con cada PGE | `seguridad-social.mjs` -> `REFERENCE_DATA` |
| Fondo de Reserva | 2.100 M€ | Cuando se publique | `seguridad-social.mjs` -> `REFERENCE_DATA` |
| Déficit acumulado (base) | 300.000 M€ (ene 2026) | Anualmente | `seguridad-social.mjs` -> `REFERENCE_DATA` |
| Gasto en intereses | 39.000 M€ (PGE 2025) | Con cada PGE | `bde.mjs` -> `REFERENCE_INTEREST_EXPENSE` |
| Serie hist. pensiones | 11 puntos interpolados + 1 punto actual | Con cada descarga exitosa | `seguridad-social.mjs` |

### DERIVADOS (calculados a partir de otros datos)
| Dato | Fórmula | Depende de |
|------|---------|-----------|
| Deuda per cápita | totalDebt / población | Automatizados |
| Deuda por contribuyente | totalDebt / poblaciónActiva | Automatizados |
| Déficit contributivo anual | gastoAnual - cotizaciones | Semi-auto + hardcodeado |
| Gasto anual pensiones | nómina × 14 pagas | Semi-automatizado |
| Contribuyentes/pensionista | afiliados / pensionistas | Hardcodeado / semi-auto |
| Gasto por segundo (pensiones) | gastoAnual / 365,25 / 86400 | Derivado |
| Deuda por segundo | Regresión lineal 24 meses | Automatizado |
| Porcentajes COFOG | categoría / total × 100 | Automatizado |
| Deflación (€ reales) | nominal × (IPC[base] / IPC[año]) | Automatizado |
| Deuda en meses de SMI | debtPerCapita / SMI | Automatizado + hardcodeado |
| Deuda en salarios anuales | debtPerCapita / salarioMedio | Automatizados |
| Deuda en años de gasto | deuda / gastoAnual | Automatizados |
| Deuda en años de pensiones | deuda / gastoAnualPensiones | Semi-auto |
| Intereses en días de gasto | intereses / gastoDiario | Hardcodeado + automatizado |
| Gasto público diario | gastoAnual / 365 | Automatizado |
| Otros ingresos | TR - D2REC - D5REC - D61REC | Automatizados |
| Presión fiscal | ingresosTotales / PIB × 100 | Automatizados |

---

## 11. MAPA DE ARCHIVOS

```
scripts/
  download-data.mjs              # Orquestador (Promise.allSettled)
  sources/
    bde.mjs                      # Banco de España (CSV + API + CCAA)
    ine.mjs                      # INE Tempus API (5 series + CPI)
    seguridad-social.mjs         # SS (HTML scraping + Excel)
    igae.mjs                     # IGAE (Excel COFOG)
    eurostat.mjs                 # Eurostat API (5 indicadores EU-27 + 6 revenue ES)
  lib/
    fetch-utils.mjs              # fetchWithRetry (backoff + timeout)
    csv-parser.mjs               # Parser CSV formato español
    regression.mjs               # Regresión lineal OLS

src/data/
  debt.json                      # 373 puntos mensuales + regresión
  demographics.json              # Población, PIB, salarios, CPI (31 años)
  pensions.json                  # Nómina, pensiones, déficit + 12 hist.
  budget.json                    # COFOG 30 años × 10 div × ~7 subcats
  eurostat.json                  # Comparativa EU-27 (5 indicadores × 8 países)
  ccaa-debt.json                 # Deuda por CCAA (17 comunidades, 2 indicadores)
  revenue.json                   # Ingresos vs gastos AAPP (30 años, 6 indicadores)
  meta.json                      # Estado última descarga
  types.ts                       # Interfaces TypeScript
  sources.ts                     # Atribución fuentes (URLs, nombres)

.github/workflows/
  deploy.yml                     # CI: lint -> test -> build -> GitHub Pages
  update-data.yml                # Datos: lunes 08:00 UTC -> download -> auto-commit
```
