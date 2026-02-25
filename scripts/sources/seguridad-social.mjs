import { linearRegression } from '../lib/regression.mjs'
import XLSX from 'xlsx'
import { fetchWithRetry } from '../lib/fetch-utils.mjs'
import {
  normalizeExcelUrl,
  collectExcelCandidates,
  parseExcelMetadata,
} from '../lib/ss-scraper.mjs'

const SS_BASE = 'https://www.seg-social.es'
const EST24_URL = `${SS_BASE}/wps/portal/wss/internet/EstadisticasPresupuestosEstudios/Estadisticas/EST23/EST24`

function parseSSExcelBuffer(buffer, excelUrl) {
  const { excelDate, monthLabel } = parseExcelMetadata(excelUrl)
  const wb = XLSX.read(Buffer.from(buffer), { type: 'buffer' })
  console.log(`    Hojas: ${wb.SheetNames.join(', ')}`)

  // Parse "Régimen_clase" sheet for totals
  const sheetName = wb.SheetNames.find(n => n.toLowerCase().includes('gimen_clase'))
    || wb.SheetNames.find(n => n.toLowerCase().includes('clase'))
    || wb.SheetNames[1] // Usually second sheet

  if (!sheetName) {
    throw new Error('No se encontró hoja de regímenes/clase')
  }

  console.log(`    Usando hoja: "${sheetName}"`)

  const ws = wb.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })

  // B4: Validación de headers Excel (tolerante a variantes reales: "Número", "Importe", "P. media")
  const normalizeHeaderText = value => String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  const scoreHeaderRow = row => {
    const col1 = normalizeHeaderText(row?.[1])
    const col2 = normalizeHeaderText(row?.[2])
    const col3 = normalizeHeaderText(row?.[3])

    const valid1 = /pensiones?|numero/.test(col1)
    const valid2 = /importe|nomina/.test(col2)
    const valid3 = /p\.?\s*media|pension\s*media|media/.test(col3)

    return {
      col1,
      col2,
      col3,
      valid1,
      valid2,
      valid3,
      score: [valid1, valid2, valid3].filter(Boolean).length
    }
  }

  let bestHeader = null
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const scored = scoreHeaderRow(rows[i])
    if (!bestHeader || scored.score > bestHeader.score) {
      bestHeader = { ...scored, index: i }
    }
  }

  if (bestHeader && bestHeader.score >= 2) {
    console.log(`    Fila de cabecera detectada en posición ${bestHeader.index}`)
    if (bestHeader.score === 3) {
      console.log('    ✅ Cabeceras de columna validadas correctamente')
    } else {
      console.log(`    ℹ️  Cabecera parcial aceptada: [1]="${bestHeader.col1}", [2]="${bestHeader.col2}", [3]="${bestHeader.col3}"`)
    }
  } else {
    console.warn('    ⚠️  No se pudo encontrar la fila de cabecera para validar columnas')
  }

  // Find "Total sistema" row
  // Structure: [label, totalNum, totalImporte, totalMedia, incapNum, incapImporte, incapMedia, jubNum, jubImporte, jubMedia]
  let totalRow = null
  for (let i = 0; i < rows.length; i++) {
    const firstCell = String(rows[i]?.[0] || '').toLowerCase().trim()
    if (firstCell.includes('total sistema')) {
      totalRow = rows[i]
      console.log(`    Fila "Total sistema" encontrada en posición ${i}`)
      break
    }
  }

  if (!totalRow) {
    throw new Error('No se encontró fila "Total sistema" en el Excel')
  }

  // Extract values
  const totalPensions = totalRow[1]         // Número total pensiones
  const monthlyPayroll = totalRow[2]        // Importe total (€/mes)
  const averagePension = totalRow[3]        // Pensión media (€/mes)
  const retirementPensions = totalRow[7]    // Número jubilaciones
  const retirementPayroll = totalRow[8]     // Importe jubilaciones
  const averageRetirement = totalRow[9]     // Pensión media jubilación

  console.log()
  console.log('  📊 Datos extraídos del Excel:')
  console.log(`    Pensiones en vigor:       ${totalPensions?.toLocaleString('es-ES')}`)
  console.log(`    Nómina mensual total:     ${(monthlyPayroll / 1_000_000_000).toFixed(3)}B€`)
  console.log(`    Pensión media:            ${averagePension?.toLocaleString('es-ES', { maximumFractionDigits: 2 })} €/mes`)
  console.log(`    Jubilaciones:             ${retirementPensions?.toLocaleString('es-ES')}`)
  console.log(`    Nómina jubilaciones:      ${(retirementPayroll / 1_000_000_000).toFixed(3)}B€`)
  console.log(`    Pensión media jubilación: ${averageRetirement?.toLocaleString('es-ES', { maximumFractionDigits: 2 })} €/mes`)

  // Sanity checks
  if (!totalPensions || totalPensions < 5_000_000 || totalPensions > 20_000_000) {
    throw new Error(`Total pensiones fuera de rango: ${totalPensions}`)
  }
  if (!monthlyPayroll || monthlyPayroll < 5_000_000_000 || monthlyPayroll > 30_000_000_000) {
    throw new Error(`Nómina mensual fuera de rango: ${monthlyPayroll}`)
  }

  return {
    monthlyPayrollSS: Math.round(monthlyPayroll),
    // Clases Pasivas: not in this Excel (separate ministry)
    // Use a proportional estimate based on known ratio (~11.6% of SS)
    monthlyPayrollClasesPasivas: null,
    totalPensions: Math.round(totalPensions),
    averagePension: Math.round(averagePension * 100) / 100,
    averagePensionRetirement: Math.round(averageRetirement * 100) / 100,
    retirementPensions: Math.round(retirementPensions),
    date: excelDate,
    dateLabel: monthLabel
  }
}

