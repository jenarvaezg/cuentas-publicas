import { execFileSync } from "child_process";
import { fetchWithRetry } from "../lib/fetch-utils.mjs";
import { normalizeText } from "../lib/text-utils.mjs";

const NAVARRA_URL =
  "https://www.navarra.es/es/web/memoria-2024/cuadro-n%C2%BA-64.-flujos-financieros-convenio-economico";
const EUSKADI_URL =
  "https://www.euskadi.eus/noticia/2024/la-cmce-acuerda-modificacion-del-concierto-economico-aumentando-autogobierno-economico-y-participacion-instituciones-vascas-foros-fiscales-internacionales/web01-ejeduki/es/";

const FALLBACK_2024 = {
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
};

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

export function parseNavarraForalFlow(html) {
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
    taxRevenue: FALLBACK_2024.navarra.taxRevenue,
  };
}

export function parseEuskadiForalFlow(html) {
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
    taxRevenue: FALLBACK_2024.paisVasco.taxRevenue,
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

async function fetchNavarraForalFlow(fetcher) {
  try {
    const html = await fetchTextPreferFetchThenCurl(NAVARRA_URL, fetcher);
    const metrics = parseNavarraForalFlow(html);
    console.log("  ✅ Navarra: datos en vivo (Cuadro nº 64)");
    return { metrics, type: "api" };
  } catch (error) {
    console.warn(`  ⚠️ Navarra: ${error.message}. Usando fallback local 2024.`);
    return { metrics: FALLBACK_2024.navarra, type: "fallback" };
  }
}

async function fetchEuskadiForalFlow(fetcher) {
  try {
    const html = await fetchTextPreferFetchThenCurl(EUSKADI_URL, fetcher);
    const metrics = parseEuskadiForalFlow(html);
    console.log("  ✅ Euskadi: datos en vivo (CMCE 2024)");
    return { metrics, type: "api" };
  } catch (error) {
    console.warn(`  ⚠️ Euskadi: ${error.message}. Usando fallback local 2024.`);
    return { metrics: FALLBACK_2024.paisVasco, type: "fallback" };
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
    return "Navarra: Cuadro nº 64 (Aportación neta y ajustes fiscales). Euskadi: nota CMCE 2024 (cupo líquido provisional).";
  }

  if (liveRegions.length === 1) {
    return `Datos en vivo de ${liveRegions[0]}. Fallback local 2024 para ${fallbackRegions[0]}.`;
  }

  return "Fallback local: Navarra (Total Pagos Aportación Neta, Total Ajustes fiscales) + Euskadi (Cupo líquido provisional).";
}

function buildForalDataset(navarraResult, euskadiResult) {
  const hasLiveData = navarraResult.type === "api" || euskadiResult.type === "api";

  return {
    lastUpdated: new Date().toISOString(),
    years: [2024],
    latestYear: 2024,
    byYear: {
      "2024": {
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
        url: NAVARRA_URL,
        date: "2024-12-31",
        note: buildForalNote(navarraResult, euskadiResult),
      },
      navarra: {
        source: "Gobierno de Navarra — Cuadro nº 64",
        type: navarraResult.type,
        url: NAVARRA_URL,
        date: "2024-12-31",
      },
      euskadi: {
        source: "Gobierno Vasco — CMCE 2024",
        type: euskadiResult.type,
        url: EUSKADI_URL,
        date: "2024-11-13",
      },
    },
  };
}

export async function downloadCcaaForalFlowsData(fetcher = fetchWithRetry) {
  console.log("\n=== Descargando flujos forales CCAA (Navarra y País Vasco) ===");
  console.log(`  Navarra: ${NAVARRA_URL}`);
  console.log(`  Euskadi:  ${EUSKADI_URL}`);

  const [navarraResult, euskadiResult] = await Promise.all([
    fetchNavarraForalFlow(fetcher),
    fetchEuskadiForalFlow(fetcher),
  ]);

  if (navarraResult.type === "fallback" && euskadiResult.type === "fallback") {
    console.warn("  ⚠️ Ambas fuentes forales usaron fallback local 2024");
  }

  return buildForalDataset(navarraResult, euskadiResult);
}
