import { fetchWithRetry } from '../lib/fetch-utils.mjs'

const INE_BASE = 'https://servicios.ine.es/wstempus/js/ES'
const TABLES = {
  vab: 78708,
  empleo: 78713,
}

const SERIES = {
  vab: {
    table: TABLES.vab,
    code: 'CSES12739',
    source: 'INE — Economía Social (VAB)',
    url: 'https://www.ine.es/jaxiT3/Tabla.htm?t=78708',
    note: 'Total CNAE. Precios corrientes. Dato base. Valor añadido bruto.',
    toOutput: (value) => Math.round(value * 1_000_000), // M€ -> €
  },
  pibShare: {
    table: TABLES.vab,
    code: 'CSES17056',
    source: 'INE — Economía Social (% PIB)',
    url: 'https://www.ine.es/jaxiT3/Tabla.htm?t=78708',
    note: 'Total CNAE. Precios corrientes. Porcentaje. Valor añadido bruto.',
    toOutput: (value) => value,
  },
  employmentShare: {
    table: TABLES.empleo,
    code: 'CSES16664',
    source: 'INE — Economía Social (% empleo)',
    url: 'https://www.ine.es/jaxiT3/Tabla.htm?t=78713',
    note: 'Puestos de trabajo. Total CNAE. Porcentaje.',
    toOutput: (value) => value,
  },
  totalJobs: {
    table: TABLES.empleo,
    code: 'CSES15096',
    source: 'INE — Economía Social (empleos directos)',
    url: 'https://www.ine.es/jaxiT3/Tabla.htm?t=78713',
    note: 'Puestos de trabajo. Total CNAE. Valor total.',
    toOutput: (value) => Math.round(value),
  },
}

const FALLBACK_SERIES = {
  vab: [
    { year: 2019, value: 48_318_000_000 },
    { year: 2020, value: 46_532_000_000 },
    { year: 2021, value: 48_477_000_000 },
    { year: 2022, value: 50_848_000_000 },
    { year: 2023, value: 54_424_000_000 },
  ],
  pibShare: [
    { year: 2019, value: 4.3 },
    { year: 2020, value: 4.5 },
    { year: 2021, value: 4.3 },
    { year: 2022, value: 4.1 },
    { year: 2023, value: 4.0 },
  ],
  employmentShare: [
    { year: 2019, value: 5.94 },
    { year: 2020, value: 6.51 },
    { year: 2021, value: 6.1 },
    { year: 2022, value: 5.9 },
    { year: 2023, value: 5.8 },
  ],
  totalJobs: [
    { year: 2019, value: 1_250_389 },
    { year: 2020, value: 1_225_981 },
    { year: 2021, value: 1_238_169 },
    { year: 2022, value: 1_255_860 },
    { year: 2023, value: 1_276_662 },
  ],
}

const PROCESSING_STATUS = 'Petición en proceso'

/**
 * Download Social Economy Satellite Account data from INE
 *
 * @param {Function} fetcher - Optional fetcher function
 * @returns {Promise<Object>} Social economy data object
 */
export async function downloadSocialEconomy(fetcher = fetchWithRetry) {
  console.log('\n=== Descargando Cuenta Satélite de la Economía Social (INE) ===')

  try {
    const [vabTable, employmentTable] = await Promise.all([
      fetchTableData(TABLES.vab, fetcher),
      fetchTableData(TABLES.empleo, fetcher),
    ])

    const tablesById = {
      [TABLES.vab]: vabTable,
      [TABLES.empleo]: employmentTable,
    }

    const vabSeries = extractMetricSeries(tablesById, SERIES.vab)
    const pibShareSeries = extractMetricSeries(tablesById, SERIES.pibShare)
    const employmentShareSeries = extractMetricSeries(tablesById, SERIES.employmentShare)
    const totalJobsSeries = extractMetricSeries(tablesById, SERIES.totalJobs)

    const referenceYear = Math.max(
      vabSeries.year,
      pibShareSeries.year,
      employmentShareSeries.year,
      totalJobsSeries.year,
    )
    const referenceDate = `${referenceYear}-12-31`

    const data = {
      lastUpdated: new Date().toISOString(),
      vab: vabSeries.value,
      pibShare: pibShareSeries.value,
      employmentShare: employmentShareSeries.value,
      totalJobs: totalJobsSeries.value,
      referenceYear,
      historical: {
        vab: vabSeries.historical,
        pibShare: pibShareSeries.historical,
        employmentShare: employmentShareSeries.historical,
        totalJobs: totalJobsSeries.historical,
      },
      sourceAttribution: {
        socialEconomy: {
          source: 'INE — Cuenta Satélite de la Economía Social',
          type: 'api',
          url: 'https://www.ine.es/jaxiT3/Tabla.htm?t=30092',
          date: referenceDate,
          note:
            'Series INE CSES12739 (VAB), CSES17056 (% PIB), CSES16664 (% empleo) y CSES15096 (puestos de trabajo).',
        },
        vab: buildMetricAttribution('api', SERIES.vab, referenceDate),
        pibShare: buildMetricAttribution('api', SERIES.pibShare, referenceDate),
        employmentShare: buildMetricAttribution('api', SERIES.employmentShare, referenceDate),
        totalJobs: buildMetricAttribution('api', SERIES.totalJobs, referenceDate),
      },
    }

    console.log('✅ Economía Social procesada:')
    console.log(`   Años: ${data.historical.vab[0]?.year}-${data.referenceYear}`)
    console.log(`   VAB: ${(data.vab / 1e9).toFixed(1)}B€`)
    console.log(`   % PIB: ${data.pibShare}%`)
    console.log(`   % Empleo: ${data.employmentShare}%`)
    console.log(`   Empleos: ${data.totalJobs.toLocaleString('es-ES')}`)

    return data
  } catch (error) {
    console.error('❌ Error descargando economía social:', error.message)
    return fallbackSocialEconomy()
  }
}

