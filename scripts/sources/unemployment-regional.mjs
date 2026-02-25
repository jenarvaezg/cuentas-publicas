import { fetchWithRetry } from "../lib/fetch-utils.mjs";
import { parseJsonStat } from "./eurostat.mjs";

const EUROSTAT_BASE =
  "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data";

/** NUTS2 codes for Spain's 17 Autonomous Communities + Ceuta/Melilla */
const NUTS2_REGIONS = [
  "ES11",
  "ES12",
  "ES13",
  "ES21",
  "ES22",
  "ES23",
  "ES24",
  "ES30",
  "ES41",
  "ES42",
  "ES43",
  "ES51",
  "ES52",
  "ES53",
  "ES61",
  "ES62",
  "ES63",
  "ES64",
  "ES70",
];

/** Map Eurostat NUTS2 codes to internal CCAA codes */
const NUTS2_TO_CCAA = {
  ES11: { code: "CA12", name: "Galicia" },
  ES12: { code: "CA03", name: "Asturias" },
  ES13: { code: "CA06", name: "Cantabria" },
  ES21: { code: "CA16", name: "País Vasco" },
  ES22: { code: "CA15", name: "Navarra" },
  ES23: { code: "CA17", name: "La Rioja" },
  ES24: { code: "CA02", name: "Aragón" },
  ES30: { code: "CA13", name: "Madrid" },
  ES41: { code: "CA07", name: "Castilla y León" },
  ES42: { code: "CA08", name: "Castilla-La Mancha" },
  ES43: { code: "CA11", name: "Extremadura" },
  ES51: { code: "CA09", name: "Cataluña" },
  ES52: { code: "CA10", name: "C. Valenciana" },
  ES53: { code: "CA04", name: "Illes Balears" },
  ES61: { code: "CA01", name: "Andalucía" },
  ES62: { code: "CA14", name: "Murcia" },
  ES63: { code: "CA18", name: "Ceuta" },
  ES64: { code: "CA19", name: "Melilla" },
  ES70: { code: "CA05", name: "Canarias" },
};

/**
 * Fetch unemployed persons by NUTS2 from Eurostat (lfst_r_lfu3pers)
 * Returns thousands of persons per region for the latest available year
 */
async function fetchRegionalUnemployed(fetcher) {
  const url = new URL(`${EUROSTAT_BASE}/lfst_r_lfu3pers`);
  for (const geo of NUTS2_REGIONS) url.searchParams.append("geo", geo);
  url.searchParams.append("sex", "T");
  url.searchParams.append("age", "Y_GE15");
  url.searchParams.append("unit", "THS_PER");
  const currentYear = new Date().getFullYear();
  url.searchParams.append("sinceTimePeriod", String(currentYear - 5));
  url.searchParams.append("untilTimePeriod", String(currentYear));

  console.log("  Descargando parados por NUTS2 (lfst_r_lfu3pers)...");
  const response = await fetcher(
    url.toString(),
    {},
    { maxRetries: 2, timeoutMs: 30000 },
  );
  const data = await response.json();
  return parseJsonStat(data, NUTS2_REGIONS);
}

/**
 * Fetch national unemployment expenditure from Eurostat (gov_10a_exp)
 * COFOG function GF1005 = unemployment, for Spain (ES), in MIO_EUR
 */
async function fetchNationalUnemploymentExpenditure(fetcher) {
  const url = new URL(`${EUROSTAT_BASE}/gov_10a_exp`);
  url.searchParams.append("geo", "ES");
  url.searchParams.append("cofog99", "GF1005");
  url.searchParams.append("na_item", "TE");
  url.searchParams.append("sector", "S13");
  url.searchParams.append("unit", "MIO_EUR");
  const currentYear = new Date().getFullYear();
  url.searchParams.append("sinceTimePeriod", String(currentYear - 5));
  url.searchParams.append("untilTimePeriod", String(currentYear));

  console.log(
    "  Descargando gasto COFOG desempleo nacional (gov_10a_exp GF1005)...",
  );
  const response = await fetcher(
    url.toString(),
    {},
    { maxRetries: 2, timeoutMs: 30000 },
  );
  const data = await response.json();
  return parseJsonStat(data, ["ES"]);
}

/**
 * Build per-CCAA unemployment expenditure by distributing the national total
 * proportionally to the number of unemployed in each region.
 */
function buildRegionalEntries(unemployedByNuts2, nationalTotal) {
  const totalUnemployed = Object.values(unemployedByNuts2).reduce(
    (s, v) => s + v,
    0,
  );
  if (totalUnemployed <= 0) return [];

  const entries = [];
  for (const nuts2 of NUTS2_REGIONS) {
    const mapping = NUTS2_TO_CCAA[nuts2];
    if (!mapping) continue;
    const regionUnemployed = unemployedByNuts2[nuts2] || 0;
    const proportion = regionUnemployed / totalUnemployed;
    // Amount stored in euros (nationalTotal is in MIO_EUR)
    entries.push({
      code: mapping.code,
      name: mapping.name,
      amount: Math.round(nationalTotal * proportion * 1_000_000),
    });
  }
  return entries.sort((a, b) => a.code.localeCompare(b.code));
}

/**
 * Download regional unemployment expenditure data.
 * - Unemployed persons count from Eurostat lfst_r_lfu3pers (NUTS2)
 * - National total from Eurostat gov_10a_exp (COFOG GF1005)
 * - Regional amounts = national × (regional_unemployed / total_unemployed)
 */
