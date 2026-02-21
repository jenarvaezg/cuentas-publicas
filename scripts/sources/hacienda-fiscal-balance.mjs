import XLSX from 'xlsx'
import { fetchWithRetry } from '../lib/fetch-utils.mjs'

const HACIENDA_INDEX_URL =
  'https://www.hacienda.gob.es/es-ES/CDI/Paginas/SistemasFinanciacionDeuda/InformacionCCAAs/Informes%20financiacion%20comunidades%20autonomas2.aspx'

const CCAA_NAME_MAP = {
  andalucia: { code: 'CA01', name: 'Andalucía' },
  aragon: { code: 'CA02', name: 'Aragón' },
  'principado de asturias': { code: 'CA03', name: 'Asturias' },
  asturias: { code: 'CA03', name: 'Asturias' },
  'illes balears': { code: 'CA04', name: 'Illes Balears' },
  baleares: { code: 'CA04', name: 'Illes Balears' },
  canarias: { code: 'CA05', name: 'Canarias' },
  cantabria: { code: 'CA06', name: 'Cantabria' },
  'castilla y leon': { code: 'CA07', name: 'Castilla y León' },
  'castilla-la mancha': { code: 'CA08', name: 'Castilla-La Mancha' },
  'castilla la mancha': { code: 'CA08', name: 'Castilla-La Mancha' },
  cataluna: { code: 'CA09', name: 'Cataluña' },
  'comunidad valenciana': { code: 'CA10', name: 'C. Valenciana' },
  'c. valenciana': { code: 'CA10', name: 'C. Valenciana' },
  'comunitat valenciana': { code: 'CA10', name: 'C. Valenciana' },
  extremadura: { code: 'CA11', name: 'Extremadura' },
  galicia: { code: 'CA12', name: 'Galicia' },
  madrid: { code: 'CA13', name: 'Madrid' },
  'comunidad de madrid': { code: 'CA13', name: 'Madrid' },
  'region de murcia': { code: 'CA14', name: 'Murcia' },
  murcia: { code: 'CA14', name: 'Murcia' },
  'la rioja': { code: 'CA17', name: 'La Rioja' },
}

