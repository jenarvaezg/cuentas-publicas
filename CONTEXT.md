# Cuentas Públicas — Domain Context

Dashboard fiscal estático de España. Este documento es el glosario canónico del dominio. Detalles de implementación, arquitectura e invariantes operativos viven en `CLAUDE.md` y `docs/`.

## Language

### Macroeconomía y contabilidad pública

**Deuda PDE**:
Deuda pública según el Protocolo de Déficit Excesivo (definición Eurostat / SEC). Métrica oficial de deuda en este proyecto.
_Avoid_: "deuda total", "deuda nominal"

**AAPP / S.13**:
Administraciones Públicas — perímetro consolidado SEC 2010 (Estado + CCAA + CCLL + SS).
_Avoid_: "sector público", "gobierno central"

**S.1314**:
Subsector "Fondos de la Seguridad Social" dentro de S.13. Base del Déficit contributivo.

**B.9**:
Capacidad (+) o Necesidad (−) de financiación, concepto técnico SEC. En este proyecto se materializa en el término **Déficit público**.

**Déficit público**:
B.9 de las AAPP (S.13): gasto AAPP − ingresos AAPP. Lo que la UE supervisa en la PDE.
_Avoid_: "déficit" a secas

**Déficit contributivo**:
Diferencia anual entre cotizaciones sociales (D61REC) y gasto contributivo (D62PAY) del subsector S.1314. Subconjunto del Déficit público.
_Avoid_: "déficit de pensiones", "déficit de la SS"

**Déficit contributivo acumulado**:
Integral temporal del Déficit contributivo desde 2009. Es la cifra del contador grande del hero.

**Ratio deuda/PIB**:
Deuda PDE dividida por PIB nominal trimestral.

**Intereses de la deuda**:
Pagos anuales del Estado por servicio financiero de la **Deuda PDE**. Excluyen amortizaciones, comisiones y costes de gestión.
_Avoid_: "coste de la deuda" en código y datos (admisible solo como copy coloquial de UI)

**Tipo medio de la deuda**:
Ratio derivado `Intereses de la deuda / Deuda PDE × 100`. Refleja el coste implícito del stock vivo.

**Cotizaciones sociales (D61REC)**:
Ingresos por contribuciones a la SS. na_item D61REC de Eurostat.
_Avoid_: "afiliaciones" (eso es número de personas)

**Gasto contributivo (D62PAY)**:
Prestaciones pagadas por la SS. na_item D62PAY de Eurostat.
_Avoid_: "pensiones totales" (excluye Clases Pasivas)

### COFOG

**División COFOG**:
Las 10 divisiones de nivel 1 (`01` Servicios públicos generales … `10` Protección social).

**Subcategoría COFOG**:
Nivel 2 (~70 entradas). Detectadas por header `XX.N` en el ETL IGAE.

**GF1005**:
Subgrupo "Desempleo" dentro de la división `10` (Protección social). Identificador Eurostat.

**Total AAPP**:
Vista consolidada COFOG sobre el perímetro S.13. La única que importamos del IGAE; no usamos subsectores.

### Territorio

**CCAA**:
Las 17 Comunidades Autónomas peninsulares e insulares de España. La UI territorial (selector, Sankey What-If, rankings) opera estrictamente sobre `CA01`–`CA17`.
_Avoid_: incluir Ceuta/Melilla en componentes UI territoriales

**CAxx**:
Identificador canónico territorial. Las 17 **CCAA** ocupan `CA01` Andalucía … `CA17` La Rioja. `CA18` (Ceuta) y `CA19` (Melilla) son códigos reservados; ver entrada propia.
_Avoid_: NUTS2 en código de aplicación; nombres en string

**CA18 / CA19**:
Códigos canónicos de Ceuta y Melilla. Solo aparecen en datasets donde excluirlas descuadraría sumas nacionales (pensiones, desempleo, demografía). Quedan fuera de la UI territorial.

**Régimen común**:
Las 15 CCAA financiadas por el modelo LOFCA (tributos cedidos + transferencias del Estado).

**Régimen foral**:
Navarra (`CA15`) y País Vasco (`CA16`): recaudan sus propios tributos y pagan al Estado a través de **Cupo** o **Aportación**.

**Cupo**:
Pago anual de País Vasco al Estado por servicios no asumidos. Acordado en la CMCE (Comisión Mixta del Concierto Económico).

**Aportación**:
Equivalente navarro del Cupo. Fijado por el Convenio Económico (Memoria, Cuadro nº 64).

### Pensiones

**Régimen contributivo**:
Pensiones financiadas con cotizaciones a la SS. Ámbito del Déficit contributivo.

**Clases Pasivas**:
Pensiones de funcionarios estatales pagadas directamente por el Estado, no por la SS.

**Cotizantes/pensionista**:
Ratio de sostenibilidad: afiliados activos sobre pensionistas.

