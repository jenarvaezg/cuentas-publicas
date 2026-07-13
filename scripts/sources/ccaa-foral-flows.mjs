import { execFileSync } from "child_process";
import { fetchWithRetry } from "../lib/fetch-utils.mjs";
import { normalizeText } from "../lib/text-utils.mjs";

const NAVARRA_MEMORIA_BASE = "https://www.navarra.es/es/web/memoria";
const EUSKADI_URLS_BY_YEAR = {
  2024:
    "https://www.euskadi.eus/noticia/2024/la-cmce-acuerda-modificacion-del-concierto-economico-aumentando-autogobierno-economico-y-participacion-instituciones-vascas-foros-fiscales-internacionales/web01-ejeduki/es/",
};

const FALLBACK_BY_YEAR = {
  2024: {
    navarra: {
      paymentToState: 698.644,
      adjustmentsWithState: 1375.927,
      netFlowToState: -677.283,
      taxRevenue: 5433,
    },
    paisVasco: {
      paymentToState: 1504.5,
      adjustmentsWithState: null,
      netFlowToState: null,
      taxRevenue: 18310,
    },
  },
};

function getFallbackMetrics(year) {
  return FALLBACK_BY_YEAR[year] ?? FALLBACK_BY_YEAR[2024];
}

export function buildNavarraFlowUrl(year) {
  return `${NAVARRA_MEMORIA_BASE}-${year}/cuadro-n%C2%BA-64.-flujos-financieros-convenio-economico`;
}

export function buildNavarraTaxRevenueUrl(year) {
  return `${NAVARRA_MEMORIA_BASE}-${year}/2.4.1-cifras-de-la-recaudacion-liquida`;
}

export function getEuskadiUrl(year) {
  return EUSKADI_URLS_BY_YEAR[year] ?? EUSKADI_URLS_BY_YEAR[2024];
}

function decodeHtmlEntities(value) {
  return String(value ?? "")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&iacute;", "í")
    .replaceAll("&aacute;", "á")
    .replaceAll("&eacute;", "é")
    .replaceAll("&oacute;", "ó")
    .replaceAll("&uacute;", "ú")
    .replaceAll("&ntilde;", "ñ")
    .replaceAll("&Iacute;", "Í")
    .replaceAll("&Aacute;", "Á")
    .replaceAll("&Eacute;", "É")
    .replaceAll("&Oacute;", "Ó")
    .replaceAll("&Uacute;", "Ú")
    .replaceAll("&Ntilde;", "Ñ")
    .replaceAll("&euro;", "€")
    .replaceAll("&#39;", "'")
    .replaceAll("&quot;", '"');
}

function parseSpanishNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const normalized = String(value).replace(/\./g, "").replace(/,/g, ".").trim();
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function thousandsToMillions(value) {
  return value == null ? null : Number((value / 1000).toFixed(3));
}

function findRowValueByLabel(rows, expectedLabel, valueIndex) {
  const expected = normalizeText(expectedLabel);
  const row = rows.find((cells) => normalizeText(cells[0]).includes(expected));
  if (!row) return null;
  return parseSpanishNumber(row[valueIndex]);
}

function htmlTableToRows(html) {
  const rows = [];
  const rowMatches = html.match(/<tr[\s\S]*?<\/tr>/gi) || [];
  for (const rowHtml of rowMatches) {
    const cells = [...rowHtml.matchAll(/<td[\s\S]*?>([\s\S]*?)<\/td>/gi)].map((match) => {
      const withoutTags = decodeHtmlEntities(match[1]).replace(/<[^>]+>/g, " ");
      return withoutTags.replace(/\s+/g, " ").trim();
    });
    if (cells.length >= 3 && cells[0]) rows.push(cells);
  }
  return rows;
}

export function parseNavarraTaxRevenue(html) {
  const normalized = decodeHtmlEntities(html);
  const match = normalized.match(
    /([0-9]{1,2}(?:\.[0-9]{3})+(?:,[0-9]+)?)\s*miles de euros/i,
  );

  if (!match) {
    throw new Error("No se encontró recaudación líquida en la memoria de Navarra");
  }

  const thousandsEuros = parseSpanishNumber(match[1]);
  const taxRevenue = thousandsToMillions(thousandsEuros);
  if (taxRevenue == null) {
    throw new Error("Recaudación líquida Navarra no parseable");
  }

  return taxRevenue;
}

