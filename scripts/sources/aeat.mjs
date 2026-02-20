import XLSX from 'xlsx'
import { fetchWithRetry } from '../lib/fetch-utils.mjs'

const AEAT_SERIES_URL =
  'https://sede.agenciatributaria.gob.es/static_files/Sede/Tema/Estadisticas/Recaudacion_Tributaria/Informes_mensuales/Cuadros_estadisticos_series_es_es.xlsx'
const AEAT_DELEGACIONES_URL =
  'https://sede.agenciatributaria.gob.es/static_files/Sede/Tema/Estadisticas/Recaudacion_Tributaria/Informes_mensuales/Ingresos_por_Delegaciones.xlsx'

// Column indices (0-indexed) in the "Ingresos tributarios" sheet.
// Row format: [year, month, monthName, ...211 data columns]
// These indices are into the full row (col 0 = year, col 1 = month, col 2 = monthName).
const COL = {
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
  { match: 'i.sociedades ingresos netos', key: 'sociedades' },
  { match: 'ii.ee. ingresos netos', key: 'iiee' },
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
 * Thousands → millions
 */
function thousandsToMillions(val) {
  return Math.round(toNum(val) / 1000)
}

/**
 * Find which concept key matches a concept cell string.
 */
function matchConcept(conceptCell) {
  const lower = String(conceptCell || '').toLowerCase()
  for (const { match, key } of CONCEPT_MAP) {
    if (lower.includes(match.toLowerCase())) return key
  }
  return null
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
      for (const key of Object.keys(COL)) {
        yearAccum[yearStr].sums[key] = 0
      }
    }

    yearAccum[yearStr].months.add(month)
    for (const [key, colIdx] of Object.entries(COL)) {
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
