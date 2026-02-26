import { fetchWithRetry } from '../lib/fetch-utils.mjs'

const INE_BASE = 'https://servicios.ine.es/wstempus/js/ES'

/**
 * Download demographics from INE API
 *
 * @param {Function} fetcher - Optional fetcher function (defaults to fetchWithRetry)
 * @returns {Promise<Object>} Demographics data object
 */
export async function downloadDemographics(fetcher = fetchWithRetry) {
  console.log('\n=== Descargando datos demográficos (INE) ===')
  console.log(`  Base API: ${INE_BASE}`)
  console.log(`  Método: DATOS_SERIE (series individuales)`)
  console.log()

  try {
    // Fetch all series in parallel
    const [population, activePopulation, gdp, salary, cpi] = await Promise.allSettled([
      fetchPopulation(fetcher),
      fetchActivePopulation(fetcher),
      fetchGDP(fetcher),
      fetchAverageSalary(fetcher),
      fetchCPI(fetcher)
    ])

    // Extract values and attributions
    const popData = population.status === 'fulfilled' ? population.value : fallbackPopulation()
    const activePop = activePopulation.status === 'fulfilled' ? activePopulation.value : fallbackActivePopulation()
    const gdpData = gdp.status === 'fulfilled' ? gdp.value : fallbackGDP()
    const salaryData = salary.status === 'fulfilled' ? salary.value : fallbackSalary()
    const cpiData = cpi.status === 'fulfilled' ? cpi.value : fallbackCPI()

    const result = {
      lastUpdated: new Date().toISOString(),
      population: popData.value,
      activePopulation: activePop.value,
      gdp: gdpData.value,
      averageSalary: salaryData.value,
      smi: 1_221, // SMI 2026: 17.094€/14 pagas
      cpi: cpiData.value,
      sourceAttribution: {
        population: popData.attribution,
        activePopulation: activePop.attribution,
        gdp: gdpData.attribution,
        averageSalary: salaryData.attribution,
        smi: {
          source: 'BOE — Salario Mínimo Interprofesional 2026',
          type: 'fallback',
          url: 'https://www.boe.es/boe/dias/2026/02/18/pdfs/BOE-A-2026-3456.pdf',
          note: 'SMI 2026: 1.221€/mes (17.094€/14 pagas)'
        },
        cpi: cpiData.attribution
      }
    }

    console.log()
    console.log(`✅ Demografía procesada:`)
    console.log(`   Población:        ${result.population.toLocaleString('es-ES')} [${popData.attribution.type}]`)
    console.log(`   Población activa: ${result.activePopulation.toLocaleString('es-ES')} [${activePop.attribution.type}]`)
    console.log(`   PIB:              ${(result.gdp / 1_000_000_000).toFixed(0)}B€ (${(result.gdp / 1_000_000_000_000).toFixed(3)}T€) [${gdpData.attribution.type}]`)
    console.log(`   Salario medio:    ${result.averageSalary.toLocaleString('es-ES')}€ [${salaryData.attribution.type}]`)
    console.log(`   SMI:              ${result.smi.toLocaleString('es-ES')}€/mes [fallback]`)
    console.log(`   IPC:              ${Object.keys(result.cpi.byYear).length} años, base=${result.cpi.baseYear} [${cpiData.attribution.type}]`)

    // Fetch detailed demographics (vital stats, pyramid, dependency ratios, immigration)
    try {
      const detail = await downloadDemographicsDetail(fetcher)
      Object.assign(result, {
        vitalStats: detail.vitalStats,
        lifeExpectancy: detail.lifeExpectancy,
        pyramid: detail.pyramid,
        dependencyRatio: detail.dependencyRatio,
        immigrationShare: detail.immigrationShare,
        projections: detail.projections,
        migrationFlows: detail.migrationFlows,
        provincialPopulation: detail.provincialPopulation,
        fertilityProjections: detail.fertilityProjections,
      })
      // Merge source attributions
      Object.assign(result.sourceAttribution, detail.sourceAttribution)
    } catch (error) {
      console.warn('⚠️ Error en datos demográficos detallados:', error.message)
      console.warn('   Usando valores de respaldo para demografía detallada')
      const fallbackDetail = fallbackDemographicsDetail()
      Object.assign(result, {
        vitalStats: fallbackDetail.vitalStats,
        lifeExpectancy: fallbackDetail.lifeExpectancy,
        pyramid: fallbackDetail.pyramid,
        dependencyRatio: fallbackDetail.dependencyRatio,
        immigrationShare: fallbackDetail.immigrationShare,
        projections: fallbackDetail.projections,
        migrationFlows: fallbackDetail.migrationFlows,
        provincialPopulation: fallbackDetail.provincialPopulation,
        fertilityProjections: fallbackDetail.fertilityProjections,
      })
      Object.assign(result.sourceAttribution, fallbackDetail.sourceAttribution)
    }

    return result
  } catch (error) {
    console.error('❌ Error descargando demografía:', error.message)
    return buildFallbackDemographics()
  }
}

// ─────────────────────────────────────────────
// Helper: fetch a single INE series
// ─────────────────────────────────────────────

/**
 * Fetch the latest N data points from an INE series.
 *
 * @param {string} seriesCode - INE series code (e.g. 'ECP320')
 * @param {number} nult - Number of latest data points to fetch
 * @returns {Promise<Array>} Array of { Valor, Fecha, ... } objects
 */
async function fetchSeries(seriesCode, nult = 1, fetcher = fetchWithRetry) {
  const url = `${INE_BASE}/DATOS_SERIE/${seriesCode}?nult=${nult}`
  console.log(`    URL: ${url}`)

  const response = await fetcher(url, {
    headers: { 'Accept': 'application/json' }
  }, { timeoutMs: 15000 })

  const json = await response.json()

  // DATOS_SERIE returns { COD, Nombre, ..., Data: [...] }
  const data = json.Data || json.data || []
  const nombre = json.Nombre || json.nombre || seriesCode

  console.log(`    Serie: "${nombre}"`)
  console.log(`    Puntos de datos recibidos: ${data.length}`)

  if (data.length === 0) {
    throw new Error(`No data points in series ${seriesCode}`)
  }

  return data
}

/**
 * Format an INE timestamp (milliseconds since epoch) to YYYY-MM-DD
 */
export function formatINEDate(timestamp) {
  if (!timestamp) return 'sin fecha'
  // INE returns Fecha as milliseconds since epoch
  const d = new Date(typeof timestamp === 'number' ? timestamp : parseInt(timestamp))
  return d.toISOString().split('T')[0]
}

// ─────────────────────────────────────────────
// Population: series ECP320
// ─────────────────────────────────────────────

async function fetchPopulation() {
  console.log('  📊 Población (Cifras de Población)...')
  console.log(`    Serie: ECP320 (Total Nacional)`)

  try {
    const data = await fetchSeries('ECP320', 3)

    // Show all returned points
    for (let i = 0; i < data.length; i++) {
      const p = data[i]
      const date = formatINEDate(p.Fecha)
      console.log(`    [${i + 1}] ${date}: ${p.Valor?.toLocaleString('es-ES') || 'null'}`)
    }

    // Take the most recent point
    const latest = data[data.length - 1]
    const value = Math.round(latest.Valor)
    const date = formatINEDate(latest.Fecha)

    // Sanity check
    if (value < 40_000_000 || value > 60_000_000) {
      throw new Error(`Valor fuera de rango: ${value.toLocaleString('es-ES')} (esperado 40M-60M)`)
    }

    console.log(`    ✅ Población: ${value.toLocaleString('es-ES')} (${date})`)

    return {
      value,
      attribution: {
        source: 'INE — Cifras de Población (serie ECP320)',
        type: 'api',
        url: 'https://www.ine.es/jaxiT3/Tabla.htm?t=56934',
        date
      }
    }
  } catch (error) {
    console.warn(`    ❌ Error: ${error.message}`)
    console.warn(`    Usando valor de referencia`)
    return fallbackPopulation()
  }
}

function fallbackPopulation() {
  return {
    value: 49_570_725,
    attribution: {
      source: 'Valor referencia ene 2026 (INE)',
      type: 'fallback',
      url: 'https://www.ine.es/jaxiT3/Tabla.htm?t=56934',
      note: 'Cifras de Población ene 2026'
    }
  }
}

// ─────────────────────────────────────────────
// Active Population: series EPA387794
// ─────────────────────────────────────────────

