import { appChapterMessages } from "./messages/app-chapters";
import { blockMessages } from "./messages/blocks";

export type AppLanguage = "es" | "en";

export const messages = {
  es: {
    language: {
      label: "Idioma",
      es: "Español",
      en: "Inglés",
    },
    header: {
      eyebrow: "Cuentas públicas en tiempo real",
      title: "Cuentas Públicas de España",
      subtitle: "Deuda, pensiones, ingresos y gasto público explicados con datos oficiales.",
      sourcesPrefix: "Fuentes: BdE, INE, Seguridad Social, IGAE y Eurostat · Última actualización:",
    },
    sections: {
      resumen: "Resumen",
      deuda: "Deuda",
      costeDeuda: "Coste deuda",
      pensiones: "Pensiones",
      ingresosGastos: "Ingresos y gastos",
      gastoCofog: "Gasto COFOG",
      recaudacion: "Recaudación",
      ue: "Comparativa UE",
      ccaa: "CCAA",
      demografia: "Demografía",
      sostenibilidadSS: "Sostenibilidad SS",
      mapaFiscal: "Mapa Fiscal",
      economiaSocial: "Economía Social",
      metodologia: "Metodología",
    },
    app: {
      pageTitle: "Cuentas Públicas de España | Dashboard Fiscal en Tiempo Real",
      pageDescription:
        "Deuda pública, pensiones, ingresos y gasto público de España. Datos oficiales actualizados.",
      debtSummaryLabel: "Deuda Pública Total",
      debtSummaryNotePrefix: "Extrapolación sobre",
      debtSummaryNoteSuffix: "último dato:",
      deficitSummaryLabel: "Déficit Contributivo Acumulado",
      deficitSummarySince: "Desde 2009:",
      deficitSummaryTooltip:
        "Suma de los déficits contributivos anuales del subsector S1314 (cotizaciones − prestaciones) desde 2009, calculada a partir de las series Eurostat gov_10a_main.",
      perYear: "/año",
      thisYear: "en",
      annualDeficit: "déficit anual",
      counterDisclaimer: "Representación visual orientativa, no dato oficial en tiempo real",
    },
    common: {
      year: "Año",
      compare: "Comparar",
      view: "Vista:",
      indicator: "Indicador",
      metric: "Métrica",
      community: "Comunidad",
      all: "Todas",
      exportPng: "Exportar PNG",
      exporting: "Exportando...",
      exportError: "No se pudo exportar",
      notAvailable: "N/D",
      sourceLabel: "Fuente",
      moreInformation: "Más información",
      sectionNavigationAria: "Navegación por secciones",
      staleDataTagPrefix: "dato",
      realtimeOffline: "Estás sin conexión. Mostrando datos y recursos cacheados.",
      showLess: "Ver menos",
      fullAnalysis: "Ver análisis completo",
    },
    pwa: {
      updateAvailablePrompt:
        "Hay una nueva versión disponible de Cuentas Públicas. ¿Quieres actualizar ahora?",
      offlineReadyLog: "[PWA] La aplicación está lista para uso offline.",
    },
    errors: {
      boundaryTitle: "Algo salió mal",
      boundaryDescription:
        "Ha ocurrido un error inesperado. Recarga la página para intentarlo de nuevo.",
      boundaryReload: "Recargar página",
    },
    sankey: {
      perCapita: "€/hab.",
      populationLabel: "Población",
      singleCcaaIndicator: "Vista individual",
    },
    blocks: blockMessages.es,
    chapters: appChapterMessages.es.chapters,
    narrativeBridges: appChapterMessages.es.narrativeBridges,
    freshness: {
      dataAsOf: "Datos actualizados:",
      staleWarning: "Algunos datos pueden estar desactualizados",
      allFresh: "Datos al día",
    },
    footer: {
      educational:
        "Datos orientativos con fines educativos. Consulta la sección de metodología para más información sobre fuentes y cálculos.",
      madeBy: "Hecho por",
      sourceCode: "Código fuente",
      rssUpdates: "RSS actualizaciones",
    },
  },
  en: {
    language: {
      label: "Language",
      es: "Spanish",
      en: "English",
    },
    header: {
      eyebrow: "Public accounts in real time",
      title: "Spain Public Accounts",
      subtitle: "Debt, pensions, revenue and public spending explained with official data.",
      sourcesPrefix: "Sources: BdE, INE, Social Security, IGAE and Eurostat · Last update:",
    },
    sections: {
      resumen: "Overview",
      deuda: "Debt",
      costeDeuda: "Debt cost",
      pensiones: "Pensions",
      ingresosGastos: "Revenue & spending",
      gastoCofog: "COFOG spending",
      recaudacion: "Tax revenue",
      ue: "EU comparison",
      ccaa: "Regions",
      demografia: "Demographics",
      sostenibilidadSS: "SS Sustainability",
      mapaFiscal: "Fiscal Map",
      economiaSocial: "Social Economy",
      metodologia: "Methodology",
    },
    app: {
      pageTitle: "Spain Public Accounts | Real-Time Fiscal Dashboard",
      pageDescription:
        "Spain public debt, pensions, revenue and spending with official up-to-date data.",
      debtSummaryLabel: "Total Public Debt",
      debtSummaryNotePrefix: "Extrapolation based on",
      debtSummaryNoteSuffix: "latest data:",
      deficitSummaryLabel: "Accumulated Contributory Deficit",
      deficitSummarySince: "Since 2009:",
      deficitSummaryTooltip:
        "Sum of annual contributory deficits for subsector S1314 (contributions − benefits) since 2009, computed from Eurostat gov_10a_main series.",
      perYear: "/year",
      thisYear: "in",
      annualDeficit: "annual deficit",
      counterDisclaimer: "Indicative visual representation, not official real-time data",
    },
    common: {
      year: "Year",
      compare: "Compare",
      view: "View:",
      indicator: "Indicator",
      metric: "Metric",
      community: "Region",
      all: "All",
      exportPng: "Export PNG",
      exporting: "Exporting...",
      exportError: "Export failed",
      notAvailable: "N/A",
      sourceLabel: "Source",
      moreInformation: "More information",
      showLess: "Show less",
      fullAnalysis: "Full analysis",
      sectionNavigationAria: "Section navigation",
      staleDataTagPrefix: "data",
      realtimeOffline: "You are offline. Showing cached data and resources.",
    },
    pwa: {
      updateAvailablePrompt:
        "A new version of Public Accounts is available. Do you want to update now?",
      offlineReadyLog: "[PWA] App is ready for offline use.",
    },
    errors: {
      boundaryTitle: "Something went wrong",
      boundaryDescription: "An unexpected error occurred. Reload the page to try again.",
      boundaryReload: "Reload page",
    },
    sankey: {
      perCapita: "€/cap.",
      populationLabel: "Population",
      singleCcaaIndicator: "Single region view",
    },
    blocks: blockMessages.en,
    chapters: appChapterMessages.en.chapters,
    narrativeBridges: appChapterMessages.en.narrativeBridges,
    freshness: {
      dataAsOf: "Data updated:",
      staleWarning: "Some data may be outdated",
      allFresh: "All data up to date",
    },
    footer: {
      educational:
        "Indicative educational data. Check the methodology section for details on sources and calculations.",
      madeBy: "Made by",
      sourceCode: "Source code",
      rssUpdates: "RSS updates",
    },
  },
} as const;

export type Messages = (typeof messages)[AppLanguage];
