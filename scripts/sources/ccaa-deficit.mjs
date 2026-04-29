import XLSX from "xlsx";
import { fetchWithRetry } from "../lib/fetch-utils.mjs";
import { normalizeText } from "../lib/text-utils.mjs";

const IGAE_DEFICIT_BASE_URL =
  "https://www.igae.pap.hacienda.gob.es/sitios/igae/es-ES/Contabilidad/ContabilidadNacional/Publicaciones/Documents/CCAA-M/M_CCAA_Sub_Det_";

const IGAE_DEFICIT_MIN_YEAR = 2021;
const IGAE_DEFICIT_MAX_TRAILING_MISSES = 1;
const MONTH_NAMES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

// Reference fallback data for CCAA capacity/need of financing (Capacidad (+) / Necesidad (-) de financiación)
// Valores en millones de euros, cierre 2023 base (datos provisionales/avance IGAE).
const FALLBACK_DEFICIT = {
  2023: {
    CA01: -1486, // Andalucía
    CA02: -317, // Aragón
    CA03: 153, // Asturias
    CA04: 342, // Baleares
    CA05: 236, // Canarias
    CA06: -60, // Cantabria
    CA07: -152, // Castilla y León
    CA08: -359, // Castilla-La Mancha
    CA09: -3616, // Cataluña
    CA10: -3358, // C. Valenciana
    CA11: -64, // Extremadura
    CA12: -193, // Galicia
    CA13: -2385, // Madrid
    CA14: -946, // Murcia
    CA15: 147, // Navarra
    CA16: -117, // País Vasco
    CA17: -43, // La Rioja
  },
};

const CCAA_MAP = {
  Andalucía: "CA01",
  Aragón: "CA02",
  Asturias: "CA03",
  Baleares: "CA04",
  "Illes Balears": "CA04",
  Canarias: "CA05",
  Cantabria: "CA06",
  "Castilla y León": "CA07",
  "Castilla - La Mancha": "CA08",
  "Castilla-La Mancha": "CA08",
  Cataluña: "CA09",
  "C. Valenciana": "CA10",
  "Comunitat Valenciana": "CA10",
  Extremadura: "CA11",
  Galicia: "CA12",
  Madrid: "CA13",
  Murcia: "CA14",
  "Región de Murcia": "CA14",
  Navarra: "CA15",
  "Comunidad Foral de Navarra": "CA15",
  "País Vasco": "CA16",
  "La Rioja": "CA17",
};

function buildYearUrl(year) {
  return `${IGAE_DEFICIT_BASE_URL}${year}.xlsx`;
}

function getMonthEndDate(year, month) {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

function detectMonthFromColumn(rows, columnIndex, fallbackMonth) {
  for (const row of rows.slice(0, 20)) {
    const normalized = normalizeText(String(row?.[columnIndex] ?? "").trim()).toLowerCase();
    const monthIndex = MONTH_NAMES.findIndex((monthName) => monthName === normalized);
    if (monthIndex >= 0) return monthIndex + 1;
  }

  return fallbackMonth >= 1 && fallbackMonth <= 12 ? fallbackMonth : null;
}

function parseCcaaSheet(year, workbookSheet) {
  const rows = XLSX.utils.sheet_to_json(workbookSheet, { header: 1, defval: "" });
  if (rows.length < 10) return null;

  // The community name is typically around row 11, col 1 in the new format like: "Comunidad Autónoma de Andalucía" or "- Impuestos del tipo valor añadido"
  // But wait, the previous snippet showed sheetName mapped to CCAA name in the 'Indice' sheet.
  // It's safer to rely on the 'Indice' mapping, handled externally, but we need the B.9 row here.

  const b9Row = rows.find(r => r[0] && String(r[0]).trim() === "B.9");
  if (!b9Row) {
    return null;
  }

  // Find the last numeric column in the B.9 row which represents the accumulated data for the latest month in that year
  let lastNumericValue = null;
  let lastNumericColumn = -1;
  for (let i = b9Row.length - 1; i >= 1; i--) {
    const val = Number(b9Row[i]);
    if (!isNaN(val) && b9Row[i] !== "" && b9Row[i] !== null) {
      lastNumericValue = val;
      lastNumericColumn = i;
      break;
    }
  }

  if (lastNumericValue === null) {
    return null;
  }

  const month = detectMonthFromColumn(rows, lastNumericColumn, lastNumericColumn - 1);

  return {
    value: lastNumericValue,
    month,
    date: month ? getMonthEndDate(year, month) : `${year}-12-31`,
  };
}

function parseYearWorkbook(year, workbook) {
  const indiceSheet = workbook.Sheets["Indice"];
  if (!indiceSheet) throw new Error("No se encontró la hoja Indice");

  const indiceRows = XLSX.utils.sheet_to_json(indiceSheet, { header: 1, defval: "" });

  // Build a map of sheetName (e.g. Tabla2a) to CCAA code
  const sheetToCcaa = {};
  for (const row of indiceRows) {
    if (!row[1]) continue;
    const match = String(row[1]).match(/Tabla (\d+a):\s*(.+)/i);
    if (match) {
      const sheetName = `Tabla${match[1]}`;
      const rawName = normalizeText(match[2].trim());
      const mappedCode = CCAA_MAP[match[2].trim()] || CCAA_MAP[Object.keys(CCAA_MAP).find(k => normalizeText(k) === rawName)];
      if (mappedCode) {
        sheetToCcaa[sheetName] = mappedCode;
      }
    }
  }

  const entries = [];
  const periodDates = [];
  const periodMonths = [];
  for (const [sheetName, ccaaCode] of Object.entries(sheetToCcaa)) {
    // Ensure we handle case insensitivity if needed, though usually it matches exactly
    const actualSheetName = workbook.SheetNames.find(n => n.toLowerCase() === sheetName.toLowerCase());

    if (!actualSheetName || !workbook.Sheets[actualSheetName]) {
      console.warn(`    ⚠️ Hoja ${sheetName} no encontrada para ${ccaaCode}`);
      continue;
    }

    const parsed = parseCcaaSheet(year, workbook.Sheets[actualSheetName]);
    if (parsed !== null) {
      entries.push({
        code: ccaaCode,
        value: parsed.value,
      });
      if (parsed.date) periodDates.push(parsed.date);
      if (parsed.month) periodMonths.push(parsed.month);
    }
  }

  if (entries.length === 0) {
    throw new Error("No se extrajeron datos de las hojas de CCAA");
  }

  // Sort by CCAA code for consistency
  entries.sort((a, b) => a.code.localeCompare(b.code));

  const date = periodDates.sort().at(-1);
  const month = periodMonths.sort((a, b) => b - a)[0] ?? null;

  return { entries, date, month };
}

async function downloadWorkbook(year, url, fetcher) {
  const response = await fetcher(
    url,
    { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } },
    { maxRetries: 2, timeoutMs: 30000 }
  );

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength < 5000) {
    throw new Error(`Archivo demasiado pequeño (${buffer.byteLength} bytes). Posible bloqueo 403 HTML.`);
  }

  return XLSX.read(Buffer.from(buffer), { type: "buffer" });
}