async function fetchActivePopulation() {
  console.log()
  console.log('  📊 Población Activa (EPA)...')
  console.log(`    Serie: EPA387794 (Activos Total, en miles)`)

  try {
    const data = await fetchSeries('EPA387794', 3)

    // Show all returned points
    for (let i = 0; i < data.length; i++) {
      const p = data[i]
      const date = formatINEDate(p.Fecha)
      console.log(`    [${i + 1}] ${date}: ${p.Valor?.toLocaleString('es-ES') || 'null'} (miles) = ${((p.Valor || 0) * 1000).toLocaleString('es-ES')} personas`)
    }

    // Take the most recent point
    const latest = data[data.length - 1]
    // EPA data is in thousands
    const valueInThousands = latest.Valor
    const value = Math.round(valueInThousands * 1000)
    const date = formatINEDate(latest.Fecha)

    // Sanity check: active population should be between 15M-35M
    if (value < 15_000_000 || value > 35_000_000) {
      throw new Error(`Valor fuera de rango: ${value.toLocaleString('es-ES')} (esperado 15M-35M)`)
    }

    console.log(`    ✅ Población activa: ${value.toLocaleString('es-ES')} (${date})`)

    return {
      value,
      attribution: {
        source: 'INE — EPA (serie EPA387794)',
        type: 'api',
        url: 'https://www.ine.es/jaxiT3/Tabla.htm?t=65080',
        date
      }
    }
  } catch (error) {
    console.warn(`    ❌ Error: ${error.message}`)
    console.warn(`    Usando valor de referencia`)
    return fallbackActivePopulation()
  }
}

function fallbackActivePopulation() {
  return {
    value: 24_940_400,
    attribution: {
      source: 'Valor referencia Q3 2025 (INE EPA)',
      type: 'fallback',
      url: 'https://www.ine.es/jaxiT3/Tabla.htm?t=65080',
      note: 'Población activa Q3 2025'
    }
  }
}

// ─────────────────────────────────────────────
// GDP: series CNTR6597 (quarterly, sum 4 quarters)
// ─────────────────────────────────────────────

async function fetchGDP() {
  console.log()
  console.log('  📊 PIB (Contabilidad Nacional Trimestral)...')
  console.log(`    Serie: CNTR6597 (PIB precios corrientes, ajustado estacionalidad, millones €)`)
  console.log(`    Estrategia: sumar 4 últimos trimestres para PIB anual`)

  try {
    // Fetch last 8 quarters to have some margin
    const data = await fetchSeries('CNTR6597', 8)

    // Show all returned points
    console.log(`    Datos trimestrales:`)
    for (let i = 0; i < data.length; i++) {
      const p = data[i]
      const date = formatINEDate(p.Fecha)
      const valueM = p.Valor?.toLocaleString('es-ES') || 'null'
      const valueB = p.Valor ? (p.Valor / 1000).toFixed(1) : '?'
      console.log(`    [${i + 1}] ${date}: ${valueM}M€ (${valueB}B€)`)
    }

    // Take the 4 most recent quarters
    const last4 = data.slice(-4)
    if (last4.length < 4) {
      throw new Error(`Solo ${last4.length} trimestres disponibles (necesitamos 4)`)
    }

    // Sum quarterly GDP (values are in millions of euros)
    const quarterlySum = last4.reduce((sum, p) => sum + (p.Valor || 0), 0)
    // Convert millions to euros
    const annualGDP = Math.round(quarterlySum * 1_000_000)

    const oldestDate = formatINEDate(last4[0].Fecha)
    const newestDate = formatINEDate(last4[last4.length - 1].Fecha)
    const dateRange = `${oldestDate} a ${newestDate}`

    console.log(`    Suma 4 trimestres (${dateRange}):`)
    console.log(`      ${quarterlySum.toLocaleString('es-ES')}M€ = ${(quarterlySum / 1000).toFixed(1)}B€ = ${(quarterlySum / 1_000_000).toFixed(3)}T€`)

    // Sanity check: Spain GDP should be between 1T€ and 3T€
    if (annualGDP < 1_000_000_000_000 || annualGDP > 3_000_000_000_000) {
      throw new Error(`PIB anual fuera de rango: ${(annualGDP / 1_000_000_000_000).toFixed(3)}T€ (esperado 1T€-3T€)`)
    }

    console.log(`    ✅ PIB anual: ${(annualGDP / 1_000_000_000_000).toFixed(3)}T€ (${dateRange})`)

    return {
      value: annualGDP,
      attribution: {
        source: 'INE — Contabilidad Nacional Trimestral (serie CNTR6597)',
        type: 'api',
        url: 'https://www.ine.es/jaxiT3/Tabla.htm?t=30679',
        date: newestDate,
        note: `Suma 4 trimestres: ${dateRange}`
      }
    }
  } catch (error) {
    console.warn(`    ❌ Error: ${error.message}`)
    console.warn(`    Usando valor de referencia`)
    return fallbackGDP()
  }
}

function fallbackGDP() {
  return {
    value: 1_686_000_000_000,
    attribution: {
      source: 'Valor referencia 2025 (countryeconomy.com)',
      type: 'fallback',
      url: 'https://countryeconomy.com/gdp/spain',
      note: 'PIB nominal 2025'
    }
  }
}

// ─────────────────────────────────────────────
// Average Salary: series EAES741
// ─────────────────────────────────────────────

async function fetchAverageSalary() {
  console.log()
  console.log('  📊 Salario medio (Encuesta Anual Estructura Salarial)...')
  console.log(`    Serie: EAES741 (Total Nacional, Media anual bruta)`)
  console.log(`    Nota: esta encuesta se publica con ~2 años de retraso`)

  try {
    const data = await fetchSeries('EAES741', 5)

    // Show all returned points
    for (let i = 0; i < data.length; i++) {
      const p = data[i]
      const date = formatINEDate(p.Fecha)
      console.log(`    [${i + 1}] ${date}: ${p.Valor?.toLocaleString('es-ES') || 'null'}€`)
    }

    // Take the most recent point
    const latest = data[data.length - 1]
    const value = Math.round(latest.Valor)
    const date = formatINEDate(latest.Fecha)

    // Sanity check
    if (value < 15_000 || value > 100_000) {
      throw new Error(`Valor fuera de rango: ${value.toLocaleString('es-ES')}€ (esperado 15K-100K)`)
    }

    console.log(`    ✅ Salario medio: ${value.toLocaleString('es-ES')}€ (${date})`)

    return {
      value,
      attribution: {
        source: 'INE — Encuesta Anual Estructura Salarial (serie EAES741)',
        type: 'api',
        url: 'https://www.ine.es/jaxiT3/Tabla.htm?t=28191',
        date
      }
    }
  } catch (error) {
    console.warn(`    ❌ Error: ${error.message}`)
    console.warn(`    Usando valor de referencia`)
    return fallbackSalary()
  }
}

function fallbackSalary() {
  return {
    value: 28_050,
    attribution: {
      source: 'Valor referencia 2022 (INE EAES)',
      type: 'fallback',
      url: 'https://www.ine.es/jaxiT3/Tabla.htm?t=28191',
      note: 'Salario medio anual bruto 2022'
    }
  }
}

// ─────────────────────────────────────────────
// CPI: series IPC278296 (annual average) + IPC290750 (annual variation)
// ─────────────────────────────────────────────

async function fetchCPI() {
  console.log()
  console.log('  📊 IPC (Índice de Precios al Consumo)...')
  console.log(`    Series: IPC278296 (media anual, base 2021=100) + IPC290750 (variación anual)`)
  console.log(`    Estrategia: valores directos 2002-2025 + reconstruir 1995-2001 hacia atrás`)

  try {
    // Fetch both series in parallel
    const [avgResult, varResult] = await Promise.allSettled([
      fetchSeries('IPC278296', 40),  // Annual average CPI, ~24 years
      fetchSeries('IPC290750', 800)  // Annual variation, many years
    ])

    if (avgResult.status === 'rejected') {
      throw new Error(`Failed to fetch IPC278296: ${avgResult.reason?.message}`)
    }

    const avgData = avgResult.value
    const varData = varResult.status === 'fulfilled' ? varResult.value : []

    // Build index from annual averages (IPC278296)
    // Each data point has Fecha (ms timestamp) and Valor (index value)
    const byYear = {}
    for (const point of avgData) {
      if (point.Valor == null) continue
      const year = new Date(point.Fecha).getFullYear()
      // This series gives one value per year (annual average)
      byYear[String(year)] = point.Valor
    }

    console.log(`    Valores directos: ${Object.keys(byYear).length} años (${Math.min(...Object.keys(byYear).map(Number))}-${Math.max(...Object.keys(byYear).map(Number))})`)

    // Build annual variation map from IPC290750
    // This series has monthly variations; we need to compute annual averages
    const variationsByYear = {}
    for (const point of varData) {
      if (point.Valor == null) continue
      const year = new Date(point.Fecha).getFullYear()
      if (!variationsByYear[year]) variationsByYear[year] = []
      variationsByYear[year].push(point.Valor)
    }

    // Average each year's monthly variations to get annual variation
    const annualVariation = {}
    for (const [year, values] of Object.entries(variationsByYear)) {
      annualVariation[year] = values.reduce((sum, v) => sum + v, 0) / values.length
    }

    console.log(`    Variaciones anuales disponibles: ${Object.keys(annualVariation).length} años`)

    // Reconstruct backwards from the earliest year in byYear
    const earliestDirect = Math.min(...Object.keys(byYear).map(Number))
    const targetStart = 1995

    if (earliestDirect > targetStart && Object.keys(annualVariation).length > 0) {
      console.log(`    Reconstruyendo ${targetStart}-${earliestDirect - 1} hacia atrás...`)
      for (let y = earliestDirect - 1; y >= targetStart; y--) {
        const nextYearIndex = byYear[String(y + 1)]
        const variation = annualVariation[String(y + 1)]
        if (nextYearIndex != null && variation != null) {
          // index[y] = index[y+1] / (1 + variation[y+1] / 100)
          byYear[String(y)] = nextYearIndex / (1 + variation / 100)
          console.log(`      ${y}: ${byYear[String(y)].toFixed(2)} (var ${y + 1}: ${variation.toFixed(2)}%)`)
        } else {
          console.warn(`      ${y}: no se puede reconstruir (faltan datos)`)
          break
        }
      }
    }

    // Determine base year = latest year with COFOG data
    const allYears = Object.keys(byYear).map(Number).sort((a, b) => a - b)
    // Use 2024 as base year (latest COFOG year), fallback to latest available
    const baseYear = byYear['2024'] ? 2024 : allYears[allYears.length - 1]

    // Round values to 2 decimals for cleaner JSON
    const rounded = {}
    for (const [year, value] of Object.entries(byYear)) {
      rounded[year] = Math.round(value * 100) / 100
    }

    console.log(`    ✅ IPC procesado: ${allYears.length} años (${allYears[0]}-${allYears[allYears.length - 1]}), base=${baseYear}`)

    return {
      value: { baseYear, byYear: rounded },
      attribution: {
        source: 'INE — Índice de Precios al Consumo (series IPC278296 + IPC290750)',
        type: 'api',
        url: 'https://www.ine.es/jaxiT3/Tabla.htm?t=50902',
        note: `IPC base 2021=100, ${allYears.length} años (${allYears[0]}-${allYears[allYears.length - 1]})`
      }
    }
  } catch (error) {
    console.warn(`    ❌ Error: ${error.message}`)
    console.warn(`    Usando valores de referencia para IPC`)
    return fallbackCPI()
  }
}

