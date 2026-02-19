import { fetchWithRetry } from '../lib/fetch-utils.mjs'

const EUROSTAT_BASE = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data'

/** Countries to fetch (Eurostat codes) */
const COUNTRIES = ['ES', 'DE', 'FR', 'IT', 'PT', 'EL', 'NL', 'EU27_2020']

/** Human-readable country names in Spanish */
const COUNTRY_NAMES = {
  ES: 'España',
  DE: 'Alemania',
  FR: 'Francia',
  IT: 'Italia',
  PT: 'Portugal',
  EL: 'Grecia',
  NL: 'Países Bajos',
  EU27_2020: 'UE-27'
}

/**
 * Indicator definitions — dataset + filter params
 * Each indicator fetches a single value per country for the latest available year.
 */
const INDICATORS = {
  debtToGDP: {
    dataset: 'gov_10dd_edpt1',
    params: { freq: 'A', unit: 'PC_GDP', sector: 'S13', na_item: 'GD' },
    label: 'Deuda/PIB',
    unit: '% del PIB'
  },
  deficit: {
    dataset: 'gov_10dd_edpt1',
    params: { freq: 'A', unit: 'PC_GDP', sector: 'S13', na_item: 'B9' },
    label: 'Déficit/superávit',
    unit: '% del PIB'
  },
  expenditureToGDP: {
    dataset: 'gov_10a_main',
    params: { freq: 'A', unit: 'PC_GDP', sector: 'S13', na_item: 'TE' },
    label: 'Gasto público/PIB',
    unit: '% del PIB'
  },
  socialSpendingToGDP: {
    dataset: 'gov_10a_exp',
    params: { freq: 'A', unit: 'PC_GDP', sector: 'S13', cofog99: 'GF10', na_item: 'TE' },
    label: 'Gasto social/PIB',
    unit: '% del PIB'
  },
  unemploymentRate: {
    dataset: 'une_rt_a',
    params: { freq: 'A', sex: 'T', age: 'Y15-74', unit: 'PC_ACT' },
    label: 'Tasa de paro',
    unit: '%'
  }
}

/**
 * Download Eurostat comparative data for Spain vs EU
 * @returns {Promise<Object>} Eurostat data object
 */
export async function downloadEurostatData() {
  console.log('\n=== Descargando datos de Eurostat ===')

  try {
    const indicatorEntries = Object.entries(INDICATORS)

    // Fetch all indicators in parallel
    const results = await Promise.allSettled(
      indicatorEntries.map(([key, config]) => fetchIndicator(key, config))
    )

    const indicators = {}
    let latestYear = 0

    for (let i = 0; i < indicatorEntries.length; i++) {
      const [key] = indicatorEntries[i]
      const result = results[i]

      if (result.status === 'fulfilled' && result.value) {
        indicators[key] = result.value.values
        if (result.value.year > latestYear) {
          latestYear = result.value.year
        }
        console.log(`  ✅ ${key}: año ${result.value.year}, ${Object.keys(result.value.values).length} países`)
      } else {
        const reason = result.status === 'rejected' ? result.reason?.message : 'sin datos'
        console.warn(`  ⚠️ ${key}: fallback — ${reason}`)
        indicators[key] = FALLBACK_DATA.indicators[key] || {}
      }
    }

    if (latestYear === 0) {
      latestYear = FALLBACK_DATA.year
    }

    const data = {
      lastUpdated: new Date().toISOString(),
      year: latestYear,
      countries: COUNTRIES,
      countryNames: COUNTRY_NAMES,
      indicators,
      indicatorMeta: Object.fromEntries(
        indicatorEntries.map(([key, config]) => [key, { label: config.label, unit: config.unit }])
      ),
      sourceAttribution: {
        eurostat: {
          source: 'Eurostat',
          type: 'api',
          url: 'https://ec.europa.eu/eurostat/databrowser/',
          date: new Date().toISOString().split('T')[0],
          note: `Datos comparativos EU-27 (${latestYear})`
        }
      }
    }

    const countryCount = Object.keys(data.countryNames).length
    const indicatorCount = Object.keys(data.indicators).length
    console.log(`✅ Eurostat descargado: ${indicatorCount} indicadores, ${countryCount} países, año ${latestYear}`)

    return data
  } catch (error) {
    console.error('❌ Error descargando Eurostat:', error.message)
    return buildFallbackEurostatData()
  }
}

/**
 * Fetch a single indicator from Eurostat for all countries
 * @param {string} key - Indicator key
 * @param {object} config - Indicator config with dataset and params
 * @returns {Promise<{values: object, year: number}>}
 */