/**
 * Download pension data from Seguridad Social
 *
 * Strategy:
 * 1. Scrape the EST24 page (Pensiones contributivas en vigor) to find Excel links
 * 2. Download the REG*.xlsx file (data by regime — has totals, payroll, averages)
 * 3. Parse "Total sistema" row from sheet "Régimen_clase"
 * 4. Fall back to hardcoded reference data if scraping fails
 *
 * @returns {Promise<Object>} Pension data object
 */
export async function downloadPensionData(fetcher = fetchWithRetry) {
  console.log('\n=== Descargando datos de pensiones (Seguridad Social) ===')
  console.log()
  console.log('  Estrategia: scraping Excel desde Seg. Social')
  console.log(`  Página índice: ${EST24_URL}`)
  console.log()

  let liveData = null
  let liveDataError = null

  try {
    liveData = await fetchFromSSExcel(fetcher)
  } catch (error) {
    liveDataError = error?.message || 'error desconocido'
    console.log(`  ❌ Error en scraping: ${error.message}`)
  }

  if (liveData) {
    console.log()
    console.log('  ✅ Datos en vivo obtenidos de Seg. Social (Excel)')
    console.log()
  } else {
    console.log()
    console.log('  ⚠️  No se pudieron obtener datos en vivo → usando valores de referencia')
    console.log()
  }

  return buildPensionResult(liveData, liveDataError)
}

/**
 * Scrape the SS EST24 page, find the REG*.xlsx link, download and parse it.
 *
 * The SS website publishes monthly Excel files with pension data.
 * URLs contain UUIDs that change each month, so we must scrape the page
 * to find the current links.
 *
 * @returns {Promise<Object|null>} Parsed pension data or null
 */
