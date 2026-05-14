/** Canonical Spanish names for the 17 modelled CCAA (see CONTEXT.md). */
export const CCAA_NAMES: Record<string, string> = {
  CA01: "Andalucía",
  CA02: "Aragón",
  CA03: "Principado de Asturias",
  CA04: "Illes Balears",
  CA05: "Canarias",
  CA06: "Cantabria",
  CA07: "Castilla y León",
  CA08: "Castilla-La Mancha",
  CA09: "Cataluña",
  CA10: "Comunitat Valenciana",
  CA11: "Extremadura",
  CA12: "Galicia",
  CA13: "Comunidad de Madrid",
  CA14: "Región de Murcia",
  CA15: "Comunidad Foral de Navarra",
  CA16: "País Vasco",
  CA17: "La Rioja",
};

/**
 * CCAA population (INE Cifras de Población, 1 enero 2024).
 * Used for per-capita formatting in single-CCAA Sankey views.
 * Source: https://www.ine.es/jaxiT3/Tabla.htm?t=2853
 */
export const CCAA_POPULATION: Record<string, number> = {
  CA01: 8_632_080,
  CA02: 1_340_560,
  CA03: 1_004_450,
  CA04: 1_209_990,
  CA05: 2_244_400,
  CA06: 589_430,
  CA07: 2_365_070,
  CA08: 2_107_880,
  CA09: 8_021_880,
  CA10: 5_216_580,
  CA11: 1_055_920,
  CA12: 2_690_460,
  CA13: 7_028_660,
  CA14: 1_564_670,
  CA15: 672_760,
  CA16: 2_232_920,
  CA17: 322_070,
};
