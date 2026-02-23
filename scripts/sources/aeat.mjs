import XLSX from 'xlsx'
import { fetchWithRetry } from '../lib/fetch-utils.mjs'

const AEAT_SERIES_URL =
  'https://sede.agenciatributaria.gob.es/static_files/Sede/Tema/Estadisticas/Recaudacion_Tributaria/Informes_mensuales/Cuadros_estadisticos_series_es_es.xlsx'
const AEAT_DELEGACIONES_URL =
  'https://sede.agenciatributaria.gob.es/static_files/Sede/Tema/Estadisticas/Recaudacion_Tributaria/Informes_mensuales/Ingresos_por_Delegaciones.xlsx'

// Legacy column indices (0-indexed) in the "Ingresos tributarios" sheet.
// Used as fallback when header-based detection cannot be resolved safely.
const LEGACY_COL = {
  total: 6,
  irpf: 29,
  sociedades: 65,
  irnr: 82,
  iva: 107,
  iieeTotal: 137,
  resto: 178,
  // IIEE sub-columns
  iieeAlcohol: 142,
  iieeCerveza: 147,
  iieeProductosIntermedios: 152,
  iieeHidrocarburos: 157,
  iieeTabaco: 162,
  iieeElectricidad: 168,
  iieeEnvasesPlastico: 173,
  iieeCarbon: 174,
  iieeMediosTransporte: 175,
  // Resto sub-columns
  restoMedioambientales: 180,
  restoTraficoExterior: 183,
  restoPrimasSeguros: 184,
  restoTransaccionesFinancieras: 185,
  restoServiciosDigitales: 186,
  restoJuego: 187,
  restoTasas: 188,
}

const NATIONAL_COLUMN_RULES = {
  total: {
    patterns: [/\btotal\b.*\b(ingres|recaud)/, /\b(ingres|recaud).*\btotal\b/],
    exclude: /\b(irpf|iva|sociedades?|irnr|ii ee|impuestos especiales|resto)\b/,
    reference: LEGACY_COL.total,
  },
  irpf: {
    patterns: [/\birpf\b/, /\bpersonas?\s+fisicas\b/, /\brenta\b.*\bpersonas?\b/],
    reference: LEGACY_COL.irpf,
  },
  sociedades: { patterns: [/\bsociedad(?:es)?\b/], reference: LEGACY_COL.sociedades },
  irnr: { patterns: [/\birnr\b/, /\bno\s+residentes?\b/], reference: LEGACY_COL.irnr },
  iva: { patterns: [/\biva\b/, /\bvalor\s+anadido\b/], reference: LEGACY_COL.iva },
  iieeTotal: {
    patterns: [
      /\b(ii ee|impuestos especiales)\b.*\b(total|ingres|recaud)\b/,
      /\btotal\b.*\b(ii ee|impuestos especiales)\b/,
    ],
    reference: LEGACY_COL.iieeTotal,
  },
  resto: {
    patterns: [/\bresto\b.*\b(ingres|recaud|net)\b/, /\bresto\b/],
    exclude:
      /\b(medioambient|ambiental|trafico|exterior|seguros|transacciones|digitales?|juego|tasas?)\b/,
    reference: LEGACY_COL.resto,
  },
  iieeAlcohol: { patterns: [/\balcohol\b/], reference: LEGACY_COL.iieeAlcohol },
  iieeCerveza: { patterns: [/\bcerveza\b/], reference: LEGACY_COL.iieeCerveza },
  iieeProductosIntermedios: {
    patterns: [/\bproductos?\s+intermedios?\b/],
    reference: LEGACY_COL.iieeProductosIntermedios,
  },
  iieeHidrocarburos: {
    patterns: [/\bhidrocarbur/],
    reference: LEGACY_COL.iieeHidrocarburos,
  },
  iieeTabaco: { patterns: [/\b(tabaco|labores?)\b/], reference: LEGACY_COL.iieeTabaco },
  iieeElectricidad: {
    patterns: [/\belectricidad\b/],
    reference: LEGACY_COL.iieeElectricidad,
  },
  iieeEnvasesPlastico: {
    patterns: [/\benvases?\b.*\bplastic/, /\bplastic\b.*\benvases?\b/],
    reference: LEGACY_COL.iieeEnvasesPlastico,
  },
  iieeCarbon: { patterns: [/\bcarbon\b/], reference: LEGACY_COL.iieeCarbon },
  iieeMediosTransporte: {
    patterns: [/\bmedios?\b.*\btransporte\b/, /\bdeterminados?\b.*\btransporte\b/],
    reference: LEGACY_COL.iieeMediosTransporte,
  },
  restoMedioambientales: {
    patterns: [/\bmedioambient/, /\bambientales?\b/],
    reference: LEGACY_COL.restoMedioambientales,
  },
  restoTraficoExterior: {
    patterns: [/\btrafico\b.*\bexterior\b/, /\bcomercio\b.*\bexterior\b/, /\baduan/],
    reference: LEGACY_COL.restoTraficoExterior,
  },
  restoPrimasSeguros: {
    patterns: [/\bprimas?\b.*\bseguros?\b/, /\bseguros?\b.*\bprimas?\b/],
    reference: LEGACY_COL.restoPrimasSeguros,
  },
  restoTransaccionesFinancieras: {
    patterns: [/\btransacciones?\b.*\bfinancieras?\b/, /\bitf\b/],
    reference: LEGACY_COL.restoTransaccionesFinancieras,
  },
  restoServiciosDigitales: {
    patterns: [/\bservicios?\b.*\bdigitales?\b/, /\bisd\b/],
    reference: LEGACY_COL.restoServiciosDigitales,
  },
  restoJuego: { patterns: [/\bjuego\b/], reference: LEGACY_COL.restoJuego },
  restoTasas: { patterns: [/\btasas?\b/], reference: LEGACY_COL.restoTasas },
}