export async function fetchFromSSExcel(fetcher = fetchWithRetry) {
  // Step 1: Fetch the index page
  console.log('  1. Descargando página índice EST24...')
  console.log(`    URL: ${EST24_URL}`)

  const pageResponse = await fetcher(EST24_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; DashboardFiscal/1.0)',
      'Accept': 'text/html'
    }
  }, { timeoutMs: 15000 })

  const html = await pageResponse.text()
  console.log(`    HTML recibido: ${(html.length / 1024).toFixed(1)} KB`)

  // Step 2: Find candidate REG*.xlsx links
  console.log()
  console.log('  2. Buscando enlaces REG*.xlsx...')
  const candidateExcelUrls = collectExcelCandidates(html)
  console.log(`    Candidatos REG*.xlsx: ${candidateExcelUrls.length}`)

  if (candidateExcelUrls.length === 0) {
    throw new Error('No se encontraron candidatos REG*.xlsx en la página ni en fallback local')
  }

  console.log()
  console.log('  3. Descargando y validando Excel (con fallback de URLs)...')

  let lastError = null
  for (let i = 0; i < candidateExcelUrls.length; i++) {
    const candidateUrl = candidateExcelUrls[i]
    const { filename, monthLabel } = parseExcelMetadata(candidateUrl)
    console.log(`    [${i + 1}/${candidateExcelUrls.length}] ${filename} (${monthLabel})`)

    try {
      const xlsxResponse = await fetcher(candidateUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; DashboardFiscal/1.0)'
        }
      }, { timeoutMs: 15000 })

      const buffer = await xlsxResponse.arrayBuffer()
      console.log(`      Descargado: ${(buffer.byteLength / 1024).toFixed(1)} KB`)
      console.log('      Parseando...')
      return parseSSExcelBuffer(buffer, candidateUrl)
    } catch (error) {
      lastError = error
      console.warn(`      ⚠️  Falló ${filename}: ${error.message}`)
    }
  }

  throw new Error(`No se pudo procesar ningún Excel REG*.xlsx. Último error: ${lastError?.message || 'desconocido'}`)
}

// ─────────────────────────────────────────────
// Reference / fallback data
// ─────────────────────────────────────────────

const REFERENCE_DATA = {
  monthlyPayrollSS: 14_250_714_014,    // Jan 2026 Excel "Total sistema"
  monthlyPayrollClasesPasivas: 1_659_000_000, // Estimated (separate ministry)
  monthlyPayrollPNC: 265_000_000,      // Estimated (IMSERSO, ~160M jubilación + ~105M invalidez)
  totalPensions: 10_452_674,            // Jan 2026 Excel
  averagePensionRetirement: 1_563.56,   // Jan 2026 Excel
  affiliates: 21_300_000,              // Estimated
  socialContributions: 200_000_000_000, // Eurostat 2024 S1314 D61REC (~199,698 M EUR) — NOT S13 total
  reserveFund: 7_500_000_000,          // 2025 estimate (7,500 M€)
  // Cumulative deficit: computed in enrichPensionWithSustainability() from Eurostat annual balances
  // Fallback null means the counter will show 0 until enrichment runs successfully
  cumulativeDeficit: null
}

/**
 * Build pension result from live or fallback data
 */