function fallbackCPI() {
  // Reference CPI values (base 2021=100) for key years
  return {
    value: {
      baseYear: 2024,
      byYear: {
        '1995': 55.07, '1996': 57.01, '1997': 58.14, '1998': 59.22,
        '1999': 60.58, '2000': 62.65, '2001': 64.91, '2002': 67.14,
        '2003': 69.17, '2004': 71.27, '2005': 73.67, '2006': 76.28,
        '2007': 78.41, '2008': 81.63, '2009': 81.40, '2010': 82.73,
        '2011': 85.29, '2012': 87.38, '2013': 88.54, '2014': 88.40,
        '2015': 87.96, '2016': 87.66, '2017': 89.40, '2018': 90.93,
        '2019': 91.58, '2020': 91.27, '2021': 100.00, '2022': 108.40,
        '2023': 112.15, '2024': 115.60
      }
    },
    attribution: {
      source: 'Valores referencia IPC (INE)',
      type: 'fallback',
      url: 'https://www.ine.es/jaxiT3/Tabla.htm?t=50902',
      note: 'IPC base 2021=100, valores de referencia'
    }
  }
}

// ─────────────────────────────────────────────
// Demographics Detail: vital stats, pyramid, dependency ratios, immigration
// ─────────────────────────────────────────────

// Age group labels used for the population pyramid
const PYRAMID_AGE_GROUPS = [
  '0-4', '5-9', '10-14', '15-19', '20-24', '25-29', '30-34', '35-39',
  '40-44', '45-49', '50-54', '55-59', '60-64', '65-69', '70-74', '75-79',
  '80-84', '85-89', '90+',
]

// Map INE age group text to our canonical labels
const AGE_GROUP_MAP = {
  'De 0 a 4 años': '0-4',
  'De 5 a 9 años': '5-9',
  'De 10 a 14 años': '10-14',
  'De 15 a 19 años': '15-19',
  'De 20 a 24 años': '20-24',
  'De 25 a 29 años': '25-29',
  'De 30 a 34 años': '30-34',
  'De 35 a 39 años': '35-39',
  'De 40 a 44 años': '40-44',
  'De 45 a 49 años': '45-49',
  'De 50 a 54 años': '50-54',
  'De 55 a 59 años': '55-59',
  'De 60 a 64 años': '60-64',
  'De 65 a 69 años': '65-69',
  'De 70 a 74 años': '70-74',
  'De 75 a 79 años': '75-79',
  'De 80 a 84 años': '80-84',
  'De 85 a 89 años': '85-89',
  '90 y más años': '90+',
}

// Region names in pyramid output
const PYRAMID_REGIONS = ['spain', 'eu', 'restEurope', 'africa', 'americas', 'asiaOceania']

/**
 * Map an INE birth-place string to one of our canonical region keys.
 * Returns null for entries that should be skipped (totals, "Extranjero", etc.).
 */
function classifyBirthPlace(birthPlace) {
  const bp = birthPlace.trim()
  if (bp === 'España') return 'spain'
  // restEurope must be checked BEFORE eu: "Europa menos UE28" contains "UE28"
  if (bp === 'Europa (no UE)' || bp === 'Resto de Europa' || bp.startsWith('Europa menos') || bp === 'Europa no comunitaria') return 'restEurope'
  if (bp === 'Unión Europea (sin España)' || bp.includes('UE27') || bp.includes('UE28') || bp.includes('sin España')) return 'eu'
  if (bp === 'África') return 'africa'
  if (bp === 'América del Norte' || bp === 'Centro América y Caribe' || bp === 'Sudamérica') return 'americas'
  if (bp === 'Asia' || bp === 'Oceanía') return 'asiaOceania'
  return null // skip "Total", "Extranjero", aggregates
}

/**
 * Parse an INE SERIES_TABLA Nombre field for table 56943.
 * Actual structure: "Total Nacional. birthPlace. ageGroup. sex. Población. Número."
 * Returns { sex, ageGroup, region } or null if the series should be skipped.
 */
function parsePyramidSeriesName(nombre) {
  const parts = nombre.split('.')
  if (parts.length < 4) return null

  const birthPlaceRaw = parts[1].trim()
  const ageRaw = parts[2].trim()
  const sexRaw = parts[3].trim()

  // Filter sex
  if (sexRaw !== 'Hombres' && sexRaw !== 'Mujeres') return null
  const sex = sexRaw === 'Hombres' ? 'male' : 'female'

  // Filter age group
  const ageGroup = AGE_GROUP_MAP[ageRaw]
  if (!ageGroup) return null // skip "Todas las edades"

  // Filter region
  const region = classifyBirthPlace(birthPlaceRaw)
  if (!region) return null

  return { sex, ageGroup, region }
}

/**
 * Fetch vital-stats IDB series (birth rate, death rate, fertility, natural growth).
 */
async function fetchVitalStats(fetcher) {
  console.log('  📊 Estadísticas vitales (Indicadores Demográficos Básicos)...')

  const seriesDefs = [
    { code: 'IDB37106', key: 'birthRate', label: 'Tasa Bruta de Natalidad' },
    { code: 'IDB47797', key: 'deathRate', label: 'Tasa Bruta de Mortalidad' },
    { code: 'IDB72160', key: 'fertilityRate', label: 'Indicador Coyuntural de Fecundidad' },
    { code: 'IDB55340', key: 'naturalGrowth', label: 'Crecimiento Vegetativo' },
  ]

  const results = await Promise.allSettled(
    seriesDefs.map(({ code }) => fetchSeries(code, 30, fetcher))
  )

  const vitalStats = {}
  for (let i = 0; i < seriesDefs.length; i++) {
    const { key, label, code } = seriesDefs[i]
    const result = results[i]
    if (result.status === 'fulfilled') {
      const parsed = result.value
        .filter(p => p.Valor != null)
        .map(p => ({ year: new Date(p.Fecha).getFullYear(), value: p.Valor }))
        .sort((a, b) => a.year - b.year)
      vitalStats[key] = parsed
      const latest = parsed[parsed.length - 1]
      console.log(`    ✅ ${label} (${code}): ${parsed.length} años, último ${latest?.year}=${latest?.value}`)
    } else {
      console.warn(`    ❌ ${label} (${code}): ${result.reason?.message}`)
      vitalStats[key] = []
    }
  }

  return vitalStats
}

/**
 * Fetch life expectancy IDB series (both sexes, male, female).
 */
async function fetchLifeExpectancy(fetcher) {
  console.log()
  console.log('  📊 Esperanza de vida (Tablas de Mortalidad)...')

  const seriesDefs = [
    { code: 'IDB53772', key: 'both', label: 'Ambos sexos' },
    { code: 'IDB53773', key: 'male', label: 'Hombres' },
    { code: 'IDB53774', key: 'female', label: 'Mujeres' },
  ]

  const results = await Promise.allSettled(
    seriesDefs.map(({ code }) => fetchSeries(code, 30, fetcher))
  )

  const lifeExpectancy = {}
  for (let i = 0; i < seriesDefs.length; i++) {
    const { key, label, code } = seriesDefs[i]
    const result = results[i]
    if (result.status === 'fulfilled') {
      const parsed = result.value
        .filter(p => p.Valor != null)
        .map(p => ({ year: new Date(p.Fecha).getFullYear(), value: p.Valor }))
        .sort((a, b) => a.year - b.year)
      lifeExpectancy[key] = parsed
      const latest = parsed[parsed.length - 1]
      console.log(`    ✅ ${label} (${code}): ${parsed.length} años, último ${latest?.year}=${latest?.value}`)
    } else {
      console.warn(`    ❌ ${label} (${code}): ${result.reason?.message}`)
      lifeExpectancy[key] = []
    }
  }

  return lifeExpectancy
}