const CCAA_MAP = {
  Andaluc: { code: 'CA01', name: 'Andalucía' },
  'Aragón': { code: 'CA02', name: 'Aragón' },
  Asturias: { code: 'CA03', name: 'Asturias' },
  Baleares: { code: 'CA04', name: 'Illes Balears' },
  Canarias: { code: 'CA05', name: 'Canarias' },
  Cantabria: { code: 'CA06', name: 'Cantabria' },
  'Castilla y León': { code: 'CA07', name: 'Castilla y León' },
  'Castilla-La Mancha': { code: 'CA08', name: 'Castilla-La Mancha' },
  'Cataluña': { code: 'CA09', name: 'Cataluña' },
  Extremadura: { code: 'CA11', name: 'Extremadura' },
  Galicia: { code: 'CA12', name: 'Galicia' },
  Madrid: { code: 'CA13', name: 'Madrid' },
  Murcia: { code: 'CA14', name: 'Murcia' },
  Navarra: { code: 'CA15', name: 'Navarra' },
  'País Vasco': { code: 'CA16', name: 'País Vasco' },
  Rioja: { code: 'CA17', name: 'La Rioja' },
  Valencia: { code: 'CA10', name: 'C. Valenciana' },
}

// Concept name substrings (case-insensitive) → field key
// Actual values in Excel: "Total Ingresos netos", "IRPF Ingresos netos",
// "IVA Ingresos netos", "I.SOCIEDADES Ingresos netos", "II.EE. Ingresos netos",
// "IRNR Ingresos netos"
const CONCEPT_MAP = [
  { match: 'total ingresos netos', key: 'total' },
  { match: 'irpf ingresos netos', key: 'irpf' },
  { match: 'iva ingresos netos', key: 'iva' },
  { match: 'i sociedades ingresos netos', key: 'sociedades' },
  { match: 'ii ee ingresos netos', key: 'iiee' },
  { match: 'irnr ingresos netos', key: 'irnr' },
]

// ─────────────────────────────────────────────
// Fallback / reference data (2024)
// ─────────────────────────────────────────────