export async function fetchCcaaDeficit(fetcher = fetchWithRetry) {
  console.log("Obteniendo datos de Déficit SEC 2010 por CCAA (IGAE)...");

  const byYear = {};
  const currentYear = new Date().getUTCFullYear();
  let hits = 0;
  let misses = 0;

  for (let year = currentYear; year >= IGAE_DEFICIT_MIN_YEAR; year--) {
    const url = buildYearUrl(year);
    try {
      const workbook = await downloadWorkbook(year, url, fetcher);
      const yearData = parseYearWorkbook(year, workbook);
      byYear[String(year)] = yearData;
      const monthLabel = yearData.month ? ` (${MONTH_NAMES[yearData.month - 1]})` : "";
      console.log(`    ${year}${monthLabel}: ${yearData.entries.length} CCAA procesadas`);
      hits++;
      misses = 0;
    } catch (error) {
      misses++;
      if (hits === 0 && year >= currentYear - 1) {
        console.log(`    ℹ️ ${year}: no encontrado (${error.message.split('\\n')[0]})`);
      }
      if (hits > 0 && misses >= IGAE_DEFICIT_MAX_TRAILING_MISSES) break;
      // Stop if we haven't found anything recently
      if (hits === 0 && misses >= 2) break;
    }
  }

  const yearsObj = Object.keys(byYear).map(Number).sort((a, b) => b - a);

  if (yearsObj.length === 0) {
    console.log("  ℹ️ Aviso: No se pudieron descargar años válidos de IGAE.");
    console.log("  ℹ️ Utilizando fallback dataset (Cierre 2023 base)...");

    const fallbackInfo = getLatestYearDataFromFallback();

    return {
      success: true,
      lastUpdated: new Date().toISOString(),
      latestYear: fallbackInfo.latestYear,
      data: fallbackInfo.data, // keeping legacy structure mapping for UI
      years: [fallbackInfo.latestYear],
      byYear: {
        [fallbackInfo.latestYear]: {
          entries: Object.entries(fallbackInfo.data).map(([code, value]) => ({ code, value })),
          date: `${fallbackInfo.latestYear}-12-31`,
          month: 12,
        }
      },
      source: "igae-cn-regional",
      note: "Capacidad/Necesidad de financiación (B.9) SEC 2010. Utilizando datos fallback debido a fallos en origen.",
    };
  }

  const latestYear = yearsObj[0];
  // Transform back to expected key-value format for main UI consumption
  const latestDataMap = {};
  byYear[String(latestYear)].entries.forEach(e => {
    latestDataMap[e.code] = e.value;
  });
  const latestYearData = byYear[String(latestYear)];
  const latestMonthLabel = latestYearData.month
    ? `${MONTH_NAMES[latestYearData.month - 1]} ${latestYear}`
    : String(latestYear);

  return {
    success: true,
    lastUpdated: new Date().toISOString(),
    latestYear,
    years: yearsObj,
    data: latestDataMap,
    byYear,
    source: "igae-cn-regional",
    sourceAttribution: {
      balances: {
        source: `IGAE — Cuentas Regionales (${latestMonthLabel})`,
        url: buildYearUrl(latestYear),
        type: "xlsx",
        date: latestYearData.date ?? `${latestYear}-12-31`,
        note: "Capacidad (+) / Necesidad (-) de financiación (B.9). Mensual acumulado SEC 2010.",
      },
    },
  };
}

function getLatestYearDataFromFallback() {
  const years = Object.keys(FALLBACK_DEFICIT).sort(
    (a, b) => Number(b) - Number(a),
  );
  const latestYear = years[0];

  return {
    latestYear: Number(latestYear),
    data: FALLBACK_DEFICIT[latestYear],
  };
}

export default async function runCcaaDeficit(fetcher = fetchWithRetry) {
  return await fetchCcaaDeficit(fetcher);
}