/**
 * Fetch population pyramid with immigration breakdown from INE table 56943.
 */
async function fetchPopulationPyramid(fetcher) {
  console.log()
  console.log('  📊 Pirámide de población por lugar de nacimiento (tabla 56943)...')

  // Step 1: Get all series metadata
  const metaUrl = `${INE_BASE}/SERIES_TABLA/56943`
  console.log(`    URL metadata: ${metaUrl}`)

  const metaResponse = await fetcher(metaUrl, {
    headers: { 'Accept': 'application/json' },
  }, { timeoutMs: 30000 })

  const allSeries = await metaResponse.json()
  console.log(`    Series totales en tabla: ${allSeries.length}`)

  // Step 2: Filter and classify series
  const targetSeries = []
  for (const series of allSeries) {
    const parsed = parsePyramidSeriesName(series.Nombre || '')
    if (parsed) {
      targetSeries.push({ cod: series.COD, ...parsed })
    }
  }

  console.log(`    Series relevantes (sexo x grupo edad x región): ${targetSeries.length}`)

  // Step 3: Batch-fetch series data (chunks of 20)
  const BATCH_SIZE = 20
  const BATCH_DELAY_MS = 500
  const seriesData = new Map() // cod -> data points

  for (let batchStart = 0; batchStart < targetSeries.length; batchStart += BATCH_SIZE) {
    const batch = targetSeries.slice(batchStart, batchStart + BATCH_SIZE)
    const batchNum = Math.floor(batchStart / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(targetSeries.length / BATCH_SIZE)
    console.log(`    Lote ${batchNum}/${totalBatches}: ${batch.length} series...`)

    const batchResults = await Promise.allSettled(
      batch.map(({ cod }) => fetchSeries(cod, 40, fetcher))
    )

    for (let i = 0; i < batch.length; i++) {
      if (batchResults[i].status === 'fulfilled') {
        seriesData.set(batch[i].cod, batchResults[i].value)
      }
    }

    // Small delay between batches
    if (batchStart + BATCH_SIZE < targetSeries.length) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS))
    }
  }

  console.log(`    Series descargadas exitosamente: ${seriesData.size}/${targetSeries.length}`)

  // Step 4: Aggregate into pyramid structure
  // For each series, extract year from data points, use latest per year
  const yearSet = new Set()
  const pyramidRaw = {} // year -> sex -> region -> ageGroup -> value

  for (const { cod, sex, ageGroup, region } of targetSeries) {
    const data = seriesData.get(cod)
    if (!data) continue

    // Group by year, keep latest data point per year
    const byYear = {}
    for (const point of data) {
      if (point.Valor == null) continue
      const year = new Date(point.Fecha).getFullYear()
      // Keep latest timestamp per year (overwrite is fine, data is chronological)
      byYear[year] = point.Valor
    }

    for (const [yearStr, value] of Object.entries(byYear)) {
      const year = Number(yearStr)
      yearSet.add(year)

      if (!pyramidRaw[year]) pyramidRaw[year] = {}
      if (!pyramidRaw[year][sex]) pyramidRaw[year][sex] = {}
      if (!pyramidRaw[year][sex][region]) pyramidRaw[year][sex][region] = {}
      pyramidRaw[year][sex][region][ageGroup] = Math.round(value)
    }
  }

  // Step 5: Build final pyramid structure, filtering out incomplete years
  // (years where foreign-born data hasn't been published yet show 0 for all non-Spain regions)
  const allYears = [...yearSet].sort((a, b) => a - b)

  const byYear = {}
  const years = []
  for (const year of allYears) {
    const yearData = pyramidRaw[year] || {}
    const entry = {}

    let foreignTotal = 0
    for (const sex of ['male', 'female']) {
      const sexData = {}
      for (const region of PYRAMID_REGIONS) {
        const regionData = yearData[sex]?.[region] || {}
        const values = PYRAMID_AGE_GROUPS.map(ag => regionData[ag] || 0)
        sexData[region] = values
        if (region !== 'spain') foreignTotal += values.reduce((s, v) => s + v, 0)
      }
      entry[sex] = sexData
    }

    const spainTotal = ['male', 'female'].reduce((s, sex) =>
      s + entry[sex].spain.reduce((a, v) => a + v, 0), 0)

    // Skip years with incomplete data (no foreign-born or no Spain-born)
    if (foreignTotal === 0 || spainTotal === 0) {
      console.log(`    ⚠️ Año ${year} con datos incompletos (spain=${spainTotal}, foreign=${foreignTotal}), omitido`)
      continue
    }

    byYear[String(year)] = entry
    years.push(year)
  }

  console.log(`    ✅ Pirámide: ${years.length} años (${years[0]}-${years[years.length - 1]}), ${PYRAMID_AGE_GROUPS.length} grupos de edad, ${PYRAMID_REGIONS.length} regiones`)

  return { years, ageGroups: PYRAMID_AGE_GROUPS, regions: PYRAMID_REGIONS, byYear }
}

/**
 * Derive dependency ratios from pyramid data for the latest year.
 * Groups: 0-14 (youth), 15-64 (working), 65+ (elderly).
 */
function deriveDependencyRatios(pyramid) {
  const latestYear = String(pyramid.years[pyramid.years.length - 1])
  const yearData = pyramid.byYear[latestYear]
  if (!yearData) return { oldAge: 0, youth: 0, total: 0 }

  // Sum across both sexes and all regions for each age group
  const popByAgeGroup = PYRAMID_AGE_GROUPS.map((_, idx) => {
    let total = 0
    for (const sex of ['male', 'female']) {
      for (const region of PYRAMID_REGIONS) {
        total += yearData[sex]?.[region]?.[idx] || 0
      }
    }
    return total
  })

  // Map age groups to broad categories
  // 0-4, 5-9, 10-14 -> youth (indices 0-2)
  // 15-19 through 60-64 -> working (indices 3-12)
  // 65-69 through 90+ -> elderly (indices 13-18)
  const pop0to14 = popByAgeGroup.slice(0, 3).reduce((s, v) => s + v, 0)
  const pop15to64 = popByAgeGroup.slice(3, 13).reduce((s, v) => s + v, 0)
  const pop65plus = popByAgeGroup.slice(13).reduce((s, v) => s + v, 0)

  const oldAge = pop15to64 > 0 ? Math.round((pop65plus / pop15to64) * 1000) / 1000 : 0
  const youth = pop15to64 > 0 ? Math.round(((pop0to14) / pop15to64) * 1000) / 1000 : 0
  const total = pop15to64 > 0 ? Math.round(((pop0to14 + pop65plus) / pop15to64) * 1000) / 1000 : 0

  console.log(`    Ratios de dependencia (${latestYear}): vejez=${oldAge}, juventud=${youth}, total=${total}`)

  return { oldAge, youth, total }
}

/**
 * Derive immigration share from pyramid data.
 */
function deriveImmigrationShare(pyramid) {
  const latestYear = String(pyramid.years[pyramid.years.length - 1])
  const yearData = pyramid.byYear[latestYear]
  if (!yearData) return { total: 0, byRegion: {}, historical: [] }

  // Sum total and by region for latest year
  let totalAll = 0
  let spainBorn = 0
  const regionTotals = {}

  for (const region of PYRAMID_REGIONS) {
    regionTotals[region] = 0
  }

  for (const sex of ['male', 'female']) {
    for (const region of PYRAMID_REGIONS) {
      const regionValues = yearData[sex]?.[region] || []
      const regionSum = regionValues.reduce((s, v) => s + v, 0)
      totalAll += regionSum
      regionTotals[region] += regionSum
      if (region === 'spain') {
        spainBorn += regionSum
      }
    }
  }

  const foreignBorn = totalAll - spainBorn
  const totalShare = totalAll > 0 ? Math.round((foreignBorn / totalAll) * 1000) / 1000 : 0

  // By region (share of total foreign-born for each region)
  const byRegion = {}
  for (const region of PYRAMID_REGIONS) {
    if (region === 'spain') continue
    byRegion[region] = totalAll > 0 ? Math.round((regionTotals[region] / totalAll) * 1000) / 1000 : 0
  }

  // Historical: compute total foreign-born share for each year
  const historical = pyramid.years.map(year => {
    const yd = pyramid.byYear[String(year)]
    if (!yd) return { year, value: 0 }

    let yearTotal = 0
    let yearSpain = 0
    for (const sex of ['male', 'female']) {
      for (const region of PYRAMID_REGIONS) {
        const vals = yd[sex]?.[region] || []
        const sum = vals.reduce((s, v) => s + v, 0)
        yearTotal += sum
        if (region === 'spain') yearSpain += sum
      }
    }

    const share = yearTotal > 0 ? Math.round(((yearTotal - yearSpain) / yearTotal) * 1000) / 1000 : 0
    return { year, value: share }
  })

  console.log(`    Cuota inmigración (${latestYear}): total=${totalShare}, regiones: ${Object.entries(byRegion).map(([k, v]) => `${k}=${v}`).join(', ')}`)

  return { total: totalShare, byRegion, historical }
}

