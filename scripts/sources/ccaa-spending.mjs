import XLSX from 'xlsx'
import { fetchWithRetry } from '../lib/fetch-utils.mjs'

const IGAE_CCAA_BASE_URL =
  'https://www.igae.pap.hacienda.gob.es/sitios/igae/es-ES/Contabilidad/ContabilidadNacional/Publicaciones/'
const IGAE_CCAA_DOC_BASE = `${IGAE_CCAA_BASE_URL}Documents/CCAA-A/COFOG_A_Detalle_CCAA_`
const IGAE_CCAA_MIN_YEAR = 2000
const IGAE_CCAA_MAX_INITIAL_MISSES = 6
const IGAE_CCAA_MAX_TRAILING_MISSES = 4

const CCAA_NAME_MAP = {
  andalucia: { code: 'CA01', name: 'Andalucía' },
  aragon: { code: 'CA02', name: 'Aragón' },
  asturias: { code: 'CA03', name: 'Asturias' },
  baleares: { code: 'CA04', name: 'Illes Balears' },
  'illes balears': { code: 'CA04', name: 'Illes Balears' },
  canarias: { code: 'CA05', name: 'Canarias' },
  cantabria: { code: 'CA06', name: 'Cantabria' },
  'castilla y leon': { code: 'CA07', name: 'Castilla y León' },
  'castilla la mancha': { code: 'CA08', name: 'Castilla-La Mancha' },
  'castilla - la mancha': { code: 'CA08', name: 'Castilla-La Mancha' },
  cataluna: { code: 'CA09', name: 'Cataluña' },
  'comunitat valenciana': { code: 'CA10', name: 'C. Valenciana' },
  'comunidad valenciana': { code: 'CA10', name: 'C. Valenciana' },
  extremadura: { code: 'CA11', name: 'Extremadura' },
  galicia: { code: 'CA12', name: 'Galicia' },
  madrid: { code: 'CA13', name: 'Madrid' },
  murcia: { code: 'CA14', name: 'Murcia' },
  'region de murcia': { code: 'CA14', name: 'Murcia' },
  'comunidad foral de navarra': { code: 'CA15', name: 'Navarra' },
  navarra: { code: 'CA15', name: 'Navarra' },
  'pais vasco': { code: 'CA16', name: 'País Vasco' },
  'la rioja': { code: 'CA17', name: 'La Rioja' },
}

const COFOG_DIVISION_NAMES = {
  '01': 'Servicios públicos generales',
  '02': 'Defensa',
  '03': 'Orden público y seguridad',
  '04': 'Asuntos económicos',
  '05': 'Protección del medio ambiente',
  '06': 'Vivienda y servicios comunitarios',
  '07': 'Salud',
  '08': 'Ocio, cultura y religión',
  '09': 'Educación',
  '10': 'Protección social',
}

const DIVISION_CODES = Object.keys(COFOG_DIVISION_NAMES)

const FALLBACK_2024_ENTRIES = [
  {
    code: 'CA01',
    name: 'Andalucía',
    total: 38935,
    divisions: {
      '01': 4786,
      '02': 0,
      '03': 749,
      '04': 3402,
      '05': 862,
      '06': 489,
      '07': 14660,
      '08': 575,
      '09': 11256,
      '10': 2156,
    },
  },
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

function getTopDivision(divisions) {
  let topCode = '01'
  let topAmount = 0

  for (const code of DIVISION_CODES) {
    const amount = divisions[code] || 0
    if (amount > topAmount) {
      topAmount = amount
      topCode = code
    }
  }

  return {
    code: topCode,
    name: COFOG_DIVISION_NAMES[topCode],
    amount: topAmount,
  }
}

function computeYearTotals(entries) {
  const totals = {
    total: 0,
    divisions: Object.fromEntries(DIVISION_CODES.map((code) => [code, 0])),
  }

  for (const entry of entries) {
    totals.total += entry.total
    for (const code of DIVISION_CODES) {
      totals.divisions[code] += entry.divisions[code] || 0
    }
  }

  return {
    total: Number(totals.total.toFixed(3)),
    divisions: Object.fromEntries(
      DIVISION_CODES.map((code) => [code, Number(totals.divisions[code].toFixed(3))]),
    ),
  }
}

export function detectYearLinks(html) {
  const matches = Array.from(
    html.matchAll(/href="([^"]*cofog_a_detalle_ccaa_(\d{4})\.xlsx[^"]*)"/gi),
  )

  const byYear = new Map()
  for (const [, rawHref, yearStr] of matches) {
    const year = Number.parseInt(yearStr, 10)
    if (!Number.isInteger(year)) continue
    byYear.set(year, new URL(rawHref, IGAE_CCAA_BASE_URL).href)
  }

  return [...byYear.entries()]
    .map(([year, url]) => ({ year, url }))
    .sort((a, b) => a.year - b.year)
}

function findHeaderRow(rows) {
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const row = rows[i] || []
    const rowText = normalizeText(row.join(' '))
    if (
      rowText.includes('gasto total') ||
      (rowText.includes('01.') &&
        rowText.includes('02.') &&
        rowText.includes('03.') &&
        rowText.includes('04.') &&
        rowText.includes('05.') &&
        rowText.includes('06.') &&
        rowText.includes('07.') &&
        rowText.includes('08.') &&
        rowText.includes('09.') &&
        rowText.includes('10.'))
    ) {
      return i
    }
  }
  return -1
}

