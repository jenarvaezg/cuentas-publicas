/**
 * Shared text utilities for data pipeline scripts.
 */

/**
 * Normalize text for comparison: lowercase, remove accents, collapse whitespace.
 * @param {*} value
 * @returns {string}
 */
export function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Safely convert a cell value to a number, returning 0 for non-numeric input.
 * Handles Spanish locale (dot as thousands separator, comma as decimal).
 * @param {*} value
 * @returns {number}
 */
export function toNumber(value) {
  if (value === null || value === undefined || value === '') return 0
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const normalized = String(value).replace(/\./g, '').replace(/,/g, '.').trim()
  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}