export function parseNavarraForalFlow(html, taxRevenue = null) {
  const rows = htmlTableToRows(html);
  const paymentThousands = findRowValueByLabel(rows, "Total Pagos Aportación Neta", 2);
  const adjustmentsThousands = findRowValueByLabel(rows, "Total Ajustes fiscales", 2);

  if (paymentThousands == null || adjustmentsThousands == null) {
    throw new Error("No se pudieron extraer métricas clave de Navarra (Cuadro 64)");
  }

  const paymentToState = thousandsToMillions(paymentThousands);
  const adjustmentsWithState = thousandsToMillions(adjustmentsThousands);

  return {
    paymentToState,
    adjustmentsWithState,
    netFlowToState: Number((paymentToState - adjustmentsWithState).toFixed(3)),
    taxRevenue: taxRevenue ?? getFallbackMetrics(2024).navarra.taxRevenue,
  };
}

export function parseEuskadiForalFlow(html, year = 2024) {
  const normalizedHtml = decodeHtmlEntities(html);
  const match = normalizedHtml.match(
    /CUPO\s+L[ÍI]QUIDO\s+PROV\s+M(?:€|EUR)?[\s\S]{0,300}?([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})/i,
  );

  if (!match) {
    throw new Error("No se pudo localizar el cupo líquido provisional en la nota de Euskadi");
  }

  const paymentToState = parseSpanishNumber(match[1]);
  if (paymentToState == null) {
    throw new Error("Valor de cupo líquido provisional no parseable");
  }

  return {
    paymentToState: Number(paymentToState.toFixed(3)),
    adjustmentsWithState: null,
    netFlowToState: null,
    taxRevenue: getFallbackMetrics(year).paisVasco.taxRevenue,
  };
}

function curlDownload(url) {
  return execFileSync(
    "curl",
    ["-LsS", "--retry", "2", "--retry-delay", "1", "--max-time", "25", url],
    { encoding: "utf8", maxBuffer: 25 * 1024 * 1024 },
  );
}

async function fetchTextPreferFetchThenCurl(url, fetcher) {
  try {
    const response = await fetcher(
      url,
      { headers: { "User-Agent": "Mozilla/5.0 (compatible; DashboardFiscal/1.0)" } },
      { maxRetries: 2, timeoutMs: 20000 },
    );
    return await response.text();
  } catch (error) {
    console.warn(`  ⚠️ fetch falló para ${url}. Intentando curl...`);
    return curlDownload(url);
  }
}

export async function resolveNavarraMemoriaYear(fetcher = fetchWithRetry, startYear = new Date().getFullYear()) {
  for (let year = startYear; year >= startYear - 3; year -= 1) {
    const url = buildNavarraFlowUrl(year);
    try {
      const response = await fetcher(
        url,
        { headers: { "User-Agent": "Mozilla/5.0 (compatible; DashboardFiscal/1.0)" } },
        { maxRetries: 1, timeoutMs: 10000 },
      );
      if (!response.ok) continue;

      const html = await response.text();
      if (html.includes("Total Pagos Aportación Neta")) {
        console.log(`  Memoria Navarra detectada: ${year}`);
        return year;
      }
    } catch {
      // try previous year
    }
  }

  console.warn("  ⚠️ No se detectó memoria Navarra reciente. Usando 2024.");
  return 2024;
}

function buildNavarraEntry(metrics) {
  return {
    code: "CA15",
    name: "Navarra",
    regime: "foral",
    paymentToState: metrics.paymentToState,
    adjustmentsWithState: metrics.adjustmentsWithState,
    netFlowToState: metrics.netFlowToState,
    taxRevenue: metrics.taxRevenue,
    detail: {
      paymentLabel: "Total Pagos Aportación Neta",
      adjustmentsLabel: "Total Ajustes fiscales",
      unit: "M€",
    },
  };
}

function buildPaisVascoEntry(metrics) {
  return {
    code: "CA16",
    name: "País Vasco",
    regime: "foral",
    paymentToState: metrics.paymentToState,
    adjustmentsWithState: metrics.adjustmentsWithState,
    netFlowToState: metrics.netFlowToState,
    taxRevenue: metrics.taxRevenue,
    detail: {
      paymentLabel: "Cupo líquido provisional",
      adjustmentsLabel: null,
      unit: "M€",
    },
  };
}

async function fetchNavarraForalFlow(fetcher, year, flowUrl, taxUrl) {
  try {
    const [flowHtml, taxHtml] = await Promise.all([
      fetchTextPreferFetchThenCurl(flowUrl, fetcher),
      fetchTextPreferFetchThenCurl(taxUrl, fetcher),
    ]);
    const taxRevenue = parseNavarraTaxRevenue(taxHtml);
    const metrics = parseNavarraForalFlow(flowHtml, taxRevenue);
    console.log(`  ✅ Navarra: datos en vivo (memoria ${year}, Cuadro nº 64)`);
    return { metrics, type: "api", year };
  } catch (error) {
    console.warn(`  ⚠️ Navarra: ${error.message}. Usando fallback local ${year}.`);
    return { metrics: getFallbackMetrics(year).navarra, type: "fallback", year };
  }
}

