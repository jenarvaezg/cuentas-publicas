/**
 * Shared utilities for scraping Seguridad Social Excel files.
 */

const SS_BASE = 'https://www.seg-social.es'
const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

function extractRegPeriodKey(url) {
  const match = String(url || '').match(/REG(\d{6})\.xlsx/i)
  return match ? parseInt(match[1], 10) : Number.NaN
}

/**
 * Normalize a path or URL fragment into a full absolute URL for the SS site.
 * @param {string} pathOrUrl
 * @returns {string|null}
 */
export function normalizeExcelUrl(pathOrUrl) {
  const cleaned = String(pathOrUrl || '').replace(/&amp;/g, '&').trim()
  if (!cleaned) return null

  try {
    return new URL(cleaned, `${SS_BASE}/`).toString()
  } catch {
    if (cleaned.startsWith('http')) return cleaned
    return `${SS_BASE}${cleaned}`
  }
}

/**
 * Collect candidate REG*.xlsx URLs from HTML scraped from the SS index page.
 * Also appends recent fallback URLs constructed from today's date.
 * @param {string} html
 * @returns {string[]} Deduplicated list of candidate URLs
 */
export function collectExcelCandidates(html) {
  const allXlsx = [...html.matchAll(/href=["']([^"']*\.xlsx[^"']*)["']/gi)]
  const regUrlsFromPage = allXlsx
    .map((match) => normalizeExcelUrl(match[1]))
    .filter(Boolean)
    .filter((url) => /REG\d{6}\.xlsx/i.test(url))

  const fallbackUrls = buildRecentRegFallbackUrls(4).filter(Boolean)

  let candidateUrls = []
  if (regUrlsFromPage.length > 0) {
    const latestPagePeriod = Math.max(
      ...regUrlsFromPage
        .map(extractRegPeriodKey)
        .filter((period) => Number.isFinite(period)),
    )
    const safeFallback = fallbackUrls.filter((url) => {
      const period = extractRegPeriodKey(url)
      return !Number.isFinite(period) || period <= latestPagePeriod
    })
    candidateUrls = [...regUrlsFromPage, ...safeFallback]
  } else {
    candidateUrls = [...fallbackUrls]
  }

  const deduped = [...new Set(candidateUrls)]

  // Try newest publication first (REGYYYYMM), then keep URL variants with
  // concrete query params before generic fallback URLs.
  deduped.sort((a, b) => {
    const periodA = extractRegPeriodKey(a)
    const periodB = extractRegPeriodKey(b)

    const hasPeriodA = Number.isFinite(periodA)
    const hasPeriodB = Number.isFinite(periodB)
    if (hasPeriodA && hasPeriodB && periodA !== periodB) return periodB - periodA
    if (hasPeriodA && !hasPeriodB) return -1
    if (!hasPeriodA && hasPeriodB) return 1

    const hasQueryA = String(a).includes('?')
    const hasQueryB = String(b).includes('?')
    if (hasQueryA !== hasQueryB) return hasQueryA ? -1 : 1

    return String(a).localeCompare(String(b))
  })

  return deduped
}

/**
 * Parse date metadata from a REG*.xlsx URL.
 * @param {string} excelUrl
 * @returns {{ filename: string, excelDate: string, monthLabel: string }}
 */
export function parseExcelMetadata(excelUrl) {
  const filename = excelUrl.split('/').pop()?.split('?')[0] || 'unknown'
  const dateMatch = filename.match(/REG(\d{4})(\d{2})/)
  const excelDate = dateMatch
    ? `${dateMatch[1]}-${dateMatch[2]}-01`
    : new Date().toISOString().split('T')[0]
  const monthLabel = dateMatch
    ? `${MONTH_NAMES[parseInt(dateMatch[2]) - 1]} ${dateMatch[1]}`
    : 'fecha desconocida'

  return { filename, excelDate, monthLabel }
}

/**
 * Build fallback REG*.xlsx URLs for the last N months.
 * @param {number} months
 * @returns {string[]}
 */
function buildRecentRegFallbackUrls(months = 4) {
  const fallback = []
  const today = new Date()

  for (let i = 0; i < months; i++) {
    const dt = new Date(today.getFullYear(), today.getMonth() - i, 1)
    const yyyymm = `${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, '0')}`
    fallback.push(`${SS_BASE}/REG${yyyymm}.xlsx`)
    fallback.push(`${SS_BASE}/wps/wcm/connect/wss/REG${yyyymm}.xlsx`)
  }

  return fallback
}
