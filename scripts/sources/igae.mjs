import XLSX from 'xlsx'
import { fetchWithRetry } from '../lib/fetch-utils.mjs'
import { toNumber } from '../lib/text-utils.mjs'

const IGAE_URL = 'https://www.igae.pap.hacienda.gob.es/sitios/igae/es-ES/Contabilidad/ContabilidadNacional/Publicaciones/Documents/AAPP_A/COFOG_A_AAPP.xlsx'

/**
 * COFOG division names in Spanish
 */
const COFOG_NAMES = {
  '01': 'Servicios públicos generales',
  '02': 'Defensa',
  '03': 'Orden público y seguridad',
  '04': 'Asuntos económicos',
  '05': 'Protección del medio ambiente',
  '06': 'Vivienda y servicios comunitarios',
  '07': 'Salud',
  '08': 'Ocio, cultura y religión',
  '09': 'Educación',
  '10': 'Protección social',
}

/**
 * COFOG subcategory names from Apéndice sheet
 */
const COFOG_SUBCATEGORY_NAMES = {
  '01.1': 'Órganos ejecutivos y legislativos',
  '01.2': 'Ayuda económica exterior',
  '01.3': 'Servicios generales',
  '01.4': 'Investigación básica',
  '01.5': 'I+D servicios públicos generales',
  '01.6': 'Servicios públicos generales n.c.o.p.',
  '01.7': 'Operaciones de deuda pública',
  '01.8': 'Transferencias entre AAPP',
  '02.1': 'Defensa militar',
  '02.2': 'Defensa civil',
  '02.3': 'Ayuda militar al exterior',
  '02.4': 'I+D defensa',
  '02.5': 'Defensa n.c.o.p.',
  '03.1': 'Servicios de policía',
  '03.2': 'Protección contra incendios',
  '03.3': 'Tribunales de justicia',
  '03.4': 'Prisiones',
  '03.5': 'I+D orden público',
  '03.6': 'Orden público y seguridad n.c.o.p.',
  '04.1': 'Asuntos económicos y laborales',
  '04.2': 'Agricultura, silvicultura, pesca y caza',
  '04.3': 'Combustible y energía',
  '04.4': 'Minería, manufacturas y construcción',
  '04.5': 'Transporte',
  '04.6': 'Comunicaciones',
  '04.7': 'Otras actividades',
  '04.8': 'I+D asuntos económicos',
  '04.9': 'Asuntos económicos n.c.o.p.',
  '05.1': 'Gestión de residuos',
  '05.2': 'Gestión de aguas residuales',
  '05.3': 'Reducción de la contaminación',
  '05.4': 'Protección de la biodiversidad',
  '05.5': 'I+D medio ambiente',
  '05.6': 'Medio ambiente n.c.o.p.',
  '06.1': 'Urbanismo',
  '06.2': 'Desarrollo comunitario',
  '06.3': 'Abastecimiento de agua',
  '06.4': 'Alumbrado público',
  '06.5': 'I+D vivienda',
  '06.6': 'Vivienda y servicios comunitarios n.c.o.p.',
  '07.1': 'Productos farmacéuticos',
  '07.2': 'Servicios ambulatorios',
  '07.3': 'Servicios hospitalarios',
  '07.4': 'Salud pública',
  '07.5': 'I+D salud',
  '07.6': 'Salud n.c.o.p.',
  '08.1': 'Servicios recreativos y deportivos',
  '08.2': 'Servicios culturales',
  '08.3': 'Radio, televisión y edición',
  '08.4': 'Servicios religiosos y comunitarios',
  '08.5': 'I+D ocio, cultura y religión',
  '08.6': 'Ocio, cultura y religión n.c.o.p.',
  '09.1': 'Educación preescolar y primaria',
  '09.2': 'Educación secundaria',
  '09.3': 'Educación postsecundaria no terciaria',
  '09.4': 'Educación terciaria',
  '09.5': 'Educación no atribuible a nivel',
  '09.6': 'Servicios auxiliares de educación',
  '09.7': 'I+D educación',
  '09.8': 'Educación n.c.o.p.',
  '10.1': 'Enfermedad e incapacidad',
  '10.2': 'Edad avanzada',
  '10.3': 'Supérstites',
  '10.4': 'Familia e hijos',
  '10.5': 'Desempleo',
  '10.6': 'Vivienda',
  '10.7': 'Exclusión social n.c.o.p.',
  '10.8': 'I+D protección social',
  '10.9': 'Protección social n.c.o.p.',
}

