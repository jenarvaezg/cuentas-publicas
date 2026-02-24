/**
 * Fetch with retry and timeout
 * @param {string} url
 * @param {object} options - fetch options
 * @param {number} maxRetries - default 2
 * @param {number} timeoutMs - default 30000
 * @returns {Promise<Response>}
 */
const fetchRetryEvents = []

export function resetFetchRetryEvents() {
  fetchRetryEvents.length = 0
}

export function getFetchRetryEvents() {
  return fetchRetryEvents.slice()
}

export async function fetchWithRetry(url, options = {}, { maxRetries = 2, timeoutMs = 30000 } = {}) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} fetching ${url}`)
      }
      return response
    } catch (error) {
      const isLastAttempt = attempt === maxRetries
      const delay = isLastAttempt ? 0 : 1000 * Math.pow(2, attempt) // exponential backoff: 1s, 2s

      fetchRetryEvents.push({
        url,
        attempt: attempt + 1,
        maxAttempts: maxRetries + 1,
        delayMs: delay,
        finalFailure: isLastAttempt,
        error: error?.message || String(error),
        timestamp: new Date().toISOString(),
      })

      if (isLastAttempt) throw error
      console.warn(`  ⚠️ Intento ${attempt + 1} fallido para ${url}: ${error.message}. Reintentando en ${delay}ms...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
}
