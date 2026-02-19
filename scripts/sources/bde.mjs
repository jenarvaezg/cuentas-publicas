import { linearRegression } from '../lib/regression.mjs'
import { fetchWithRetry } from '../lib/fetch-utils.mjs'

const BDE_CSV_BASE = 'https://www.bde.es/webbe/es/estadisticas/compartido/datos/csv'
const BDE_API_BASE = 'https://app.bde.es/bierest/resources/srdatosapp'

/**
 * Download debt data from Banco de España
 * @returns {Promise<Object>} Debt data object
 */
export async function downloadDebtData() {
  console.log('\n=== Descargando datos de deuda (BdE) ===')

  try {
    // Fetch all sources in parallel
    const [be11bData, be1101Data, apiData] = await Promise.allSettled([
      fetchBE11B(),
      fetchBE1101(),
      fetchBDEApi()
    ])

    // Extract data from successful fetches
    const monthlyData = be11bData.status === 'fulfilled' ? be11bData.value : null
    const quarterlyData = be1101Data.status === 'fulfilled' ? be1101Data.value : null
    const latestApi = apiData.status === 'fulfilled' ? apiData.value : null

    // Build result by combining all sources
    const result = buildDebtResult(monthlyData, quarterlyData, latestApi)

    console.log(`✅ Deuda descargada: ${result.current.totalDebt?.toLocaleString('es-ES') || 'N/A'}€`)
    console.log(`   Deuda/PIB: ${result.current.debtToGDP?.toFixed(2) || 'N/A'}%`)
    console.log(`   Puntos históricos: ${result.historical.length}`)

    return result
  } catch (error) {
    console.error('❌ Error descargando datos de deuda:', error.message)
    return buildFallbackDebtData()
  }
}

/**
 * Fetch BE11B CSV - Monthly debt advance
 * BdE CSVs are in transposed format with series as columns
 */
async function fetchBE11B() {
  console.log('  Descargando be11b.csv (avance mensual)...')
  const url = `${BDE_CSV_BASE}/be11b.csv`

  const response = await fetchWithRetry(url)

  const csvText = await response.text()
  const csvSizeKB = (csvText.length / 1024).toFixed(1)
  const csvLines = csvText.split('\n').length

  console.log(`    CSV descargado: ${csvSizeKB} KB, ${csvLines} líneas`)

  // Parse BdE transposed format
  const debtData = parseBdETransposedCSV(csvText, 'monthly')

  console.log(`    Series encontradas: ${debtData.totalDebt.length} puntos`)

  // Log data range
  if (debtData.totalDebt.length > 0) {
    const firstDate = debtData.totalDebt[0].date
    const lastDate = debtData.totalDebt[debtData.totalDebt.length - 1].date
    console.log(`    Rango temporal: ${firstDate} — ${lastDate} (${debtData.totalDebt.length} puntos mensuales)`)

    // Log last 3 data points
    console.log(`    Últimos 3 datos:`)
    const last3 = debtData.totalDebt.slice(-3)
    last3.forEach(point => {
      console.log(`      ${point.date}: ${point.value.toLocaleString('es-ES')} €`)
    })

    // Log subsectors
    if (Object.keys(debtData.debtBySubsector).length > 0) {
      console.log(`    Subsectores (último dato):`)
      if (debtData.debtBySubsector.estado) {
        console.log(`      Estado:  ${debtData.debtBySubsector.estado.toLocaleString('es-ES')} €`)
      }
      if (debtData.debtBySubsector.ccaa) {
        console.log(`      CCAA:    ${debtData.debtBySubsector.ccaa.toLocaleString('es-ES')} €`)
      }
      if (debtData.debtBySubsector.ccll) {
        console.log(`      CCLL:    ${debtData.debtBySubsector.ccll.toLocaleString('es-ES')} €`)
      }
      if (debtData.debtBySubsector.ss) {
        console.log(`      SS:      ${debtData.debtBySubsector.ss.toLocaleString('es-ES')} €`)
      }
    }
  }

  return debtData
}

/**
 * Fetch BE1101 CSV - Quarterly debt + deficit
 */
async function fetchBE1101() {
  console.log('  Descargando be1101.csv (trimestral)...')
  const url = `${BDE_CSV_BASE}/be1101.csv`

  const response = await fetchWithRetry(url)

  const csvText = await response.text()

  // Parse BdE transposed format
  const debtData = parseBdETransposedCSV(csvText, 'quarterly')

  console.log(`    Series encontradas: ${debtData.totalDebt.length} puntos`)

  return debtData
}