async function fetchIndicator(key, config) {
  const { dataset, params } = config

  // Build URL with query params
  const url = new URL(`${EUROSTAT_BASE}/${dataset}`)

  // Add filter params
  for (const [paramKey, paramValue] of Object.entries(params)) {
    url.searchParams.append(paramKey, paramValue)
  }

  // Add countries
  for (const geo of COUNTRIES) {
    url.searchParams.append('geo', geo)
  }

  // Request last 3 years to maximize chance of getting data
  const currentYear = new Date().getFullYear()
  url.searchParams.append('sinceTimePeriod', String(currentYear - 3))
  url.searchParams.append('untilTimePeriod', String(currentYear))

  console.log(`  Descargando ${key} (${dataset})...`)

  const response = await fetchWithRetry(url.toString(), {}, { maxRetries: 1, timeoutMs: 20000 })
  const data = await response.json()

  return parseJsonStat(data, COUNTRIES)
}

/**
 * Parse JSON-stat 2.0 response from Eurostat
 * Extracts values per country for the latest available year.
 *
 * @param {object} data - JSON-stat response
 * @param {string[]} countries - Country codes to extract
 * @returns {{ values: Record<string, number>, year: number }}
 */
function parseJsonStat(data, countries) {
  const dims = data.id
  const sizes = data.size
  const values = data.value

  if (!dims || !sizes || !values) {
    throw new Error('Respuesta JSON-stat inválida')
  }

  // Find geo and time dimension indices
  const geoDimIdx = dims.indexOf('geo')
  const timeDimIdx = dims.indexOf('time')

  if (geoDimIdx === -1 || timeDimIdx === -1) {
    throw new Error('Dimensiones geo/time no encontradas')
  }

  const geoCategoryIndex = data.dimension.geo.category.index
  const timeCategoryIndex = data.dimension.time.category.index

  // Get available years sorted descending (most recent first)
  const availableYears = Object.keys(timeCategoryIndex)
    .map(Number)
    .filter(y => !isNaN(y))
    .sort((a, b) => b - a)

  // For each country, get the value from the most recent year with data
  const result = {}
  let bestYear = 0

  for (const countryCode of countries) {
    const geoIdx = geoCategoryIndex[countryCode]
    if (geoIdx === undefined) continue

    for (const year of availableYears) {
      const timeIdx = timeCategoryIndex[String(year)]
      if (timeIdx === undefined) continue

      // Compute flat index
      const dimIndices = new Array(dims.length).fill(0)
      dimIndices[geoDimIdx] = geoIdx
      dimIndices[timeDimIdx] = timeIdx

      let flatIndex = 0
      let multiplier = 1
      for (let i = dims.length - 1; i >= 0; i--) {
        flatIndex += dimIndices[i] * multiplier
        multiplier *= sizes[i]
      }

      const val = values[flatIndex] ?? values[String(flatIndex)]
      if (val !== null && val !== undefined) {
        result[countryCode] = Math.round(val * 10) / 10
        if (year > bestYear) bestYear = year
        break // Got value for this country, move to next
      }
    }
  }

  if (Object.keys(result).length === 0) {
    throw new Error('Sin datos válidos en la respuesta')
  }

  return { values: result, year: bestYear }
}

/**
 * Fallback data — approximate Eurostat 2023 values
 */
const FALLBACK_DATA = {
  year: 2023,
  indicators: {
    debtToGDP: { ES: 107.7, DE: 63.6, FR: 110.6, IT: 137.3, PT: 99.1, EL: 161.9, NL: 46.5, EU27_2020: 81.7 },
    deficit: { ES: -3.6, DE: -2.1, FR: -5.5, IT: -7.4, PT: -1.2, EL: -1.6, NL: -0.3, EU27_2020: -3.5 },
    expenditureToGDP: { ES: 46.5, DE: 49.0, FR: 57.3, IT: 56.2, PT: 44.3, EL: 50.6, NL: 43.5, EU27_2020: 49.3 },
    socialSpendingToGDP: { ES: 18.6, DE: 21.6, FR: 24.0, IT: 23.2, PT: 16.3, EL: 20.2, NL: 15.4, EU27_2020: 20.2 },
    unemploymentRate: { ES: 12.1, DE: 3.0, FR: 7.3, IT: 7.6, PT: 6.5, EL: 11.1, NL: 3.6, EU27_2020: 6.0 }
  }
}

// ─── Revenue data (Spain-only time series from gov_10a_main) ───

