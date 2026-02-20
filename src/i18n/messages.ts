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
      title: "Dashboard Fiscal de España",
      subtitle: "Deuda, pensiones y gasto público explicados con datos oficiales.",
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
      metodologia: "Metodología",
    },
    app: {
      pageTitle: "Cuentas Públicas de España en Tiempo Real",
      pageDescription:
        "Deuda pública, pensiones y gasto público de España. Datos oficiales actualizados en tiempo real.",
      debtSummaryLabel: "Deuda Pública Total",
      debtSummaryNotePrefix: "Extrapolación sobre",
      debtSummaryNoteSuffix: "último dato:",
      deficitSummaryLabel: "Déficit Contributivo Acumulado",
      deficitSummarySince: "Desde 2011:",
      perYear: "/año",
      thisYear: "en",
      annualDeficit: "déficit anual",
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
    blocks: {
      debt: { title: "Deuda Pública (PDE)" },
      debtCost: { title: "Coste de la Deuda" },
      equivalences: {
        title: "Equivalencias",
        subtitle: "Para entender las cifras: la deuda publica traducida a magnitudes cotidianas",
      },
      pensions: { title: "Pensiones y Seguridad Social" },
      revenue: { title: "Ingresos vs Gastos Públicos" },
      budget: { title: "Gasto Público por Funciones (COFOG)" },
      eu: { title: "España en la Unión Europea" },
      ccaa: { title: "Deuda por Comunidad Autónoma" },
      taxRevenue: { title: "Recaudación Tributaria" },
      methodology: {
        title: "Metodología y fuentes",
      },
      roadmap: {
        title: "Roadmap y wishlist",
      },
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
      title: "Spain Fiscal Dashboard",
      subtitle: "Debt, pensions and public spending explained with official data.",
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
      metodologia: "Methodology",
    },
    app: {
      pageTitle: "Spain Public Accounts in Real Time",
      pageDescription:
        "Public debt, pensions and spending indicators for Spain with official up-to-date data.",
      debtSummaryLabel: "Total Public Debt",
      debtSummaryNotePrefix: "Extrapolation based on",
      debtSummaryNoteSuffix: "latest data:",
      deficitSummaryLabel: "Accumulated Contributory Deficit",
      deficitSummarySince: "Since 2011:",
      perYear: "/year",
      thisYear: "in",
      annualDeficit: "annual deficit",
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
    blocks: {
      debt: { title: "Public Debt (EDP)" },
      debtCost: { title: "Debt Cost" },
      equivalences: {
        title: "Equivalences",
        subtitle: "Debt translated into everyday magnitudes to make figures easier to grasp",
      },
      pensions: { title: "Pensions and Social Security" },
      revenue: { title: "Public Revenue vs Expenditure" },
      budget: { title: "Public Spending by Function (COFOG)" },
      eu: { title: "Spain in the European Union" },
      ccaa: { title: "Debt by Autonomous Community" },
      taxRevenue: { title: "Tax Revenue" },
      methodology: {
        title: "Methodology and sources",
      },
      roadmap: {
        title: "Roadmap and wishlist",
      },
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