/**
 * Column mapping for "Total XX" columns in each year sheet.
 * Row 7 contains subcategory codes; the "Total XX" columns give division totals.
 * Row 8 is the "GASTO TOTAL" row.
 */
const DIVISION_TOTAL_COLS = {
  '01': 10, '02': 16, '03': 23, '04': 33, '05': 40,
  '06': 47, '07': 54, '08': 61, '09': 70, '10': 80,
}

/**
 * Subcategory column ranges (start col, end col inclusive) for each division
 */
const SUBCATEGORY_COLS = {
  '01': { start: 2, end: 9 },    // 01.1-01.8
  '02': { start: 11, end: 15 },  // 02.1-02.5
  '03': { start: 17, end: 22 },  // 03.1-03.6
  '04': { start: 24, end: 32 },  // 04.1-04.9
  '05': { start: 34, end: 39 },  // 05.1-05.6
  '06': { start: 41, end: 46 },  // 06.1-06.6
  '07': { start: 48, end: 53 },  // 07.1-07.6
  '08': { start: 55, end: 60 },  // 08.1-08.6
  '09': { start: 62, end: 69 },  // 09.1-09.8
  '10': { start: 71, end: 79 },  // 10.1-10.9
}

const GRAND_TOTAL_COL = 81

/**
 * Download budget data (COFOG classification) from IGAE
 *
 * @returns {Promise<Object>} Budget data object
 */
export async function downloadBudgetData(fetcher = fetchWithRetry) {
  console.log('\n=== Descargando datos de presupuestos (IGAE COFOG) ===')
  console.log()
  console.log('  Fuente: IGAE — Clasificación funcional COFOG')
  console.log(`  URL: ${IGAE_URL}`)
  console.log()

  let liveData = null

  try {
    liveData = await fetchFromIGAE(fetcher)
  } catch (error) {
    console.log(`  ❌ Error descargando IGAE: ${error.message}`)
  }

  if (liveData) {
    console.log()
    console.log('  ✅ Datos COFOG obtenidos de IGAE')
    console.log()
  } else {
    console.log()
    console.log('  ⚠️  No se pudieron obtener datos → usando valores de referencia')
    console.log()
  }

  return buildBudgetResult(liveData)
}

/**
 * Fetch and parse the IGAE COFOG Excel file
 */
async function fetchFromIGAE(fetcher) {
  // Step 1: Download Excel
  console.log('  1. Descargando Excel COFOG...')

  const response = await fetcher(IGAE_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; DashboardFiscal/1.0)',
    },
  })

  const buffer = await response.arrayBuffer()
  console.log(`    Descargado: ${(buffer.byteLength / 1024).toFixed(1)} KB`)

  // Step 2: Parse Excel
  console.log()
  console.log('  2. Parseando Excel...')

  const wb = XLSX.read(Buffer.from(buffer), { type: 'buffer' })
  console.log(`    Hojas: ${wb.SheetNames.length} (${wb.SheetNames[1]}...${wb.SheetNames[wb.SheetNames.length - 2]})`)

  // Step 3: Extract year sheets (skip 'Indice' and 'Apéndice')
  const yearSheets = wb.SheetNames.filter(name => /^\d{4}$/.test(name))
  console.log(`    Años disponibles: ${yearSheets[0]}-${yearSheets[yearSheets.length - 1]} (${yearSheets.length} años)`)

  // Step 4: Parse each year
  console.log()
  console.log('  3. Extrayendo datos por año...')

  const byYear = {}
  const years = []

  for (const yearStr of yearSheets) {
    const year = parseInt(yearStr)
    const yearData = parseYearSheet(wb.Sheets[yearStr], yearStr)

    if (yearData) {
      byYear[yearStr] = yearData
      years.push(year)
    }
  }

  // Also try the provisional year (e.g., "2024" sheet might have "2024(P)" in row 6)
  const lastSheetName = wb.SheetNames[wb.SheetNames.length - 2] // Before 'Apéndice'
  if (!yearSheets.includes(lastSheetName) && /^\d{4}/.test(lastSheetName)) {
    const year = parseInt(lastSheetName)
    const yearData = parseYearSheet(wb.Sheets[lastSheetName], lastSheetName)
    if (yearData) {
      byYear[String(year)] = yearData
      years.push(year)
    }
  }

  years.sort((a, b) => a - b)

  console.log(`    Años procesados: ${years.length}`)

  // Log latest year summary
  const latestYear = String(years[years.length - 1])
  const latestData = byYear[latestYear]
  if (latestData) {
    console.log()
    console.log(`  📊 Resumen ${latestYear}:`)
    console.log(`    Gasto total: ${latestData.total.toLocaleString('es-ES')} M€`)
    for (const cat of latestData.categories) {
      console.log(`      ${cat.code} ${cat.name}: ${cat.amount.toLocaleString('es-ES')} M€ (${cat.percentage.toFixed(1)}%)`)
    }
  }

  return { byYear, years }
}