const REVENUE_INDICATORS = {
  totalRevenue: {
    dataset: 'gov_10a_main',
    params: { freq: 'A', unit: 'MIO_EUR', sector: 'S13', na_item: 'TR' },
    label: 'Ingresos totales',
    unit: 'M€'
  },
  totalExpenditure: {
    dataset: 'gov_10a_main',
    params: { freq: 'A', unit: 'MIO_EUR', sector: 'S13', na_item: 'TE' },
    label: 'Gastos totales',
    unit: 'M€'
  },
  balance: {
    dataset: 'gov_10a_main',
    params: { freq: 'A', unit: 'MIO_EUR', sector: 'S13', na_item: 'B9' },
    label: 'Déficit/superávit',
    unit: 'M€'
  },
  taxesIndirect: {
    dataset: 'gov_10a_main',
    params: { freq: 'A', unit: 'MIO_EUR', sector: 'S13', na_item: 'D2REC' },
    label: 'Impuestos indirectos',
    unit: 'M€'
  },
  taxesDirect: {
    dataset: 'gov_10a_main',
    params: { freq: 'A', unit: 'MIO_EUR', sector: 'S13', na_item: 'D5REC' },
    label: 'Impuestos directos',
    unit: 'M€'
  },
  socialContributions: {
    dataset: 'gov_10a_main',
    params: { freq: 'A', unit: 'MIO_EUR', sector: 'S13', na_item: 'D61REC' },
    label: 'Cotizaciones sociales',
    unit: 'M€'
  }
}

const REVENUE_FALLBACK = {
  latestYear: 2024,
  byYear: {
    '2024': {
      totalRevenue: 673734,
      totalExpenditure: 725001,
      balance: -8218,
      taxesIndirect: 176937,
      taxesDirect: 198711,
      socialContributions: 210337,
      otherRevenue: 87749
    }
  }
}

/**
 * Parse JSON-stat 2.0 response returning all years for a single country
 * @param {object} data - JSON-stat response
 * @param {string} country - Country code (e.g. 'ES')
 * @returns {{ byYear: Record<string, number>, years: number[] }}
 */
function parseJsonStatTimeSeries(data, country) {
  const dims = data.id
  const sizes = data.size
  const values = data.value

  if (!dims || !sizes || !values) {
    throw new Error('Respuesta JSON-stat inválida')
  }

  const geoDimIdx = dims.indexOf('geo')
  const timeDimIdx = dims.indexOf('time')

  if (geoDimIdx === -1 || timeDimIdx === -1) {
    throw new Error('Dimensiones geo/time no encontradas')
  }

  const geoCategoryIndex = data.dimension.geo.category.index
  const timeCategoryIndex = data.dimension.time.category.index

  const geoIdx = geoCategoryIndex[country]
  if (geoIdx === undefined) {
    throw new Error(`País ${country} no encontrado en la respuesta`)
  }

  const byYear = {}
  const years = []

  for (const [yearStr, timeIdx] of Object.entries(timeCategoryIndex)) {
    const year = Number(yearStr)
    if (isNaN(year)) continue

    const dimIndices = new Array(dims.length).fill(0)
    dimIndices[geoDimIdx] = geoIdx
    dimIndices[timeDimIdx] = timeIdx

    let flatIndex = 0
    let multiplier = 1
    for (let i = dims.length - 1; i >= 0; i--) {
      flatIndex += dimIndices[i] * multiplier
      multiplier *= sizes[i]
    }

    const val = values[flatIndex] ?? values[String(flatIndex)]
    if (val !== null && val !== undefined) {
      byYear[String(year)] = Math.round(val)
      years.push(year)
    }
  }

  years.sort((a, b) => a - b)

  if (years.length === 0) {
    throw new Error('Sin datos válidos en la respuesta')
  }

  return { byYear, years }
}

/**
 * Fetch a single indicator time series for Spain from Eurostat
 * @param {string} key - Indicator key
 * @param {object} config - Indicator config with dataset and params
 * @returns {Promise<{byYear: Record<string, number>, years: number[]}>}
 */
async function fetchIndicatorTimeSeries(key, config) {
  const { dataset, params } = config

  const url = new URL(`${EUROSTAT_BASE}/${dataset}`)

  for (const [paramKey, paramValue] of Object.entries(params)) {
    url.searchParams.append(paramKey, paramValue)
  }

  url.searchParams.append('geo', 'ES')
  url.searchParams.append('sinceTimePeriod', '1995')

  console.log(`  Descargando ${key} (${dataset}, serie temporal ES)...`)

  const response = await fetchWithRetry(url.toString(), {}, { maxRetries: 1, timeoutMs: 20000 })
  const data = await response.json()

  return parseJsonStatTimeSeries(data, 'ES')
}

/**
 * Download revenue vs expenditure data for Spain (time series 1995–present)
 * @returns {Promise<Object>} Revenue data object
 */
