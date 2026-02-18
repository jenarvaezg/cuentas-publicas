import { parseSpanishCSV } from '../lib/csv-parser.mjs'
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
    debtToGDP: [],
    interestExpense: []
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
    }

    // Log first 10 columns to see what we have
    if (i <= 10 || matched) {
      console.log(`      [${i}] "${descriptions[i]}" ${matched ? `(${matched})` : ''}`)
    }
  }

  console.log(`    Índices encontrados - Total:${totalDebtIdx}, Estado:${estadoIdx}, CCAA:${ccaaIdx}, CCLL:${ccllIdx}, SS:${ssIdx}`)

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

  // Interest expense
  const interestExpense = monthlyData?.interestExpense?.[0] ||
                          quarterlyData?.interestExpense?.[0] ||
                          0

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
      interestExpense: 42_000_000_000
    },
    historical: [
      { date: '2024-12-31', totalDebt: 1_621_000_000_000 },
      { date: '2025-06-30', totalDebt: 1_628_000_000_000 },
      { date: '2025-12-31', totalDebt: 1_635_000_000_000 }
    ],
    regression: {
      slope: totalDebt / Date.now(),
      intercept: 0,
      lastDataTimestamp: Date.now(),
      debtPerSecond: 3_500 // Approximate
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
        note: '~42.000 M€ (estimación)'
      }
    }
  }
}