const REFERENCE_NATIONAL = {
  '2024': {
    total: 295028,
    irpf: 129538,
    iva: 90631,
    sociedades: 39136,
    irnr: 4039,
    iiee: 22150,
    resto: 9535,
    iieeBreakdown: {
      alcohol: 371,
      cerveza: 464,
      productosIntermedios: 24,
      hidrocarburos: 10283,
      tabaco: 6765,
      electricidad: 1529,
      envasesPlastico: 393,
      carbon: 0,
      mediosTransporte: 2321,
    },
    restoBreakdown: {
      medioambientales: 2103,
      traficoExterior: 2053,
      primasSeguros: 1853,
      transaccionesFinancieras: 0,
      serviciosDigitales: 33,
      juego: 115,
      tasas: 3378,
    },
  },
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/**
 * Safely convert a cell value to a number.
 * AEAT series values are in thousands of euros; conversion to millions happens at call site.
 */
function toNum(val) {
  if (val === null || val === undefined || val === '') return 0
  if (typeof val === 'number') return val
  const cleaned = String(val).trim().replace(/\./g, '').replace(/,/g, '.')
  const n = parseFloat(cleaned)
  return isNaN(n) ? 0 : n
}

/**
 * Normalize cell text to robustly compare labels with accents/punctuation differences.
 */
function normalizeCellText(val) {
  return String(val ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Thousands → millions
 */
function thousandsToMillions(val) {
  return Math.round(toNum(val) / 1000)
}

/**
 * Find which concept key matches a concept cell string.
 */
function matchConcept(conceptCell) {
  const lower = normalizeCellText(conceptCell)
  for (const { match, key } of CONCEPT_MAP) {
    if (lower.includes(match)) return key
  }
  return null
}

function isNationalDataRow(row) {
  if (!Array.isArray(row)) return false
  const yearRaw = row[0]
  const yearVal = typeof yearRaw === 'number' ? yearRaw : parseInt(String(yearRaw), 10)
  if (!Number.isInteger(yearVal) || yearVal < 1990 || yearVal > 2100) return false
  const month = toNum(row[1])
  return month >= 1 && month <= 12
}

function findFirstNationalDataRow(rows) {
  for (let i = 0; i < rows.length; i++) {
    if (isNationalDataRow(rows[i])) return i
  }
  return -1
}

function buildNationalColumnLabels(rows, firstDataRowIdx) {
  const headerRows = rows.slice(0, Math.max(firstDataRowIdx, 0))
  const maxCols = rows.reduce((max, row) => Math.max(max, Array.isArray(row) ? row.length : 0), 0)
  const expandedRows = headerRows.map((row) => expandHeaderRow(row, maxCols))
  const labels = Array.from({ length: maxCols }, () => '')

  for (let col = 0; col < maxCols; col++) {
    const parts = []
    for (const row of expandedRows) {
      const normalized = normalizeCellText(row?.[col])
      if (!normalized) continue
      if (parts.at(-1) === normalized) continue
      parts.push(normalized)
    }
    labels[col] = parts.join(' ')
  }

  return labels
}

/**
 * Expand sparse header rows to account for merged cells in Excel exports.
 * This propagates the last non-empty token to the right on sparse rows only.
 */
function expandHeaderRow(row, maxCols) {
  const normalized = Array.from({ length: maxCols }, (_, col) => normalizeCellText(row?.[col]))
  const nonEmptyCount = normalized.filter(Boolean).length
  const density = maxCols > 0 ? nonEmptyCount / maxCols : 0

  if (density > 0.45) return normalized

  const expanded = [...normalized]
  let current = ''
  for (let col = 0; col < expanded.length; col++) {
    if (expanded[col]) {
      current = expanded[col]
      continue
    }
    if (current) expanded[col] = current
  }

  return expanded
}

function detectNationalColumns(rows) {
  const firstDataRowIdx = findFirstNationalDataRow(rows)
  if (firstDataRowIdx <= 0) return null

  const labels = buildNationalColumnLabels(rows, firstDataRowIdx)
  const labeledCols = labels.filter(Boolean).length
  if (labeledCols < 6) return null

  const mapping = {}
  const usedCols = new Set()
  const missing = []

  for (const [key, rule] of Object.entries(NATIONAL_COLUMN_RULES)) {
    const matches = []
    for (let col = 0; col < labels.length; col++) {
      if (usedCols.has(col)) continue
      const label = labels[col]
      if (!label) continue
      if (rule.exclude?.test(label)) continue
      if (!rule.patterns.some((pattern) => pattern.test(label))) continue
      matches.push(col)
    }

    if (matches.length === 0) {
      missing.push(key)
      continue
    }

    matches.sort((a, b) => {
      const distance = Math.abs(a - rule.reference) - Math.abs(b - rule.reference)
      return distance !== 0 ? distance : a - b
    })

    const selected = matches[0]
    mapping[key] = selected
    usedCols.add(selected)
  }

  if (missing.length > 0) {
    console.warn(`    ⚠️  AEAT series: faltan columnas por cabecera (${missing.join(', ')})`)
    return null
  }

  return mapping
}

// ─────────────────────────────────────────────
// National (Series) parser
// ─────────────────────────────────────────────

/**
 * Parse the "Ingresos tributarios" sheet and aggregate monthly rows to annual.
 * Returns { national, years } or throws.
 */
function parseNationalSheet(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })
  const detectedCols = detectNationalColumns(rows)
  const cols = detectedCols || LEGACY_COL
  const keys = Object.keys(LEGACY_COL)

  if (detectedCols) {
    const shiftedKeys = keys.filter((key) => detectedCols[key] !== LEGACY_COL[key])
    if (shiftedKeys.length > 0) {
      console.log(
        `    ℹ️  AEAT series: detección dinámica aplicada (${shiftedKeys.length} columnas difieren de índices legacy)`,
      )
    } else {
      console.log('    ℹ️  AEAT series: cabeceras detectadas y alineadas con índices esperados')
    }
  } else {
    console.warn('    ⚠️  AEAT series: usando índices legacy por falta de cabeceras detectables')
  }

  // Accumulate per-year monthly data
  const yearAccum = {}

  for (const row of rows) {
    const yearRaw = row[0]
    const yearVal = typeof yearRaw === 'number' ? yearRaw : parseInt(String(yearRaw), 10)
    if (!Number.isInteger(yearVal) || yearVal < 1990 || yearVal > 2100) {
      continue // skip header / non-data rows
    }
    const yearStr = String(yearVal)
    const month = toNum(row[1])
    if (month < 1 || month > 12) continue

    if (!yearAccum[yearStr]) {
      yearAccum[yearStr] = { months: new Set(), sums: {} }
      for (const key of keys) {
        yearAccum[yearStr].sums[key] = 0
      }
    }

    yearAccum[yearStr].months.add(month)
    for (const [key, colIdx] of Object.entries(cols)) {
      yearAccum[yearStr].sums[key] += toNum(row[colIdx])
    }
  }

  // Only keep complete years (all 12 months present)
  const national = {}
  const years = []

  for (const [yearStr, accum] of Object.entries(yearAccum)) {
    if (accum.months.size < 12) {
      console.log(`    Año ${yearStr}: solo ${accum.months.size} meses — omitido (incompleto)`)
      continue
    }

    const s = accum.sums
    const entry = {
      total: thousandsToMillions(s.total),
      irpf: thousandsToMillions(s.irpf),
      iva: thousandsToMillions(s.iva),
      sociedades: thousandsToMillions(s.sociedades),
      irnr: thousandsToMillions(s.irnr),
      iiee: thousandsToMillions(s.iieeTotal),
      resto: thousandsToMillions(s.resto),
      iieeBreakdown: {
        alcohol: thousandsToMillions(s.iieeAlcohol),
        cerveza: thousandsToMillions(s.iieeCerveza),
        productosIntermedios: thousandsToMillions(s.iieeProductosIntermedios),
        hidrocarburos: thousandsToMillions(s.iieeHidrocarburos),
        tabaco: thousandsToMillions(s.iieeTabaco),
        electricidad: thousandsToMillions(s.iieeElectricidad),
        envasesPlastico: thousandsToMillions(s.iieeEnvasesPlastico),
        carbon: thousandsToMillions(s.iieeCarbon),
        mediosTransporte: thousandsToMillions(s.iieeMediosTransporte),
      },
      restoBreakdown: {
        medioambientales: thousandsToMillions(s.restoMedioambientales),
        traficoExterior: thousandsToMillions(s.restoTraficoExterior),
        primasSeguros: thousandsToMillions(s.restoPrimasSeguros),
        transaccionesFinancieras: thousandsToMillions(s.restoTransaccionesFinancieras),
        serviciosDigitales: thousandsToMillions(s.restoServiciosDigitales),
        juego: thousandsToMillions(s.restoJuego),
        tasas: thousandsToMillions(s.restoTasas),
      },
    }

    // Validation: total ≈ irpf + iva + sociedades + irnr + iiee + resto (1% tolerance)
    const componentSum = entry.irpf + entry.iva + entry.sociedades + entry.irnr + entry.iiee + entry.resto
    const diff = Math.abs(componentSum - entry.total)
    const tolerance = entry.total * 0.01
    if (diff > tolerance) {
      console.warn(
        `    ⚠️  [${yearStr}] Validación: suma componentes (${componentSum.toLocaleString('es-ES')}) ≠ total (${entry.total.toLocaleString('es-ES')}) — diferencia ${diff.toLocaleString('es-ES')} M€`,
      )
    }

    national[yearStr] = entry
    years.push(parseInt(yearStr))
  }

  years.sort((a, b) => a - b)
  return { national, years }
}

// ─────────────────────────────────────────────
// CCAA (Delegaciones) parser
// ─────────────────────────────────────────────

/**
 * Map header cells to CCAA info. Returns array indexed by column index.
 */
function buildCcaaColMap(headerRow) {
  const colMap = {} // colIdx → { code, name }
  for (let col = 0; col < headerRow.length; col++) {
    const cell = String(headerRow[col] || '').trim()
    // Only match "D.E." (Delegación Especial) columns — these are CCAA-level aggregates.
    // Individual province columns (Almería, Cádiz, etc.) don't have the "D.E." prefix.
    if (!cell.startsWith('D.E.')) continue
    for (const [substr, info] of Object.entries(CCAA_MAP)) {
      if (cell.includes(substr)) {
        colMap[col] = info
        break
      }
    }
  }
  return colMap
}

/**
 * Parse the delegaciones sheet and aggregate to annual per-CCAA per-concept.
 * Returns { ccaa } or throws.
 */
function parseDelegacionesSheet(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })
  if (rows.length < 2) throw new Error('Hoja de delegaciones vacía o demasiado pequeña')

  // Find header row: look for a row containing "Ejercicio" or "Mes"
  let headerRowIdx = 0
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const rowStr = rows[i].map(c => String(c || '')).join('|').toLowerCase()
    if (rowStr.includes('ejercicio') || rowStr.includes('delegac')) {
      headerRowIdx = i
      break
    }
  }

  const headerRow = rows[headerRowIdx]
  const ccaaColMap = buildCcaaColMap(headerRow)

  if (Object.keys(ccaaColMap).length === 0) {
    throw new Error('No se encontraron columnas de CCAA en el header')
  }

  console.log(`    CCAA detectadas: ${Object.keys(ccaaColMap).length} columnas`)

  // Identify column positions for Ejercicio, Mes, Concepto
  let colEjercicio = -1, colMes = -1, colConcepto = -1
  for (let col = 0; col < headerRow.length; col++) {
    const cell = String(headerRow[col] || '').trim().toLowerCase()
    if (cell === 'ejercicio' || cell === 'año') colEjercicio = col
    else if (cell === 'mes') colMes = col
    else if (cell === 'concepto') colConcepto = col
  }

  if (colEjercicio === -1) colEjercicio = 0
  if (colMes === -1) colMes = 1
  if (colConcepto === -1) colConcepto = 2

  // yearAccum[yearStr][caCode][conceptKey] = { months: Set, sum: number }
  const yearAccum = {}

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.length === 0) continue

    const yearRaw = row[colEjercicio]
    const yearVal = typeof yearRaw === 'number' ? yearRaw : parseInt(String(yearRaw), 10)
    if (!Number.isInteger(yearVal) || yearVal < 1990 || yearVal > 2100) continue

    const yearStr = String(yearVal)
    const month = toNum(row[colMes])
    if (month < 1 || month > 12) continue

    const conceptKey = matchConcept(row[colConcepto])
    if (!conceptKey) continue

    if (!yearAccum[yearStr]) yearAccum[yearStr] = {}

    for (const [colIdx, caInfo] of Object.entries(ccaaColMap)) {
      const caCode = caInfo.code
      if (!yearAccum[yearStr][caCode]) {
        yearAccum[yearStr][caCode] = { info: caInfo, concepts: {} }
      }
      if (!yearAccum[yearStr][caCode].concepts[conceptKey]) {
        yearAccum[yearStr][caCode].concepts[conceptKey] = { months: new Set(), sum: 0 }
      }
      yearAccum[yearStr][caCode].concepts[conceptKey].months.add(month)
      yearAccum[yearStr][caCode].concepts[conceptKey].sum += toNum(row[parseInt(colIdx)])
    }
  }

  // Build ccaa output — only complete years
  const ccaa = {}

  for (const [yearStr, caAccum] of Object.entries(yearAccum)) {
    // Check completeness: require 'total' concept to have 12 months for at least
    // some CCAA. Skip individual CCAA that are incomplete.
    const entries = []
    for (const [caCode, caData] of Object.entries(caAccum)) {
      const totalConcept = caData.concepts.total
      if (!totalConcept || totalConcept.months.size < 12) {
        continue // skip this CCAA for this year (incomplete)
      }

      const concepts = caData.concepts
      const entry = {
        code: caCode,
        name: caData.info.name,
        total: thousandsToMillions(concepts.total?.sum ?? 0),
        irpf: thousandsToMillions(concepts.irpf?.sum ?? 0),
        iva: thousandsToMillions(concepts.iva?.sum ?? 0),
        sociedades: thousandsToMillions(concepts.sociedades?.sum ?? 0),
        iiee: thousandsToMillions(concepts.iiee?.sum ?? 0),
        irnr: thousandsToMillions(concepts.irnr?.sum ?? 0),
      }
      entries.push(entry)
    }

    if (entries.length === 0) {
      console.log(`    CCAA año ${yearStr}: sin datos completos — omitido`)
      continue
    }

    // Sort by CA code for deterministic output
    entries.sort((a, b) => a.code.localeCompare(b.code))
    ccaa[yearStr] = { entries }
    console.log(`    CCAA año ${yearStr}: ${entries.length} comunidades`)
  }

  return { ccaa }
}

