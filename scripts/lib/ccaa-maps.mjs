/**
 * Canonical CCAA name/code mappings for all data pipeline scripts.
 *
 * CCAA_NAME_MAP: normalized (accent-free, lowercase) name → { code, name }
 * NUTS2_TO_CCAA: Eurostat NUTS2 code → { code, name }
 * resolveCcaaCode(rawName): normalize rawName and look up its CCAA code
 */

import { normalizeText } from './text-utils.mjs'

/**
 * Superset of all CCAA name variants found across data sources.
 * Keys are normalized (lowercase, accent-stripped, whitespace-collapsed).
 * Values are { code: 'CAXX', name: '<canonical display name>' }.
 */
export const CCAA_NAME_MAP = {
  // Andalucía
  andalucia: { code: 'CA01', name: 'Andalucía' },
  // Aragón
  aragon: { code: 'CA02', name: 'Aragón' },
  // Asturias
  asturias: { code: 'CA03', name: 'Asturias' },
  'principado de asturias': { code: 'CA03', name: 'Asturias' },
  // Illes Balears
  baleares: { code: 'CA04', name: 'Illes Balears' },
  'illes balears': { code: 'CA04', name: 'Illes Balears' },
  // Canarias
  canarias: { code: 'CA05', name: 'Canarias' },
  // Cantabria
  cantabria: { code: 'CA06', name: 'Cantabria' },
  // Castilla y León
  'castilla y leon': { code: 'CA07', name: 'Castilla y León' },
  // Castilla-La Mancha
  'castilla la mancha': { code: 'CA08', name: 'Castilla-La Mancha' },
  'castilla - la mancha': { code: 'CA08', name: 'Castilla-La Mancha' },
  'castilla-la mancha': { code: 'CA08', name: 'Castilla-La Mancha' },
  // Cataluña
  cataluna: { code: 'CA09', name: 'Cataluña' },
  // C. Valenciana
  'comunitat valenciana': { code: 'CA10', name: 'C. Valenciana' },
  'comunidad valenciana': { code: 'CA10', name: 'C. Valenciana' },
  'c. valenciana': { code: 'CA10', name: 'C. Valenciana' },
  // Extremadura
  extremadura: { code: 'CA11', name: 'Extremadura' },
  // Galicia
  galicia: { code: 'CA12', name: 'Galicia' },
  // Madrid
  madrid: { code: 'CA13', name: 'Madrid' },
  'comunidad de madrid': { code: 'CA13', name: 'Madrid' },
  // Murcia
  murcia: { code: 'CA14', name: 'Murcia' },
  'region de murcia': { code: 'CA14', name: 'Murcia' },
  // Navarra
  navarra: { code: 'CA15', name: 'Navarra' },
  'comunidad foral de navarra': { code: 'CA15', name: 'Navarra' },
  // País Vasco
  'pais vasco': { code: 'CA16', name: 'País Vasco' },
  // La Rioja
  'la rioja': { code: 'CA17', name: 'La Rioja' },
}

/**
 * Map Eurostat NUTS2 codes to internal CCAA codes.
 * Superset covering both regional-accounts.mjs (17 CCAA) and
 * unemployment-regional.mjs (17 CCAA + Ceuta + Melilla).
 */
export const NUTS2_TO_CCAA = {
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
  ES63: { code: 'CA18', name: 'Ceuta' },
  ES64: { code: 'CA19', name: 'Melilla' },
  ES70: { code: 'CA05', name: 'Canarias' },
}

/**
 * Normalize rawName and look up the CCAA entry from CCAA_NAME_MAP.
 * @param {*} rawName
 * @returns {{ code: string, name: string } | undefined}
 */
export function resolveCcaaCode(rawName) {
  return CCAA_NAME_MAP[normalizeText(rawName)]
}
