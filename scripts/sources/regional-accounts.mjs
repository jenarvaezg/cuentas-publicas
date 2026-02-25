import { fetchWithRetry } from '../lib/fetch-utils.mjs'
import { parseJsonStat } from './eurostat.mjs'

const EUROSTAT_BASE = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data'

/** NUTS2 codes for Spain's 17 Autonomous Communities (Ceuta/Melilla excluded) */
const NUTS2_REGIONS = [
  'ES11', 'ES12', 'ES13', 'ES21', 'ES22', 'ES23', 'ES24',
  'ES30', 'ES41', 'ES42', 'ES43', 'ES51', 'ES52', 'ES53',
  'ES61', 'ES62', 'ES70'
]

/** Map Eurostat NUTS2 codes to internal CCAA codes */
const NUTS2_TO_CCAA = {
  ES11: { code: 'CA12', name: 'Galicia' },
  ES12: { code: 'CA03', name: 'Asturias' },
  ES13: { code: 'CA06', name: 'Cantabria' },
  ES21: { code: 'CA16', name: 'País Vasco' },
  ES22: { code: 'CA15', name: 'Navarra' },
  ES23: { code: 'CA17', name: 'La Rioja' },
  ES24: { code: 'CA02', name: 'Aragón' },
  ES30: { code: 'CA13', name: 'Madrid' },
  ES41: { code: 'CA07', name: 'Castilla y León' },
  ES42: { code: 'CA08', name: 'Castilla-La Mancha' },
  ES43: { code: 'CA11', name: 'Extremadura' },
  ES51: { code: 'CA09', name: 'Cataluña' },
  ES52: { code: 'CA10', name: 'C. Valenciana' },
  ES53: { code: 'CA04', name: 'Illes Balears' },
  ES61: { code: 'CA01', name: 'Andalucía' },
  ES62: { code: 'CA14', name: 'Murcia' },
  ES70: { code: 'CA05', name: 'Canarias' },
}

/**
 * Fetch a regional indicator from Eurostat for all Spanish NUTS2 regions
 * @param {string} dataset - Eurostat dataset code
 * @param {string|null} naItem - National accounts item code (e.g. 'D61'), null if dataset has no na_item dimension
 * @param {string} label - Human-readable label for logging
 * @param {Function} fetcher - Fetch function
 * @returns {Promise<{values: Record<string, number>, year: number}>}
 */
async function fetchRegionalIndicator(dataset, naItem, label, fetcher) {
  const url = new URL(`${EUROSTAT_BASE}/${dataset}`)
  for (const geo of NUTS2_REGIONS) url.searchParams.append('geo', geo)
  if (naItem) url.searchParams.append('na_item', naItem)
  url.searchParams.append('unit', 'MIO_EUR')
  const currentYear = new Date().getFullYear()
  url.searchParams.append('sinceTimePeriod', String(currentYear - 5))
  url.searchParams.append('untilTimePeriod', String(currentYear))

  console.log(`  Descargando ${label}...`)
  const response = await fetcher(url.toString(), {}, { maxRetries: 2, timeoutMs: 30000 })
  const data = await response.json()
  return parseJsonStat(data, NUTS2_REGIONS)
}

/**
 * Convert NUTS2-keyed values to CCAA-keyed entries sorted by code
 */
function mapNuts2ToCcaaEntries(gdpValues, scValues) {
  const entries = []
  for (const nuts2 of NUTS2_REGIONS) {
    const mapping = NUTS2_TO_CCAA[nuts2]
    if (!mapping) continue
    entries.push({
      code: mapping.code,
      name: mapping.name,
      gdp: Math.round(gdpValues[nuts2] || 0),
      socialContributions: Math.round(scValues[nuts2] || 0),
    })
  }
  return entries.sort((a, b) => a.code.localeCompare(b.code))
}

/**
 * Download regional GDP and social contributions from Eurostat NUTS2 datasets.
 * - GDP: nama_10r_2gdp (B1GQ, MIO_EUR)
 * - Social contributions: nama_10r_2hhinc (D61, MIO_EUR)
 *
 * D61 represents household social contributions paid. While not identical to
 * total cotizaciones (employer + employee), the regional proportions are a
 * good proxy since employer contributions scale proportionally with wages.
 *
 * @param {Function} fetcher - Optional fetcher function
 * @returns {Promise<Object>} Regional accounts data
 */
