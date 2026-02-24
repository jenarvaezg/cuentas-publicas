# Roadmap: Simulador de Independencia Fiscal 100% Preciso (Arquitectura Estática)

El objetivo de este roadmap es transformar la herramienta actual en un **simulador macroeconómico 100% fidedigno**, sin depender de bases de datos relacionales ni servidores backend complejos. 
Todo el motor de conocimiento se basará en **Data Lakes de archivos JSON estáticos** generados mediante scripts ETL en tiempo de compilación.

Cada paso detallado aquí responde a cómo procesar microdatos públicos, convertirlos en JSON estáticos y conectarlos matemáticamente a los Nodos y Enlaces (Links) específicos de nuestra librería `@nivo/sankey`.

---

## Fase 1: Pensiones y Desempleo (El Gran Gasto Social)
Las transferencias directas a familias suponen el grueso del gasto estatal.

- [ ] **1.1. Pensiones Territorializadas:**
  - **Script ETL:** Crear `scripts/etl/pensions-regional.mjs` que parsee estadisticas de la Seg. Social.
  - **Output JSON:** `src/data/pensions-regional.json` con formato: `{"CA01": { "gasto": 15000000 }, "CA02": ...}`
  - **Integración Sankey:** 
    - Al excluir una CCAA, buscar su valor en el JSON.
    - Restar ese valor al nodo `PENSIONES` (target).
    - Restar ese valor al enlace `GASTOS_TOTALES -> PENSIONES`.
- [ ] **1.2. Prestaciones por Desempleo (SEPE):**
  - **Script ETL:** Crear `scripts/etl/unemployment-regional.mjs`.
  - **Output JSON:** `src/data/unemployment-regional.json`.
  - **Integración Sankey:** 
    - Buscar el valor regional excluido en el JSON.
    - Restar el valor al nodo `DESEMPLEO`.
    - Restar el valor al enlace `GASTOS_TOTALES -> DESEMPLEO`.

## Fase 2: Inversiones Reales y Subvenciones
El Estado Central asume la construcción de infraestructuras interregionales y rescates a empresas.

- [ ] **2.1. Licitaciones y Obra Pública (Cap. 6):**
  - **Script ETL:** Crear scraper de la Plataforma de Contratos (`scripts/etl/contracts-regional.mjs`) que agrupe importes de adjudicación por Código Postal / NUTS.
  - **Output JSON:** `src/data/investments-regional.json` mapeado por CCAA y Función COFOG.
  - **Integración Sankey:**
    - Identificar a qué rama afecta (ej: Infraestructuras = `ASUNTOS_ECONOMICOS`).
    - Restar el valor de la CCAA al nodo COFOG correspondiente (ej. `ASUNTOS_ECONOMICOS`).
    - Restar del enlace `GASTOS_TOTALES -> ASUNTOS_ECONOMICOS`.
- [ ] **2.2. Subvenciones del Estado (Cap. 4 y 7):**
  - **Script ETL:** Consumir la base de datos BDNS y agrupar por CCAA fiscal de los beneficiarios.
  - **Output JSON:** `src/data/subsidies-regional.json`.
  - **Integración Sankey:** Restar proporcionalmente de las áreas subvencionadas (ej. `AGRICULTURA`, `INDUSTRIA`).

## Fase 3: Nóminas de la Administración General del Estado (AGE)
Sueldos de policías, jueces, militares y delegaciones ministeriales ubicados físicamente en la región.

- [ ] **3.1. Distribución de Funcionarios del Estado:**
  - **Script ETL:** Extraer efectivos del Boletín de Personal de las AAPP y cruzar con sueldos medios según PGE.
  - **Output JSON:** `src/data/age-salaries-regional.json` desglosado por rama (Defensa, Justicia, etc.).
  - **Integración Sankey:**
    - Restar del nodo `SERVICIOS_PUBLICOS`, `DEFENSA`, `ORDEN_PUBLICO` según corresponda.
    - Restar de los enlaces respectivos desde `GASTOS_TOTALES`.

## Fase 4: Bienes Públicos Indivisibles (Proxy Demográfico)
Hay gastos que benefician a todo el país y no se pueden localizar geográficamente (ej. Ministerio de Exteriores, Corona, el Congreso, Deudas genéricas). Para esto SÍ usaremos una aproximación proporcional.

- [ ] **4.1. Extracción de Pesos Demográficos/PIB:**
  - **Uso de Datos Actuales:** Ya tenemos `demographics.json` y `ccaa-fiscal-balance.json`.
  - **Cálculo Backend/Frontend:** Calcular el `%` de población y/o PIB de la región sobre España.
  - **Integración Sankey:** 
    - Multiplicar ese `%` por el balance sobrante (lo no-territorializable) de nodos como `DEFENSA`, `ASUNTOS_EXTERIORES`, e `INTERESES_DEUDA`.
    - Restarlo de dichos nodos y sus enlaces desde `GASTOS_TOTALES`.

## Fase 5: El Balance de Masas (Déficit y Consolidado)
Este es el motor matemático central (`useMemo` en `FlowsSankeyBlock.tsx`).

1. **Sumar todos los Impactos de Ingresos Excluidos:** Se resta lo que esa región aportaba a la caja común (Impuestos no cedidos). -> *Golpea a `INGRESOS_TOTALES`*.
2. **Sumar todos los Impactos de Gastos Excluidos (Fases 1 a 4):** Se resta todo el presupuesto autonómico, más las pensiones que el Estado les pagaba, inversiones, etc. -> *Golpea a `GASTOS_TOTALES`*.
3. **Recalcular Diferencial:** Si `(Nuevos Ingresos) < (Nuevos Gastos)`, el nuevo `DEFICIT` = `Gastos - Ingresos`.
4. **Actualizar Nodo Consolidado:** El nodo `CONSOLIDADO` en el medio del Sankey reajusta su tamaño a la masa económica del resto de España resultante. All links flowing in/out must total exactly the `CONSOLIDADO` value to prevent Nivo Sankey from throwing DAG (Directed Acyclic Graph) error loops.

### Conclusión Arquitectónica
No necesitamos una base de datos. Solo necesitamos que la carpeta `scripts/SOURCES_ETL/` crezca con 5-6 scripts nuevos que mastiquen la complejidad histórica de Excels y APIs gubernamentales y expupan **matrices JSON limpias de "CCAA -> COFOG -> EUROS"** en la carpeta `src/data/`. El frontend React solo cruzará estas matrices restando a los nodos originales.
