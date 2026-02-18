/**
 * Fetch with retry and timeout
 * @param {string} url
 * @param {object} options - fetch options
 * @param {number} maxRetries - default 2
 * @param {number} timeoutMs - default 30000
 * @returns {Promise<Response>}
 */
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
      if (attempt === maxRetries) throw error
      const delay = 1000 * Math.pow(2, attempt) // exponential backoff: 1s, 2s
      console.warn(`  ⚠️ Intento ${attempt + 1} fallido para ${url}: ${error.message}. Reintentando en ${delay}ms...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
}