const FALLBACK_2023_ENTRIES = [
  {
    code: 'CA01',
    name: 'Andalucía',
    cededTaxes: 472.133,
    transfers: 758.097,
    netBalance: 285.964,
    transferToTaxRatio: 1.606,
    cededTaxesBreakdown: { irpf: 802.191, iva: -80.894, iiee: -249.164 },
    transfersBreakdown: {
      fondoGarantia: 77.286,
      fondoSuficiencia: 35.048,
      fondoCompetitividad: 0,
      fondoCooperacion: 645.763,
    },
  },
  {
    code: 'CA02',
    name: 'Aragón',
    cededTaxes: -74.109,
    transfers: 194.987,
    netBalance: 269.096,
    transferToTaxRatio: -2.631,
    cededTaxesBreakdown: { irpf: 47.372, iva: -15.893, iiee: -105.587 },
    transfersBreakdown: {
      fondoGarantia: 114.755,
      fondoSuficiencia: 19.356,
      fondoCompetitividad: 0,
      fondoCooperacion: 60.876,
    },
  },
  {
    code: 'CA03',
    name: 'Asturias',
    cededTaxes: -47.613,
    transfers: 274.822,
    netBalance: 322.436,
    transferToTaxRatio: -5.772,
    cededTaxesBreakdown: { irpf: 58.63, iva: -51.691, iiee: -54.553 },
    transfersBreakdown: {
      fondoGarantia: 70.361,
      fondoSuficiencia: 13.021,
      fondoCompetitividad: 0,
      fondoCooperacion: 191.44,
    },
  },
  {
    code: 'CA04',
    name: 'Illes Balears',
    cededTaxes: 267.354,
    transfers: 770.13,
    netBalance: 502.775,
    transferToTaxRatio: 2.881,
    cededTaxesBreakdown: { irpf: 471.194, iva: -208.198, iiee: 4.359 },
    transfersBreakdown: {
      fondoGarantia: -93.438,
      fondoSuficiencia: -48.908,
      fondoCompetitividad: 912.475,
      fondoCooperacion: 0,
    },
  },
  {
    code: 'CA05',
    name: 'Canarias',
    cededTaxes: 177.72,
    transfers: 804.365,
    netBalance: 626.646,
    transferToTaxRatio: 4.526,
    cededTaxesBreakdown: { irpf: 221.447, iva: 0, iiee: -43.727 },
    transfersBreakdown: {
      fondoGarantia: -132.885,
      fondoSuficiencia: 5.133,
      fondoCompetitividad: 768.884,
      fondoCooperacion: 163.234,
    },
  },
  {
    code: 'CA06',
    name: 'Cantabria',
    cededTaxes: -13.237,
    transfers: 207.96,
    netBalance: 221.197,
    transferToTaxRatio: -15.71,
    cededTaxesBreakdown: { irpf: 50.039, iva: -37.122, iiee: -26.154 },
    transfersBreakdown: {
      fondoGarantia: 63.007,
      fondoSuficiencia: 34.3,
      fondoCompetitividad: 0,
      fondoCooperacion: 110.654,
    },
  },
  {
    code: 'CA07',
    name: 'Castilla y León',
    cededTaxes: -25.428,
    transfers: 641.683,
    netBalance: 667.112,
    transferToTaxRatio: -25.235,
    cededTaxesBreakdown: { irpf: 163.995, iva: -89.299, iiee: -100.124 },
    transfersBreakdown: {
      fondoGarantia: 168.635,
      fondoSuficiencia: 30.289,
      fondoCompetitividad: 0,
      fondoCooperacion: 442.76,
    },
  },
  {
    code: 'CA08',
    name: 'Castilla-La Mancha',
    cededTaxes: -41.733,
    transfers: 325.31,
    netBalance: 367.043,
    transferToTaxRatio: -7.795,
    cededTaxesBreakdown: { irpf: 151.996, iva: -87.721, iiee: -106.008 },
    transfersBreakdown: {
      fondoGarantia: 177.02,
      fondoSuficiencia: 5.526,
      fondoCompetitividad: 0,
      fondoCooperacion: 142.765,
    },
  },
  {
    code: 'CA09',
    name: 'Cataluña',
    cededTaxes: 1266.593,
    transfers: 1456.886,
    netBalance: 190.293,
    transferToTaxRatio: 1.15,
    cededTaxesBreakdown: { irpf: 1443.334, iva: -42.84, iiee: -133.901 },
    transfersBreakdown: {
      fondoGarantia: -128.336,
      fondoSuficiencia: 62.035,
      fondoCompetitividad: 1523.187,
      fondoCooperacion: 0,
    },
  },
  {
    code: 'CA10',
    name: 'C. Valenciana',
    cededTaxes: 160.46,
    transfers: 1843.436,
    netBalance: 1682.976,
    transferToTaxRatio: 11.488,
    cededTaxesBreakdown: { irpf: 398.129, iva: -92.843, iiee: -144.826 },
    transfersBreakdown: {
      fondoGarantia: 239.96,
      fondoSuficiencia: -100.993,
      fondoCompetitividad: 1363.413,
      fondoCooperacion: 341.056,
    },
  },
  {
    code: 'CA11',
    name: 'Extremadura',
    cededTaxes: -8.646,
    transfers: 264.985,
    netBalance: 273.631,
    transferToTaxRatio: -30.649,
    cededTaxesBreakdown: { irpf: 33.927, iva: -6.661, iiee: -35.912 },
    transfersBreakdown: {
      fondoGarantia: 21.28,
      fondoSuficiencia: 31.143,
      fondoCompetitividad: 0,
      fondoCooperacion: 212.563,
    },
  },
  {
    code: 'CA12',
    name: 'Galicia',
    cededTaxes: 38.605,
    transfers: 640.859,
    netBalance: 602.254,
    transferToTaxRatio: 16.601,
    cededTaxesBreakdown: { irpf: 238.908, iva: -62.087, iiee: -138.216 },
    transfersBreakdown: {
      fondoGarantia: 89.96,
      fondoSuficiencia: 41.71,
      fondoCompetitividad: 0,
      fondoCooperacion: 509.188,
    },
  },
  {
    code: 'CA13',
    name: 'Madrid',
    cededTaxes: 997.816,
    transfers: -192.768,
    netBalance: -1190.583,
    transferToTaxRatio: -0.193,
    cededTaxesBreakdown: { irpf: 621.484, iva: 563.74, iiee: -187.409 },
    transfersBreakdown: {
      fondoGarantia: -389.868,
      fondoSuficiencia: -52.587,
      fondoCompetitividad: 249.688,
      fondoCooperacion: 0,
    },
  },
  {
    code: 'CA14',
    name: 'Murcia',
    cededTaxes: 32.447,
    transfers: 368.474,
    netBalance: 336.027,
    transferToTaxRatio: 11.356,
    cededTaxesBreakdown: { irpf: 100.99, iva: -15.927, iiee: -52.617 },
    transfersBreakdown: {
      fondoGarantia: 116.766,
      fondoSuficiencia: -14.055,
      fondoCompetitividad: 160.947,
      fondoCooperacion: 104.816,
    },
  },
  {
    code: 'CA17',
    name: 'La Rioja',
    cededTaxes: 11.785,
    transfers: 42.775,
    netBalance: 30.991,
    transferToTaxRatio: 3.63,
    cededTaxesBreakdown: { irpf: 20.568, iva: -3.562, iiee: -5.222 },
    transfersBreakdown: {
      fondoGarantia: 11.471,
      fondoSuficiencia: 14.853,
      fondoCompetitividad: 0,
      fondoCooperacion: 16.451,
    },
  },
]