// ─────────────────────────────────────────────
// Population Projections (INE table 36679 + long-term indicators)
// ─────────────────────────────────────────────

const SHORT_TERM_SERIES = {
  'Total Nacional': 'PROP7993',
  'Andalucía': 'PROP7990',
  'Aragón': 'PROP7987',
  'Asturias, Principado de': 'PROP7984',
  'Balears, Illes': 'PROP7981',
  'Canarias': 'PROP7978',
  'Cantabria': 'PROP7975',
  'Castilla y León': 'PROP7972',
  'Castilla - La Mancha': 'PROP7969',
  'Cataluña': 'PROP7966',
  'Comunitat Valenciana': 'PROP7963',
  'Extremadura': 'PROP7960',
  'Galicia': 'PROP7957',
  'Madrid, Comunidad de': 'PROP7954',
  'Murcia, Región de': 'PROP7951',
  'Navarra, Comunidad Foral de': 'PROP7948',
  'País Vasco': 'PROP7945',
  'Rioja, La': 'PROP7942',
  'Ceuta': 'PROP7939',
  'Melilla': 'PROP7936',
}

const PROJECTION_INDICATORS = [
  { code: 'PROP7467', key: 'dependencyOldAge' },
  { code: 'PROP7465', key: 'dependencyTotal' },
  { code: 'PROP7463', key: 'proportionOver65' },
  { code: 'PROP7446', key: 'populationGrowth' },
  { code: 'PROP7447', key: 'naturalBalance' },
  { code: 'PROP7448', key: 'netMigration' },
]

/**
 * Fetch population projections: short-term by CCAA + long-term indicators.
 */
async function fetchProjections(fetcher) {
  console.log()
  console.log('  📊 Proyecciones de población (INE tabla 36679 + indicadores LP)...')

  // Fetch all short-term series in parallel
  const shortTermEntries = Object.entries(SHORT_TERM_SERIES)
  const shortTermResults = await Promise.allSettled(
    shortTermEntries.map(([, code]) => fetchSeries(code, 20, fetcher))
  )

  const shortTerm = { national: [], byCcaa: {} }
  for (let i = 0; i < shortTermEntries.length; i++) {
    const [name] = shortTermEntries[i]
    const result = shortTermResults[i]
    if (result.status === 'fulfilled') {
      const parsed = result.value
        .filter(p => p.Valor != null)
        .map(p => ({ year: new Date(p.Fecha).getFullYear(), value: Math.round(p.Valor) }))
        .sort((a, b) => a.year - b.year)
      if (name === 'Total Nacional') {
        shortTerm.national = parsed
        console.log(`    ✅ Nacional: ${parsed.length} puntos, último ${parsed[parsed.length - 1]?.year}`)
      } else {
        shortTerm.byCcaa[name] = parsed
      }
    } else {
      console.warn(`    ❌ ${name}: ${result.reason?.message}`)
      if (name !== 'Total Nacional') shortTerm.byCcaa[name] = []
    }
  }

  // Fetch long-term indicator projections in parallel
  const indicatorResults = await Promise.allSettled(
    PROJECTION_INDICATORS.map(({ code }) => fetchSeries(code, 100, fetcher))
  )

  const indicators = {}
  for (let i = 0; i < PROJECTION_INDICATORS.length; i++) {
    const { key, code } = PROJECTION_INDICATORS[i]
    const result = indicatorResults[i]
    if (result.status === 'fulfilled') {
      const parsed = result.value
        .filter(p => p.Valor != null)
        .map(p => ({ year: new Date(p.Fecha).getFullYear(), value: Math.round(p.Valor * 100) / 100 }))
        .sort((a, b) => a.year - b.year)
      indicators[key] = parsed
      const latest = parsed[parsed.length - 1]
      console.log(`    ✅ ${key} (${code}): ${parsed.length} puntos, último ${latest?.year}=${latest?.value}`)
    } else {
      console.warn(`    ❌ ${key} (${code}): ${result.reason?.message}`)
      indicators[key] = []
    }
  }

  return { shortTerm, indicators }
}

function fallbackProjections() {
  return {
    shortTerm: {
      national: [
        { year: 2024, value: 48610458 }, { year: 2025, value: 49265049 },
        { year: 2026, value: 49910256 }, { year: 2027, value: 50506066 },
        { year: 2028, value: 51033947 }, { year: 2029, value: 51489372 },
        { year: 2030, value: 51876063 }, { year: 2035, value: 53109717 },
        { year: 2039, value: 53747904 },
      ],
      byCcaa: {},
    },
    indicators: {
      dependencyOldAge: [
        { year: 2024, value: 31.30 }, { year: 2030, value: 34.39 },
        { year: 2040, value: 44.33 }, { year: 2050, value: 53.03 },
        { year: 2060, value: 52.67 }, { year: 2074, value: 52.67 },
      ],
      dependencyTotal: [
        { year: 2024, value: 53.30 }, { year: 2030, value: 56.39 },
        { year: 2040, value: 66.33 }, { year: 2050, value: 73.03 },
        { year: 2060, value: 72.67 }, { year: 2074, value: 73.89 },
      ],
      proportionOver65: [
        { year: 2024, value: 20.40 }, { year: 2030, value: 22.50 },
        { year: 2040, value: 27.00 }, { year: 2050, value: 30.00 },
        { year: 2060, value: 30.00 }, { year: 2074, value: 30.29 },
      ],
      populationGrowth: [
        { year: 2024, value: 13.40 }, { year: 2030, value: 7.00 },
        { year: 2040, value: 3.00 }, { year: 2050, value: 1.00 },
        { year: 2060, value: -0.50 }, { year: 2073, value: 0.29 },
      ],
      naturalBalance: [
        { year: 2024, value: -2.70 }, { year: 2030, value: -3.50 },
        { year: 2040, value: -4.50 }, { year: 2050, value: -5.50 },
        { year: 2060, value: -6.00 }, { year: 2073, value: -5.18 },
      ],
      netMigration: [
        { year: 2024, value: 16.10 }, { year: 2030, value: 10.00 },
        { year: 2040, value: 7.50 }, { year: 2050, value: 6.00 },
        { year: 2060, value: 5.50 }, { year: 2073, value: 5.48 },
      ],
    },
  }
}

// ─────────────────────────────────────────────
// Migration Flows (INE Estadística de Migraciones)
// ─────────────────────────────────────────────

/**
 * Fetch immigration and emigration flows, merging old (op=71) and new (op=455) series.
 */
async function fetchMigrationFlows(fetcher) {
  console.log()
  console.log('  📊 Flujos migratorios (INE Estadística de Migraciones)...')

  // Fetch all four series in parallel
  const [oldImmResult, oldEmResult, newImmResult, newEmResult] = await Promise.allSettled([
    fetchSeries('EM825679', 30, fetcher),   // old immigration (op=71, 2008-2020)
    fetchSeries('EM950865', 30, fetcher),   // old emigration (op=71, 2008-2020)
    fetchSeries('EM1765217', 10, fetcher),  // new immigration (op=455, 2021+)
    fetchSeries('EM1843418', 10, fetcher),  // new emigration (op=455, 2021+)
  ])

  // Parse each series into year->value maps
  function parseToYearMap(result) {
    if (result.status !== 'fulfilled') return {}
    const map = {}
    for (const p of result.value) {
      if (p.Valor == null) continue
      const year = new Date(p.Fecha).getFullYear()
      map[year] = Math.round(p.Valor)
    }
    return map
  }

  const oldImm = parseToYearMap(oldImmResult)
  const oldEm = parseToYearMap(oldEmResult)
  const newImm = parseToYearMap(newImmResult)
  const newEm = parseToYearMap(newEmResult)

  // Merge: prefer newer source (op=455) for 2021+, use old for earlier years
  const immByYear = { ...oldImm }
  for (const [year, val] of Object.entries(newImm)) {
    if (Number(year) >= 2021) immByYear[year] = val
  }

  const emByYear = { ...oldEm }
  for (const [year, val] of Object.entries(newEm)) {
    if (Number(year) >= 2021) emByYear[year] = val
  }

  // Build sorted arrays and compute net migration
  const allYears = [...new Set([...Object.keys(immByYear), ...Object.keys(emByYear)].map(Number))].sort((a, b) => a - b)

  const immigration = allYears
    .filter(y => immByYear[y] != null)
    .map(y => ({ year: y, value: immByYear[y] }))

  const emigration = allYears
    .filter(y => emByYear[y] != null)
    .map(y => ({ year: y, value: emByYear[y] }))

  const netMigration = allYears
    .filter(y => immByYear[y] != null && emByYear[y] != null)
    .map(y => ({ year: y, value: immByYear[y] - emByYear[y] }))

  console.log(`    ✅ Inmigración: ${immigration.length} años, Emigración: ${emigration.length} años, Neta: ${netMigration.length} años`)

  return { immigration, emigration, netMigration }
}