/**
 * Fetch BdE REST API - Latest debt
 */
async function fetchBDEApi() {
  console.log('  Descargando API BdE (último valor)...')
  const url = `${BDE_API_BASE}/favoritas?idioma=es&series=DTNPDE2010_P0000P_PS_APU`

  const response = await fetchWithRetry(url)

  const data = await response.json()
  console.log(`    Respuesta API recibida`)

  // Extract latest value from API response
  return extractLatestFromApi(data)
}

/**
 * Parse BdE transposed CSV format
 * Row 1: Series codes
 * Row 4: Series descriptions
 * Row 5: Units
 * Row 7+: Data rows with date in first column
 */
function parseBdETransposedCSV(csvText, type) {
  const result = {
    totalDebt: [],
    debtBySubsector: {},
    debtToGDP: []
  }

  if (!csvText) return result

  const lines = csvText.split('\n').filter(line => line.trim())
  if (lines.length < 8) return result

  // Parse header rows
  const seriesCodes = parseCSVLine(lines[0])
  const descriptions = parseCSVLine(lines[3])
  const units = parseCSVLine(lines[4])

  // Find series indices
  let totalDebtIdx = -1
  let estadoIdx = -1
  let ccaaIdx = -1
  let ccllIdx = -1
  let ssIdx = -1
  let pibIdx = -1

  console.log(`    Columnas encontradas:`)
  for (let i = 1; i < descriptions.length; i++) {
    const desc = descriptions[i].toLowerCase()
    let matched = ''

    if (desc.includes('aapp') && desc.includes('deuda pde') && desc.includes('total') && totalDebtIdx === -1) {
      totalDebtIdx = i
      matched = 'MATCHED: totalDebt'
    } else if (desc.includes('estado') && desc.includes('deuda pde') && desc.includes('total')) {
      estadoIdx = i
      matched = 'MATCHED: estado'
    } else if (desc.includes('ccaa') && desc.includes('deuda pde')) {
      ccaaIdx = i
      matched = 'MATCHED: ccaa'
    } else if (desc.includes('ccll') && desc.includes('deuda pde')) {
      ccllIdx = i
      matched = 'MATCHED: ccll'
    } else if (desc.includes('seguridad social') && desc.includes('deuda')) {
      ssIdx = i
      matched = 'MATCHED: ss'
    } else if (desc.includes('pib') && pibIdx === -1) {
      pibIdx = i
      matched = 'MATCHED: pib'
    }

    // Log first 10 columns to see what we have
    if (i <= 10 || matched) {
      console.log(`      [${i}] "${descriptions[i]}" ${matched ? `(${matched})` : ''}`)
    }
  }

  console.log(`    Índices encontrados - Total:${totalDebtIdx}, Estado:${estadoIdx}, CCAA:${ccaaIdx}, CCLL:${ccllIdx}, SS:${ssIdx}, PIB:${pibIdx}`)

  // Parse data rows (starting from row 7, index 6)
  for (let i = 6; i < lines.length; i++) {
    const row = parseCSVLine(lines[i])
    if (row.length < 2) continue

    const dateStr = row[0].trim()
    const dateObj = parseBdEDate(dateStr)
    if (!dateObj) continue

    const isoDate = dateObj.toISOString().split('T')[0]

    // Extract total debt
    if (totalDebtIdx !== -1) {
      const value = parseSpanishNumberFromString(row[totalDebtIdx])
      if (value > 0) {
        result.totalDebt.push({
          date: isoDate,
          value: value * 1000 // Miles de euros to euros
        })
      }
    }

    // Extract subsectors (use last value)
    if (estadoIdx !== -1) {
      const value = parseSpanishNumberFromString(row[estadoIdx])
      if (value > 0) result.debtBySubsector.estado = value * 1000
    }
    if (ccaaIdx !== -1) {
      const value = parseSpanishNumberFromString(row[ccaaIdx])
      if (value > 0) result.debtBySubsector.ccaa = value * 1000
    }
    if (ccllIdx !== -1) {
      const value = parseSpanishNumberFromString(row[ccllIdx])
      if (value > 0) result.debtBySubsector.ccll = value * 1000
    }
    if (ssIdx !== -1) {
      const value = parseSpanishNumberFromString(row[ssIdx])
      if (value > 0) result.debtBySubsector.ss = value * 1000
    }

    // Calculate debt-to-GDP ratio when both columns are available
    if (totalDebtIdx !== -1 && pibIdx !== -1) {
      const debtValue = parseSpanishNumberFromString(row[totalDebtIdx])
      const pibValue = parseSpanishNumberFromString(row[pibIdx])
      if (debtValue > 0 && pibValue > 0) {
        result.debtToGDP.push({
          date: isoDate,
          value: (debtValue / pibValue) * 100
        })
      }
    }
  }

  return result
}