function findGastoTotalRow(rows, headerRowIndex) {
  for (let i = Math.max(headerRowIndex, 0); i < rows.length; i++) {
    const row = rows[i] || []
    const rowText = normalizeText(row.join(' '))
    if (!rowText.includes('gasto total')) continue
    return i
  }
  return -1
}

function detectDivisionColumns(headerRow) {
  const divisionCols = {}
  let totalCol = -1

  for (let col = 0; col < headerRow.length; col++) {
    const value = normalizeText(headerRow[col])
    if (!value) continue

    const divisionMatch = value.match(/\b(0[1-9]|10)\./)
    if (divisionMatch) {
      divisionCols[divisionMatch[1]] = col
      continue
    }

    if (totalCol < 0 && value === 'total') {
      totalCol = col
    }
  }

  const missingDivisions = DIVISION_CODES.filter((code) => divisionCols[code] == null)
  if (missingDivisions.length > 0) {
    throw new Error(`No se detectaron columnas COFOG: ${missingDivisions.join(', ')}`)
  }

  if (totalCol < 0) {
    const maxDivCol = Math.max(...Object.values(divisionCols))
    totalCol = maxDivCol + 1
  }

  return { divisionCols, totalCol }
}

export function parseCcaaSheet(sheetName, workbookSheet) {
  const rows = XLSX.utils.sheet_to_json(workbookSheet, { header: 1, defval: '' })
  if (rows.length < 9) return null

  const rawName = String(rows[0]?.[0] ?? '').trim()
  const mapped = CCAA_NAME_MAP[normalizeText(rawName)]
  if (!mapped) {
    console.warn(`    ⚠️ ${sheetName}: comunidad no mapeada (${rawName || 'vacía'})`)
    return null
  }

  const headerRowIndex = findHeaderRow(rows)
  if (headerRowIndex < 0) {
    throw new Error(`${sheetName}: no se encontró cabecera COFOG`)
  }

  const headerRow = rows[headerRowIndex] || []
  const gastoTotalRowIndex = findGastoTotalRow(rows, headerRowIndex)
  if (gastoTotalRowIndex < 0) {
    throw new Error(`${sheetName}: no se encontró fila GASTO TOTAL`)
  }

  const gastoRow = rows[gastoTotalRowIndex] || []
  const { divisionCols, totalCol } = detectDivisionColumns(headerRow)

  const divisions = Object.fromEntries(
    DIVISION_CODES.map((code) => [code, Number(toNumber(gastoRow[divisionCols[code]]).toFixed(3))]),
  )

  let total = Number(toNumber(gastoRow[totalCol]).toFixed(3))
  if (!(total > 0)) {
    total = Number(
      DIVISION_CODES.reduce((acc, code) => acc + (divisions[code] || 0), 0).toFixed(3),
    )
  }

  const topDivision = getTopDivision(divisions)
  const topDivisionPct = total > 0 ? Number(((topDivision.amount / total) * 100).toFixed(2)) : 0

  return {
    code: mapped.code,
    name: mapped.name,
    total,
    divisions,
    topDivisionCode: topDivision.code,
    topDivisionName: topDivision.name,
    topDivisionAmount: Number(topDivision.amount.toFixed(3)),
    topDivisionPct,
  }
}