const REQUIRED_COLUMNS = [
  'irpf',
  'iva',
  'iiee',
  'fondoGarantia',
  'fondoSuficiencia',
  'fondoCompetitividad',
  'fondoCooperacion',
]

function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return 0
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const normalized = String(value).replace(/\./g, '').replace(/,/g, '.').trim()
  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function thousandEurosToMillions(value) {
  return Number((toNumber(value) / 1000).toFixed(3))
}

function roundMillionValue(value) {
  return Number(value.toFixed(3))
}

function isSummaryRow(labelNormalized) {
  return (
    labelNormalized.startsWith('total') ||
    labelNormalized === 'ceuta' ||
    labelNormalized === 'melilla'
  )
}

function detectYearLinks(html) {
  const matches = Array.from(
    html.matchAll(/href="([^"]*cuadros-liquidacion-(\d{4})\.xlsx[^"]*)"/gi),
  )

  const byYear = new Map()
  for (const [, rawHref, yearStr] of matches) {
    const year = Number.parseInt(yearStr, 10)
    if (!Number.isInteger(year)) continue
    const url = new URL(rawHref, HACIENDA_INDEX_URL).href
    byYear.set(year, url)
  }

  return [...byYear.entries()]
    .map(([year, url]) => ({ year, url }))
    .sort((a, b) => a.year - b.year)
}

function findTargetSheet(workbook) {
  const preferred = workbook.SheetNames.find(
    (name) => normalizeText(name) === '3. liquidacion definitiva',
  )
  if (preferred) return preferred

  return workbook.SheetNames.find((name) =>
    normalizeText(name).includes('liquidacion definitiva'),
  )
}

function findHeaderRow(rows) {
  for (let i = 0; i < Math.min(rows.length, 50); i++) {
    const row = rows[i] || []
    const rowText = normalizeText(row.join(' '))
    if (
      rowText.includes('comunidad') &&
      rowText.includes('tarifa autonomica de irpf') &&
      rowText.includes('impuesto sobre el valor anadido') &&
      rowText.includes('total impuestos especiales') &&
      rowText.includes('transferencia del fondo de garantia')
    ) {
      return i
    }
  }
  return -1
}