/**
 * Parse CSV line handling quoted fields
 */
function parseCSVLine(line) {
  const result = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  result.push(current.trim())
  return result
}

/**
 * Parse BdE date format (e.g., "DIC 1994", "ENE 1995")
 */
function parseBdEDate(dateStr) {
  const months = {
    'ENE': 0, 'FEB': 1, 'MAR': 2, 'ABR': 3, 'MAY': 4, 'JUN': 5,
    'JUL': 6, 'AGO': 7, 'SEP': 8, 'OCT': 9, 'NOV': 10, 'DIC': 11
  }

  const parts = dateStr.split(' ')
  if (parts.length !== 2) return null

  const monthName = parts[0].toUpperCase()
  const year = parseInt(parts[1])

  if (!months.hasOwnProperty(monthName) || isNaN(year)) return null

  return new Date(year, months[monthName], 1)
}

/**
 * Parse Spanish number from string
 */
function parseSpanishNumberFromString(str) {
  if (!str || typeof str !== 'string') return 0

  const cleaned = str.trim().replace(/\./g, '').replace(/,/g, '.')
  const num = parseFloat(cleaned)

  return isNaN(num) ? 0 : num
}


/**
 * Extract latest value from BdE API response
 */
function extractLatestFromApi(apiData) {
  try {
    console.log(`    Estructura de respuesta API:`)
    console.log(`      Es array: ${Array.isArray(apiData)}`)

    // BdE API typically returns structure with series data
    if (apiData && Array.isArray(apiData)) {
      console.log(`      Número de series: ${apiData.length}`)

      for (let i = 0; i < apiData.length; i++) {
        const series = apiData[i]
        console.log(`      Serie ${i}: ${series.Nombre || 'sin nombre'}`)

        if (series.Datos && Array.isArray(series.Datos)) {
          console.log(`        Datos: ${series.Datos.length} puntos`)

          // Get latest data point
          const latest = series.Datos[series.Datos.length - 1]
          if (latest && latest.Valor) {
            const value = latest.Valor * 1_000_000 // millions to euros
            const date = latest.Fecha || new Date().toISOString()
            console.log(`        Último valor: ${value.toLocaleString('es-ES')} € (${date})`)

            return { value, date }
          }
        }
      }
    } else if (apiData && typeof apiData === 'object') {
      console.log(`      Estructura: ${Object.keys(apiData).join(', ')}`)
    }

    console.warn('    No se pudo extraer valor del API')
    return null
  } catch (e) {
    console.warn('    Error parsing API response:', e.message)
    return null
  }
}

/**
 * Build final debt result object
 */
