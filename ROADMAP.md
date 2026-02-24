# Roadmap — Dashboard Fiscal de España

Estado validado contra el código actual: **23 febrero 2026**.

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
- [ ] (Q2 2026) **Sostenibilidad del estado de bienestar**: Visualización didáctica del agujero de las pensiones y la curva demográfica frente a previsiones de cotización y Fondo de Reserva. -> **HAY DATOS BÁSICOS EN TABLA, FALTA VISUALIZACIÓN PROPIA / SECCIÓN DEDICADA**.
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
  - ⏳ Proyecciones demográficas (INE a 20-30 años)
  - ⏳ Datos de flujos migratorios (entradas/salidas)

---

## Simulador Territorial (Sankey Avanzado) ⏳

El objetivo es transformar la herramienta actual en un **simulador macroeconómico 100% fidedigno** mediante Data Lakes de archivos JSON estáticos (matrices "CCAA -> COFOG -> EUROS") autogenerados por ETLs y conectados matemáticamente a los Nodos/Enlaces del Sankey.

### Fase 1: Pensiones y Desempleo (El Gran Gasto Social)
Las transferencias directas a familias suponen el grueso del gasto estatal.

- ⏳ **1.1. Pensiones Territorializadas:**
  - **Script ETL:** Crear `scripts/etl/pensions-regional.mjs` que parsee estadisticas de la Seg. Social.
  - **Output JSON:** `src/data/pensions-regional.json` (ej: `{"CA01": { "gasto": 15000000 }, "CA02": ...}`).
  - **Integración Sankey:** Restar el valor al nodo `PENSIONES` y al enlace desde `GASTOS_TOTALES`.
- ⏳ **1.2. Prestaciones por Desempleo (SEPE):**
  - **Script ETL:** Crear `scripts/etl/unemployment-regional.mjs`.
  - **Output JSON:** `src/data/unemployment-regional.json`.
  - **Integración Sankey:** Restar el valor al nodo `DESEMPLEO`.

### Fase 2: Inversiones Reales y Subvenciones
El Estado Central asume la construcción de infraestructuras interregionales y rescates a empresas.

- ⏳ **2.1. Licitaciones y Obra Pública (Cap. 6):**
  - **Script ETL:** Scraper de la Plataforma de Contratos (`scripts/etl/contracts-regional.mjs`) mapeado por CCAA y Función COFOG.
  - **Output JSON:** `src/data/investments-regional.json`.
  - **Integración Sankey:** Restar del nodo COFOG correspondiente (ej. `ASUNTOS_ECONOMICOS`).
- ⏳ **2.2. Subvenciones del Estado (Cap. 4 y 7):**
  - **Script ETL:** Consumir la base de datos BDNS y agrupar por CCAA fiscal de los beneficiarios en `src/data/subsidies-regional.json`.
  - **Integración Sankey:** Restar proporcionalmente de las áreas subvencionadas (`AGRICULTURA`, `INDUSTRIA`).

### Fase 3: Nóminas de la Administración General del Estado (AGE)
Sueldos de policías, jueces, militares y delegaciones ministeriales ubicados físicamente en la región.

- ⏳ **3.1. Distribución de Funcionarios del Estado:**
  - **Script ETL:** Extraer efectivos del Boletín de Personal AAPP y cruzar con sueldos PGE.
  - **Output JSON:** `src/data/age-salaries-regional.json` desglosado por rama (Defensa, Justicia, etc.).
  - **Integración Sankey:** Restar del nodo respectivo (`SERVICIOS_PUBLICOS`, `DEFENSA`, `ORDEN_PUBLICO`).

### Fase 4: Bienes Públicos Indivisibles (Proxy Demográfico)
Gastos no localizables geográficamente (ej. Exteriores, Corona, Congreso, Deudas).

- ⏳ **4.1. Extracción de Pesos Demográficos/PIB:**
  - **Cálculo:** Calcular el `%` de población/PIB de la región sobre España desde `demographics.json`.
  - **Integración Sankey:** Restar ese `%` proporcionalmente a los nodos indivisibles (`DEFENSA`, `ASUNTOS_EXTERIORES`, `INTERESES_DEUDA`).

### Fase 5: El Balance de Masas (Déficit y Consolidado)
Motor matemático central (`useMemo` en `FlowsSankeyBlock.tsx`).

- ⏳ **1. Ingresos Excluidos:** Resta lo aportado a la caja común (golpea a `INGRESOS_TOTALES`).
- ⏳ **2. Gastos Excluidos (Fases 1-4):** Resta todo el presupuesto autonómico y transferencias (golpea a `GASTOS_TOTALES`).
- ⏳ **3. Diferencial (Déficit):** Si `(Nuevos Ingresos) < (Nuevos Gastos)`, el nuevo `DEFICIT` = `Gastos - Ingresos`.
- ⏳ **4. Nodo Consolidado:** Reajusta su tamaño a la masa económica resultante.

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

- **✅ Sankey fiscal ultra detallado**: visualización interactiva de flujos desde ingresos territoriales hacia usos finales del gasto, con simulador "What-If" para CCAA.
- **✅ "De cada 1.000€ que entran, se reparten así"**: Integrado en el visor Sankey como herramienta proporcional del presupuesto consolidado.
- **Proyecciones demográficas**: Pirámide de población actual + proyecciones INE a 20-30 años (ratio dependencia futuro).
- **Población por provincia**: Desglose demográfico a nivel provincial. Fuente: INE (padrón continuo, estadísticas de nacimientos/defunciones, estadística de migraciones). Dificultad: ALTA.
- **Sostenibilidad de la Seguridad Social**: Sección dedicada con serie histórica del déficit contributivo (ingresos vs gastos contributivos desde 2006), déficit como % PIB y % gasto contributivo, saldo contributivo por CCAA, evolución del Fondo de Reserva y patrimonio neto de la SS. Fuentes: Fedea (Ángel de la Fuente, series de SS Ampliada), IGAE, García (2023) para CCAA, Ageing Report 2024 (proyecciones UE). Referencia: informe Hespérides «La (in)sostenibilidad de la Seguridad Social» (gráficos 7-15). Dificultad: ALTA.
- **Deuda hogares/empresas**: No solo deuda pública — incluir deuda privada para ver el panorama completo (BdE cuentas financieras).
- **Simulador de ajuste fiscal**: "¿Qué pasaría si subimos/bajamos X impuesto un Y%?" — calculadora interactiva.
- **Timeline de hitos**: Eventos económicos importantes (crisis 2008, COVID, reformas) superpuestos en los gráficos históricos.
- **Rating crediticio**: Indicador confianza deuda (Moody's/S&P/Fitch — sin API pública, dificultad MUY ALTA).

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

## Orden Propuesto de Ejecución

1. **Completar CCAA (déficit y gasto por comunidad)**  
   Último gran bloque funcional pendiente antes de nuevas líneas de producto.
2. **Ejecutar checklist territorial CCAA→Provincia→Ayuntamiento**  
   Seguir la sección "Checklist operativo por comunidad" comunidad a comunidad, con foco en máxima profundidad y frescura.
3. ~~**Cerrar deuda documental del inventario de datos**~~
   ✅ `DATA-REGISTRY.md`, `API.md` y `openapi.json` alineados con los 11 datasets publicados en `/api/v1`.
