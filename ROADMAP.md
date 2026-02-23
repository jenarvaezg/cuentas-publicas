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
- 🟡 Deuda, déficit y gasto por comunidad (detalle de deuda listo + proxy déficit/gasto integrado con BdE+AEAT; pendiente fuente oficial CN regional)
- ✅ SEO pre-render + SSG multi-ruta: snapshot estático, sitemap y páginas por sección (`/secciones/*`, `/en/sections/*`)
- ✅ Compartir: hash + URL state (`section`, `ccaa`, `ccaaMetric`) + export PNG por bloque
- ✅ PWA offline hardening: runtime caching, fallback offline y registro SW con actualización
- ✅ Tests E2E con Playwright (smoke suite)
- ✅ i18n de interfaz y contenidos largos (castellano + inglés): selector, UI principal, metodología y roadmap

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

- **Sankey fiscal ultra detallado**: visualización de flujos desde ingresos (figuras tributarias y no tributarias) hacia usos finales del gasto (subsector, política, programa, capítulo/artículo/concepto), con filtros por Estado/CCAA/Provincia/Ayuntamiento y trazabilidad completa de fuente por nodo y enlace. Objetivo: nivel "aguja en pajar". Especificación: [`SANKEY-1000EUR.md`](SANKEY-1000EUR.md).
- **"De cada 1.000€ que entran, se reparten así"**: bloque narrativo y comparativo que convierta todo el presupuesto en una unidad fija (por 1.000€ de ingresos) con desglose granular por destino y opción de ver versión consolidada o por administración territorial. Especificación: [`SANKEY-1000EUR.md`](SANKEY-1000EUR.md).
- **Sección de demografía**: Bloque completo con población en tiempo real (contador estimado), natalidad, mortalidad e inmigración. Desglose por provincia. Fuente: INE (padrón continuo, estadísticas de nacimientos/defunciones, estadística de migraciones). Dificultad: ALTA.
- **Proyecciones demográficas**: Pirámide de población actual + proyecciones INE a 20-30 años (ratio dependencia futuro).
- **Población por tramos de edad**: Pirámide demográfica, ratio dependencia. Fuente: INE API — tablas demográficas.
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

## Orden Propuesto de Ejecución

1. **Completar CCAA (déficit y gasto por comunidad)**  
   Último gran bloque funcional pendiente antes de nuevas líneas de producto.
2. **Ejecutar checklist territorial CCAA→Provincia→Ayuntamiento**  
   Seguir [`CHECKLIST-TERRITORIAL.md`](CHECKLIST-TERRITORIAL.md) comunidad a comunidad, con foco en máxima profundidad y frescura.
3. ~~**Cerrar deuda documental del inventario de datos**~~
   ✅ `DATA-REGISTRY.md`, `API.md` y `openapi.json` alineados con los 11 datasets publicados en `/api/v1`.