function buildDebtResult(monthlyData, quarterlyData, apiData) {
  const now = new Date().toISOString()

  // Combine all historical data
  let allHistorical = []

  if (monthlyData?.totalDebt) {
    allHistorical.push(...monthlyData.totalDebt)
  }
  if (quarterlyData?.totalDebt) {
    allHistorical.push(...quarterlyData.totalDebt)
  }

  // Sort and deduplicate by date
  allHistorical.sort((a, b) => a.date.localeCompare(b.date))
  const historicalMap = new Map()
  for (const point of allHistorical) {
    historicalMap.set(point.date, point.value)
  }

  const historical = Array.from(historicalMap.entries())
    .map(([date, totalDebt]) => ({ date, totalDebt }))
    .filter(p => p.totalDebt > 0)

  // Get latest total debt
  let totalDebt = 0
  let totalDebtSource = 'csv'
  if (apiData?.value) {
    totalDebt = apiData.value
    totalDebtSource = 'api'
  } else if (historical.length > 0) {
    totalDebt = historical[historical.length - 1].totalDebt
    totalDebtSource = 'csv'
  }

  // Get subsector breakdown
  const debtBySubsector = monthlyData?.debtBySubsector || quarterlyData?.debtBySubsector || {}

  // Calculate year-over-year change
  let yearOverYearChange = 0
  if (historical.length > 12) {
    const latest = historical[historical.length - 1].totalDebt
    const yearAgo = historical[historical.length - 13].totalDebt
    yearOverYearChange = ((latest - yearAgo) / yearAgo) * 100
  }

  // Get debt-to-GDP ratio
  let debtToGDP = 0
  const gdpData = quarterlyData?.debtToGDP || []
  if (gdpData.length > 0) {
    debtToGDP = gdpData[gdpData.length - 1].value
  }

  // Interest expense — no CSV source available, use PGE 2025 estimate as reference
  const REFERENCE_INTEREST_EXPENSE = 39_000_000_000
  const interestExpense = REFERENCE_INTEREST_EXPENSE

  // Calculate regression for extrapolation
  const regressionPoints = historical.slice(-24).map(p => ({
    x: new Date(p.date).getTime(),
    y: p.totalDebt
  }))

  const regression = linearRegression(regressionPoints)
  const lastDataTimestamp = regressionPoints.length > 0
    ? regressionPoints[regressionPoints.length - 1].x
    : Date.now()

  const debtPerSecond = regression.slope * 1000 // Convert ms to seconds

  // Log regression details
  if (regressionPoints.length >= 2) {
    console.log(`    Regresión lineal (últimos ${regressionPoints.length} meses):`)
    console.log(`      Pendiente: ${(regression.slope / 1000).toFixed(2)} €/ms = ${debtPerSecond.toLocaleString('es-ES', { maximumFractionDigits: 2 })} €/s`)
    console.log(`      R² (ajuste): ${regression.r2?.toFixed(3) || 'N/A'}`)
    console.log(`      Deuda/segundo: ${debtPerSecond.toLocaleString('es-ES', { maximumFractionDigits: 2 })} €/s = ${(debtPerSecond * 86400).toLocaleString('es-ES', { maximumFractionDigits: 0 })} €/día`)

    if (yearOverYearChange !== 0) {
      const yearlyChange = historical.length > 12 ? historical[historical.length - 1].totalDebt - historical[historical.length - 13].totalDebt : 0
      console.log(`      Variación interanual: +${yearOverYearChange.toFixed(2)}% (+${(yearlyChange / 1_000_000_000).toLocaleString('es-ES', { maximumFractionDigits: 0 })}B€)`)
    }
  }

  // Build source attributions
  const lastDataDate = historical.length > 0 ? historical[historical.length - 1].date : now.split('T')[0]
  const sourceAttribution = {
    totalDebt: {
      source: totalDebtSource === 'api' ? 'BdE — API REST' : 'BdE — CSV be11b',
      type: totalDebtSource,
      url: totalDebtSource === 'api'
        ? 'https://app.bde.es/bierest/resources/srdatosapp'
        : 'https://www.bde.es/webbe/es/estadisticas/compartido/datos/csv/be11b.csv',
      date: lastDataDate
    },
    debtBySubsector: {
      source: 'BdE — CSV be11b',
      type: 'csv',
      url: 'https://www.bde.es/webbe/es/estadisticas/compartido/datos/csv/be11b.csv',
      date: lastDataDate
    },
    debtToGDP: {
      source: 'BdE — CSV be1101',
      type: 'csv',
      url: 'https://www.bde.es/webbe/es/estadisticas/compartido/datos/csv/be1101.csv',
      note: 'Ratio deuda/PIB trimestral'
    },
    yearOverYearChange: {
      source: 'Cálculo derivado',
      type: 'derived',
      note: 'Variación % último dato vs mismo mes año anterior'
    },
    interestExpense: {
      source: 'Estimación PGE 2025',
      type: 'fallback',
      url: 'https://www.sepg.pap.hacienda.gob.es/sitios/sepg/es-ES/Presupuestos/PGE/Paginas/PGE2025.aspx',
      note: '~39.000 M€ (estimación ~2,3% coste medio)'
    }
  }

  return {
    lastUpdated: now,
    current: {
      totalDebt,
      debtBySubsector,
      debtToGDP,
      yearOverYearChange,
      interestExpense
    },
    historical,
    regression: {
      slope: regression.slope,
      intercept: regression.intercept,
      lastDataTimestamp,
      debtPerSecond
    },
    sourceAttribution
  }
}

