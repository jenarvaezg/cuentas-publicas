import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useI18n } from "@/i18n/I18nProvider";
import { getSearchParam, SECTION_CHANGE_EVENT } from "@/utils/url-state";

interface MethodSection {
  title: string;
  source?: {
    label: string;
    url: string;
    note?: string;
  };
  paragraphs: string[];
  bullets?: string[];
  ordered?: string[];
}

interface MethodologyCopy {
  intro: string;
  sections: MethodSection[];
  refreshTitle: string;
  refreshBullets: string[];
  limitsTitle: string;
  limitsText: string;
}

const copyByLang: Record<"es" | "en", MethodologyCopy> = {
  es: {
    intro:
      "Proyecto educativo que muestra deuda pública, pensiones, gasto público e ingresos del sector público en España usando fuentes oficiales. El pipeline aplica validaciones y mantiene fallback explícito cuando una fuente falla.",
    sections: [
      {
        title: "Deuda Pública",
        source: {
          label: "Banco de España (be11b.csv)",
          url: "https://www.bde.es/webbe/es/estadisticas/compartido/datos/csv/be11b.csv",
          note: "Avance mensual de deuda PDE",
        },
        paragraphs: [
          "Se descarga CSV oficial del BdE y se parsea formato español (coma decimal, punto de miles, separador punto y coma).",
          "El contador en tiempo real usa regresión lineal sobre los últimos 24 meses y extrapola desde el último punto oficial.",
          "La deuda PDE (Procedimiento de Déficit Excesivo) es una cifra consolidada: el Banco de España netea los préstamos que el Estado concede directamente a las CCAA y a la Seguridad Social, como el FLA (Fondo de Liquidez Autonómica) o el FFPP (Fondo de Financiación a Comunidades Autónomas). Por ello la suma de los cuatro subsectores (Estado, CCAA, CCLL, Seguridad Social) supera al total oficial: la diferencia representa exactamente esos préstamos intergubernamentales que se eliminan al consolidar.",
        ],
        bullets: [
          "Deuda total PDE",
          "Desglose por subsector (Estado, CCAA, CCLL, Seguridad Social)",
          "Deuda per cápita, deuda por contribuyente y ratio deuda/PIB",
          "Variación interanual frente al mismo mes del año previo",
        ],
      },
      {
        title: "Pensiones",
        source: {
          label: "Seguridad Social (EST24/REG*.xlsx)",
          url: "https://www.seg-social.es/wps/portal/wss/internet/EstadisticasPresupuestosEstudios/Estadisticas",
          note: "No hay API pública estable",
        },
        paragraphs: [
          "El pipeline localiza la URL mensual del Excel de pensiones contributivas y procesa la hoja con el total del sistema.",
          "Si falla la descarga de Excel vivo, se activa fallback con el último dataset válido y queda trazado en metadatos/alertas.",
          "Las cotizaciones sociales, el Fondo de Reserva y el número de afiliados se enriquecen automáticamente desde el pipeline de Sostenibilidad SS (Eurostat gov_10a_main D61REC, serie histórica del Ministerio de Inclusión y ratio cotizantes/pensionista respectivamente), sustituyendo las estimaciones anteriores.",
        ],
        ordered: [
          "Descarga de HTML de estadísticas.",
          "Extracción de enlace REG*.xlsx (UUID rotatorio).",
          "Descarga y parseo del Excel.",
          "Cálculo de métricas derivadas (gasto anual, déficit contributivo, cotizantes/pensionista).",
        ],
        bullets: [
          "Nómina mensual total y pensiones en vigor",
          "Pensión media de jubilación",
          "Gasto pensiones / PIB",
          "Fondo de reserva (estimación documentada)",
        ],
      },
      {
        title: "Gasto Público (COFOG)",
        source: {
          label: "IGAE COFOG",
          url: "https://www.igae.pap.hacienda.gob.es/sitios/igae/es-ES/Contabilidad/ContabilidadNacional/Publicaciones/Documents/AAPP_A/COFOG_A_AAPP.xlsx",
          note: "Total AAPP (S.13)",
        },
        paragraphs: [
          "Se descarga el Excel anual COFOG y se validan cabeceras/estructura antes de procesar.",
          "La vista de comparación permite importe absoluto, % peso y % cambio; opcionalmente en euros reales (deflactados por IPC INE).",
        ],
        bullets: [
          "Cobertura anual desde 1995",
          "10 divisiones COFOG con subcategorías",
          "Validación cruzada de suma de categorías vs total",
        ],
      },
      {
        title: "Recaudación Tributaria",
        source: {
          label: "AEAT (Series mensuales + Delegaciones)",
          url: "https://sede.agenciatributaria.gob.es/Sede/datosAbiertos/catalogo/hacienda/Informe_mensual_de_Recaudacion_Tributaria.shtml",
          note: "Datos abiertos AEAT",
        },
        paragraphs: [
          "Se descargan dos ficheros Excel de la AEAT: series mensuales nacionales (1995-presente) e ingresos por delegaciones/CCAA (2007-presente).",
          "Los datos mensuales se agregan a nivel anual. Se muestran ingresos netos (tras devoluciones) en millones de euros.",
          "Además, se integra la liquidación anual del sistema de financiación autonómica publicada por Hacienda (régimen común) para comparar impuestos cedidos frente a transferencias recibidas por comunidad.",
        ],
        bullets: [
          "Desglose por impuesto: IRPF, IVA, Sociedades, IRNR, Impuestos Especiales y resto",
          "Sub-desglose de Impuestos Especiales (hidrocarburos, tabaco, alcohol, etc.)",
          "Recaudación por Comunidad Autónoma (delegaciones AEAT)",
          "Balanzas fiscales CCAA (Hacienda): impuestos cedidos (IRPF+IVA+IIEE) y transferencias (Fondos de Garantía, Suficiencia, Competitividad y Cooperación)",
          "Régimen foral: Navarra y País Vasco recaudan sus propios tributos; las cifras AEAT reflejan solo la cuota estatal",
        ],
      },
      {
        title: "Demografía y PIB",
        source: {
          label: "INE (API Tempus)",
          url: "https://www.ine.es",
          note: "Series oficiales",
        },
        paragraphs: [
          "Se consumen series de población total, población activa, PIB nominal, salario medio e IPC.",
          "El IPC se usa para convertir comparativas de gasto a euros constantes con año base del último COFOG disponible.",
        ],
        bullets: [
          "Población total (ECP320)",
          "Población activa (EPA387794)",
          "PIB nominal (CNTR6597)",
          "Salario medio (EAES741)",
          "IPC (IPC278296 + IPC290750)",
        ],
      },
      {
        title: "Demografía detallada",
        source: {
          label: "INE (Indicadores Demográficos + Cifras de Población)",
          url: "https://www.ine.es/jaxiT3/Tabla.htm?t=1381",
          note: "Series IDB + tabla 56943",
        },
        paragraphs: [
          "Se consumen series de indicadores demográficos básicos (natalidad, mortalidad, fecundidad, crecimiento vegetativo) y tablas de mortalidad (esperanza de vida).",
          "La pirámide de población combina datos de la tabla 56943 del INE, que desglosa la población por edad quinquenal, sexo y lugar de nacimiento (España, UE, resto de Europa, África, América, Asia+Oceanía).",
        ],
        bullets: [
          "Tasa bruta de natalidad (IDB37106)",
          "Tasa bruta de mortalidad (IDB47797)",
          "Indicador coyuntural de fecundidad (IDB86387)",
          "Crecimiento vegetativo (IDB55340)",
          "Esperanza de vida al nacer por sexo (IDB53772-74)",
          "Pirámide de población por origen (tabla 56943)",
          "Ratios de dependencia (derivados de pirámide)",
          "Porcentaje de nacidos en el extranjero (derivado de pirámide)",
        ],
      },
      {
        title: "Ingresos y Gastos Públicos",
        source: {
          label: "Eurostat (gov_10a_main)",
          url: "https://ec.europa.eu/eurostat/databrowser/view/gov_10a_main/",
          note: "SEC 2010, S.13",
        },
        paragraphs: [
          "Se consultan series anuales de ingresos, gastos y balance para España (TR, TE, B9) junto con composición de ingresos (D2REC, D5REC, D61REC).",
          "Con estas series se calcula presión fiscal y se visualiza la evolución histórica de 30 años.",
        ],
      },
      {
        title: "Comparativa Europea",
        source: {
          label: "Eurostat",
          url: "https://ec.europa.eu/eurostat/databrowser/",
          note: "Último año comparable",
        },
        paragraphs: [
          "Se comparan indicadores fiscales y macro entre España, países de referencia y media UE-27.",
        ],
        bullets: [
          "Deuda/PIB",
          "Déficit/superávit",
          "Gasto público/PIB",
          "Gasto social/PIB",
          "Tasa de paro",
        ],
      },
      {
        title: "Deuda por CCAA",
        source: {
          label: "Banco de España (be1310/be1309)",
          url: "https://www.bde.es/webbe/es/estadisticas/compartido/datos/csv/be1310.csv",
          note: "Serie trimestral",
        },
        paragraphs: [
          "Se combinan dos CSV oficiales para mostrar ranking por %PIB y deuda absoluta en euros.",
          "Para el detalle por comunidad también se muestra un proxy de déficit/gasto: variación interanual de deuda PDE (BdE) + ingresos tributarios AEAT de la comunidad.",
          "Este proxy sirve solo como señal orientativa y no equivale al saldo de contabilidad nacional regional.",
          "El selector por comunidad persiste en URL para compartir estado exacto del bloque.",
        ],
      },
      {
        title: "Economía Social",
        source: {
          label: "INE (Cuenta Satélite de la Economía Social, tablas 78708/78713)",
          url: "https://www.ine.es/jaxiT3/Tabla.htm?t=78708",
          note: "Serie anual 2019-2023",
        },
        paragraphs: [
          "Se consumen series anuales de la Cuenta Satélite de la Economía Social del INE para medir la aportación económica y laboral del sector en España.",
        ],
        bullets: [
          "VAB (serie CSES12739, tabla 78708)",
          "Peso relativo del VAB (serie CSES17056, tabla 78708)",
          "Empleo total y peso en el empleo (series CSES15096 y CSES16664, tabla 78713)",
        ],
      },
      {
        title: "Condiciones de Vida y Desigualdad",
        source: {
          label: "INE (Encuesta de Condiciones de Vida)",
          url: "https://www.ine.es/jaxiT3/Tabla.htm?t=76847",
          note: "Series AROPE, Gini y Renta",
        },
        paragraphs: [
          "Se consumen indicadores de la Encuesta de Condiciones de Vida (ECV) para proporcionar contexto social a las cifras de gasto público.",
        ],
        bullets: [
          "Tasa AROPE: Riesgo de pobreza o exclusión social (ECV6275)",
          "Índice de Gini: Coeficiente de desigualdad de ingresos (ECV4838)",
          "Renta media neta anual por persona (30648)",
        ],
      },
      {
        title: "Contadores en tiempo real",
        paragraphs: [
          "Los contadores son representaciones visuales orientativas, no datos oficiales en tiempo real. Se renderizan con actualización periódica en cliente y números tabulares para estabilidad visual.",
          "Deuda: extrapolación lineal (regresión sobre 24 meses de datos BdE). La pendiente puede diferir significativamente de la variación interanual real, especialmente ante emisiones o amortizaciones puntuales de deuda.",
          "Pensiones: prorrateo de nómina mensual × 14 pagas, convertido a flujo por segundo. Esta simplificación puede diferir ~5% respecto a la cifra Eurostat, que incluye ajustes contables adicionales.",
        ],
      },
      {
        title: "Sostenibilidad de la Seguridad Social",
        source: {
          label: "Eurostat (gov_10a_main) + Ageing Report 2024",
          url: "https://ec.europa.eu/eurostat/databrowser/view/gov_10a_main/",
          note: "Gasto contributivo, cotizaciones sociales y proyecciones",
        },
        paragraphs: [
          "Se consultan tres series Eurostat del subsector S1314: prestaciones contributivas en efectivo (D62PAY) en millones de euros y como % del PIB (España y EU-27), y cotizaciones sociales (D61REC).",
          "El balance del sistema se calcula como cotizaciones menos gasto contributivo. Se complementa con datos de referencia del Fondo de Reserva, ratio cotizantes/pensionista y proyecciones del Ageing Report 2024.",
          "El déficit contributivo acumulado se calcula sumando los balances anuales del subsector S1314 desde 2009 (primer año de déficit continuado, que incluye el impacto de la crisis financiera). El año 2009 se eligió como punto de partida porque marca el inicio de una racha ininterrumpida de déficits estructurales. Los datos proceden exclusivamente de las series Eurostat gov_10a_main; no se usan estimaciones externas.",
        ],
        bullets: [
          "Ingresos por cotizaciones vs gasto contributivo (serie anual)",
          "Gasto contributivo como % del PIB: España vs EU-27",
          "Evolución del Fondo de Reserva de la Seguridad Social (2000-2025)",
          "Ratio cotizantes por pensionista (2006-2025)",
          "Proyecciones de gasto/PIB hasta 2070 (Ageing Report)",
          "Déficit acumulado S1314: suma de balances anuales desde 2009 (Eurostat gov_10a_main)",
        ],
      },
    ],
    refreshTitle: "Frecuencia de actualización",
    refreshBullets: [
      "Workflow automático semanal (lunes 08:00 UTC).",
      "Actualización manual disponible por workflow_dispatch.",
      "Si hay cambios, se actualizan datasets, API pública versionada y artefactos SEO/SSG.",
      "Si hay fallos o datos stale, se crean/actualizan issues automáticas en GitHub.",
    ],
    limitsTitle: "Limitaciones",
    limitsText:
      "Aunque las fuentes son oficiales, hay desfases de publicación y algunas métricas derivadas requieren hipótesis explícitas. Para decisiones formales, consultar siempre la publicación primaria más reciente del organismo oficial.",
  },
  en: {
    intro:
      "Educational project showing public debt, pensions, public spending and public revenue in Spain using official data sources. The pipeline adds validations and explicit fallback behavior when a source fails.",
    sections: [
      {
        title: "Public Debt",
        source: {
          label: "Bank of Spain (be11b.csv)",
          url: "https://www.bde.es/webbe/es/estadisticas/compartido/datos/csv/be11b.csv",
          note: "Monthly EDP debt release",
        },
        paragraphs: [
          "The pipeline downloads the official CSV and parses Spanish numeric formatting safely.",
          "Real-time debt is estimated with linear regression over the latest 24 monthly observations, then extrapolated from the last official point.",
          "EDP (Excessive Deficit Procedure) debt is a consolidated figure: the Bank of Spain nets out loans that the central government grants directly to the regions and Social Security, such as the FLA (Regional Liquidity Fund) and FFPP (Regional Financing Fund). This is why the sum of the four subsectors (Central, Regions, Local, Social Security) exceeds the official total — the difference represents exactly those intergovernmental loans that are eliminated during consolidation.",
        ],
        bullets: [
          "Total EDP debt",
          "Subsector breakdown (central, regions, local, Social Security)",
          "Debt per capita, debt per contributor and debt-to-GDP ratio",
          "Year-over-year change versus same month in the previous year",
        ],
      },
      {
        title: "Pensions",
        source: {
          label: "Social Security (EST24/REG*.xlsx)",
          url: "https://www.seg-social.es/wps/portal/wss/internet/EstadisticasPresupuestosEstudios/Estadisticas",
          note: "No stable public API",
        },
        paragraphs: [
          "The pipeline resolves the current monthly Excel URL and parses the total-system row.",
          "If live Excel retrieval fails, a critical fallback uses the last valid dataset and the event is persisted in metadata/alerts.",
          "Social contributions, the Reserve Fund and the affiliates count are automatically enriched from the SS Sustainability pipeline (Eurostat gov_10a_main D61REC, Ministry of Inclusion historical series and contributors-per-pensioner ratio respectively), replacing the previous hardcoded estimates.",
        ],
        ordered: [
          "Download statistics HTML page.",
          "Extract REG*.xlsx link (rotating UUID).",
          "Download and parse workbook.",
          "Compute derived metrics (annualized spending, contributory deficit, contributors per pensioner).",
        ],
        bullets: [
          "Total monthly payroll and active pensions",
          "Average retirement pension",
          "Pension spending / GDP",
          "Reserve fund (documented estimate)",
        ],
      },
      {
        title: "Public Spending (COFOG)",
        source: {
          label: "IGAE COFOG",
          url: "https://www.igae.pap.hacienda.gob.es/sitios/igae/es-ES/Contabilidad/ContabilidadNacional/Publicaciones/Documents/AAPP_A/COFOG_A_AAPP.xlsx",
          note: "General government (S.13)",
        },
        paragraphs: [
          "The annual COFOG workbook is downloaded and validated (headers/schema checks) before processing.",
          "Comparison mode supports absolute values, weight percentages and year-over-year percentage change; optionally in real euros deflated with INE CPI.",
        ],
        bullets: [
          "Annual coverage since 1995",
          "10 COFOG divisions with subcategories",
          "Cross-check validation: categories sum vs total",
        ],
      },
      {
        title: "Tax Revenue",
        source: {
          label: "AEAT (Monthly series + Regional offices)",
          url: "https://sede.agenciatributaria.gob.es/Sede/datosAbiertos/catalogo/hacienda/Informe_mensual_de_Recaudacion_Tributaria.shtml",
          note: "AEAT open data",
        },
        paragraphs: [
          "Two AEAT Excel files are downloaded: national monthly series (1995-present) and revenue by regional tax offices/CCAA (2007-present).",
          "Monthly figures are aggregated annually. Values shown are net revenue (after refunds) in millions of euros.",
          "The dashboard also integrates annual regional-financing settlements from the Ministry of Finance (common regime) to compare ceded taxes against transfers received by each region.",
        ],
        bullets: [
          "Tax type breakdown: PIT, VAT, Corporate, Non-resident, Excise duties and other",
          "Excise duty sub-breakdown (hydrocarbons, tobacco, alcohol, etc.)",
          "Revenue by Autonomous Community (AEAT regional offices)",
          "Regional fiscal balances (Finance Ministry): ceded taxes (PIT+VAT+excise) and transfers (Guarantee, Sufficiency, Competitiveness and Cooperation Funds)",
          "Foral regime: Navarra and País Vasco collect their own taxes; AEAT figures reflect only the central government share",
        ],
      },
      {
        title: "Demographics and GDP",
        source: {
          label: "INE (Tempus API)",
          url: "https://www.ine.es",
          note: "Official time series",
        },
        paragraphs: [
          "The app consumes total population, labor force, nominal GDP, average salary and CPI series.",
          "CPI is used to deflate public spending comparisons to constant euros with base year equal to the latest available COFOG year.",
        ],
        bullets: [
          "Total population (ECP320)",
          "Labor force (EPA387794)",
          "Nominal GDP (CNTR6597)",
          "Average salary (EAES741)",
          "CPI (IPC278296 + IPC290750)",
        ],
      },
      {
        title: "Detailed demographics",
        source: {
          label: "INE (Demographic Indicators + Population Figures)",
          url: "https://www.ine.es/jaxiT3/Tabla.htm?t=1381",
          note: "IDB series + table 56943",
        },
        paragraphs: [
          "Basic demographic indicators (birth rate, death rate, fertility, natural growth) and mortality tables (life expectancy) are consumed from INE time series.",
          "The population pyramid combines data from INE table 56943, which breaks down population by five-year age group, sex and place of birth (Spain, EU, rest of Europe, Africa, Americas, Asia+Oceania).",
        ],
        bullets: [
          "Crude birth rate (IDB37106)",
          "Crude death rate (IDB47797)",
          "Total fertility rate (IDB86387)",
          "Natural population growth (IDB55340)",
          "Life expectancy at birth by sex (IDB53772-74)",
          "Population pyramid by birth origin (table 56943)",
          "Dependency ratios (derived from pyramid)",
          "Foreign-born population share (derived from pyramid)",
        ],
      },
      {
        title: "Public Revenue and Expenditure",
        source: {
          label: "Eurostat (gov_10a_main)",
          url: "https://ec.europa.eu/eurostat/databrowser/view/gov_10a_main/",
          note: "ESA 2010, S.13",
        },
        paragraphs: [
          "Annual revenue, expenditure and balance are pulled for Spain (TR, TE, B9), plus revenue composition (D2REC, D5REC, D61REC).",
          "These series feed tax burden calculations and the long-run revenue vs expenditure chart.",
        ],
      },
      {
        title: "European Comparison",
        source: {
          label: "Eurostat",
          url: "https://ec.europa.eu/eurostat/databrowser/",
          note: "Latest comparable year",
        },
        paragraphs: [
          "The dashboard compares fiscal and macro indicators between Spain, benchmark countries and EU-27 average.",
        ],
        bullets: [
          "Debt-to-GDP",
          "Deficit/surplus",
          "Public spending/GDP",
          "Social spending/GDP",
          "Unemployment rate",
        ],
      },
      {
        title: "Regional Debt (Autonomous Communities)",
        source: {
          label: "Bank of Spain (be1310/be1309)",
          url: "https://www.bde.es/webbe/es/estadisticas/compartido/datos/csv/be1310.csv",
          note: "Quarterly series",
        },
        paragraphs: [
          "Two official CSV sources are combined to rank regions by %GDP and absolute debt in euros.",
          "Region detail also includes a deficit/spending proxy: year-over-year EDP debt change (BdE) + AEAT regional tax revenue.",
          "This proxy is directional only and is not equivalent to official regional national-accounts balance.",
          "Region and metric selection is persisted in URL query state for shareable deep links.",
        ],
      },
      {
        title: "Social Economy",
        source: {
          label: "INE (Social Economy Satellite Account, tables 78708/78713)",
          url: "https://www.ine.es/jaxiT3/Tabla.htm?t=78708",
          note: "Annual series 2019-2023",
        },
        paragraphs: [
          "The dashboard consumes annual time series from INE's Social Economy Satellite Account to track the sector's economic and labour footprint in Spain.",
        ],
        bullets: [
          "GVA (series CSES12739, table 78708)",
          "Relative GVA weight (series CSES17056, table 78708)",
          "Total jobs and employment share (series CSES15096 and CSES16664, table 78713)",
        ],
      },
      {
        title: "Living Conditions and Inequality",
        source: {
          label: "INE (Living Conditions Survey)",
          url: "https://www.ine.es/jaxiT3/Tabla.htm?t=76847",
          note: "AROPE, Gini and Income series",
        },
        paragraphs: [
          "The app pull indicators from the Living Conditions Survey (ECV) to provide social context to public spending figures.",
        ],
        bullets: [
          "AROPE rate: At risk of poverty or social exclusion (ECV6275)",
          "Gini index: Income inequality coefficient (ECV4838)",
          "Average annual net income per person (30648)",
        ],
      },
      {
        title: "Real-time Counters",
        paragraphs: [
          "Counters are indicative visual representations, not official real-time data. They are rendered client-side with periodic updates and tabular numerals for stable display.",
          "Debt: linear extrapolation (regression over 24 months of BdE data). The slope may differ significantly from the actual year-over-year change, especially around one-off debt issuances or redemptions.",
          "Pensions: monthly payroll × 14 payments, converted to per-second flow. This simplification may differ ~5% from the Eurostat figure, which includes additional accounting adjustments.",
        ],
      },
      {
        title: "Social Security Sustainability",
        source: {
          label: "Eurostat (gov_10a_main) + 2024 Ageing Report",
          url: "https://ec.europa.eu/eurostat/databrowser/view/gov_10a_main/",
          note: "Contributory spending, social contributions and projections",
        },
        paragraphs: [
          "Three Eurostat series are queried for subsector S1314: contributory cash benefits (D62PAY) in million euros and as % of GDP (Spain and EU-27), and social contributions (D61REC).",
          "System balance is computed as contributions minus contributory spending. Reference data for the Reserve Fund, contributors-per-pensioner ratio and 2024 Ageing Report projections complement the Eurostat series.",
          "The cumulative contributory deficit is computed by summing the annual S1314 balances since 2009 (the first year of sustained deficit, capturing the impact of the financial crisis). The year 2009 was chosen as the start because it marks the beginning of an uninterrupted run of structural deficits. Data come exclusively from Eurostat gov_10a_main series; no external estimates are used.",
        ],
        bullets: [
          "Contribution income vs contributory spending (annual series)",
          "Contributory spending as % of GDP: Spain vs EU-27",
          "Social Security Reserve Fund evolution (2000-2025)",
          "Contributors per pensioner ratio (2006-2025)",
          "Spending/GDP projections to 2070 (Ageing Report)",
          "Cumulative S1314 deficit: sum of annual balances since 2009 (Eurostat gov_10a_main)",
        ],
      },
    ],
    refreshTitle: "Update frequency",
    refreshBullets: [
      "Automatic weekly workflow (Monday 08:00 UTC).",
      "Manual refresh available through workflow_dispatch.",
      "When data changes, datasets, versioned public API and SEO/SSG artifacts are regenerated.",
      "If sources fail or data becomes stale, GitHub issues are created/updated automatically.",
    ],
    limitsTitle: "Limitations",
    limitsText:
      "Even with official sources, publication lag exists and some derived metrics require explicit assumptions. For formal decisions, always verify against the latest primary release from each official institution.",
  },
};