export async function downloadUnemploymentRegionalData(
  fetcher = fetchWithRetry,
) {
  console.log(
    "\n=== Descargando desempleo regional (Eurostat NUTS2 + COFOG) ===",
  );

  try {
    const [unemployedResult, expenditureResult] = await Promise.allSettled([
      fetchRegionalUnemployed(fetcher),
      fetchNationalUnemploymentExpenditure(fetcher),
    ]);

    const unemployedData =
      unemployedResult.status === "fulfilled" ? unemployedResult.value : null;
    const expenditureData =
      expenditureResult.status === "fulfilled"
        ? expenditureResult.value
        : null;

    if (!unemployedData || !expenditureData) {
      const failedParts = [];
      if (!unemployedData) failedParts.push("parados regionales");
      if (!expenditureData) failedParts.push("gasto nacional");
      console.warn(`  Sin datos de API (${failedParts.join(", ")}), usando fallback`);
      return buildFallbackData();
    }

    const nationalTotal = expenditureData.values.ES || 0;
    if (nationalTotal <= 0) {
      console.warn("  Gasto nacional = 0, usando fallback");
      return buildFallbackData();
    }

    const latestYear = Math.min(unemployedData.year, expenditureData.year);
    const entries = buildRegionalEntries(
      unemployedData.values,
      nationalTotal,
    );
    const total = entries.reduce((s, e) => s + e.amount, 0);

    const data = {
      lastUpdated: new Date().toISOString(),
      latestYear,
      byYear: {
        [String(latestYear)]: { total, entries },
      },
      sourceAttribution: {
        unemployment: {
          source:
            "Eurostat (lfst_r_lfu3pers + gov_10a_exp GF1005)",
          type: "api",
          url: "https://ec.europa.eu/eurostat/databrowser/product/view/lfst_r_lfu3pers",
          date: `${latestYear}-12-31`,
          note: `Gasto en desempleo distribuido por parados NUTS2 (${entries.length} CCAA, ${latestYear}). Nacional: ${Math.round(nationalTotal).toLocaleString("es-ES")} M€`,
        },
      },
    };

    const regionCount = entries.filter((e) => e.amount > 0).length;
    console.log(
      `  ✅ Parados: ${Object.keys(unemployedData.values).length} NUTS2 (año ${unemployedData.year})`,
    );
    console.log(
      `  ✅ Gasto nacional desempleo: ${Math.round(nationalTotal).toLocaleString("es-ES")} M€ (año ${expenditureData.year})`,
    );
    console.log(
      `  ✅ Distribución: ${regionCount} CCAA, total ${Math.round(total / 1e6).toLocaleString("es-ES")} M€`,
    );
    console.log(
      `✅ Desempleo regional: ${entries.length} CCAA, año ${latestYear}`,
    );

    return data;
  } catch (error) {
    console.error(
      "❌ Error descargando desempleo regional:",
      error.message,
    );
    return buildFallbackData();
  }
}

// ─── Fallback (SEPE 2022 published values) ──────────────────────

const FALLBACK_YEAR = 2022;

const FALLBACK_ENTRIES = [
  { code: "CA01", name: "Andalucía", amount: 5122400000 },
  { code: "CA02", name: "Aragón", amount: 489200000 },
  { code: "CA03", name: "Asturias", amount: 401500000 },
  { code: "CA04", name: "Illes Balears", amount: 588100000 },
  { code: "CA05", name: "Canarias", amount: 1104300000 },
  { code: "CA06", name: "Cantabria", amount: 201800000 },
  { code: "CA07", name: "Castilla y León", amount: 845600000 },
  { code: "CA08", name: "Castilla-La Mancha", amount: 890200000 },
  { code: "CA09", name: "Cataluña", amount: 3350100000 },
  { code: "CA10", name: "C. Valenciana", amount: 2430500000 },
  { code: "CA11", name: "Extremadura", amount: 530400000 },
  { code: "CA12", name: "Galicia", amount: 920700000 },
  { code: "CA13", name: "Madrid", amount: 2840200000 },
  { code: "CA14", name: "Murcia", amount: 620100000 },
  { code: "CA15", name: "Navarra", amount: 230500000 },
  { code: "CA16", name: "País Vasco", amount: 680900000 },
  { code: "CA17", name: "La Rioja", amount: 120300000 },
  { code: "CA18", name: "Ceuta", amount: 35100000 },
  { code: "CA19", name: "Melilla", amount: 41200000 },
];

function buildFallbackData() {
  console.warn("⚠️  Usando datos de respaldo para desempleo regional");
  const total = FALLBACK_ENTRIES.reduce((s, e) => s + e.amount, 0);
  return {
    lastUpdated: new Date().toISOString(),
    latestYear: FALLBACK_YEAR,
    byYear: {
      [String(FALLBACK_YEAR)]: { total, entries: FALLBACK_ENTRIES },
    },
    sourceAttribution: {
      unemployment: {
        source: "SEPE / MITES (referencia)",
        type: "fallback",
        url: "https://www.sepe.es/",
        date: `${FALLBACK_YEAR}-12-31`,
        note: `Valores de referencia ${FALLBACK_YEAR}`,
      },
    },
  };
}
