/**
 * Parse BdE CSV files with Spanish format
 * - Separator: ;
 * - Numbers with Spanish format (1.234,56 → 1234.56)
 * - Multi-line headers
 * @param {string} csvText - Raw CSV text
 * @returns {Array<Object>} Array of row objects
 */
export function parseSpanishCSV(csvText) {
  if (!csvText || typeof csvText !== 'string') {
    return []
  }

  const lines = csvText.split('\n').map(line => line.trim()).filter(line => line.length > 0)

  if (lines.length === 0) {
    return []
  }

  // Find header row - typically the first non-empty line
  // BdE CSVs may have metadata rows before the actual header
  let headerIndex = 0
  let headers = []

  // Try to find the header by looking for common BdE header patterns
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const parts = lines[i].split(';')
    // A header typically has multiple columns and may contain words like "Fecha", "Periodo", etc.
    if (parts.length > 1) {
      headers = parts.map(h => h.trim().replace(/^"|"$/g, ''))
      headerIndex = i
      break
    }
  }

  if (headers.length === 0) {
    console.warn('Could not find CSV header, using first line')
    headers = lines[0].split(';').map(h => h.trim().replace(/^"|"$/g, ''))
    headerIndex = 0
  }

  const rows = []

  // Parse data rows
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue

    const values = line.split(';')
    const row = {}

    for (let j = 0; j < headers.length; j++) {
      const header = headers[j]
      const value = values[j]?.trim().replace(/^"|"$/g, '') || ''

      // Try to parse as number with Spanish format
      row[header] = parseSpanishNumber(value)
    }

    rows.push(row)
  }

  return rows
}

/**
 * Parse Spanish number format (1.234,56 → 1234.56)
 * If not a number, returns the original string
 * @param {string} str
 * @returns {number|string}
 */
export function parseSpanishNumber(str) {
  if (!str || typeof str !== 'string') {
    return str
  }

  const trimmed = str.trim()

  // Check if it looks like a number
  if (!/^-?[\d.,]+$/.test(trimmed)) {
    return trimmed
  }

  // Spanish format: thousands separator = . , decimal separator = ,
  // Convert: remove thousands separators, replace decimal comma with dot
  const normalized = trimmed
    .replace(/\./g, '')  // Remove thousand separators
    .replace(/,/g, '.')  // Replace decimal comma with dot

  const num = parseFloat(normalized)

  return isNaN(num) ? trimmed : num
}