**Fondo de Reserva**:
Fondo de la SS para amortiguar el Déficit contributivo.

**Ageing Report**:
Informe trienal de la UE con proyecciones de gasto en pensiones a 2070.

### Sankey de flujos consolidados

**Consolidado**:
Nodo central del diagrama de flujos. Cumple `Consolidado = Ingresos + Déficit público`.

**What-If**:
Modo del Sankey que recalcula la red al excluir una o varias **CCAA**.

**Residuo central**:
Para una categoría de gasto X: `residuo = X_Sankey − Σ X_regional`. Es el gasto del Estado en X no atribuible directamente a una CCAA. Al excluir CCAA se distribuye proporcionalmente al PIB.

**Proyección Fiscal**:
La operación de mapear datos nacionales (Sankey base) a una vista regional, computando **Residuos centrales** y cuotas por CCAA. Existe en código como módulo `createFiscalProjection`: instancia por año, expone los tres modos del Sankey (`national`, `focusOn(ccaa)`, `exclude(ccaas)`). Reemplaza a las antiguas funciones `buildCcaaGraph` y `computeWhatIfSimulation`.

**FlowGraph**:
Resultado de la **Proyección Fiscal**: nodos y aristas balanceadas listas para `@nivo/sankey`. Sucesor del tipo `FlowsYearData`.

### Calidad de vida

**AROPE**:
At-Risk-Of-Poverty-or-Exclusion. Indicador agregado del INE.

**Gini**:
Coeficiente de desigualdad de renta. Presentado en escala 0–100.

**ECV**:
Encuesta de Condiciones de Vida (INE). Anual.

## Relationships

- **AAPP** = Estado + CCAA + CCLL + **S.1314**.
- **Déficit contributivo** ⊂ **Déficit público**.
- **Déficit contributivo acumulado** es la integral temporal del **Déficit contributivo** desde 2009.
- Las 17 **CCAA** se particionan en **Régimen común** (15) y **Régimen foral** (Navarra + País Vasco).
- Cada **CCAA** tiene un único `CAxx`; todos los datasets territoriales se cruzan por ese código. `CA18`/`CA19` viven en paralelo en datasets nacionales pero no son **CCAA** a efectos de UI.
- En el Sankey, el nodo **Consolidado** equilibra ingresos y gastos; el **Residuo central** absorbe la parte no atribuida regionalmente.

## Example dialogue

> **Dev:** "El contador del hero pone 'Déficit Acumulado' y cita Eurostat S1314. ¿Es **Déficit público** o **Déficit contributivo**?"
> **Domain:** "Es el **Déficit contributivo acumulado**: integral desde 2009 de D61REC − D62PAY a nivel S.1314. El **Déficit público** (B.9 sobre S.13) solo aparece en `RevenueDashboardBlock` y en la comparativa UE."

> **Dev:** "Si excluyo Navarra en el **What-If**, ¿qué le resto?"
> **Domain:** "Lo que ya esté atribuido vía `pensions-regional`/`ccaa-spending` se resta directo. Del **Residuo central** se le resta su cuota proporcional al PIB navarro. Y como Navarra es **Régimen foral**, sus ingresos vienen vía **Aportación**, no por impuestos cedidos."

## Flagged ambiguities

- **"Déficit" a secas** — resuelto. Tres conceptos distintos (público, contributivo, contributivo acumulado) que antes se mezclaban. Tienen ahora términos canónicos separados; "déficit" sin calificador queda prohibido en copy nuevo. Aplicar la limpieza al label del hero (`App.tsx:264`) y a los tooltips relacionados.
- **"Coste de la deuda"** — resuelto. El término técnico canónico es **Intereses de la deuda** (un único componente, no servicio total). "Coste de la deuda" sigue siendo aceptable como copy de UI (capítulo C4, sección `#coste-deuda`) por familiaridad para el lector no experto, pero no como término en código ni en atribuciones.
- **"Déficit (Nueva Deuda)"** en el Sankey — pendiente. El nodo `DEFICIT` usa B.9 anual (correctamente **Déficit público**) pero la etiqueta lo conflaciona con "incremento de deuda", que no es lo mismo (existen ajustes stock-flow). Cambiar la etiqueta a algo como "Déficit público (financiación necesaria)" o equivalente sin igualar conceptos.
- **Cobertura de Ceuta y Melilla** — resuelto en política, inconsistente en código. Política canónica: `CA18`/`CA19` son códigos válidos; los datasets que necesitan preservar el total nacional los capturan y la UI los ignora. El código actual es heterogéneo (`pensions-regional`, `unemployment-regional`, `ine` los incluyen; `regional-accounts`, `hacienda-fiscal-balance` los excluyen). Probablemente artefacto de pasadas de IA sin política única. Pendiente: ADR + auditoría para alinear todos los pipelines al criterio.