async function fetchTableData(tableId, fetcher, maxAttempts = 8) {
  const url = `${INE_BASE}/DATOS_TABLA/${tableId}`

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await fetcher(
      url,
      { headers: { Accept: 'application/json' } },
      { timeoutMs: 30000 },
    )
    const json = await response.json()

    if (Array.isArray(json) && json.length > 0) {
      return json
    }

    const status = String(json?.status || json?.Status || '')
    if (status.includes(PROCESSING_STATUS) && attempt < maxAttempts) {
      await sleep(1000 * attempt)
      continue
    }

    throw new Error(`Respuesta inesperada en DATOS_TABLA/${tableId}: ${status || 'vacía'}`)
  }

  throw new Error(`No se pudo descargar DATOS_TABLA/${tableId}`)
}

function extractMetricSeries(tablesById, metricDef) {
  const tableRows = tablesById[metricDef.table]
  const serie = tableRows.find((row) => row.COD === metricDef.code)

  if (!serie) {
    throw new Error(`Serie ${metricDef.code} no encontrada en tabla ${metricDef.table}`)
  }

  const historical = toHistoricalSeries(serie.Data, metricDef.toOutput)
  if (historical.length === 0) {
    throw new Error(`Serie ${metricDef.code} sin datos válidos`)
  }

  const latest = historical[historical.length - 1]
  return {
    value: latest.value,
    year: latest.year,
    historical,
  }
}

function toHistoricalSeries(data, transformValue) {
  const latestByYear = new Map()

  for (const row of data || []) {
    const year = Number(row?.Anyo ?? new Date(row?.Fecha ?? 0).getFullYear())
    const value = Number(row?.Valor)
    if (!Number.isFinite(year) || !Number.isFinite(value)) continue
    latestByYear.set(year, transformValue(value))
  }

  return [...latestByYear.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, value]) => ({ year, value }))
}

function buildMetricAttribution(type, metricDef, date) {
  return {
    source: metricDef.source,
    type,
    url: metricDef.url,
    date,
    note: metricDef.note,
  }
}

function fallbackSocialEconomy() {
  const referenceYear = FALLBACK_SERIES.vab[FALLBACK_SERIES.vab.length - 1].year
  const referenceDate = `${referenceYear}-12-31`

  return {
    lastUpdated: new Date().toISOString(),
    vab: FALLBACK_SERIES.vab[FALLBACK_SERIES.vab.length - 1].value,
    pibShare: FALLBACK_SERIES.pibShare[FALLBACK_SERIES.pibShare.length - 1].value,
    employmentShare:
      FALLBACK_SERIES.employmentShare[FALLBACK_SERIES.employmentShare.length - 1].value,
    totalJobs: FALLBACK_SERIES.totalJobs[FALLBACK_SERIES.totalJobs.length - 1].value,
    referenceYear,
    historical: {
      vab: FALLBACK_SERIES.vab,
      pibShare: FALLBACK_SERIES.pibShare,
      employmentShare: FALLBACK_SERIES.employmentShare,
      totalJobs: FALLBACK_SERIES.totalJobs,
    },
    sourceAttribution: {
      socialEconomy: {
        source: 'INE — Cuenta Satélite de la Economía Social',
        type: 'fallback',
        url: 'https://www.ine.es/jaxiT3/Tabla.htm?t=30092',
        date: referenceDate,
        note:
          'Fallback 2019-2023 basado en series INE CSES12739/CSES17056/CSES16664/CSES15096.',
      },
      vab: buildMetricAttribution('fallback', SERIES.vab, referenceDate),
      pibShare: buildMetricAttribution('fallback', SERIES.pibShare, referenceDate),
      employmentShare: buildMetricAttribution('fallback', SERIES.employmentShare, referenceDate),
      totalJobs: buildMetricAttribution('fallback', SERIES.totalJobs, referenceDate),
    },
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