export async function downloadRegionalAccountsData(fetcher = fetchWithRetry) {
  console.log('\n=== Descargando cuentas regionales (Eurostat NUTS2) ===')

  try {
    const [gdpResult, scResult] = await Promise.allSettled([
      fetchRegionalIndicator('nama_10r_2gdp', null, 'PIB regional (nama_10r_2gdp)', fetcher),
      fetchRegionalIndicator('nama_10r_2hhinc', 'D61', 'Cotizaciones sociales regionales (nama_10r_2hhinc D61)', fetcher),
    ])

    const gdpData = gdpResult.status === 'fulfilled' ? gdpResult.value : null
    const scData = scResult.status === 'fulfilled' ? scResult.value : null

    if (!gdpData && !scData) {
      console.warn('  Sin datos de API, usando fallback')
      return buildFallbackRegionalAccounts()
    }

    const latestYear = Math.max(gdpData?.year || 0, scData?.year || 0)
    const entries = mapNuts2ToCcaaEntries(gdpData?.values || {}, scData?.values || {})

    const totals = {
      gdp: entries.reduce((sum, e) => sum + e.gdp, 0),
      socialContributions: entries.reduce((sum, e) => sum + e.socialContributions, 0),
    }

    const data = {
      lastUpdated: new Date().toISOString(),
      latestYear,
      years: [latestYear],
      byYear: {
        [String(latestYear)]: { entries, totals },
      },
      sourceAttribution: {
        regionalAccounts: {
          source: 'Eurostat (nama_10r_2gdp + nama_10r_2hhinc)',
          type: 'api',
          url: 'https://ec.europa.eu/eurostat/databrowser/product/view/nama_10r_2gdp',
          date: `${latestYear}-12-31`,
          note: `PIB regional y cotizaciones sociales por CCAA (${entries.length} comunidades, ${latestYear})`,
        },
      },
    }

    const gdpCount = entries.filter((e) => e.gdp > 0).length
    const scCount = entries.filter((e) => e.socialContributions > 0).length
    console.log(`  ✅ PIB regional: ${gdpCount} CCAA (año ${gdpData?.year || 'N/A'})`)
    console.log(`  ✅ Cotizaciones: ${scCount} CCAA (año ${scData?.year || 'N/A'})`)
    console.log(`  PIB total: ${totals.gdp.toLocaleString('es-ES')} M€`)
    console.log(`  Cotizaciones total: ${totals.socialContributions.toLocaleString('es-ES')} M€`)
    console.log(`✅ Cuentas regionales: ${entries.length} CCAA, año ${latestYear}`)

    return data
  } catch (error) {
    console.error('❌ Error descargando cuentas regionales:', error.message)
    return buildFallbackRegionalAccounts()
  }
}

// ─── Fallback (Eurostat 2022 published values) ──────────────────────

const FALLBACK_YEAR = 2022

const FALLBACK_ENTRIES = [
  { code: 'CA01', name: 'Andalucía', gdp: 183072, socialContributions: 27417 },
  { code: 'CA02', name: 'Aragón', gdp: 42596, socialContributions: 5692 },
  { code: 'CA03', name: 'Asturias', gdp: 25123, socialContributions: 3704 },
  { code: 'CA04', name: 'Illes Balears', gdp: 37505, socialContributions: 5134 },
  { code: 'CA05', name: 'Canarias', gdp: 50081, socialContributions: 7528 },
  { code: 'CA06', name: 'Cantabria', gdp: 15240, socialContributions: 2096 },
  { code: 'CA07', name: 'Castilla y León', gdp: 62258, socialContributions: 8692 },
  { code: 'CA08', name: 'Castilla-La Mancha', gdp: 44932, socialContributions: 6641 },
  { code: 'CA09', name: 'Cataluña', gdp: 261888, socialContributions: 36605 },
  { code: 'CA10', name: 'C. Valenciana', gdp: 127244, socialContributions: 18278 },
  { code: 'CA11', name: 'Extremadura', gdp: 21837, socialContributions: 3181 },
  { code: 'CA12', name: 'Galicia', gdp: 70980, socialContributions: 9568 },
  { code: 'CA13', name: 'Madrid', gdp: 271727, socialContributions: 37376 },
  { code: 'CA14', name: 'Murcia', gdp: 36554, socialContributions: 5229 },
  { code: 'CA15', name: 'Navarra', gdp: 22898, socialContributions: 3193 },
  { code: 'CA16', name: 'País Vasco', gdp: 82048, socialContributions: 10899 },
  { code: 'CA17', name: 'La Rioja', gdp: 9897, socialContributions: 1225 },
]

function buildFallbackRegionalAccounts() {
  console.warn('⚠️  Usando datos de respaldo para cuentas regionales')
  const totals = {
    gdp: FALLBACK_ENTRIES.reduce((sum, e) => sum + e.gdp, 0),
    socialContributions: FALLBACK_ENTRIES.reduce((sum, e) => sum + e.socialContributions, 0),
  }
  return {
    lastUpdated: new Date().toISOString(),
    latestYear: FALLBACK_YEAR,
    years: [FALLBACK_YEAR],
    byYear: {
      [String(FALLBACK_YEAR)]: { entries: FALLBACK_ENTRIES, totals },
    },
    sourceAttribution: {
      regionalAccounts: {
        source: 'Eurostat (referencia)',
        type: 'fallback',
        url: 'https://ec.europa.eu/eurostat/databrowser/product/view/nama_10r_2gdp',
        date: `${FALLBACK_YEAR}-12-31`,
        note: `Valores de referencia ${FALLBACK_YEAR}`,
      },
    },
  }
}
