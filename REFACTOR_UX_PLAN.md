# Análisis y Crítica de Arquitectura y UX: Proyecto Cuentas Públicas

Este documento recoge una crítica estructural y de experiencia de usuario (UX) del proyecto, centrada en identificar redundancias, exceso de carga cognitiva ("bloat") y fragmentación en el modelo de datos.

## 1. El anti-patrón de "Todo es un Bloque" (Fatiga de Scroll)

Actualmente, `App.tsx` renderiza **15 secciones distintas** apiladas verticalmente (`DebtBlock`, `PensionsBlock`, `BudgetBlock`, `InequalityBlock`, `EquivalenciasBlock`, etc.).

*   **El problema:** El usuario entra para consultar el estado de las cuentas públicas y se enfrenta a una avalancha cognitiva en forma de pergamino infinito. Muchas de estas secciones pertenecen a la misma línea narrativa pero están desvinculadas visualmente.
*   **Ejemplo:** `DebtBlock`, `DebtCostBlock` y `EquivalenciasBlock` son tres bloques gigantes para explicar **una sola narrativa**: La Deuda. 
*   **La solución:** Consolidar bloques temáticos en un único componente interactivo (ej. un `DebtDashboard`) usando pestañas (*tabs*), selectores o vistas colapsables en lugar de apilar contenido verticalmente.

## 2. Redundancia en los Ingresos (Eurostat vs. AEAT)

Existe un puente narrativo que explica *"La brecha entre Eurostat y Hacienda"*, seguido de dos bloques de primer nivel: `RevenueBlock` (Ingresos y gastos globales) y `TaxRevenueBlock` (Recaudación tributaria).

*   **El problema:** Se obliga al usuario a procesar dos modelos mentales y visuales distintos para responder a una pregunta sencilla: "¿cuánto dinero entra?". Esto genera competencia por la atención del usuario y confusión sobre qué métrica es la "importante".
*   **La solución:** Fusionar ambos en un único "Motor de Ingresos". Mostrar el total consolidado por defecto y ofrecer un *drill-down* (profundización) hacia los impuestos directos de la AEAT (IRPF, IVA) solo si el usuario desea más detalle.

## 3. Fragmentación extrema del modelo de datos Territorial (CCAA)

Revisando `src/data/types.ts`, el modelado de datos autonómicos es un caos arquitectónico. Existen **9 interfaces distintas** para datos regionales diseminadas por toda la aplicación:

1. `CcaaDebtData`
2. `CcaaDeficitData`
3. `TaxRevenueCcaaEntry`
4. `CcaaFiscalBalanceData`
5. `CcaaSpendingData`
6. `CcaaForalFlowsData`
7. `PensionsRegionalData`
8. `UnemploymentRegionalData`
9. `RegionalAccountsData`

*   **El problema:** Descargar, parsear e inyectar 9 archivos JSON separados para hablar de las mismas 17 Comunidades Autónomas es sumamente ineficiente. Obliga al *frontend* a hacer cruces de datos (joins) constantemente.
*   **La solución:** Crear un script de agregación en Node (en *build time*) que unifique todos estos conjuntos en un único `ccaa.json`. Debería existir una interfaz maestra `CcaaProfile` que contenga todas las dimensiones (deuda, déficit, gasto, pensiones) indexadas por el código de la comunidad.

## 4. Datos que "no aportan" al objetivo principal (Scope Creep)

El dashboard se llama "Cuentas Públicas" y su foco principal debería ser la deuda, el déficit, las pensiones y el gasto (COFOG). Sin embargo, se ha incluido:

*   `InequalityBlock` (Gini, AROPE)
*   `SocialEconomyBlock`
*   `DemographicsBlock` (Pirámide poblacional, esperanza de vida)

*   **El problema:** Aunque es un contexto macroeconómico brillante, se desvía del hilo conductor. Incluir la economía social o la desigualdad al mismo nivel que la deuda nacional diluye el impacto del mensaje principal (el estado financiero del país).
*   **La solución:** Eliminar estos bloques como secciones principales. La demografía puede mantenerse de forma reducida *únicamente* como contexto anidado dentro de Pensiones (donde la pirámide poblacional es vital para explicar el déficit). El resto debe ir a un anexo o eliminarse.

## 5. El Sankey (`FlowsSankeyBlock`) como parche de navegación

El "Mapa Fiscal" es excelente visualmente, pero compite con el resto de la página.

*   **El problema:** Un diagrama de Sankey complejo sirve habitualmente como el **resumen interactivo definitivo** para evitar el scroll infinito. Sin embargo, en el diseño actual, el Sankey te muestra todo el flujo... y luego te hace hacer scroll por 15 secciones que vuelven a desglosar exactamente lo mismo.
*   **La solución:** Convertir el Sankey en una herramienta de navegación. Al hacer clic en el nodo de "Pensiones" o "Deuda", el dashboard debería actualizar la vista inferior o hacer autoscroll hacia una vista detallada, en lugar de ser solo un gráfico pasivo en la cabecera.

---

## Plan de Acción Recomendado (Refactor)

1. **Reducir de 15 a 5 Dashboards (Consolidación UI):**
   * **Dashboard Principal:** Contadores en tiempo real + Sankey (usado como índice interactivo).
   * **Gasto Público:** Pensiones + Presupuestos (COFOG) unificados.
   * **Ingresos Públicos:** Recaudación consolidada (Hacienda + Eurostat).
   * **Deuda Nacional:** Deuda + Costes + Equivalencias (usando pestañas).
   * **Explorador Regional:** Un único componente interactivo (mapa o tabla maestra) para consultar todos los datos de las CCAA sin hacer scroll.

2. **Poda de Scope (Eliminación):**
   * Ocultar o eliminar `SocialEconomyBlock` y `InequalityBlock`.
   * Integrar la parte útil de `DemographicsBlock` dentro del apartado de Pensiones.

3. **Backend / Data Pipeline:**
   * Crear un nuevo script en `scripts/` que recoja la salida de las CCAA y devuelva un único JSON unificado para simplificar el estado global (`useData.ts`).

> *"La perfección en el diseño de dashboards no se alcanza cuando no hay más métricas que añadir, sino cuando no hay más métricas que quitar sin perder el mensaje principal."*