function findColumnIndexes(headerRow) {
  const indexes = {
    name: 0,
    irpf: -1,
    iva: -1,
    iiee: -1,
    fondoGarantia: -1,
    fondoSuficiencia: -1,
    fondoCompetitividad: -1,
    fondoCooperacion: -1,
  }

  for (let i = 0; i < headerRow.length; i++) {
    const label = normalizeText(headerRow[i])
    if (!label) continue

    if (label.includes('comunidad') && label.includes('ciudad')) indexes.name = i
    else if (label.includes('tarifa autonomica de irpf')) indexes.irpf = i
    else if (label.includes('impuesto sobre el valor anadido')) indexes.iva = i
    else if (label.includes('total impuestos especiales')) indexes.iiee = i
    else if (label.includes('transferencia del fondo de garantia')) indexes.fondoGarantia = i
    else if (label.includes('fondo de suficiencia global')) indexes.fondoSuficiencia = i
    else if (label.includes('fondo de competitividad')) indexes.fondoCompetitividad = i
    else if (label.includes('fondo de cooperacion')) indexes.fondoCooperacion = i
  }

  const missing = REQUIRED_COLUMNS.filter((key) => indexes[key] < 0)
  if (missing.length > 0) {
    throw new Error(`Columnas no encontradas: ${missing.join(', ')}`)
  }

  return indexes
}

function buildFiscalEntry(rawName, row, indexes) {
  const nameKey = normalizeText(rawName)
  const mapped = CCAA_NAME_MAP[nameKey]
  if (!mapped) return null

  const irpf = thousandEurosToMillions(row[indexes.irpf])
  const iva = thousandEurosToMillions(row[indexes.iva])
  const iiee = thousandEurosToMillions(row[indexes.iiee])
  const fondoGarantia = thousandEurosToMillions(row[indexes.fondoGarantia])
  const fondoSuficiencia = thousandEurosToMillions(row[indexes.fondoSuficiencia])
  const fondoCompetitividad = thousandEurosToMillions(row[indexes.fondoCompetitividad])
  const fondoCooperacion = thousandEurosToMillions(row[indexes.fondoCooperacion])

  const cededTaxes = roundMillionValue(irpf + iva + iiee)
  const transfers = roundMillionValue(
    fondoGarantia + fondoSuficiencia + fondoCompetitividad + fondoCooperacion,
  )
  const netBalance = roundMillionValue(transfers - cededTaxes)
  const transferToTaxRatio =
    cededTaxes === 0 ? null : roundMillionValue(transfers / cededTaxes)

  return {
    code: mapped.code,
    name: mapped.name,
    cededTaxes,
    transfers,
    netBalance,
    transferToTaxRatio,
    cededTaxesBreakdown: { irpf, iva, iiee },
    transfersBreakdown: {
      fondoGarantia,
      fondoSuficiencia,
      fondoCompetitividad,
      fondoCooperacion,
    },
  }
}

function computeYearTotals(entries) {
  const totals = entries.reduce(
    (acc, entry) => {
      acc.cededTaxes += entry.cededTaxes
      acc.transfers += entry.transfers
      acc.netBalance += entry.netBalance
      return acc
    },
    { cededTaxes: 0, transfers: 0, netBalance: 0 },
  )

  return {
    cededTaxes: roundMillionValue(totals.cededTaxes),
    transfers: roundMillionValue(totals.transfers),
    netBalance: roundMillionValue(totals.netBalance),
  }
}

function parseYearWorkbook(year, workbook) {
  const sheetName = findTargetSheet(workbook)
  if (!sheetName) {
    throw new Error(`Año ${year}: no se encontró hoja de liquidación definitiva`)
  }

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '' })
  const headerRowIndex = findHeaderRow(rows)
  if (headerRowIndex < 0) {
    throw new Error(`Año ${year}: no se encontró cabecera esperada`)
  }

  const columnIndexes = findColumnIndexes(rows[headerRowIndex] ?? [])
  const entries = []

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i] || []
    const rawName = String(row[columnIndexes.name] ?? '').trim()
    if (!rawName) continue

    const normalizedName = normalizeText(rawName)
    if (isSummaryRow(normalizedName)) continue

    const entry = buildFiscalEntry(rawName, row, columnIndexes)
    if (entry) entries.push(entry)
  }

  if (entries.length === 0) {
    throw new Error(`Año ${year}: no se encontraron filas CCAA válidas`)
  }

  entries.sort((a, b) => a.code.localeCompare(b.code))
  return { entries, totals: computeYearTotals(entries) }
}