export async function downloadRevenueData() {
  console.log('\n=== Descargando datos de Ingresos/Gastos (Eurostat gov_10a_main) ===')

  try {
    const indicatorEntries = Object.entries(REVENUE_INDICATORS)

    const results = await Promise.allSettled(
      indicatorEntries.map(([key, config]) => fetchIndicatorTimeSeries(key, config))
    )

    // Collect all years across all indicators
    const allYearsSet = new Set()
    const indicatorData = {}

    for (let i = 0; i < indicatorEntries.length; i++) {
      const [key] = indicatorEntries[i]
      const result = results[i]

      if (result.status === 'fulfilled' && result.value) {
        indicatorData[key] = result.value.byYear
        for (const y of result.value.years) {
          allYearsSet.add(y)
        }
        console.log(`  ✅ ${key}: ${result.value.years.length} años`)
      } else {
        const reason = result.status === 'rejected' ? result.reason?.message : 'sin datos'
        console.warn(`  ⚠️ ${key}: fallback — ${reason}`)
        indicatorData[key] = {}
      }
    }

    const years = [...allYearsSet].sort((a, b) => a - b)

    if (years.length === 0) {
      console.warn('⚠️  Sin años válidos, usando fallback')
      return buildFallbackRevenueData()
    }

    const latestYear = years[years.length - 1]

    // Build byYear structure
    const byYear = {}
    for (const year of years) {
      const y = String(year)
      const tr = indicatorData.totalRevenue?.[y]
      const te = indicatorData.totalExpenditure?.[y]

      // Only include years that have at least revenue or expenditure
      if (tr === undefined && te === undefined) continue

      const taxesIndirect = indicatorData.taxesIndirect?.[y] ?? 0
      const taxesDirect = indicatorData.taxesDirect?.[y] ?? 0
      const socialContributions = indicatorData.socialContributions?.[y] ?? 0
      const otherRevenue = tr !== undefined
        ? tr - taxesIndirect - taxesDirect - socialContributions
        : 0

      byYear[y] = {
        totalRevenue: tr ?? 0,
        totalExpenditure: te ?? 0,
        balance: indicatorData.balance?.[y] ?? 0,
        taxesIndirect,
        taxesDirect,
        socialContributions,
        otherRevenue
      }
    }

    const validYears = Object.keys(byYear).map(Number).sort((a, b) => a - b)

    const data = {
      lastUpdated: new Date().toISOString(),
      latestYear,
      years: validYears,
      byYear,
      indicatorMeta: Object.fromEntries(
        indicatorEntries.map(([key, config]) => [key, { label: config.label, unit: config.unit }])
      ),
      sourceAttribution: {
        revenue: {
          source: 'Eurostat',
          type: 'api',
          url: 'https://ec.europa.eu/eurostat/databrowser/view/gov_10a_main/',
          date: new Date().toISOString().split('T')[0],
          note: `Ingresos y gastos AAPP España, ${validYears.length} años (${validYears[0]}–${latestYear})`
        }
      }
    }

    console.log(`✅ Revenue descargado: ${validYears.length} años, ${indicatorEntries.length} indicadores, último año ${latestYear}`)

    return data
  } catch (error) {
    console.error('❌ Error descargando Revenue:', error.message)
    return buildFallbackRevenueData()
  }
}

/**
 * Build fallback revenue data
 */
function buildFallbackRevenueData() {
  console.warn('⚠️  Usando datos de respaldo para Revenue')

  return {
    lastUpdated: new Date().toISOString(),
    latestYear: REVENUE_FALLBACK.latestYear,
    years: [REVENUE_FALLBACK.latestYear],
    byYear: REVENUE_FALLBACK.byYear,
    indicatorMeta: Object.fromEntries(
      Object.entries(REVENUE_INDICATORS).map(([key, config]) => [key, { label: config.label, unit: config.unit }])
    ),
    sourceAttribution: {
      revenue: {
        source: 'Eurostat (referencia)',
        type: 'fallback',
        url: 'https://ec.europa.eu/eurostat/databrowser/view/gov_10a_main/',
        note: `Valores de referencia ${REVENUE_FALLBACK.latestYear}`
      }
    }
  }
}

/**
 * Build full fallback data object
 */
function buildFallbackEurostatData() {
  console.warn('⚠️  Usando datos de respaldo para Eurostat')

  return {
    lastUpdated: new Date().toISOString(),
    year: FALLBACK_DATA.year,
    countries: COUNTRIES,
    countryNames: COUNTRY_NAMES,
    indicators: FALLBACK_DATA.indicators,
    indicatorMeta: Object.fromEntries(
      Object.entries(INDICATORS).map(([key, config]) => [key, { label: config.label, unit: config.unit }])
    ),
    sourceAttribution: {
      eurostat: {
        source: 'Eurostat (referencia)',
        type: 'fallback',
        url: 'https://ec.europa.eu/eurostat/databrowser/',
        note: `Valores de referencia ${FALLBACK_DATA.year}`
      }
    }
  }
}
