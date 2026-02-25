import { fetchWithRetry } from "../lib/fetch-utils.mjs";
import { parseJsonStatTimeSeries } from "./eurostat.mjs";

const EUROSTAT_BASE =
  "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data";

// ─── Eurostat indicator configs ──────────────────────────────────────

const EUROSTAT_INDICATORS = {
  pensionExpenditure: {
    dataset: "gov_10a_main",
    params: {
      freq: "A",
      unit: "MIO_EUR",
      sector: "S1314",
      na_item: "D62PAY",
    },
    geos: ["ES"],
    label: "Prestaciones contributivas en efectivo",
    unit: "M€",
  },
  pensionToGDP: {
    dataset: "gov_10a_main",
    params: {
      freq: "A",
      unit: "PC_GDP",
      sector: "S1314",
      na_item: "D62PAY",
    },
    geos: ["ES", "EU27_2020"],
    label: "Prestaciones contributivas / PIB",
    unit: "% PIB",
  },
  socialContributions: {
    dataset: "gov_10a_main",
    params: {
      freq: "A",
      unit: "MIO_EUR",
      sector: "S1314",
      na_item: "D61REC",
    },
    geos: ["ES"],
    label: "Cotizaciones sociales",
    unit: "M€",
  },
};

// ─── Hardcoded reference data ────────────────────────────────────────

/** Reserve Fund balance in M€ (end of year). Source: Ministerio de Inclusión / seg-social.es */
const RESERVE_FUND_HISTORY = [
  { year: 2000, balance: 601 },
  { year: 2001, balance: 3575 },
  { year: 2002, balance: 6180 },
  { year: 2003, balance: 8565 },
  { year: 2004, balance: 14198 },
  { year: 2005, balance: 20216 },
  { year: 2006, balance: 32746 },
  { year: 2007, balance: 45717 },
  { year: 2008, balance: 57223 },
  { year: 2009, balance: 60022 },
  { year: 2010, balance: 64375 },
  { year: 2011, balance: 66815 },
  { year: 2012, balance: 63009 },
  { year: 2013, balance: 53744 },
  { year: 2014, balance: 41634 },
  { year: 2015, balance: 32481 },
  { year: 2016, balance: 25193 },
  { year: 2017, balance: 8095 },
  { year: 2018, balance: 5042 },
  { year: 2019, balance: 2150 },
  { year: 2020, balance: 2098 },
  { year: 2021, balance: 2137 },
  { year: 2022, balance: 2862 },
  { year: 2023, balance: 4365 },
  { year: 2024, balance: 5803 },
  { year: 2025, balance: 7500 },
];

/** Contributors per pensioner (annual average). Source: SS monthly reports */
const CONTRIBUTORS_PER_PENSIONER_HISTORY = [
  { year: 2006, ratio: 2.49 },
  { year: 2007, ratio: 2.53 },
  { year: 2008, ratio: 2.45 },
  { year: 2009, ratio: 2.31 },
  { year: 2010, ratio: 2.27 },
  { year: 2011, ratio: 2.21 },
  { year: 2012, ratio: 2.14 },
  { year: 2013, ratio: 2.08 },
  { year: 2014, ratio: 2.1 },
  { year: 2015, ratio: 2.16 },
  { year: 2016, ratio: 2.22 },
  { year: 2017, ratio: 2.28 },
  { year: 2018, ratio: 2.32 },
  { year: 2019, ratio: 2.34 },
  { year: 2020, ratio: 2.13 },
  { year: 2021, ratio: 2.22 },
  { year: 2022, ratio: 2.3 },
  { year: 2023, ratio: 2.27 },
  { year: 2024, ratio: 2.23 },
  { year: 2025, ratio: 2.2 },
];