export function parseYearWorkbook(year, workbook) {
  const sheetNames = workbook.SheetNames.filter(
    (name) => /^tabla\d+a$/i.test(name) && normalizeText(name) !== 'tabla1a',
  )

  const entries = []
  for (const sheetName of sheetNames) {
    const workbookSheet = workbook.Sheets[sheetName]
    if (!workbookSheet) continue
    try {
      const parsed = parseCcaaSheet(sheetName, workbookSheet)
      if (parsed) entries.push(parsed)
    } catch (error) {
      console.warn(`    ⚠️ ${year}/${sheetName}: ${error.message}`)
    }
  }

  if (entries.length === 0) {
    throw new Error(`Año ${year}: no se encontraron hojas CCAA válidas`)
  }

  entries.sort((a, b) => a.code.localeCompare(b.code))

  return {
    entries,
    totals: computeYearTotals(entries),
  }
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

function buildYearUrl(year) {
  return `${IGAE_CCAA_DOC_BASE}${year}.xlsx`
}

async function downloadAvailableYears() {
  const byYear = {}
  const currentYear = new Date().getUTCFullYear()
  let hits = 0
  let misses = 0

  for (let year = currentYear; year >= IGAE_CCAA_MIN_YEAR; year--) {
    const url = buildYearUrl(year)
    try {
      const workbook = await downloadWorkbook(year, url)
      byYear[String(year)] = parseYearWorkbook(year, workbook)
      console.log(`    ${year}: ${byYear[String(year)].entries.length} CCAA procesadas`)
      hits += 1
      misses = 0
    } catch (error) {
      misses += 1

      if (hits === 0 && year >= currentYear - 2) {
        console.warn(`    ⚠️ ${year}: ${error.message}`)
      }

      if (hits === 0 && misses >= IGAE_CCAA_MAX_INITIAL_MISSES) break
      if (hits > 0 && misses >= IGAE_CCAA_MAX_TRAILING_MISSES) break
    }
  }

  return byYear
}

function buildFallbackDataset() {
  const entries = FALLBACK_2024_ENTRIES.map((entry) => {
    const topDivision = getTopDivision(entry.divisions)
    return {
      ...entry,
      topDivisionCode: topDivision.code,
      topDivisionName: topDivision.name,
      topDivisionAmount: topDivision.amount,
      topDivisionPct: entry.total > 0 ? Number(((topDivision.amount / entry.total) * 100).toFixed(2)) : 0,
    }
  })

  return {
    lastUpdated: new Date().toISOString(),
    years: [2024],
    latestYear: 2024,
    byYear: {
      '2024': {
        entries,
        totals: computeYearTotals(entries),
      },
    },
    sourceAttribution: {
      spending: {
        source: 'IGAE — COFOG detalle CCAA (referencia 2024)',
        type: 'fallback',
        url: buildYearUrl(2024),
        date: '2024-12-31',
        note: 'Fallback local al no poder descargar XLS oficiales en este entorno',
      },
    },
  }
}

export async function downloadCcaaSpendingData() {
  console.log('\n=== Descargando gasto CCAA (IGAE COFOG detalle) ===')
  console.log(`  Patrón URL: ${IGAE_CCAA_DOC_BASE}{YYYY}.xlsx`)

  try {
    const byYear = await downloadAvailableYears()

    const years = Object.keys(byYear)
      .map((value) => Number.parseInt(value, 10))
      .filter(Number.isInteger)
      .sort((a, b) => a - b)

    if (years.length === 0) {
      throw new Error('No se pudo procesar ningún año de gasto CCAA')
    }

    const latestYear = years[years.length - 1]

    return {
      lastUpdated: new Date().toISOString(),
      years,
      latestYear,
      byYear,
      sourceAttribution: {
        spending: {
          source: `IGAE — COFOG Administración regional (${years[0]}-${latestYear})`,
          type: 'xlsx',
          url: buildYearUrl(latestYear),
          date: `${latestYear}-12-31`,
          note:
            'Detalle funcional COFOG por CCAA (subsector Administración regional), millones de euros.',
        },
      },
    }
  } catch (error) {
    console.warn(`  ⚠️ Error en descarga de gasto CCAA: ${error.message}`)
    console.warn('  ⚠️ Usando fallback local 2024')
    return buildFallbackDataset()
  }
}
