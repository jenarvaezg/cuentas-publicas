import { linearRegression } from '../lib/regression.mjs'
import XLSX from 'xlsx'
import { fetchWithRetry } from '../lib/fetch-utils.mjs'

const SS_BASE = 'https://www.seg-social.es'
const EST24_URL = `${SS_BASE}/wps/portal/wss/internet/EstadisticasPresupuestosEstudios/Estadisticas/EST23/EST24`

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
export async function downloadPensionData() {
  console.log('\n=== Descargando datos de pensiones (Seguridad Social) ===')
  console.log()
  console.log('  Estrategia: scraping Excel desde Seg. Social')
  console.log(`  Página índice: ${EST24_URL}`)
  console.log()

  let liveData = null

  try {
    liveData = await fetchFromSSExcel()
  } catch (error) {
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

  return buildPensionResult(liveData)
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
async function fetchFromSSExcel() {
  // Step 1: Fetch the index page
  console.log('  1. Descargando página índice EST24...')
  console.log(`    URL: ${EST24_URL}`)

  const pageResponse = await fetchWithRetry(EST24_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; DashboardFiscal/1.0)',
      'Accept': 'text/html'
    }
  }, { timeoutMs: 15000 })

  const html = await pageResponse.text()
  console.log(`    HTML recibido: ${(html.length / 1024).toFixed(1)} KB`)

  // Step 2: Find the REG*.xlsx link (pension data by regime)
  console.log()
  console.log('  2. Buscando enlace a Excel de regímenes (REG*.xlsx)...')

  const regexPattern = /href=["']([^"']*REG\d{6}\.xlsx[^"']*)["']/i
  const match = html.match(regexPattern)

  if (!match) {
    // Try broader pattern
    const allXlsx = [...html.matchAll(/href=["']([^"']*\.xlsx[^"']*)["']/gi)]
    console.log(`    No se encontró REG*.xlsx. Total Excel encontrados: ${allXlsx.length}`)
    allXlsx.slice(0, 5).forEach((m, i) => {
      const filename = m[1].split('/').pop()?.split('?')[0] || m[1]
      console.log(`      [${i + 1}] ${filename}`)
    })
    throw new Error('No se encontró enlace REG*.xlsx en la página')
  }

  // Clean up HTML entities in the URL
  let excelPath = match[1].replace(/&amp;/g, '&')
  const excelUrl = excelPath.startsWith('http') ? excelPath : `${SS_BASE}${excelPath}`
  const filename = excelUrl.split('/').pop()?.split('?')[0] || 'unknown'

  console.log(`    Encontrado: ${filename}`)
  console.log(`    URL completa: ${excelUrl.substring(0, 120)}...`)

  // Extract the date from filename (e.g., REG202601.xlsx → enero 2026)
  const dateMatch = filename.match(/REG(\d{4})(\d{2})/)
  const excelDate = dateMatch
    ? `${dateMatch[1]}-${dateMatch[2]}-01`
    : new Date().toISOString().split('T')[0]
  const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
  const monthLabel = dateMatch
    ? `${monthNames[parseInt(dateMatch[2]) - 1]} ${dateMatch[1]}`
    : 'fecha desconocida'

  console.log(`    Período: ${monthLabel}`)

  // Step 3: Download the Excel file
  console.log()
  console.log('  3. Descargando Excel...')

  const xlsxResponse = await fetchWithRetry(excelUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; DashboardFiscal/1.0)'
    }
  }, { timeoutMs: 15000 })

  const buffer = await xlsxResponse.arrayBuffer()
  console.log(`    Descargado: ${(buffer.byteLength / 1024).toFixed(1)} KB`)

  // Step 4: Parse the Excel
  console.log()
  console.log('  4. Parseando Excel...')

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

// ─────────────────────────────────────────────
// Reference / fallback data
// ─────────────────────────────────────────────