/** European Commission 2024 Ageing Report — pension spending projections */
const AGEING_REPORT_PROJECTIONS = {
  source: "European Commission — 2024 Ageing Report",
  url: "https://economy-finance.ec.europa.eu/publications/2024-ageing-report_en",
  spain: [
    { year: 2022, pensionToGDP: 12.3 },
    { year: 2030, pensionToGDP: 12.9 },
    { year: 2040, pensionToGDP: 14.4 },
    { year: 2050, pensionToGDP: 15.7 },
    { year: 2060, pensionToGDP: 14.5 },
    { year: 2070, pensionToGDP: 13.3 },
  ],
  eu27: [
    { year: 2022, pensionToGDP: 11.4 },
    { year: 2030, pensionToGDP: 11.9 },
    { year: 2040, pensionToGDP: 12.4 },
    { year: 2050, pensionToGDP: 12.4 },
    { year: 2060, pensionToGDP: 12.1 },
    { year: 2070, pensionToGDP: 11.6 },
  ],
};

// ─── Fallback reference data ─────────────────────────────────────────

const FALLBACK_DATA = {
  latestYear: 2023,
  byYear: {
    2020: {
      socialContributions: 151773,
      pensionExpenditure: 201375,
      ssBalance: -49602,
      pensionToGDP: 17.8,
    },
    2021: {
      socialContributions: 161306,
      pensionExpenditure: 199557,
      ssBalance: -38251,
      pensionToGDP: 16.2,
    },
    2022: {
      socialContributions: 169656,
      pensionExpenditure: 199290,
      ssBalance: -29634,
      pensionToGDP: 14.5,
    },
    2023: {
      socialContributions: 186417,
      pensionExpenditure: 219180,
      ssBalance: -32763,
      pensionToGDP: 14.6,
    },
  },
  pensionToGDP: {
    spain: {
      byYear: { 2020: 17.8, 2021: 16.2, 2022: 14.5, 2023: 14.6 },
      years: [2020, 2021, 2022, 2023],
    },
    eu27: {
      byYear: { 2020: 13.7, 2021: 12.6, 2022: 11.9, 2023: 11.9 },
      years: [2020, 2021, 2022, 2023],
    },
  },
};

// ─── Parsers ─────────────────────────────────────────────────────────

/**
 * Like parseJsonStatTimeSeries but preserves one decimal place (for % values).
 * @param {object} data - JSON-stat response
 * @param {string} country - Country code
 * @returns {{ byYear: Record<string, number>, years: number[] }}
 */
function parseTimeSeriesDecimal(data, country) {
  const dims = data.id;
  const sizes = data.size;
  const values = data.value;

  if (!dims || !sizes || !values) {
    throw new Error("Respuesta JSON-stat inválida");
  }

  const geoDimIdx = dims.indexOf("geo");
  const timeDimIdx = dims.indexOf("time");

  if (geoDimIdx === -1 || timeDimIdx === -1) {
    throw new Error("Dimensiones geo/time no encontradas");
  }

  const geoCategoryIndex = data.dimension.geo.category.index;
  const timeCategoryIndex = data.dimension.time.category.index;

  const geoIdx = geoCategoryIndex[country];
  if (geoIdx === undefined) {
    throw new Error(`País ${country} no encontrado en la respuesta`);
  }

  const byYear = {};
  const years = [];

  for (const [yearStr, timeIdx] of Object.entries(timeCategoryIndex)) {
    const year = Number(yearStr);
    if (isNaN(year)) continue;

    const dimIndices = new Array(dims.length).fill(0);
    dimIndices[geoDimIdx] = geoIdx;
    dimIndices[timeDimIdx] = timeIdx;

    let flatIndex = 0;
    let multiplier = 1;
    for (let i = dims.length - 1; i >= 0; i--) {
      flatIndex += dimIndices[i] * multiplier;
      multiplier *= sizes[i];
    }

    const val = values[flatIndex] ?? values[String(flatIndex)];
    if (val !== null && val !== undefined) {
      byYear[String(year)] = Math.round(val * 10) / 10;
      years.push(year);
    }
  }

  years.sort((a, b) => a - b);

  if (years.length === 0) {
    throw new Error("Sin datos válidos en la respuesta");
  }

  return { byYear, years };
}