// ─────────────────────────────────────────────
// Fetch helpers
// ─────────────────────────────────────────────

async function fetchNationalData() {
  console.log('  1. Descargando series nacionales (AEAT)...')
  console.log(`    URL: ${AEAT_SERIES_URL}`)

  const response = await fetchWithRetry(
    AEAT_SERIES_URL,
    { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DashboardFiscal/1.0)' } },
  )

  const buffer = await response.arrayBuffer()
  console.log(`    Descargado: ${(buffer.byteLength / 1024).toFixed(1)} KB`)

  console.log('  2. Parseando hoja "Ingresos tributarios"...')
  const wb = XLSX.read(Buffer.from(buffer), { type: 'buffer' })
  console.log(`    Hojas disponibles: ${wb.SheetNames.join(', ')}`)

  const sheetName = wb.SheetNames.find(n => n.includes('Ingresos tributarios')) ?? wb.SheetNames[0]
  console.log(`    Usando hoja: "${sheetName}"`)

  const ws = wb.Sheets[sheetName]
  if (!ws) throw new Error(`Hoja "${sheetName}" no encontrada`)

  const result = parseNationalSheet(ws)
  console.log(`    Años procesados: ${result.years.length}`)
  return result
}

async function fetchCcaaData() {
  console.log('  3. Descargando datos por delegaciones (CCAA)...')
  console.log(`    URL: ${AEAT_DELEGACIONES_URL}`)

  const response = await fetchWithRetry(
    AEAT_DELEGACIONES_URL,
    { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DashboardFiscal/1.0)' } },
    { maxRetries: 2, timeoutMs: 60000 },
  )

  const buffer = await response.arrayBuffer()
  console.log(`    Descargado: ${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB`)

  console.log('  4. Parseando hoja de delegaciones...')
  const wb = XLSX.read(Buffer.from(buffer), { type: 'buffer' })
  console.log(`    Hojas disponibles: ${wb.SheetNames.join(', ')}`)

  const sheetName =
    wb.SheetNames.find(n => n.toLowerCase().includes('datos_delegaciones')) ??
    wb.SheetNames.find(n => n.toLowerCase().includes('delegac')) ??
    wb.SheetNames[0]
  console.log(`    Usando hoja: "${sheetName}"`)

  const ws = wb.Sheets[sheetName]
  if (!ws) throw new Error(`Hoja de delegaciones no encontrada`)

  const result = parseDelegacionesSheet(ws)
  const ccaaYears = Object.keys(result.ccaa).sort()
  console.log(`    Años CCAA procesados: ${ccaaYears.length}`)
  return result
}