/**
 * Parse a single year sheet and extract COFOG data from the "GASTO TOTAL" row
 */
function parseYearSheet(ws, sheetName) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })
  if (rows.length < 9) return null

  // B1: Detección dinámica de columnas por header
  const headerRow = rows[7]
  let colMapping = detectColumnsFromHeader(headerRow)

  if (!colMapping) {
    console.warn(`    ⚠️  [${sheetName}] Fallo en detección dinámica de columnas. Usando constantes hardcodeadas.`)
    colMapping = {
      divisionTotalCols: DIVISION_TOTAL_COLS,
      subcategoryCols: SUBCATEGORY_COLS,
      grandTotalCol: GRAND_TOTAL_COL
    }
  } else {
    // Verificar si difiere de lo esperado (opcional para debug)
    let differs = false
    for (const code of Object.keys(DIVISION_TOTAL_COLS)) {
      if (colMapping.divisionTotalCols[code] !== DIVISION_TOTAL_COLS[code]) differs = true
    }
    if (differs) {
      console.log(`    ℹ️  [${sheetName}] Estructura de columnas detectada difiere de la estándar. Adaptando dinámicamente.`)
    }
  }

  // Row 8 (index 8) is "GASTO TOTAL"
  const gastoRow = rows[8]
  if (!gastoRow || String(gastoRow[1] || '').trim() !== 'GASTO TOTAL') {
    // Try to find GASTO TOTAL row
    for (let i = 0; i < rows.length; i++) {
      if (String(rows[i]?.[1] || '').trim() === 'GASTO TOTAL') {
        return parseGastoRow(rows[i], headerRow, sheetName, colMapping)
      }
    }
    return null
  }

  return parseGastoRow(gastoRow, headerRow, sheetName, colMapping)
}

/**
 * Detect column indices for divisions and subcategories based on COFOG codes in row 7
 */
function detectColumnsFromHeader(headerRow) {
  if (!headerRow) return null

  const divisions = {}
  for (let col = 0; col < headerRow.length; col++) {
    const cell = String(headerRow[col] || '').trim()
    const subMatch = cell.match(/^(\d{2})\.\d+$/)
    if (subMatch) {
      const divCode = subMatch[1]
      if (!divisions[divCode]) {
        divisions[divCode] = { subCols: [] }
      }
      divisions[divCode].subCols.push(col)
    }
  }

  const divCodes = Object.keys(divisions).sort()
  if (divCodes.length < 10) return null // Esperamos al menos las 10 divisiones principales

  const divisionTotalCols = {}
  const subcategoryCols = {}

  for (const code of divCodes) {
    const subCols = divisions[code].subCols
    const lastSubCol = Math.max(...subCols)
    const firstSubCol = Math.min(...subCols)

    // El total de la división suele estar justo después de su última subcategoría
    divisionTotalCols[code] = lastSubCol + 1
    subcategoryCols[code] = { start: firstSubCol, end: lastSubCol }
  }

  const lastDivCode = divCodes[divCodes.length - 1]
  const grandTotalCol = divisionTotalCols[lastDivCode] + 1

  return { divisionTotalCols, subcategoryCols, grandTotalCol }
}

/**
 * Parse the GASTO TOTAL row to extract division and subcategory totals
 */