// ─── Fetchers ────────────────────────────────────────────────────────

/**
 * Fetch a single indicator time series from Eurostat
 * @param {string} key - Indicator key
 * @param {object} config - Indicator config
 * @returns {Promise<{raw: object}>}
 */
async function fetchIndicator(key, config, fetcher) {
  const { dataset, params, geos } = config;

  const url = new URL(`${EUROSTAT_BASE}/${dataset}`);
  for (const [paramKey, paramValue] of Object.entries(params)) {
    url.searchParams.append(paramKey, paramValue);
  }
  for (const geo of geos) {
    url.searchParams.append("geo", geo);
  }
  url.searchParams.append("sinceTimePeriod", "1995");

  console.log(`  Descargando ${key} (${dataset})...`);

  const response = await fetcher(
    url.toString(),
    {},
    { maxRetries: 1, timeoutMs: 20000 },
  );
  return response.json();
}

// ─── Main download function ──────────────────────────────────────────

/**
 * Download Social Security sustainability data
 * @returns {Promise<Object>} SS sustainability data object
 */
export async function downloadSSSustainability(fetcher = fetchWithRetry) {
  console.log(
    "\n=== Descargando datos de Sostenibilidad SS (Eurostat + referencia) ===",
  );

  try {
    const indicatorEntries = Object.entries(EUROSTAT_INDICATORS);

    const results = await Promise.allSettled(
      indicatorEntries.map(([key, config]) => fetchIndicator(key, config, fetcher)),
    );

    const [pensionExpResult, pensionGDPResult, socialContribResult] = results;

    // Parse pension expenditure (M€, Spain only)
    let pensionExp = null;
    if (pensionExpResult.status === "fulfilled" && pensionExpResult.value) {
      try {
        pensionExp = parseJsonStatTimeSeries(pensionExpResult.value, "ES");
        console.log(`  ✅ pensionExpenditure: ${pensionExp.years.length} años`);
      } catch (e) {
        console.warn(`  ⚠️ pensionExpenditure parse error: ${e.message}`);
      }
    } else {
      console.warn(
        `  ⚠️ pensionExpenditure: ${pensionExpResult.reason?.message || "sin datos"}`,
      );
    }

    // Parse pension/GDP (% GDP, Spain + EU27)
    let pensionGDP_ES = null;
    let pensionGDP_EU = null;
    if (pensionGDPResult.status === "fulfilled" && pensionGDPResult.value) {
      try {
        pensionGDP_ES = parseTimeSeriesDecimal(pensionGDPResult.value, "ES");
        console.log(`  ✅ pensionToGDP (ES): ${pensionGDP_ES.years.length} años`);
      } catch (e) {
        console.warn(`  ⚠️ pensionToGDP (ES) parse error: ${e.message}`);
      }
      try {
        pensionGDP_EU = parseTimeSeriesDecimal(
          pensionGDPResult.value,
          "EU27_2020",
        );
        console.log(
          `  ✅ pensionToGDP (EU27): ${pensionGDP_EU.years.length} años`,
        );
      } catch (e) {
        console.warn(`  ⚠️ pensionToGDP (EU27) parse error: ${e.message}`);
      }
    } else {
      console.warn(
        `  ⚠️ pensionToGDP: ${pensionGDPResult.reason?.message || "sin datos"}`,
      );
    }

    // Parse social contributions (M€, Spain only)
    let socialContrib = null;
    if (socialContribResult.status === "fulfilled" && socialContribResult.value) {
      try {
        socialContrib = parseJsonStatTimeSeries(
          socialContribResult.value,
          "ES",
        );
        console.log(
          `  ✅ socialContributions: ${socialContrib.years.length} años`,
        );
      } catch (e) {
        console.warn(`  ⚠️ socialContributions parse error: ${e.message}`);
      }
    } else {
      console.warn(
        `  ⚠️ socialContributions: ${socialContribResult.reason?.message || "sin datos"}`,
      );
    }

    const usedApi = pensionExp || socialContrib || pensionGDP_ES;

    if (!usedApi) {
      console.warn("⚠️  Sin datos Eurostat, usando fallback completo");
      return buildFallbackData();
    }

    // Build byYear structure using only complete years across all core series
    const allYearsSet = new Set();
    if (pensionExp) {
      for (const y of pensionExp.years) allYearsSet.add(y);
    }
    if (socialContrib) {
      for (const y of socialContrib.years) allYearsSet.add(y);
    }
    if (pensionGDP_ES) {
      for (const y of pensionGDP_ES.years) allYearsSet.add(y);
    }

    const years = [...allYearsSet].sort((a, b) => a - b);
    const latestYear = years[years.length - 1];

    const byYear = {};
    for (const year of years) {
      const y = String(year);
      const sc = socialContrib?.byYear[y];
      const pe = pensionExp?.byYear[y];
      const p2g = pensionGDP_ES?.byYear[y];

      // Avoid false zeros: include only years with all core indicators available
      if (sc === undefined || pe === undefined || p2g === undefined) continue;

      byYear[y] = {
        socialContributions: sc,
        pensionExpenditure: pe,
        ssBalance: sc - pe,
        pensionToGDP: p2g,
      };
    }

    const validYears = Object.keys(byYear)
      .map(Number)
      .sort((a, b) => a - b);

    if (validYears.length === 0) {
      console.warn("⚠️  Sin años completos entre cotizaciones, gasto y %PIB; usando fallback");
      return buildFallbackData();
    }

    const data = {
      lastUpdated: new Date().toISOString(),
      latestYear: validYears[validYears.length - 1] || latestYear,
      years: validYears,
      byYear,
      pensionToGDP: {
        spain: pensionGDP_ES || FALLBACK_DATA.pensionToGDP.spain,
        eu27: pensionGDP_EU || FALLBACK_DATA.pensionToGDP.eu27,
      },
      reserveFund: RESERVE_FUND_HISTORY,
      contributorsPerPensioner: CONTRIBUTORS_PER_PENSIONER_HISTORY,
      projections: AGEING_REPORT_PROJECTIONS,
      sourceAttribution: {
        ssSustainability: {
          source: "Eurostat",
          type: usedApi ? "api" : "fallback",
          url: "https://ec.europa.eu/eurostat/databrowser/view/gov_10a_main/",
          date: `${validYears[validYears.length - 1] || latestYear}-12-31`,
          note: `Cotizaciones D61REC, prestaciones D62PAY y ratio sobre PIB (subsector S1314, ${validYears.length} años)`,
        },
      },
    };

    console.log(
      `✅ SS Sostenibilidad descargado: ${validYears.length} años, último año ${data.latestYear}`,
    );

    return data;
  } catch (error) {
    console.error("❌ Error descargando Sostenibilidad SS:", error.message);
    return buildFallbackData();
  }
}

/**
 * Build fallback data when all Eurostat fetches fail
 */
function buildFallbackData() {
  console.warn("⚠️  Usando datos de respaldo para Sostenibilidad SS");

  const years = Object.keys(FALLBACK_DATA.byYear)
    .map(Number)
    .sort((a, b) => a - b);

  return {
    lastUpdated: new Date().toISOString(),
    latestYear: FALLBACK_DATA.latestYear,
    years,
    byYear: FALLBACK_DATA.byYear,
    pensionToGDP: FALLBACK_DATA.pensionToGDP,
    reserveFund: RESERVE_FUND_HISTORY,
    contributorsPerPensioner: CONTRIBUTORS_PER_PENSIONER_HISTORY,
    projections: AGEING_REPORT_PROJECTIONS,
    sourceAttribution: {
      ssSustainability: {
        source: "Eurostat (referencia)",
        type: "fallback",
        url: "https://ec.europa.eu/eurostat/databrowser/view/gov_10a_main/",
        date: `${FALLBACK_DATA.latestYear}-12-31`,
        note: `Valores de referencia ${FALLBACK_DATA.latestYear}`,
      },
    },
  };
}