async function downloadWorkbook(year, url) {
  const response = await fetchWithRetry(
    url,
    { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DashboardFiscal/1.0)' } },
    { maxRetries: 2, timeoutMs: 60000 },
  )
  const buffer = await response.arrayBuffer()
  console.log(`    ${year}: ${(buffer.byteLength / 1024).toFixed(1)} KB`)
  return XLSX.read(Buffer.from(buffer), { type: 'buffer' })
}

function buildFallbackDataset() {
  const entries = [...FALLBACK_2023_ENTRIES].sort((a, b) => a.code.localeCompare(b.code))
  return {
    lastUpdated: new Date().toISOString(),
    years: [2023],
    latestYear: 2023,
    byYear: {
      '2023': {
        entries,
        totals: computeYearTotals(entries),
      },
    },
    coverage: {
      regime: 'common',
      includesCeutaMelilla: false,
      excludesForal: true,
      notes:
        'Liquidación del sistema de financiación de régimen común. No incluye Navarra ni País Vasco.',
    },
    sourceAttribution: {
      balances: {
        source: 'Referencia Hacienda — Liquidación CCAA 2023',
        type: 'fallback',
        url: HACIENDA_INDEX_URL,
        date: '2023-12-31',
        note: 'Fallback local al no poder descargar XLS oficiales en este entorno',
      },
    },
  }
}

export async function downloadCcaaFiscalBalanceData() {
  console.log('\n=== Descargando balanzas fiscales CCAA (Hacienda) ===')
  console.log(`  Índice: ${HACIENDA_INDEX_URL}`)

  try {
    const indexResponse = await fetchWithRetry(
      HACIENDA_INDEX_URL,
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DashboardFiscal/1.0)' } },
      { maxRetries: 2, timeoutMs: 45000 },
    )
    const indexHtml = await indexResponse.text()
    const yearLinks = detectYearLinks(indexHtml)

    if (yearLinks.length === 0) {
      throw new Error('No se detectaron ficheros "cuadros-liquidacion-YYYY.xlsx"')
    }

    console.log(
      `  Años detectados: ${yearLinks.map(({ year }) => year).join(', ')}`,
    )

    const byYear = {}

    for (const { year, url } of yearLinks) {
      try {
        const workbook = await downloadWorkbook(year, url)
        byYear[String(year)] = parseYearWorkbook(year, workbook)
        console.log(
          `    ${year}: ${byYear[String(year)].entries.length} CCAA procesadas`,
        )
      } catch (error) {
        console.warn(`    ⚠️ ${year}: ${error.message}`)
      }
    }

    const years = Object.keys(byYear)
      .map((year) => Number.parseInt(year, 10))
      .filter(Number.isInteger)
      .sort((a, b) => a - b)

    if (years.length === 0) {
      throw new Error('No se pudo procesar ningún año de balanzas fiscales CCAA')
    }

    const latestYear = years[years.length - 1]

    return {
      lastUpdated: new Date().toISOString(),
      years,
      latestYear,
      byYear,
      coverage: {
        regime: 'common',
        includesCeutaMelilla: false,
        excludesForal: true,
        notes:
          'Liquidación del sistema de financiación de régimen común. No incluye Navarra ni País Vasco.',
      },
      sourceAttribution: {
        balances: {
          source: `Ministerio de Hacienda — Cuadros liquidación CCAA (${years[0]}-${latestYear})`,
          type: 'xlsx',
          url: HACIENDA_INDEX_URL,
          date: `${latestYear}-12-31`,
          note:
            'Impuestos cedidos (IRPF, IVA, IIEE) y transferencias (Fondo de Garantía, Suficiencia, Competitividad y Cooperación). Miles de euros convertidos a millones.',
        },
      },
    }
  } catch (error) {
    console.warn(`  ⚠️ Error en descarga de balanzas fiscales CCAA: ${error.message}`)
    console.warn('  ⚠️ Usando fallback local 2023')
    return buildFallbackDataset()
  }
}
