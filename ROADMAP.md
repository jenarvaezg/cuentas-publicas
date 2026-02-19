# Roadmap — Dashboard Fiscal de España

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
- Selector de Comunidad Autónoma (drill-down detallado)
- Deuda, déficit y gasto por comunidad (vista detallada per-CCAA)
- SSG/pre-rendering para SEO
- Compartir: URL con parámetros, captura de imagen
- PWA offline completa
- Tests E2E con Playwright
- i18n (castellano + inglés)

---

## Wishlist

Ideas de funcionalidades y datos que nos gustaría añadir. Sin orden de prioridad fijo.

### Datos fiscales detallados

- **Recaudación por impuesto y año**: Desglose de cuánto recauda el gobierno por cada impuesto (IRPF, IVA, Sociedades, IIEE, etc.) año a año. Fuente potencial: AEAT informes mensuales de recaudación (PDF/Excel), o Eurostat `gov_10a_taxag`. Dificultad: ALTA.
- **Tipos efectivos por impuesto**: Tipo efectivo medio de IRPF, Sociedades, IVA — evolución temporal.
- **Recaudación por CCAA**: Cuánto aporta cada comunidad autónoma en impuestos cedidos vs transferencias recibidas (balanzas fiscales).

### Mejoras de datos existentes

| Dato | Por qué | Fuente potencial | Dificultad |
|------|---------|-------------------|------------|
| Afiliados SS automatizados | Dato crucial para ratio cotizantes/pensionista | SS `EST211` — scraping similar al de pensiones | ALTA (UUID) |
| Cotizaciones sociales reales | Base del déficit contributivo | AEAT recaudación o liquidación presupuestaria SS | ALTA |
| Serie histórica pensiones real | Los 11 puntos actuales son interpolados | Histórico EST24 o Anuario Estadístico SS | MEDIA |
| SMI automático | Actualización manual cada enero | Tabla INE si existe, o historial hardcodeado | MEDIA |
| CPI 2025 | Solo llega hasta 2024; limita deflación | INE publica media anual en enero del año siguiente | BAJA (esperar) |
| Tipo interés medio de la deuda | Calcular coste intereses dinámicamente | Tesoro Público — tipos medios emisión | MEDIA |
| Inflación anual actual | Dato de contexto muy demandado | INE API — IPC variación anual (ya tenemos serie) | BAJA |
| Déficit acumulado recalculado | Eliminar hardcoded 300 mm€ | Script que sume gasto vs cotizaciones anualmente | MEDIA |

### Nuevas visualizaciones

- **Proyecciones demográficas**: Pirámide de población actual + proyecciones INE a 20-30 años (ratio dependencia futuro).
- **Población por tramos de edad**: Pirámide demográfica, ratio dependencia. Fuente: INE API — tablas demográficas.
- **Deuda hogares/empresas**: No solo deuda pública — incluir deuda privada para ver el panorama completo (BdE cuentas financieras).
- **Simulador de ajuste fiscal**: "¿Qué pasaría si subimos/bajamos X impuesto un Y%?" — calculadora interactiva.
- **Timeline de hitos**: Eventos económicos importantes (crisis 2008, COVID, reformas) superpuestos en los gráficos históricos.
- **Rating crediticio**: Indicador confianza deuda (Moody's/S&P/Fitch — sin API pública, dificultad MUY ALTA).

### Robustez del pipeline

1. **✅ IGAE: Detectar columnas por header en vez de por índice** — Leer fila cabecera, buscar códigos COFOG (01, 02...) y calcular índices dinámicamente. Elimina el problema de desplazamiento.
2. **SS: Fallback de URLs alternativas** — Mantener últimas 3-4 URLs conocidas del Excel y probarlas si scraping falla. Alertar (GitHub Issue automática) si ninguna funciona.
3. **✅ Validación cruzada COFOG** — Verificar que suma de 10 divisiones = total general. Si no cuadra, log warning + mantener datos anteriores.
4. **✅ SS: Validación de cabeceras** — Comprobar que las columnas del Excel coinciden con el esquema esperado antes de procesar.

### Infraestructura y UX

- **✅ Tooltips/modales explicativos por métrica**: Cada gráfica y dato debería tener un icono de ayuda (?) que abra un tooltip o modal explicando qué es el dato, cómo se calcula y por qué es importante. Objetivo: que cualquier persona sin formación económica entienda cada cifra.
- **Roadmap visible en la web**: Mostrar este roadmap como una página dentro del dashboard.
- **Compartir gráficos individuales**: Botón para exportar cada bloque como imagen (canvas -> PNG).
- **Notificaciones de datos nuevos**: Suscripción por email/RSS cuando se actualizan los datos.
- **API pública**: Endpoint JSON para que otros proyectos consuman nuestros datos procesados.
- **✅ Alertas de datos stale**: Si un dato > X meses de antigüedad, crear GitHub Issue automática (umbral actual: 14 días).
- **Ampliar meta.json**: Incluir "último dato real" (no último download) para cada métrica. Mostrar en UI cuándo se actualizó realmente cada dato.
- **Tests de integridad**: Tests que verifiquen `debtToGDP > 0`, `interestExpense > 0`, suma COFOG cuadre, etc.