export function buildPensionResult(liveData, fallbackReason = null) {
  const isFallback = !liveData
  const sourceUrl = `${SS_BASE}/wps/portal/wss/internet/EstadisticasPresupuestosEstudios/Estadisticas/EST23/EST24`

  // Determine monthlyPayrollSS
  const monthlyPayrollSS = liveData?.monthlyPayrollSS || REFERENCE_DATA.monthlyPayrollSS

  // Clases Pasivas: not available in the SS Excel
  // Use reference value (separate ministry, changes slowly)
  const monthlyPayrollClasesPasivas = REFERENCE_DATA.monthlyPayrollClasesPasivas

  // Pensiones No Contributivas: IMSERSO
  const monthlyPayrollPNC = REFERENCE_DATA.monthlyPayrollPNC

  const monthlyPayroll = monthlyPayrollSS + monthlyPayrollClasesPasivas + monthlyPayrollPNC
  const annualExpense = monthlyPayroll * 14 // 14 pagas

  const totalPensions = liveData?.totalPensions || REFERENCE_DATA.totalPensions
  const pensioners = totalPensions
  const affiliates = REFERENCE_DATA.affiliates // Always fallback (different source)
  const contributorsPerPensioner = affiliates / pensioners

  const expensePerSecond = annualExpense / 365.25 / 86400

  const socialContributions = REFERENCE_DATA.socialContributions
  const contributoryDeficit = annualExpense - socialContributions

  const averagePensionRetirement = liveData?.averagePensionRetirement || REFERENCE_DATA.averagePensionRetirement

  // Log what we're using
  if (isFallback) {
    console.log('  Valores de referencia (ene 2026):')
  } else {
    console.log(`  Valores (${liveData.dateLabel}):`)
  }
  console.log(`    Nómina SS contributivas:  ${(monthlyPayrollSS / 1_000_000_000).toFixed(3)}B€/mes [${isFallback ? 'fallback' : 'Excel SS'}]`)
  console.log(`    Clases Pasivas:           ${(monthlyPayrollClasesPasivas / 1_000_000_000).toFixed(3)}B€/mes [fallback]`)
  console.log(`    Pensiones No Contributivas: ${(monthlyPayrollPNC / 1_000_000_000).toFixed(3)}B€/mes [fallback IMSERSO]`)
  console.log(`    Total:                    ${(monthlyPayroll / 1_000_000_000).toFixed(3)}B€/mes`)
  console.log(`    Gasto anual (×14 pagas):  ${(annualExpense / 1_000_000_000).toFixed(3)}B€`)
  console.log(`    Pensiones en vigor:       ${totalPensions.toLocaleString('es-ES')} [${isFallback ? 'fallback' : 'Excel SS'}]`)
  console.log(`    Pensión media jubilación: ${averagePensionRetirement.toLocaleString('es-ES')} €/mes [${isFallback ? 'fallback' : 'Excel SS'}]`)
  console.log(`    Afiliados:                ${affiliates.toLocaleString('es-ES')} [fallback]`)
  console.log(`    Cotizaciones sociales:    ${(socialContributions / 1_000_000_000).toFixed(0)}B€/año [fallback PGE]`)
  console.log(`    Fondo de reserva:         ${(REFERENCE_DATA.reserveFund / 1_000_000_000).toFixed(1)}B€ [fallback]`)
  console.log()

  // Build historical data
  const historical = buildHistoricalData(liveData)

  // Calculate regression
  const regressionPoints = historical.map(p => ({
    x: new Date(p.date).getTime(),
    y: p.monthlyPayroll
  }))

  const regression = linearRegression(regressionPoints)
  const lastDataTimestamp = regressionPoints.length > 0
    ? regressionPoints[regressionPoints.length - 1].x
    : Date.now()

  const regressionExpensePerSecond = (regression.slope * 14 * 1000) / (365.25 * 86400)

  // Build source attributions
  const liveType = isFallback ? 'fallback' : 'csv'
  const liveDate = liveData?.date || undefined
  const liveNote = liveData
    ? `Datos Excel Seg. Social ${liveData.dateLabel}`
    : `Valor referencia ene 2026${fallbackReason ? ` (${fallbackReason})` : ''}`

  const sourceAttribution = {
    monthlyPayroll: {
      source: isFallback ? 'Referencia Seg. Social ene 2026' : `Seg. Social — Pensiones en vigor (${liveData.dateLabel})`,
      type: liveType,
      url: sourceUrl,
      date: liveDate,
      note: isFallback ? 'Nómina mensual referencia ene 2026' : liveNote
    },
    monthlyPayrollSS: {
      source: isFallback ? 'Referencia Seg. Social ene 2026' : `Seg. Social — Excel REG (${liveData.dateLabel})`,
      type: liveType,
      url: sourceUrl,
      date: liveDate,
      note: isFallback ? 'Nómina SS referencia ene 2026' : liveNote
    },
    monthlyPayrollClasesPasivas: {
      source: 'Estimación Clases Pasivas',
      type: 'fallback',
      note: 'Clases Pasivas: ministerio separado, dato estimado'
    },
    monthlyPayrollPNC: {
      source: 'PNC (IMSERSO)',
      type: 'fallback',
      url: 'https://imserso.es/la-entidad/estadisticas/pensiones-no-contributivas',
      note: 'Pensiones No Contributivas (aprox. 160M€ jubilación + 105M€ invalidez)'
    },
    annualExpense: {
      source: 'Cálculo derivado',
      type: 'derived',
      note: 'Nómina mensual × 14 pagas'
    },
    totalPensions: {
      source: isFallback ? 'Referencia Seg. Social ene 2026' : `Seg. Social — Excel REG (${liveData.dateLabel})`,
      type: liveType,
      url: sourceUrl,
      date: liveDate,
      note: isFallback ? 'Pensiones en vigor referencia ene 2026' : liveNote
    },
    averagePensionRetirement: {
      source: isFallback ? 'Referencia Seg. Social ene 2026' : `Seg. Social — Excel REG (${liveData.dateLabel})`,
      type: liveType,
      url: sourceUrl,
      date: liveDate,
      note: isFallback ? 'Pensión media jubilación referencia ene 2026' : liveNote
    },
    affiliates: {
      source: 'Estimación afiliados SS',
      type: 'fallback',
      note: 'Afiliados estimados feb 2026'
    },
    contributorsPerPensioner: {
      source: 'Cálculo derivado',
      type: 'derived',
      note: 'Afiliados / pensionistas'
    },
    socialContributions: {
      source: 'PGE — Cotizaciones sociales',
      type: 'fallback',
      url: 'https://www.sepg.pap.hacienda.gob.es/sitios/sepg/es-ES/Presupuestos/PGE/Paginas/PGE2025.aspx',
      note: 'Cotizaciones estimadas 2025'
    },
    contributoryDeficit: {
      source: 'Cálculo derivado',
      type: 'derived',
      note: 'Gasto anual - cotizaciones sociales'
    },
    reserveFund: {
      source: 'Estimación Fondo de Reserva',
      type: 'fallback',
      note: 'Fondo de reserva estimado feb 2026'
    }
  }

  const result = {
    lastUpdated: new Date().toISOString(),
    pipeline: {
      liveDataUsed: !isFallback,
      criticalFallback: isFallback,
      fallbackReason: isFallback ? fallbackReason || 'No se pudo procesar ningún REG*.xlsx' : null
    },
    current: {
      monthlyPayroll,
      monthlyPayrollSS,
      monthlyPayrollClasesPasivas,
      monthlyPayrollPNC,
      annualExpense,
      totalPensions,
      averagePensionRetirement,
      affiliates,
      pensioners,
      contributorsPerPensioner,
      expensePerSecond,
      socialContributions,
      contributoryDeficit,
      reserveFund: REFERENCE_DATA.reserveFund,
      cumulativeDeficit: REFERENCE_DATA.cumulativeDeficit
    },
    historical,
    regression: {
      slope: regression.slope,
      intercept: regression.intercept,
      lastDataTimestamp,
      expensePerSecond: regressionExpensePerSecond
    },
    sourceAttribution
  }

  console.log(`✅ Pensiones procesadas:`)
  console.log(`   Nómina mensual: ${(monthlyPayroll / 1_000_000_000).toFixed(2)}B€`)
  console.log(`   Gasto anual: ${(annualExpense / 1_000_000_000).toFixed(2)}B€`)
  console.log(`   Pensiones: ${totalPensions.toLocaleString('es-ES')}`)
  console.log(`   Afiliados/pensionista: ${contributorsPerPensioner.toFixed(2)}`)
  console.log(`   Déficit contributivo: ${(contributoryDeficit / 1_000_000_000).toFixed(2)}B€`)

  return result
}