/**
 * Fallback data when all sources fail
 */
function buildFallbackDebtData() {
  console.warn('⚠️  Usando datos de respaldo para deuda')

  // Reference values from Feb 2026
  const totalDebt = 1_635_000_000_000 // 1.635 trillion euros

  return {
    lastUpdated: new Date().toISOString(),
    current: {
      totalDebt,
      debtBySubsector: {
        estado: 1_250_000_000_000,
        ccaa: 320_000_000_000,
        ccll: 25_000_000_000,
        ss: 40_000_000_000
      },
      debtToGDP: 106.8,
      yearOverYearChange: 2.1,
      interestExpense: 39_000_000_000
    },
    historical: [
      { date: '2024-12-31', totalDebt: 1_621_000_000_000 },
      { date: '2025-06-30', totalDebt: 1_628_000_000_000 },
      { date: '2025-12-31', totalDebt: 1_635_000_000_000 }
    ],
    regression: {
      slope: 60_000_000_000 / (365.25 * 24 * 60 * 60 * 1000), // ~60B€/año
      get intercept() { return totalDebt - this.slope * Date.now() },
      lastDataTimestamp: Date.now(),
      get debtPerSecond() { return this.slope * 1000 }
    },
    sourceAttribution: {
      totalDebt: {
        source: 'Valor referencia feb 2026',
        type: 'fallback',
        url: 'https://www.bde.es/webbe/es/estadisticas/compartido/datos/csv/be11b.csv',
        note: 'Deuda pública estimada'
      },
      debtBySubsector: {
        source: 'Valor referencia feb 2026',
        type: 'fallback',
        url: 'https://www.bde.es/webbe/es/estadisticas/compartido/datos/csv/be11b.csv',
        note: 'Distribución estimada por subsector'
      },
      debtToGDP: {
        source: 'Valor referencia feb 2026',
        type: 'fallback',
        note: 'Ratio deuda/PIB estimado'
      },
      yearOverYearChange: {
        source: 'Valor referencia feb 2026',
        type: 'fallback',
        note: 'Variación interanual estimada'
      },
      interestExpense: {
        source: 'Estimación PGE 2025',
        type: 'fallback',
        url: 'https://www.sepg.pap.hacienda.gob.es/sitios/sepg/es-ES/Presupuestos/PGE/Paginas/PGE2025.aspx',
        note: '~39.000 M€ (estimación PGE 2025)'
      }
    }
  }
}

// ---------------------------------------------------------------------------
// CCAA debt data (be1309 absolute / be1310 % GDP)
// ---------------------------------------------------------------------------

// BdE CSV suffix mapping: .1 = Total CCAA, .2-.18 = individual CCAA
// Order comes from BdE CSV alias row (BE_13_9.N / BE_13_10.N)
const CCAA_TOTAL_SUFFIX = 1

const CCAA_MAP = {
  2:  { code: 'CA01', name: 'Andalucía' },
  3:  { code: 'CA02', name: 'Aragón' },
  4:  { code: 'CA03', name: 'Asturias' },
  5:  { code: 'CA04', name: 'Baleares' },
  6:  { code: 'CA05', name: 'Canarias' },
  7:  { code: 'CA06', name: 'Cantabria' },
  8:  { code: 'CA07', name: 'Castilla-La Mancha' },
  9:  { code: 'CA08', name: 'Castilla y León' },
  10: { code: 'CA09', name: 'Cataluña' },
  11: { code: 'CA10', name: 'Extremadura' },
  12: { code: 'CA11', name: 'Galicia' },
  13: { code: 'CA12', name: 'La Rioja' },
  14: { code: 'CA13', name: 'Madrid' },
  15: { code: 'CA14', name: 'Murcia' },
  16: { code: 'CA15', name: 'Navarra' },
  17: { code: 'CA16', name: 'País Vasco' },
  18: { code: 'CA17', name: 'C. Valenciana' },
}

/**
 * Convert a Date to "YYYY-QN" quarter string
 */
function dateToQuarter(date) {
  const year = date.getFullYear()
  const quarter = Math.floor(date.getMonth() / 3) + 1
  return `${year}-Q${quarter}`
}