function fallbackMigrationFlows() {
  return {
    immigration: [
      { year: 2008, value: 599074 }, { year: 2010, value: 360704 },
      { year: 2012, value: 304054 }, { year: 2014, value: 305454 },
      { year: 2016, value: 414746 }, { year: 2018, value: 643684 },
      { year: 2019, value: 750480 }, { year: 2020, value: 467918 },
      { year: 2021, value: 887960 }, { year: 2022, value: 1258894 },
      { year: 2023, value: 1250991 }, { year: 2024, value: 1288562 },
    ],
    emigration: [
      { year: 2008, value: 288432 }, { year: 2010, value: 403379 },
      { year: 2012, value: 446606 }, { year: 2014, value: 400430 },
      { year: 2016, value: 327325 }, { year: 2018, value: 309526 },
      { year: 2019, value: 296248 }, { year: 2020, value: 248561 },
      { year: 2021, value: 696866 }, { year: 2022, value: 531889 },
      { year: 2023, value: 608695 }, { year: 2024, value: 662294 },
    ],
    netMigration: [
      { year: 2008, value: 310642 }, { year: 2010, value: -42675 },
      { year: 2012, value: -142552 }, { year: 2014, value: -94976 },
      { year: 2016, value: 87421 }, { year: 2018, value: 334158 },
      { year: 2019, value: 454232 }, { year: 2020, value: 219357 },
      { year: 2021, value: 191094 }, { year: 2022, value: 727005 },
      { year: 2023, value: 642296 }, { year: 2024, value: 626268 },
    ],
  }
}

// ─────────────────────────────────────────────
// Provincial Population (INE Padrón — table 2852)
// ─────────────────────────────────────────────

/** Province series from INE Padrón Continuo (table 2852), total population per province. */
const PROVINCE_SERIES = [
  { code: 'DPOP4', name: 'Álava', ccaa: 'País Vasco' },
  { code: 'DPOP160', name: 'Albacete', ccaa: 'Castilla-La Mancha' },
  { code: 'DPOP424', name: 'Alicante', ccaa: 'C. Valenciana' },
  { code: 'DPOP850', name: 'Almería', ccaa: 'Andalucía' },
  { code: 'DPOP15001', name: 'Asturias', ccaa: 'P. de Asturias' },
  { code: 'DPOP1162', name: 'Ávila', ccaa: 'Castilla y León' },
  { code: 'DPOP1909', name: 'Badajoz', ccaa: 'Extremadura' },
  { code: 'DPOP2404', name: 'Baleares', ccaa: 'Islas Baleares' },
  { code: 'DPOP2608', name: 'Barcelona', ccaa: 'Cataluña' },
  { code: 'DPOP22522', name: 'Bizkaia', ccaa: 'País Vasco' },
  { code: 'DPOP3544', name: 'Burgos', ccaa: 'Castilla y León' },
  { code: 'DPOP4660', name: 'Cáceres', ccaa: 'Extremadura' },
  { code: 'DPOP5320', name: 'Cádiz', ccaa: 'Andalucía' },
  { code: 'DPOP17359', name: 'Cantabria', ccaa: 'Cantabria' },
  { code: 'DPOP5455', name: 'Castellón', ccaa: 'C. Valenciana' },
  { code: 'DPOP5866', name: 'Ciudad Real', ccaa: 'Castilla-La Mancha' },
  { code: 'DPOP6175', name: 'Córdoba', ccaa: 'Andalucía' },
  { code: 'DPOP6403', name: 'A Coruña', ccaa: 'Galicia' },
  { code: 'DPOP6688', name: 'Cuenca', ccaa: 'Castilla-La Mancha' },
  { code: 'DPOP9448', name: 'Gipuzkoa', ccaa: 'País Vasco' },
  { code: 'DPOP7405', name: 'Girona', ccaa: 'Cataluña' },
  { code: 'DPOP8074', name: 'Granada', ccaa: 'Andalucía' },
  { code: 'DPOP8581', name: 'Guadalajara', ccaa: 'Castilla-La Mancha' },
  { code: 'DPOP9715', name: 'Huelva', ccaa: 'Andalucía' },
  { code: 'DPOP9955', name: 'Huesca', ccaa: 'Aragón' },
  { code: 'DPOP10564', name: 'Jaén', ccaa: 'Andalucía' },
  { code: 'DPOP10858', name: 'León', ccaa: 'Castilla y León' },
  { code: 'DPOP11497', name: 'Lleida', ccaa: 'Cataluña' },
  { code: 'DPOP12193', name: 'La Rioja', ccaa: 'La Rioja' },
  { code: 'DPOP12718', name: 'Lugo', ccaa: 'Galicia' },
  { code: 'DPOP12922', name: 'Madrid', ccaa: 'C. de Madrid' },
  { code: 'DPOP13462', name: 'Málaga', ccaa: 'Andalucía' },
  { code: 'DPOP13765', name: 'Murcia', ccaa: 'R. de Murcia' },
  { code: 'DPOP13903', name: 'Navarra', ccaa: 'Navarra' },
  { code: 'DPOP14722', name: 'Ourense', ccaa: 'Galicia' },
  { code: 'DPOP15238', name: 'Palencia', ccaa: 'Castilla y León' },
  { code: 'DPOP15814', name: 'Las Palmas', ccaa: 'Canarias' },
  { code: 'DPOP15919', name: 'Pontevedra', ccaa: 'Galicia' },
  { code: 'DPOP16108', name: 'Salamanca', ccaa: 'Castilla y León' },
  { code: 'DPOP17197', name: 'S.C. Tenerife', ccaa: 'Canarias' },
  { code: 'DPOP17668', name: 'Segovia', ccaa: 'Castilla y León' },
  { code: 'DPOP18298', name: 'Sevilla', ccaa: 'Andalucía' },
  { code: 'DPOP18616', name: 'Soria', ccaa: 'Castilla y León' },
  { code: 'DPOP19168', name: 'Tarragona', ccaa: 'Cataluña' },
  { code: 'DPOP19720', name: 'Teruel', ccaa: 'Aragón' },
  { code: 'DPOP20431', name: 'Toledo', ccaa: 'Castilla-La Mancha' },
  { code: 'DPOP21046', name: 'Valencia', ccaa: 'C. Valenciana' },
  { code: 'DPOP21844', name: 'Valladolid', ccaa: 'Castilla y León' },
  { code: 'DPOP22858', name: 'Zamora', ccaa: 'Castilla y León' },
  { code: 'DPOP23605', name: 'Zaragoza', ccaa: 'Aragón' },
  { code: 'DPOP33147', name: 'Ceuta', ccaa: 'Ceuta' },
  { code: 'DPOP33144', name: 'Melilla', ccaa: 'Melilla' },
]

/**
 * Fetch provincial population from INE Padrón Continuo (table 2852).
 * Fetches 52 province series in batches of 20 to be API-friendly.
 */
async function fetchProvincialPopulation(fetcher) {
  console.log()
  console.log('  📊 Población provincial (INE Padrón tabla 2852)...')

  const BATCH_SIZE = 20
  const allResults = []
  for (let i = 0; i < PROVINCE_SERIES.length; i += BATCH_SIZE) {
    const batch = PROVINCE_SERIES.slice(i, i + BATCH_SIZE)
    const batchResults = await Promise.allSettled(
      batch.map(({ code }) => fetchSeries(code, 10, fetcher))
    )
    allResults.push(...batch.map((spec, idx) => ({ ...spec, result: batchResults[idx] })))
  }

  const entries = []
  let latestYear = 0

  for (const { name, ccaa, result } of allResults) {
    if (result.status !== 'fulfilled') {
      console.warn(`    ❌ ${name}: ${result.reason?.message}`)
      continue
    }
    const historical = result.value
      .filter(p => p.Valor != null)
      .map(p => ({ year: p.Anyo ?? new Date(p.Fecha).getFullYear(), value: Math.round(p.Valor) }))
      .sort((a, b) => a.year - b.year)

    if (historical.length === 0) continue
    const latest = historical[historical.length - 1]
    if (latest.year > latestYear) latestYear = latest.year

    entries.push({ code: name, name, ccaa, population: latest.value, historical })
  }

  console.log(`    ✅ ${entries.length} provincias, último año ${latestYear}`)
  return { latestYear, entries }
}