/**
 * Enrich pension data with values from ss-sustainability pipeline.
 * Replaces 3 hardcoded fallbacks (socialContributions, reserveFund, affiliates)
 * with real data from Eurostat / reference series.
 *
 * @param {Object} pensionData - Output from buildPensionResult()
 * @param {Object} sustainabilityData - Output from downloadSSSustainability()
 * @returns {Object} New pension object with enriched values (immutable)
 */
export function enrichPensionWithSustainability(pensionData, sustainabilityData) {
  if (!pensionData || !sustainabilityData) return pensionData

  const latestYear = String(sustainabilityData.latestYear)
  const yearData = sustainabilityData.byYear?.[latestYear]

  // 1. Social contributions: Eurostat gov_10a_main D61REC (M€ → €)
  const socialContributionsMEur = yearData?.socialContributions
  const socialContributions = socialContributionsMEur != null
    ? socialContributionsMEur * 1_000_000
    : pensionData.current.socialContributions

  // 2. Reserve fund: latest entry from RESERVE_FUND_HISTORY (M€ → €)
  const reserveFundHistory = sustainabilityData.reserveFund
  const latestReserveFund = reserveFundHistory?.length > 0
    ? reserveFundHistory[reserveFundHistory.length - 1]
    : null
  const reserveFund = latestReserveFund?.balance != null
    ? latestReserveFund.balance * 1_000_000
    : pensionData.current.reserveFund

  // 3. Affiliates: derive from contributors-per-pensioner ratio × totalPensions
  const cppHistory = sustainabilityData.contributorsPerPensioner
  const latestCpp = cppHistory?.length > 0
    ? cppHistory[cppHistory.length - 1]
    : null
  const totalPensions = pensionData.current.totalPensions
  const affiliates = latestCpp?.ratio != null
    ? Math.round(latestCpp.ratio * totalPensions)
    : pensionData.current.affiliates

  // Recalculate derived values
  const contributorsPerPensioner = affiliates / totalPensions
  const contributoryDeficit = pensionData.current.annualExpense - socialContributions

  // 4. Cumulative deficit: sum ssBalance (M EUR → EUR) for years >= 2009 from Eurostat series
  const START_YEAR = 2009
  const byYear = sustainabilityData.byYear
  let computedCumulativeDeficit = null
  if (byYear && typeof byYear === 'object') {
    const availableYears = Object.keys(byYear)
      .map(Number)
      .filter(y => y >= START_YEAR && byYear[String(y)]?.ssBalance != null)
    if (availableYears.length > 0) {
      const sumMEur = availableYears.reduce((acc, y) => acc + byYear[String(y)].ssBalance, 0)
      const latestComputedYear = Math.max(...availableYears)
      computedCumulativeDeficit = {
        base: sumMEur * 1_000_000,
        baseDate: `${latestComputedYear}-12-31`,
        source: 'eurostat',
        startYear: START_YEAR,
      }
      console.log(`    Déficit acumulado SS (${START_YEAR}-${latestComputedYear}): ${(sumMEur / 1000).toFixed(1)}B€ [${availableYears.length} años]`)
    }
  }
  const cumulativeDeficit = computedCumulativeDeficit ?? pensionData.current.cumulativeDeficit

  const enrichedCurrent = {
    ...pensionData.current,
    socialContributions,
    reserveFund,
    affiliates,
    contributorsPerPensioner,
    contributoryDeficit,
    cumulativeDeficit,
  }

  // Update source attributions for enriched fields
  const enrichedAttribution = {
    ...pensionData.sourceAttribution,
    socialContributions: socialContributionsMEur != null
      ? {
        source: `Eurostat gov_10a_main D61REC (${latestYear})`,
        type: "cross-reference",
        url: "https://ec.europa.eu/eurostat/databrowser/view/gov_10a_main/",
        date: `${latestYear}-12-31`,
        note: `Cotizaciones sociales ${latestYear}: ${socialContributionsMEur.toLocaleString("es-ES")} M€ (Eurostat)`,
      }
      : pensionData.sourceAttribution.socialContributions,
    reserveFund: latestReserveFund
      ? {
        source: `Fondo de Reserva SS (${latestReserveFund.year})`,
        type: "cross-reference",
        url: "https://www.seg-social.es",
        date: `${latestReserveFund.year}-12-31`,
        note: `Fondo de reserva ${latestReserveFund.year}: ${latestReserveFund.balance.toLocaleString("es-ES")} M€`,
      }
      : pensionData.sourceAttribution.reserveFund,
    affiliates: latestCpp
      ? {
        source: `Derivado ratio cotizantes/pensionista (${latestCpp.year})`,
        type: "cross-reference",
        note: `Ratio ${latestCpp.ratio} × ${totalPensions.toLocaleString("es-ES")} pensiones`,
      }
      : pensionData.sourceAttribution.affiliates,
    contributorsPerPensioner: latestCpp
      ? {
        source: `SS — ratio cotizantes/pensionista (${latestCpp.year})`,
        type: "cross-reference",
        note: `Ratio ${latestCpp.ratio} (${latestCpp.year})`,
      }
      : pensionData.sourceAttribution.contributorsPerPensioner,
    contributoryDeficit: {
      source: "Cálculo derivado (cross-reference)",
      type: "derived",
      note: "Gasto anual - cotizaciones sociales (Eurostat)",
    },
    cumulativeDeficit: computedCumulativeDeficit
      ? {
        source: `Eurostat gov_10a_main S1314 (${START_YEAR}-${computedCumulativeDeficit.baseDate.slice(0, 4)})`,
        type: "cross-reference",
        url: "https://ec.europa.eu/eurostat/databrowser/view/gov_10a_main/",
        date: computedCumulativeDeficit.baseDate,
        note: `Suma déficits anuales S1314 desde ${START_YEAR}: ${(computedCumulativeDeficit.base / 1_000_000_000).toFixed(0)}B€`,
      }
      : pensionData.sourceAttribution?.cumulativeDeficit,
  }

  console.log("  📊 Enriquecimiento cross-reference:")
  console.log(`    Cotizaciones sociales: ${(socialContributions / 1_000_000_000).toFixed(1)}B€ [${socialContributionsMEur != null ? "Eurostat " + latestYear : "fallback"}]`)
  console.log(`    Fondo de reserva:      ${(reserveFund / 1_000_000_000).toFixed(1)}B€ [${latestReserveFund ? latestReserveFund.year : "fallback"}]`)
  console.log(`    Afiliados:             ${affiliates.toLocaleString("es-ES")} [${latestCpp ? "ratio " + latestCpp.ratio : "fallback"}]`)
  console.log(`    Cotizantes/pensionista: ${contributorsPerPensioner.toFixed(2)}`)
  console.log(`    Déficit contributivo:  ${(contributoryDeficit / 1_000_000_000).toFixed(1)}B€`)

  return {
    ...pensionData,
    current: enrichedCurrent,
    sourceAttribution: enrichedAttribution,
  }
}