export function MethodologySection() {
  const [isOpen, setIsOpen] = useState(false);
  const { msg, lang } = useI18n();

  const copy = useMemo(() => copyByLang[lang], [lang]);

  useEffect(() => {
    const syncOpenState = () => {
      const searchSection = getSearchParam("section");
      const hash = window.location.hash.replace("#", "");

      if (searchSection === "metodologia" || hash === "metodologia") {
        setIsOpen(true);
      }
    };

    const handleSectionChange = (event: Event) => {
      const detail = (event as CustomEvent<{ section: string | null }>).detail?.section ?? null;
      if (detail === "metodologia") {
        setIsOpen(true);
      }
    };

    if (typeof window !== "undefined") {
      syncOpenState();
      window.addEventListener("popstate", syncOpenState);
      window.addEventListener("hashchange", syncOpenState);
      window.addEventListener(SECTION_CHANGE_EVENT, handleSectionChange);
      return () => {
        window.removeEventListener("popstate", syncOpenState);
        window.removeEventListener("hashchange", syncOpenState);
        window.removeEventListener(SECTION_CHANGE_EVENT, handleSectionChange);
      };
    }
    return undefined;
  }, []);

  return (
    <Card className="animate-slide-up" style={{ animationDelay: "0.3s" }}>
      <CardHeader>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-controls="methodology-content"
          className="flex items-center justify-between w-full text-left hover:text-primary transition-colors"
        >
          <h2 className="text-lg font-semibold">{msg.blocks.methodology.title}</h2>
          {isOpen ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          )}
        </button>
      </CardHeader>

      {isOpen && (
        <CardContent id="methodology-content" className="space-y-6 text-sm leading-relaxed">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <p className="text-muted-foreground">{copy.intro}</p>

            {copy.sections.map((section) => (
              <div key={section.title}>
                <h3 className="text-base font-semibold mt-6 mb-3 text-foreground">
                  {section.title}
                </h3>

                {section.source && (
                  <p>
                    <strong className="text-foreground">{msg.common.sourceLabel}:</strong>{" "}
                    <a
                      href={section.source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-4 hover:text-primary transition-colors"
                    >
                      {section.source.label}
                    </a>
                    {section.source.note ? ` — ${section.source.note}` : ""}
                  </p>
                )}

                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}

                {section.ordered && (
                  <ol className="list-decimal list-inside pl-4 space-y-1 text-xs text-muted-foreground">
                    {section.ordered.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ol>
                )}

                {section.bullets && (
                  <ul className="list-disc list-inside pl-4 space-y-1 text-xs text-muted-foreground">
                    {section.bullets.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}

            <h3 className="text-base font-semibold mt-6 mb-3 text-foreground">
              {copy.refreshTitle}
            </h3>
            <ul className="list-disc list-inside pl-4 space-y-1 text-xs text-muted-foreground">
              {copy.refreshBullets.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>

            <h3 className="text-base font-semibold mt-6 mb-3 text-foreground">
              {copy.limitsTitle}
            </h3>
            <p className="text-muted-foreground">{copy.limitsText}</p>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