function fallbackProvincialPopulation() {
  return {
    latestYear: 2025,
    entries: [
      { code: 'Madrid', name: 'Madrid', ccaa: 'C. de Madrid', population: 7_000_000, historical: [{ year: 2025, value: 7_000_000 }] },
      { code: 'Barcelona', name: 'Barcelona', ccaa: 'Cataluña', population: 5_800_000, historical: [{ year: 2025, value: 5_800_000 }] },
      { code: 'Valencia', name: 'Valencia', ccaa: 'C. Valenciana', population: 2_650_000, historical: [{ year: 2025, value: 2_650_000 }] },
      { code: 'Sevilla', name: 'Sevilla', ccaa: 'Andalucía', population: 1_970_000, historical: [{ year: 2025, value: 1_970_000 }] },
      { code: 'Alicante', name: 'Alicante', ccaa: 'C. Valenciana', population: 1_950_000, historical: [{ year: 2025, value: 1_950_000 }] },
      { code: 'Málaga', name: 'Málaga', ccaa: 'Andalucía', population: 1_760_000, historical: [{ year: 2025, value: 1_760_000 }] },
      { code: 'Murcia', name: 'Murcia', ccaa: 'R. de Murcia', population: 1_560_000, historical: [{ year: 2025, value: 1_560_000 }] },
      { code: 'Cádiz', name: 'Cádiz', ccaa: 'Andalucía', population: 1_250_000, historical: [{ year: 2025, value: 1_250_000 }] },
      { code: 'Bizkaia', name: 'Bizkaia', ccaa: 'País Vasco', population: 1_160_000, historical: [{ year: 2025, value: 1_160_000 }] },
      { code: 'Las Palmas', name: 'Las Palmas', ccaa: 'Canarias', population: 1_150_000, historical: [{ year: 2025, value: 1_150_000 }] },
    ],
  }
}

/**
 * Download detailed demographics: vital stats, life expectancy, population pyramid
 * with immigration breakdown, dependency ratios, and immigration share.
 *
 * @param {Function} fetcher - Optional fetcher function (defaults to fetchWithRetry)
 * @returns {Promise<Object>} Detailed demographics data
 */
// ─────────────────────────────────────────────
// Fertility Projections (static reference data)
// ─────────────────────────────────────────────

const FERTILITY_PROJECTION_SERIES = [
  {
    source: 'ONU WPP 2010',
    publishedYear: 2010,
    // UN assumed convergence to ~1.85 for all below-replacement countries
    points: [
      { year: 2010, value: 1.37 }, // baseline
      { year: 2025, value: 1.60 },
      { year: 2050, value: 1.85 },
    ],
  },
  {
    source: 'ONU WPP 2017',
    publishedYear: 2017,
    // UN DESA: "fertility for Europe projected to increase from 1.6 to nearly 1.8 in 2045-2050"
    points: [
      { year: 2017, value: 1.33 }, // baseline
      { year: 2025, value: 1.48 },
      { year: 2050, value: 1.80 },
    ],
  },
  {
    source: 'ONU WPP 2022',
    publishedYear: 2022,
    // Significantly revised down after persistent decline
    points: [
      { year: 2022, value: 1.16 }, // baseline
      { year: 2025, value: 1.22 },
      { year: 2030, value: 1.26 },
      { year: 2040, value: 1.31 },
      { year: 2050, value: 1.36 },
    ],
  },
  {
    source: 'ONU WPP 2024',
    publishedYear: 2024,
    points: [
      { year: 2024, value: 1.12 },
      { year: 2026, value: 1.24 },
      { year: 2030, value: 1.26 },
      { year: 2035, value: 1.29 },
      { year: 2040, value: 1.31 },
      { year: 2050, value: 1.36 },
    ],
  },
  {
    source: 'INE 2018',
    publishedYear: 2018,
    // INE 2018: TFR 1.31 (2017) → 1.46 by 2050
    points: [
      { year: 2018, value: 1.31 },
      { year: 2050, value: 1.46 },
    ],
  },
  {
    source: 'INE 2020',
    publishedYear: 2020,
    // Similar to AIReF 2020: ~1.43 by 2050
    points: [
      { year: 2020, value: 1.23 },
      { year: 2050, value: 1.43 },
    ],
  },
  {
    source: 'INE 2024',
    publishedYear: 2024,
    points: [
      { year: 2024, value: 1.16 },
      { year: 2038, value: 1.24 },
      { year: 2050, value: 1.30 },
    ],
  },
]

/**
 * Compute a linear regression from actual fertility data (last 10 years) and
 * extrapolate to 2050 in 5-year increments.
 *
 * @param {Array<{year: number, value: number}>} actual
 * @returns {Array<{year: number, value: number}>}
 */
function computeFertilityLinearRegression(actual, yearsBack = 10) {
  const lastYear = actual.length ? actual[actual.length - 1].year : 0
  const cutoff = lastYear - yearsBack + 1
  const recent = actual.filter(p => p.year >= cutoff)
  if (recent.length < 3) return []

  const n = recent.length
  const sumX = recent.reduce((s, p) => s + p.year, 0)
  const sumY = recent.reduce((s, p) => s + p.value, 0)
  const sumXY = recent.reduce((s, p) => s + p.year * p.value, 0)
  const sumX2 = recent.reduce((s, p) => s + p.year * p.year, 0)

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  const intercept = (sumY - slope * sumX) / n

  const points = []
  for (let y = lastYear; y <= 2050; y += 5) {
    const value = Math.round((slope * y + intercept) * 100) / 100
    points.push({ year: y, value: Math.max(value, 0.5) })
  }
  // Make sure 2050 is included
  if (points[points.length - 1]?.year !== 2050) {
    const value = Math.round((slope * 2050 + intercept) * 100) / 100
    points.push({ year: 2050, value: Math.max(value, 0.5) })
  }
  return points
}

/**
 * Build fertility projections comparison data from actual fertility rate series.
 *
 * @param {Array<{year: number, value: number}>} actualFertilityRate
 * @returns {Object} FertilityProjectionsData
 */
function buildFertilityProjections(actualFertilityRate) {
  return {
    actual: actualFertilityRate,
    projections: FERTILITY_PROJECTION_SERIES,
    linearRegression: computeFertilityLinearRegression(actualFertilityRate, 10),
    ourEstimate: computeFertilityLinearRegression(actualFertilityRate, 5),
    replacementLevel: 2.1,
  }
}

export async function downloadDemographicsDetail(fetcher = fetchWithRetry) {
  console.log()
  console.log('  === Datos demográficos detallados ===')

  try {
    // Fetch vital stats, life expectancy, projections, migration flows and provincial pop in parallel
    const [vitalStats, lifeExpectancy, projections, migrationFlows, provincialPopulation] = await Promise.all([
      fetchVitalStats(fetcher),
      fetchLifeExpectancy(fetcher),
      fetchProjections(fetcher).catch(err => {
        console.warn('⚠️ Proyecciones fallback:', err.message)
        return fallbackProjections()
      }),
      fetchMigrationFlows(fetcher).catch(err => {
        console.warn('⚠️ Flujos migratorios fallback:', err.message)
        return fallbackMigrationFlows()
      }),
      fetchProvincialPopulation(fetcher).catch(err => {
        console.warn('⚠️ Población provincial fallback:', err.message)
        return fallbackProvincialPopulation()
      }),
    ])

    // Fetch pyramid (heavier, sequential to be API-friendly)
    const pyramid = await fetchPopulationPyramid(fetcher)

    // Derive ratios
    console.log()
    console.log('  📊 Derivando ratios...')
    const dependencyRatio = deriveDependencyRatios(pyramid)
    const immigrationShare = deriveImmigrationShare(pyramid)

    console.log()
    console.log('  ✅ Datos demográficos detallados completados')

    const fertilityProjections = buildFertilityProjections(vitalStats?.fertilityRate ?? fallbackDemographicsDetail().vitalStats.fertilityRate)

    return {
      vitalStats,
      lifeExpectancy,
      pyramid,
      dependencyRatio,
      immigrationShare,
      projections,
      migrationFlows,
      provincialPopulation,
      fertilityProjections,
      sourceAttribution: {
        vitalStats: {
          source: 'INE — Indicadores Demográficos Básicos',
          type: 'api',
          url: 'https://www.ine.es/jaxiT3/Tabla.htm?t=1381',
        },
        lifeExpectancy: {
          source: 'INE — Tablas de Mortalidad',
          type: 'api',
          url: 'https://www.ine.es/jaxiT3/Tabla.htm?t=48882',
        },
        pyramid: {
          source: 'INE — Cifras de Población por lugar de nacimiento',
          type: 'api',
          url: 'https://www.ine.es/jaxiT3/Tabla.htm?t=56943',
        },
        projections: {
          source: 'INE — Proyecciones de Población (corto y largo plazo)',
          type: 'api',
          url: 'https://www.ine.es/dyngs/INEbase/es/operacion.htm?c=Estadistica_C&cid=1254736176953',
        },
        migrationFlows: {
          source: 'INE — Estadística de Migraciones',
          type: 'api',
          url: 'https://www.ine.es/dyngs/INEbase/es/operacion.htm?c=Estadistica_C&cid=1254736177000',
        },
        provincialPopulation: {
          source: 'INE — Padrón Continuo (tabla 2852)',
          type: 'api',
          url: 'https://www.ine.es/jaxiT3/Tabla.htm?t=2852',
        },
        fertilityProjections: {
          source: 'INE / ONU WPP — Proyecciones históricas de fecundidad',
          type: 'reference',
          url: 'https://population.un.org/wpp/',
          note: 'Comparativa de proyecciones históricas vs datos reales',
        },
      },
    }
  } catch (error) {
    console.warn(`  ❌ Error en datos demográficos detallados: ${error.message}`)
    console.warn('     Usando valores de respaldo para demografía detallada')
    return fallbackDemographicsDetail()
  }
}

/**
 * Fallback data for demographics detail with realistic 2024 reference values.
 */