// ─────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────

/**
 * Download AEAT tax revenue data and produce the tax-revenue.json payload.
 *
 * @returns {Promise<Object>} TaxRevenueData object
 */
export async function downloadTaxRevenueData() {
  console.log('\n=== Descargando datos de recaudación tributaria (AEAT) ===')
  console.log()
  console.log('  Fuente: Agencia Estatal de Administración Tributaria (AEAT)')
  console.log()

  let national = null
  let years = []
  let ccaa = {}

  // --- National data ---
  try {
    const result = await fetchNationalData()
    national = result.national
    years = result.years

    const latestYear = String(years[years.length - 1])
    const latest = national[latestYear]
    console.log()
    console.log(`  Resumen ${latestYear} (recaudacion neta, M€):`)
    console.log(`    Total:      ${latest.total.toLocaleString('es-ES')}`)
    console.log(`    IRPF:       ${latest.irpf.toLocaleString('es-ES')}`)
    console.log(`    IVA:        ${latest.iva.toLocaleString('es-ES')}`)
    console.log(`    Sociedades: ${latest.sociedades.toLocaleString('es-ES')}`)
    console.log(`    IRNR:       ${latest.irnr.toLocaleString('es-ES')}`)
    console.log(`    IIEE:       ${latest.iiee.toLocaleString('es-ES')}`)
    console.log(`    Resto:      ${latest.resto.toLocaleString('es-ES')}`)
    console.log()
  } catch (error) {
    console.log(`  Error descargando datos nacionales: ${error.message}`)
    console.log('  Usando datos de referencia nacionales.')
    national = REFERENCE_NATIONAL
    years = Object.keys(REFERENCE_NATIONAL).map(Number).sort()
  }

  // --- CCAA data ---
  try {
    const result = await fetchCcaaData()
    ccaa = result.ccaa
    console.log()
  } catch (error) {
    console.log(`  Error descargando datos CCAA: ${error.message}`)
    console.log('  Continuando sin datos de CCAA.')
    ccaa = {}
  }

  const latestYear = years[years.length - 1]
  const isFallbackNational = national === REFERENCE_NATIONAL

  const result = {
    lastUpdated: new Date().toISOString(),
    years,
    latestYear,
    national,
    ccaa,
    sourceAttribution: {
      series: {
        source: isFallbackNational
          ? 'Referencia AEAT — Informe mensual de Recaudación Tributaria 2024'
          : `AEAT — Informe mensual de Recaudación Tributaria (${years[0]}-${latestYear})`,
        type: isFallbackNational ? 'fallback' : 'xlsx',
        url: AEAT_SERIES_URL,
        date: `${latestYear}-12-31`,
        note: isFallbackNational
          ? 'Datos de referencia, descarga AEAT no disponible'
          : `Series mensuales agregadas anualmente, miles de euros → millones`,
      },
      delegaciones: {
        source: Object.keys(ccaa).length === 0
          ? 'Sin datos CCAA disponibles'
          : `AEAT — Ingresos por Delegaciones (${Object.keys(ccaa).sort()[0]}-${Object.keys(ccaa).sort().at(-1)})`,
        type: Object.keys(ccaa).length === 0 ? 'fallback' : 'xlsx',
        url: AEAT_DELEGACIONES_URL,
        date: `${latestYear}-12-31`,
        note: Object.keys(ccaa).length === 0
          ? 'Datos CCAA no disponibles'
          : 'Ingresos netos por Delegación Especial, miles de euros → millones',
      },
    },
  }

  console.log(`✅ Recaudación tributaria procesada:`)
  console.log(`   Años nacionales: ${years[0]}-${latestYear} (${years.length} años)`)
  console.log(`   Años CCAA: ${Object.keys(ccaa).length}`)

  return result
}