const REFERENCE_DATA = {
  monthlyPayrollSS: 14_250_714_014,    // Jan 2026 Excel "Total sistema"
  monthlyPayrollClasesPasivas: 1_659_000_000, // Estimated (separate ministry)
  totalPensions: 10_452_674,            // Jan 2026 Excel
  averagePensionRetirement: 1_563.56,   // Jan 2026 Excel
  affiliates: 21_300_000,              // Estimated
  socialContributions: 180_000_000_000, // PGE estimate
  reserveFund: 2_100_000_000,          // Estimated
  // Accumulated contributory deficit (pension expense − social contributions) since 2011
  // Sources: UV-Eje quarterly reports, WTW, Instituto Santalucía, Fedea SSA series
  // Methodology: sum of annual deficits 2011-2025 (~290B€ narrow) + Clases Pasivas gap
  cumulativeDeficit: { base: 300_000_000_000, baseDate: '2026-01-01' }
}

/**
 * Build pension result from live or fallback data
 */
function buildPensionResult(liveData) {
  const isFallback = !liveData
  const sourceUrl = `${SS_BASE}/wps/portal/wss/internet/EstadisticasPresupuestosEstudios/Estadisticas/EST23/EST24`

  // Determine monthlyPayrollSS
  const monthlyPayrollSS = liveData?.monthlyPayrollSS || REFERENCE_DATA.monthlyPayrollSS

  // Clases Pasivas: not available in the SS Excel
  // Use reference value (separate ministry, changes slowly)
  const monthlyPayrollClasesPasivas = REFERENCE_DATA.monthlyPayrollClasesPasivas

  const monthlyPayroll = monthlyPayrollSS + monthlyPayrollClasesPasivas
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
    : 'Valor referencia ene 2026'

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
    current: {
      monthlyPayroll,
      monthlyPayrollSS,
      monthlyPayrollClasesPasivas,
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
 * Build historical reference data
 * If we have live data, append the latest point
 */
function buildHistoricalData(liveData) {
  const historical = [
    { date: '2020-12-31', monthlyPayroll: 10_200_000_000, totalPensions: 9_800_000 },
    { date: '2021-06-30', monthlyPayroll: 10_600_000_000, totalPensions: 9_900_000 },
    { date: '2021-12-31', monthlyPayroll: 10_900_000_000, totalPensions: 9_950_000 },
    { date: '2022-06-30', monthlyPayroll: 11_300_000_000, totalPensions: 10_050_000 },
    { date: '2022-12-31', monthlyPayroll: 11_700_000_000, totalPensions: 10_100_000 },
    { date: '2023-06-30', monthlyPayroll: 12_200_000_000, totalPensions: 10_150_000 },
    { date: '2023-12-31', monthlyPayroll: 12_600_000_000, totalPensions: 10_200_000 },
    { date: '2024-06-30', monthlyPayroll: 13_100_000_000, totalPensions: 10_250_000 },
    { date: '2024-12-31', monthlyPayroll: 13_500_000_000, totalPensions: 10_280_000 },
    { date: '2025-06-30', monthlyPayroll: 14_000_000_000, totalPensions: 10_290_000 },
    { date: '2025-12-31', monthlyPayroll: 14_500_000_000, totalPensions: 10_300_000 }
  ]

  // If we have live data, add it as the latest point
  if (liveData?.monthlyPayrollSS && liveData?.date) {
    // Add Clases Pasivas estimate to match historical format
    const totalPayroll = liveData.monthlyPayrollSS + REFERENCE_DATA.monthlyPayrollClasesPasivas
    historical.push({
      date: liveData.date,
      monthlyPayroll: totalPayroll,
      totalPensions: liveData.totalPensions
    })
  } else {
    // Use reference as last point
    historical.push({
      date: '2026-01-31',
      monthlyPayroll: REFERENCE_DATA.monthlyPayrollSS + REFERENCE_DATA.monthlyPayrollClasesPasivas,
      totalPensions: REFERENCE_DATA.totalPensions
    })
  }

  return historical
}