function fallbackDemographicsDetail() {
  return {
    vitalStats: {
      birthRate: [
        { year: 2019, value: 7.62 }, { year: 2020, value: 7.19 }, { year: 2021, value: 7.12 },
        { year: 2022, value: 6.73 }, { year: 2023, value: 6.53 }, { year: 2024, value: 6.49 },
      ],
      deathRate: [
        { year: 2019, value: 8.83 }, { year: 2020, value: 10.37 }, { year: 2021, value: 9.33 },
        { year: 2022, value: 9.11 }, { year: 2023, value: 9.10 }, { year: 2024, value: 9.50 },
      ],
      fertilityRate: [
        { year: 2019, value: 1.24 }, { year: 2020, value: 1.19 }, { year: 2021, value: 1.19 },
        { year: 2022, value: 1.16 }, { year: 2023, value: 1.12 }, { year: 2024, value: 1.16 },
      ],
      naturalGrowth: [
        { year: 2019, value: -1.21 }, { year: 2020, value: -3.18 }, { year: 2021, value: -2.21 },
        { year: 2022, value: -2.38 }, { year: 2023, value: -2.57 }, { year: 2024, value: -3.01 },
      ],
    },
    lifeExpectancy: {
      both: [
        { year: 2019, value: 83.58 }, { year: 2020, value: 82.33 }, { year: 2021, value: 83.06 },
        { year: 2022, value: 83.08 }, { year: 2023, value: 83.50 }, { year: 2024, value: 83.50 },
      ],
      male: [
        { year: 2019, value: 80.87 }, { year: 2020, value: 79.59 }, { year: 2021, value: 80.24 },
        { year: 2022, value: 80.35 }, { year: 2023, value: 80.70 }, { year: 2024, value: 80.70 },
      ],
      female: [
        { year: 2019, value: 86.22 }, { year: 2020, value: 85.06 }, { year: 2021, value: 85.83 },
        { year: 2022, value: 85.75 }, { year: 2023, value: 86.10 }, { year: 2024, value: 86.10 },
      ],
    },
    pyramid: {
      years: [2024],
      ageGroups: PYRAMID_AGE_GROUPS,
      regions: PYRAMID_REGIONS,
      byYear: {
        '2024': {
          male: {
            spain: [880000, 1000000, 1100000, 1080000, 1050000, 1020000, 1100000, 1250000, 1450000, 1550000, 1500000, 1380000, 1200000, 1050000, 850000, 650000, 400000, 180000, 60000],
            eu: [20000, 22000, 24000, 28000, 35000, 45000, 55000, 60000, 55000, 45000, 38000, 30000, 22000, 15000, 10000, 6000, 3000, 1000, 300],
            restEurope: [8000, 9000, 10000, 14000, 20000, 28000, 32000, 30000, 25000, 18000, 12000, 8000, 5000, 3000, 2000, 1000, 500, 200, 50],
            africa: [35000, 32000, 28000, 30000, 45000, 65000, 80000, 85000, 75000, 55000, 35000, 20000, 12000, 7000, 4000, 2000, 800, 300, 80],
            americas: [30000, 28000, 30000, 38000, 55000, 70000, 85000, 90000, 80000, 65000, 50000, 35000, 22000, 14000, 8000, 5000, 2500, 1000, 250],
            asiaOceania: [12000, 11000, 12000, 16000, 25000, 35000, 40000, 38000, 30000, 22000, 15000, 10000, 6000, 3500, 2000, 1000, 400, 150, 40],
          },
          female: {
            spain: [830000, 940000, 1040000, 1020000, 1000000, 980000, 1060000, 1200000, 1400000, 1500000, 1470000, 1360000, 1230000, 1120000, 960000, 800000, 570000, 310000, 150000],
            eu: [19000, 21000, 23000, 27000, 35000, 48000, 58000, 62000, 56000, 48000, 40000, 32000, 25000, 18000, 12000, 8000, 4500, 2000, 600],
            restEurope: [7500, 8500, 9500, 14000, 22000, 32000, 38000, 35000, 28000, 20000, 14000, 10000, 7000, 4500, 3000, 1800, 800, 350, 100],
            africa: [32000, 29000, 25000, 25000, 35000, 50000, 55000, 52000, 42000, 30000, 20000, 12000, 8000, 5000, 3000, 1500, 600, 250, 60],
            americas: [28000, 27000, 30000, 40000, 60000, 80000, 100000, 105000, 95000, 78000, 60000, 42000, 28000, 18000, 11000, 7000, 3500, 1500, 400],
            asiaOceania: [11000, 10000, 11000, 14000, 22000, 30000, 34000, 32000, 26000, 19000, 13000, 8500, 5500, 3000, 1800, 1000, 450, 180, 50],
          },
        },
      },
    },
    dependencyRatio: {
      oldAge: 0.30,
      youth: 0.22,
      total: 0.52,
    },
    immigrationShare: {
      total: 0.189,
      byRegion: { eu: 0.052, restEurope: 0.020, africa: 0.038, americas: 0.068, asiaOceania: 0.016 },
      historical: [{ year: 2024, value: 0.189 }],
    },
    projections: fallbackProjections(),
    migrationFlows: fallbackMigrationFlows(),
    provincialPopulation: fallbackProvincialPopulation(),
    fertilityProjections: buildFertilityProjections([
      { year: 2019, value: 1.24 }, { year: 2020, value: 1.19 }, { year: 2021, value: 1.19 },
      { year: 2022, value: 1.16 }, { year: 2023, value: 1.12 }, { year: 2024, value: 1.16 },
    ]),
    sourceAttribution: {
      vitalStats: {
        source: 'Valor referencia 2024 (INE IDB)',
        type: 'fallback',
        url: 'https://www.ine.es/jaxiT3/Tabla.htm?t=1381',
        note: 'Indicadores Demográficos Básicos referencia',
      },
      lifeExpectancy: {
        source: 'Valor referencia 2024 (INE Mortalidad)',
        type: 'fallback',
        url: 'https://www.ine.es/jaxiT3/Tabla.htm?t=48882',
        note: 'Esperanza de vida referencia',
      },
      pyramid: {
        source: 'Valor referencia 2024 (INE tabla 56943)',
        type: 'fallback',
        url: 'https://www.ine.es/jaxiT3/Tabla.htm?t=56943',
        note: 'Pirámide de población referencia',
      },
      projections: {
        source: 'Valor referencia (INE Proyecciones de Población)',
        type: 'fallback',
        url: 'https://www.ine.es/dyngs/INEbase/es/operacion.htm?c=Estadistica_C&cid=1254736176953',
        note: 'Proyecciones de Población referencia',
      },
      migrationFlows: {
        source: 'Valor referencia (INE Estadística de Migraciones)',
        type: 'fallback',
        url: 'https://www.ine.es/dyngs/INEbase/es/operacion.htm?c=Estadistica_C&cid=1254736177000',
        note: 'Flujos migratorios referencia',
      },
      provincialPopulation: {
        source: 'Valor referencia (INE Padrón Continuo)',
        type: 'fallback',
        url: 'https://www.ine.es/jaxiT3/Tabla.htm?t=2852',
        note: 'Población provincial referencia',
      },
      fertilityProjections: {
        source: 'INE / ONU WPP — Proyecciones históricas de fecundidad',
        type: 'fallback',
        url: 'https://population.un.org/wpp/',
        note: 'Comparativa de proyecciones históricas vs datos reales',
      },
    },
  }
}

// ─────────────────────────────────────────────
// Full fallback
// ─────────────────────────────────────────────

function buildFallbackDemographics() {
  console.warn('⚠️  Usando datos de respaldo completos para demografía')

  const pop = fallbackPopulation()
  const active = fallbackActivePopulation()
  const gdpVal = fallbackGDP()
  const sal = fallbackSalary()
  const cpiVal = fallbackCPI()
  const detail = fallbackDemographicsDetail()

  return {
    lastUpdated: new Date().toISOString(),
    population: pop.value,
    activePopulation: active.value,
    gdp: gdpVal.value,
    averageSalary: sal.value,
    smi: 1_221,
    cpi: cpiVal.value,
    vitalStats: detail.vitalStats,
    lifeExpectancy: detail.lifeExpectancy,
    pyramid: detail.pyramid,
    dependencyRatio: detail.dependencyRatio,
    immigrationShare: detail.immigrationShare,
    projections: detail.projections,
    migrationFlows: detail.migrationFlows,
    provincialPopulation: detail.provincialPopulation,
    fertilityProjections: detail.fertilityProjections,
    sourceAttribution: {
      population: pop.attribution,
      activePopulation: active.attribution,
      gdp: gdpVal.attribution,
      averageSalary: sal.attribution,
      smi: {
        source: 'BOE — Salario Mínimo Interprofesional 2026',
        type: 'fallback',
        url: 'https://www.boe.es/boe/dias/2026/02/18/pdfs/BOE-A-2026-3456.pdf',
        note: 'SMI 2026: 1.221€/mes (17.094€/14 pagas)'
      },
      cpi: cpiVal.attribution,
      ...detail.sourceAttribution,
    }
  }
}
