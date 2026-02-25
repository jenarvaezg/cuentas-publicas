/**
 * Shared utilities for scraping Seguridad Social Excel files.
 */

const SS_BASE = 'https://www.seg-social.es'
const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

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
  const regexPattern = /href=["']([^"']*REG\d{6}\.xlsx[^"']*)["']/i
  const primaryMatch = html.match(regexPattern)
  const primaryUrl = primaryMatch ? normalizeExcelUrl(primaryMatch[1]) : null

  const allXlsx = [...html.matchAll(/href=["']([^"']*\.xlsx[^"']*)["']/gi)]
  const regUrlsFromPage = allXlsx
    .map((match) => normalizeExcelUrl(match[1]))
    .filter(Boolean)
    .filter((url) => /REG\d{6}\.xlsx/i.test(url))

  const candidateUrls = [primaryUrl, ...regUrlsFromPage, ...buildRecentRegFallbackUrls(4)].filter(
    Boolean,
  )

  return [...new Set(candidateUrls)]
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