function parseGastoRow(gastoRow, headerRow, sheetName, colMapping) {
  const { divisionTotalCols, subcategoryCols, grandTotalCol: totalColIdx } = colMapping
  const grandTotal = toNumber(gastoRow[totalColIdx])
  if (!grandTotal || grandTotal <= 0) return null

  const categories = []
  let sumDivisions = 0

  const sortedDivCodes = Object.keys(divisionTotalCols).sort()
  for (const divCode of sortedDivCodes) {
    const totalCol = divisionTotalCols[divCode]
    const divAmount = toNumber(gastoRow[totalCol])
    sumDivisions += divAmount
    const divPercentage = grandTotal > 0 ? (divAmount / grandTotal) * 100 : 0

    // Extract subcategories
    const { start, end } = subcategoryCols[divCode]
    const children = []

    for (let col = start; col <= end; col++) {
      const subAmount = toNumber(gastoRow[col])
      if (subAmount === 0) continue

      // Determine subcategory code from header row
      const subCode = headerRow ? String(headerRow[col] || '').trim() : null
      if (!subCode || !subCode.match(/^\d{2}\.\d/)) continue

      const subName = COFOG_SUBCATEGORY_NAMES[subCode] || subCode

      children.push({
        code: subCode,
        name: subName,
        amount: subAmount,
        percentage: grandTotal > 0 ? (subAmount / grandTotal) * 100 : 0,
      })
    }

    categories.push({
      code: divCode,
      name: COFOG_NAMES[divCode] || `División ${divCode}`,
      amount: divAmount,
      percentage: divPercentage,
      children: children.length > 0 ? children : undefined,
    })
  }

  // B2: Validación cruzada: sum(divisions) ≈ grandTotal (1% tolerancia)
  const diff = Math.abs(sumDivisions - grandTotal)
  const tolerance = grandTotal * 0.01
  if (diff > tolerance) {
    console.warn(`    ⚠️  [${sheetName}] Cross-validation fallida: suma divisiones (${sumDivisions.toLocaleString()}) != gran total (${grandTotal.toLocaleString()}). Dif: ${diff.toLocaleString()} M€`)
  }

  return {
    total: grandTotal,
    categories,
  }
}

// ─────────────────────────────────────────────
// Reference / fallback data (2023)
// ─────────────────────────────────────────────

const REFERENCE_DATA = {
  years: [2020, 2021, 2022, 2023],
  latestYear: 2023,
  byYear: {
    '2023': {
      total: 690624,
      categories: [
        { code: '01', name: 'Servicios públicos generales', amount: 89835, percentage: 13.0 },
        { code: '02', name: 'Defensa', amount: 13572, percentage: 2.0 },
        { code: '03', name: 'Orden público y seguridad', amount: 27329, percentage: 4.0 },
        { code: '04', name: 'Asuntos económicos', amount: 75870, percentage: 11.0 },
        { code: '05', name: 'Protección del medio ambiente', amount: 14847, percentage: 2.1 },
        { code: '06', name: 'Vivienda y servicios comunitarios', amount: 7301, percentage: 1.1 },
        { code: '07', name: 'Salud', amount: 97826, percentage: 14.2 },
        { code: '08', name: 'Ocio, cultura y religión', amount: 18488, percentage: 2.7 },
        { code: '09', name: 'Educación', amount: 62579, percentage: 9.1 },
        { code: '10', name: 'Protección social', amount: 282977, percentage: 41.0 },
      ],
    },
  },
}

/**
 * Build final budget result from live or fallback data
 */
function buildBudgetResult(liveData) {
  const isFallback = !liveData

  const years = liveData?.years || REFERENCE_DATA.years
  const byYear = liveData?.byYear || REFERENCE_DATA.byYear
  const latestYear = years[years.length - 1]

  const sourceUrl = IGAE_URL

  const sourceAttribution = {
    budget: {
      source: isFallback
        ? 'Referencia IGAE COFOG AAPP 2023'
        : `IGAE — COFOG Total AAPP (${years[0]}-${latestYear})`,
      type: isFallback ? 'fallback' : 'csv',
      url: sourceUrl,
      date: `${latestYear}-12-31`,
      note: isFallback
        ? 'Datos de referencia, descarga IGAE no disponible'
        : `Datos anuales ${years[0]}-${latestYear}, millones de euros`,
    },
  }

  const result = {
    lastUpdated: new Date().toISOString(),
    years,
    latestYear,
    byYear,
    sourceAttribution,
  }

  console.log(`✅ Presupuestos procesados:`)
  console.log(`   Años: ${years[0]}-${latestYear} (${years.length} años)`)
  console.log(`   Último año: ${latestYear} — ${byYear[String(latestYear)]?.total?.toLocaleString('es-ES') || 'N/A'} M€`)

  return result
}