async function fetchEuskadiForalFlow(fetcher, year, euskadiUrl) {
  try {
    const html = await fetchTextPreferFetchThenCurl(euskadiUrl, fetcher);
    const metrics = parseEuskadiForalFlow(html, year);
    console.log(`  ✅ Euskadi: datos en vivo (CMCE ${year})`);
    return { metrics, type: "api", year };
  } catch (error) {
    console.warn(`  ⚠️ Euskadi: ${error.message}. Usando fallback local ${year}.`);
    return { metrics: getFallbackMetrics(year).paisVasco, type: "fallback", year };
  }
}

function buildForalNote(navarraResult, euskadiResult) {
  const liveRegions = [];
  const fallbackRegions = [];

  if (navarraResult.type === "api") liveRegions.push("Navarra");
  else fallbackRegions.push("Navarra");

  if (euskadiResult.type === "api") liveRegions.push("Euskadi");
  else fallbackRegions.push("Euskadi");

  if (liveRegions.length === 2) {
    return `Navarra: Cuadro nº 64 + recaudación líquida (${navarraResult.year}). Euskadi: nota CMCE ${euskadiResult.year} (cupo líquido provisional).`;
  }

  if (liveRegions.length === 1) {
    return `Datos en vivo de ${liveRegions[0]}. Fallback local ${fallbackRegions[0] === "Navarra" ? navarraResult.year : euskadiResult.year} para ${fallbackRegions[0]}.`;
  }

  return "Fallback local: Navarra (aportación + recaudación) + Euskadi (cupo líquido provisional).";
}

function buildForalDataset(memoriaYear, navarraResult, euskadiResult, urls) {
  const hasLiveData = navarraResult.type === "api" || euskadiResult.type === "api";
  const datasetYear = Math.max(navarraResult.year, euskadiResult.year, memoriaYear);

  return {
    lastUpdated: new Date().toISOString(),
    years: [datasetYear],
    latestYear: datasetYear,
    byYear: {
      [String(datasetYear)]: {
        entries: [
          buildNavarraEntry(navarraResult.metrics),
          buildPaisVascoEntry(euskadiResult.metrics),
        ],
      },
    },
    coverage: {
      regime: "foral",
      notes:
        "Indicadores forales (Navarra y País Vasco) no equivalentes metodológicamente a la liquidación de régimen común.",
    },
    sourceAttribution: {
      foral: {
        source: "Gobierno de Navarra + Gobierno Vasco (CMCE)",
        type: hasLiveData ? "api" : "fallback",
        url: urls.navarraFlowUrl,
        date: `${datasetYear}-12-31`,
        note: buildForalNote(navarraResult, euskadiResult),
      },
      navarra: {
        source: "Gobierno de Navarra — Cuadro nº 64 + recaudación líquida",
        type: navarraResult.type,
        url: urls.navarraFlowUrl,
        date: `${navarraResult.year}-12-31`,
      },
      euskadi: {
        source: `Gobierno Vasco — CMCE ${euskadiResult.year}`,
        type: euskadiResult.type,
        url: urls.euskadiUrl,
        date: `${euskadiResult.year}-11-13`,
      },
    },
  };
}

export async function downloadCcaaForalFlowsData(fetcher = fetchWithRetry) {
  console.log("\n=== Descargando flujos forales CCAA (Navarra y País Vasco) ===");

  const memoriaYear = await resolveNavarraMemoriaYear(fetcher);
  const navarraFlowUrl = buildNavarraFlowUrl(memoriaYear);
  const navarraTaxUrl = buildNavarraTaxRevenueUrl(memoriaYear);
  const euskadiUrl = getEuskadiUrl(memoriaYear);

  console.log(`  Navarra flujos: ${navarraFlowUrl}`);
  console.log(`  Navarra recaudación: ${navarraTaxUrl}`);
  console.log(`  Euskadi:  ${euskadiUrl}`);

  const [navarraResult, euskadiResult] = await Promise.all([
    fetchNavarraForalFlow(fetcher, memoriaYear, navarraFlowUrl, navarraTaxUrl),
    fetchEuskadiForalFlow(fetcher, memoriaYear, euskadiUrl),
  ]);

  if (navarraResult.type === "fallback" && euskadiResult.type === "fallback") {
    console.warn(`  ⚠️ Ambas fuentes forales usaron fallback local ${memoriaYear}`);
  }

  return buildForalDataset(memoriaYear, navarraResult, euskadiResult, {
    navarraFlowUrl,
    navarraTaxUrl,
    euskadiUrl,
  });
}