/**
 * Build historical reference data
 * If we have live data, append the latest point
 */
export function buildHistoricalData(liveData) {
  // Approximate adjustments for previous years to make the chart smooth
  // This assumes PNC+ClasesPasivas was roughly ~1.7B-1.9B total historically
  const baselineOffset = 1_600_000_000 + 265_000_000 // Aprox. CP + PNC for recent months

  const historical = [
    { date: '2020-12-31', monthlyPayroll: 10_200_000_000 + 1_500_000_000, totalPensions: 9_800_000 },
    { date: '2021-06-30', monthlyPayroll: 10_600_000_000 + 1_550_000_000, totalPensions: 9_900_000 },
    { date: '2021-12-31', monthlyPayroll: 10_900_000_000 + 1_600_000_000, totalPensions: 9_950_000 },
    { date: '2022-06-30', monthlyPayroll: 11_300_000_000 + 1_650_000_000, totalPensions: 10_050_000 },
    { date: '2022-12-31', monthlyPayroll: 11_700_000_000 + 1_700_000_000, totalPensions: 10_100_000 },
    { date: '2023-06-30', monthlyPayroll: 12_200_000_000 + 1_750_000_000, totalPensions: 10_150_000 },
    { date: '2023-12-31', monthlyPayroll: 12_600_000_000 + 1_800_000_000, totalPensions: 10_200_000 },
    { date: '2024-06-30', monthlyPayroll: 13_100_000_000 + 1_850_000_000, totalPensions: 10_250_000 },
    { date: '2024-12-31', monthlyPayroll: 13_500_000_000 + 1_900_000_000, totalPensions: 10_280_000 },
    { date: '2025-06-30', monthlyPayroll: 14_000_000_000 + 1_900_000_000, totalPensions: 10_290_000 },
    { date: '2025-12-31', monthlyPayroll: 14_500_000_000 + baselineOffset, totalPensions: 10_300_000 }
  ]

  // If we have live data, add it as the latest point
  if (liveData?.monthlyPayrollSS && liveData?.date) {
    // Add Clases Pasivas & PNC estimate to match historical format
    const totalPayroll = liveData.monthlyPayrollSS + REFERENCE_DATA.monthlyPayrollClasesPasivas + REFERENCE_DATA.monthlyPayrollPNC
    historical.push({
      date: liveData.date,
      monthlyPayroll: totalPayroll,
      totalPensions: liveData.totalPensions
    })
  } else {
    // Use reference as last point
    historical.push({
      date: '2026-01-31',
      monthlyPayroll: REFERENCE_DATA.monthlyPayrollSS + REFERENCE_DATA.monthlyPayrollClasesPasivas + REFERENCE_DATA.monthlyPayrollPNC,
      totalPensions: REFERENCE_DATA.totalPensions
    })
  }

  return historical
}
