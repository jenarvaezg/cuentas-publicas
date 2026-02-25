export const appChapterMessages = {
  es: {
    chapters: {
      c1: {
        title: "El Gran Balance",
        subtitle: "Deuda en tiempo real y el mapa fiscal interactivo.",
        navLabel: "Resumen",
      },
      c2: {
        title: "La Máquina de Recaudar",
        subtitle: "Ingresos públicos y desglose de la recaudación tributaria.",
        navLabel: "Ingresos",
      },
      c3: {
        title: "El Invierno Demográfico",
        subtitle: "Envejecimiento poblacional y la factura del estado de bienestar.",
        navLabel: "Estado Social",
      },
      c4: {
        title: "La Hipoteca Nacional",
        subtitle: "La deuda pública, el coste de los intereses y sus equivalencias.",
        navLabel: "La Deuda",
      },
      c5: {
        title: "El Juego Territorial",
        subtitle: "Brecha autonómica, comparativa europea y metodología.",
        navLabel: "Territorio",
      },
    },
    narrativeBridges: {
      fiscalMapTitle: "Mapa Fiscal",
      eurostatVsAeatTitle: "La brecha entre Eurostat y Hacienda",
      eurostatVsAeatText:
        "Para entender los ingresos del Estado hay que mirar dos cajas: la fotografía completa de Eurostat (Administraciones Públicas), que incluye cotizaciones a la Seguridad Social; y el detalle estricto de la Agencia Tributaria (Hacienda), enfocado exclusivamente en los impuestos (IRPF, IVA...).",
      demographicClockTitle: "El reloj demográfico",
      demographicClockText:
        "El sistema de bienestar español descansa sobre una frágil balanza poblacional. A medida que la pirámide demográfica se invierte y la natalidad cae, la presión sobre el sistema de pensiones y la Seguridad Social aumenta inexorablemente.",
      costOfDebtTitle: "El coste del endeudamiento",
      costOfDebtText:
        "Déficit tras déficit, año tras año, se genera un pasivo colosal. Esta deuda no sale gratis: genera unos intereses anuales que rivalizan con los mayores ministerios del país, drenando recursos de los servicios públicos.",
    },
  },
  en: {
    chapters: {
      c1: {
        title: "The Big Picture",
        subtitle: "National real-time debt and interactive fiscal map.",
        navLabel: "Overview",
      },
      c2: {
        title: "Revenue Engine",
        subtitle: "Public income and tax collection breakdown.",
        navLabel: "Revenue",
      },
      c3: {
        title: "Demographics & Welfare",
        subtitle: "Population aging and the cost of the welfare state.",
        navLabel: "Welfare",
      },
      c4: {
        title: "The National Mortgage",
        subtitle: "Public debt, interest costs, and what they equivalate to.",
        navLabel: "Debt",
      },
      c5: {
        title: "The Territorial Game",
        subtitle: "Regional debt, EU context, and methodology.",
        navLabel: "Territory",
      },
    },
    narrativeBridges: {
      fiscalMapTitle: "Fiscal Map",
      eurostatVsAeatTitle: "The Eurostat vs Tax Agency gap",
      eurostatVsAeatText:
        "To understand state revenue, we look at two sources: Eurostat's complete picture (General Government), which includes social contributions, and the Spanish Tax Agency's (AEAT) specific breakdown of direct and indirect taxes.",
      demographicClockTitle: "The Demographic Clock",
      demographicClockText:
        "Spain's welfare system rests on a delicate population balance. As the demographic pyramid inverts and birth rates fall, the pressure on the pension system and Social Security inexorably rises.",
      costOfDebtTitle: "The Cost of Indebtedness",
      costOfDebtText:
        "Years of accumulated deficits generate a massive liability. This debt is not free: it generates annual interest payments that rival the country's largest departmental budgets, diverting funds from public services.",
    },
  },
} as const;
