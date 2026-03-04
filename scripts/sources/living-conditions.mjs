import { fetchWithRetry } from '../lib/fetch-utils.mjs'

const INE_BASE = 'https://servicios.ine.es/wstempus/js/ES'
const HISTORY_POINTS = 20
const SERIES = {
  arope: {
    code: 'ECV6275',
    source: 'INE — Tasa AROPE (ECV)',
    url: 'https://www.ine.es/jaxiT3/Tabla.htm?t=76847',
    decimals: 1,
  },
  gini: {
    code: 'ECV4838',
    source: 'INE — Índice de Gini (ECV)',
    url: 'https://www.ine.es/jaxiT3/Tabla.htm?t=76846',
    decimals: 1,
  },
  averageIncome: {
    code: 'ECV3761',
    source: 'INE — Renta media por persona (ECV)',
    url: `${INE_BASE}/DATOS_SERIE/ECV3761?nult=${HISTORY_POINTS}`,
    decimals: 0,
  },
}

/**
 * Download Living Conditions data (AROPE, Gini, Income) from INE
 *
 * @param {Function} fetcher - Optional fetcher function
 * @returns {Promise<Object>} Living conditions data object
 */
export async function downloadLivingConditions(fetcher = fetchWithRetry) {
  console.log('\n=== Descargando Encuesta de Condiciones de Vida (INE) ===')

  try {
    const [aropeResult, giniResult, incomeResult] = await Promise.allSettled([
      fetchSeries(SERIES.arope.code, HISTORY_POINTS, fetcher),
      fetchSeries(SERIES.gini.code, HISTORY_POINTS, fetcher),
      fetchSeries(SERIES.averageIncome.code, HISTORY_POINTS, fetcher),
    ])

    const aropeData = extractMetricSeries(aropeResult, fallbackArope(), SERIES.arope.decimals)
    const giniData = extractMetricSeries(giniResult, fallbackGini(), SERIES.gini.decimals)
    const incomeData = extractMetricSeries(
      incomeResult,
      fallbackAverageIncome(),
      SERIES.averageIncome.decimals,
    )

    const referenceYear = Math.max(aropeData.year, giniData.year, incomeData.year)

    const result = {
      lastUpdated: new Date().toISOString(),
      arope: aropeData.value,
      gini: giniData.value,
      averageIncome: incomeData.value,
      referenceYear,
      historical: {
        arope: aropeData.historical,
        gini: giniData.historical,
        averageIncome: incomeData.historical,
      },
      sourceAttribution: {
        arope: {
          source: SERIES.arope.source,
          type: aropeData.isLive ? 'api' : 'fallback',
          url: SERIES.arope.url,
          date: aropeData.date,
        },
        gini: {
          source: SERIES.gini.source,
          type: giniData.isLive ? 'api' : 'fallback',
          url: SERIES.gini.url,
          date: giniData.date,
        },
        averageIncome: {
          source: SERIES.averageIncome.source,
          type: incomeData.isLive ? 'api' : 'fallback',
          url: SERIES.averageIncome.url,
          date: incomeData.date,
        },
      },
    }

    if (!aropeData.isLive || !giniData.isLive || !incomeData.isLive) {
      console.warn('⚠️ Condiciones de vida con fallback parcial en una o más series')
    }

    console.log('✅ Condiciones de Vida procesadas:')
    console.log(`   Tasa AROPE:    ${result.arope}% (${result.historical.arope.length} años)`)
    console.log(`   Índice Gini:   ${result.gini} (${result.historical.gini.length} años)`)
    console.log(
      `   Renta media:   ${result.averageIncome.toLocaleString('es-ES')}€ (${result.historical.averageIncome.length} años)`
    )

    return result
  } catch (error) {
    console.error('❌ Error descargando condiciones de vida:', error.message)
    return fallbackLivingConditions()
  }
}

async function fetchSeries(code, nult = 1, fetcher = fetchWithRetry) {
  const url = `${INE_BASE}/DATOS_SERIE/${code}?nult=${nult}`
  const response = await fetcher(url)
  const json = await response.json()
  return json.Data || json.data || []
}

function extractMetricSeries(result, fallbackMetric, decimals = 1) {
  if (result.status === 'fulfilled' && Array.isArray(result.value) && result.value.length > 0) {
    const historical = toHistoricalSeries(result.value, decimals)
    if (historical.length > 0) {
      const latest = historical[historical.length - 1]
      return {
        value: latest.value,
        year: latest.year,
        date: `${latest.year}-12-31`,
        historical,
        isLive: true,
      }
    }
  }

  return {
    value: fallbackMetric.value,
    year: fallbackMetric.year,
    date: fallbackMetric.date,
    historical: fallbackMetric.historical,
    isLive: false,
  }
}

function toHistoricalSeries(data, decimals = 1) {
  const factor = 10 ** decimals
  const seen = new Map()

  for (const row of data) {
    const year = Number(row?.Anyo ?? new Date(row?.Fecha ?? 0).getFullYear())
    const value = Number(row?.Valor)
    if (!Number.isFinite(year) || !Number.isFinite(value)) continue
    seen.set(year, Math.round(value * factor) / factor)
  }

  return [...seen.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, value]) => ({ year, value }))
}

function fallbackArope() {
  return {
    value: 25.7,
    year: 2025,
    date: '2026-02-26',
    historical: [
      { year: 2021, value: 27.8 },
      { year: 2022, value: 26.0 },
      { year: 2023, value: 26.5 },
      { year: 2024, value: 25.8 },
      { year: 2025, value: 25.7 },
    ],
  }
}

function fallbackGini() {
  return {
    value: 30.8,
    year: 2025,
    date: '2026-02-26',
    historical: [
      { year: 2021, value: 33.0 },
      { year: 2022, value: 32.0 },
      { year: 2023, value: 31.0 },
      { year: 2024, value: 30.5 },
      { year: 2025, value: 30.8 },
    ],
  }
}

function fallbackAverageIncome() {
  return {
    value: 17914,
    year: 2025,
    date: '2026-02-26',
    historical: [
      { year: 2021, value: 14255 },
      { year: 2022, value: 15086 },
      { year: 2023, value: 16180 },
      { year: 2024, value: 16917 },
      { year: 2025, value: 17914 },
    ],
  }
}

function fallbackLivingConditions() {
  const arope = fallbackArope()
  const gini = fallbackGini()
  const averageIncome = fallbackAverageIncome()

  return {
    lastUpdated: new Date().toISOString(),
    arope: arope.value,
    gini: gini.value,
    averageIncome: averageIncome.value,
    referenceYear: 2025,
    historical: {
      arope: arope.historical,
      gini: gini.historical,
      averageIncome: averageIncome.historical,
    },
    sourceAttribution: {
      arope: {
        source: 'INE (Referencia 2025)',
        type: 'fallback',
        url: SERIES.arope.url,
        date: arope.date,
        note: 'Valores de referencia basados en la ECV 2025.',
      },
      gini: {
        source: 'INE (Referencia 2025)',
        type: 'fallback',
        url: SERIES.gini.url,
        date: gini.date,
        note: 'Valores de referencia basados en la ECV 2025.',
      },
      averageIncome: {
        source: 'INE (Referencia 2025)',
        type: 'fallback',
        url: SERIES.averageIncome.url,
        date: averageIncome.date,
        note: 'Valores de referencia basados en la ECV 2025.',
      },
    },
  }
}