/**
 * Parse a BdE transposed CSV where series are columns.
 * Row 0: series codes, Row 2: aliases (e.g. "BE_13_9.1" … "BE_13_9.18")
 * Row 6+: data rows — col 0 is date string, rest are values.
 *
 * Returns { latestDate: Date, values: Map<number, number> }
 * where the Map key is the alias suffix integer and value is
 * the latest non-zero reading. Suffix 1 = total, 2-18 = individual CCAA.
 */
function parseCcaaTransposedCSV(csvText) {
  const lines = csvText.split('\n').filter(line => line.trim() !== '')

  if (lines.length < 7) {
    throw new Error(`CSV demasiado corto (${lines.length} líneas)`)
  }

  // Row 2: alias row (e.g. "BE_13_9.1", "BE_13_9.2", ...)
  const aliasCols = parseCSVLine(lines[2])

  // Build map: column index → suffix number
  const colToSuffix = new Map()
  for (let col = 1; col < aliasCols.length; col++) {
    const alias = aliasCols[col].trim().replace(/"/g, '')
    const match = alias.match(/\.(\d+)$/)
    if (match) {
      const suffix = parseInt(match[1], 10)
      colToSuffix.set(col, suffix)
    }
  }

  // Accumulate latest non-zero value per suffix
  const latestValues = new Map() // suffix → number
  let latestDate = null

  for (let row = 6; row < lines.length; row++) {
    const cols = parseCSVLine(lines[row])
    if (!cols[0] || !cols[0].trim()) continue

    const date = parseBdEDate(cols[0].trim())
    if (!date) continue

    let rowHasData = false
    for (const [col, suffix] of colToSuffix) {
      const raw = cols[col]
      if (!raw || !raw.trim() || raw.trim() === '_') continue
      // BdE CCAA CSVs use international number format (dot = decimal)
      const val = parseFloat(raw.trim())
      if (!isNaN(val) && val !== 0) {
        latestValues.set(suffix, val)
        rowHasData = true
      }
    }

    if (rowHasData) {
      latestDate = date
    }
  }

  return { latestDate, values: latestValues }
}

/**
 * Build fallback CCAA debt data from hardcoded reference values (Q3 2025)
 */
function buildFallbackCcaaDebtData() {
  console.warn('⚠️  Usando datos de respaldo para deuda CCAA')

  return {
    lastUpdated: new Date().toISOString(),
    quarter: '2025-Q3',
    ccaa: [
      { code: 'CA01', name: 'Andalucía',         debtAbsolute: 40_452_000_000, debtToGDP: 18.3 },
      { code: 'CA02', name: 'Aragón',             debtAbsolute:  9_416_000_000, debtToGDP: 18.3 },
      { code: 'CA03', name: 'Asturias',           debtAbsolute:  3_934_000_000, debtToGDP: 12.6 },
      { code: 'CA04', name: 'Baleares',           debtAbsolute:  8_615_000_000, debtToGDP: 18.5 },
      { code: 'CA05', name: 'Canarias',           debtAbsolute:  6_534_000_000, debtToGDP: 10.8 },
      { code: 'CA06', name: 'Cantabria',          debtAbsolute:  3_229_000_000, debtToGDP: 17.6 },
      { code: 'CA07', name: 'Castilla-La Mancha', debtAbsolute: 16_621_000_000, debtToGDP: 28.8 },
      { code: 'CA08', name: 'Castilla y León',    debtAbsolute: 14_523_000_000, debtToGDP: 18.9 },
      { code: 'CA09', name: 'Cataluña',           debtAbsolute: 89_069_000_000, debtToGDP: 28.4 },
      { code: 'CA10', name: 'Extremadura',        debtAbsolute:  5_279_000_000, debtToGDP: 19.1 },
      { code: 'CA11', name: 'Galicia',            debtAbsolute: 12_051_000_000, debtToGDP: 14.2 },
      { code: 'CA12', name: 'La Rioja',           debtAbsolute:  1_753_000_000, debtToGDP: 15.2 },
      { code: 'CA13', name: 'Madrid',             debtAbsolute: 37_829_000_000, debtToGDP: 11.5 },
      { code: 'CA14', name: 'Murcia',             debtAbsolute: 13_147_000_000, debtToGDP: 29.8 },
      { code: 'CA15', name: 'Navarra',            debtAbsolute:  2_737_000_000, debtToGDP:  9.9 },
      { code: 'CA16', name: 'País Vasco',         debtAbsolute: 11_191_000_000, debtToGDP: 11.8 },
      { code: 'CA17', name: 'C. Valenciana',      debtAbsolute: 62_424_000_000, debtToGDP: 40.5 },
    ],
    total: { debtAbsolute: 338_804_000_000, debtToGDP: 20.4 },
    sourceAttribution: {
      be1309: {
        source: 'Valor referencia Q3 2025',
        type: 'fallback',
        url: `${BDE_CSV_BASE}/be1309.csv`,
        note: 'Deuda PDE CCAA en miles de euros',
      },
      be1310: {
        source: 'Valor referencia Q3 2025',
        type: 'fallback',
        url: `${BDE_CSV_BASE}/be1310.csv`,
        note: 'Deuda PDE CCAA como % del PIB regional',
      },
    },
  }
}

/**
 * Download CCAA debt data from Banco de España (be1309 + be1310)
 * @returns {Promise<Object>} CCAA debt data object
 */
export async function downloadCcaaDebtData() {
  console.log('\n=== Descargando datos de deuda CCAA (BdE) ===')

  try {
    const url1309 = `${BDE_CSV_BASE}/be1309.csv`
    const url1310 = `${BDE_CSV_BASE}/be1310.csv`

    console.log('  Descargando be1309.csv (deuda absoluta en miles €)...')
    console.log('  Descargando be1310.csv (deuda % PIB regional)...')

    const [res1309, res1310] = await Promise.allSettled([
      fetchWithRetry(url1309),
      fetchWithRetry(url1310),
    ])

    if (res1309.status !== 'fulfilled') {
      throw new Error(`Error descargando be1309: ${res1309.reason?.message}`)
    }
    if (res1310.status !== 'fulfilled') {
      throw new Error(`Error descargando be1310: ${res1310.reason?.message}`)
    }

    const text1309 = await res1309.value.text()
    const text1310 = await res1310.value.text()

    const parsed1309 = parseCcaaTransposedCSV(text1309)
    const parsed1310 = parseCcaaTransposedCSV(text1310)

    // Use the most recent date across both files
    const latestDate = parsed1309.latestDate || parsed1310.latestDate || new Date()
    const latestDateISO = latestDate.toISOString().split('T')[0]
    const quarter = dateToQuarter(latestDate)

    // Build per-CCAA entries (suffixes 2-18 in CCAA_MAP)
    const ccaa = Object.entries(CCAA_MAP).map(([suffixStr, { code, name }]) => {
      const suffix = parseInt(suffixStr, 10)
      const debtToGDP = parsed1310.values.get(suffix) ?? 0
      const debtAbsolute = (parsed1309.values.get(suffix) ?? 0) * 1000 // thousands → euros
      return { code, name, debtAbsolute, debtToGDP }
    })

    // Total from suffix 1 (or sum of CCAA as fallback)
    const totalDebtAbsolute = parsed1309.values.has(CCAA_TOTAL_SUFFIX)
      ? parsed1309.values.get(CCAA_TOTAL_SUFFIX) * 1000
      : ccaa.reduce((sum, c) => sum + c.debtAbsolute, 0)
    const totalDebtToGDP = parsed1310.values.get(CCAA_TOTAL_SUFFIX) ?? 0

    console.log(`✅ Deuda CCAA descargada: ${ccaa.length} comunidades, trimestre ${quarter}`)
    console.log(`   Total: ${totalDebtAbsolute.toLocaleString('es-ES')}€ (${totalDebtToGDP.toFixed(1)}% PIB)`)

    return {
      lastUpdated: new Date().toISOString(),
      quarter,
      ccaa,
      total: { debtAbsolute: totalDebtAbsolute, debtToGDP: totalDebtToGDP },
      sourceAttribution: {
        be1309: {
          source: 'BdE — CSV be1309',
          type: 'csv',
          url: url1309,
          date: latestDateISO,
        },
        be1310: {
          source: 'BdE — CSV be1310',
          type: 'csv',
          url: url1310,
          date: latestDateISO,
        },
      },
    }
  } catch (error) {
    console.error('❌ Error descargando datos de deuda CCAA:', error.message)
    return buildFallbackCcaaDebtData()
  }
}
