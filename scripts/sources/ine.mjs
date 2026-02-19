import { fetchWithRetry } from '../lib/fetch-utils.mjs'

const INE_BASE = 'https://servicios.ine.es/wstempus/js/ES'

/**
 * Download demographics from INE API
 *
 * Uses DATOS_SERIE endpoint with specific series codes (much more reliable
 * than DATOS_TABLA which returns complex multi-series responses).
 *
 * Series codes discovered via INE API exploration:
 *   - ECP320:    Cifras de Población — Total Nacional
 *   - EPA387794: EPA — Activos Total (en miles)
 *   - CNTR6597:  PIB precios corrientes, ajustado estacionalidad (trimestral, millones €)
 *
 * @returns {Promise<Object>} Demographics data object
 */
export async function downloadDemographics() {
  console.log('\n=== Descargando datos demográficos (INE) ===')
  console.log(`  Base API: ${INE_BASE}`)
  console.log(`  Método: DATOS_SERIE (series individuales)`)
  console.log()

  try {
    // Fetch all series in parallel
    const [population, activePopulation, gdp, salary, cpi] = await Promise.allSettled([
      fetchPopulation(),
      fetchActivePopulation(),
      fetchGDP(),
      fetchAverageSalary(),
      fetchCPI()
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
async function fetchSeries(seriesCode, nult = 1) {
  const url = `${INE_BASE}/DATOS_SERIE/${seriesCode}?nult=${nult}`
  console.log(`    URL: ${url}`)

  const response = await fetchWithRetry(url, {
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
function formatINEDate(timestamp) {
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
// Full fallback
// ─────────────────────────────────────────────

function buildFallbackDemographics() {
  console.warn('⚠️  Usando datos de respaldo completos para demografía')

  const pop = fallbackPopulation()
  const active = fallbackActivePopulation()
  const gdpVal = fallbackGDP()
  const sal = fallbackSalary()
  const cpiVal = fallbackCPI()

  return {
    lastUpdated: new Date().toISOString(),
    population: pop.value,
    activePopulation: active.value,
    gdp: gdpVal.value,
    averageSalary: sal.value,
    smi: 1_221,
    cpi: cpiVal.value,
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
      cpi: cpiVal.attribution
    }
  }
}
