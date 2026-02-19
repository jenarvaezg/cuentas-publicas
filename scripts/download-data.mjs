import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs'
import { downloadDebtData, downloadCcaaDebtData } from './sources/bde.mjs'
import { downloadDemographics } from './sources/ine.mjs'
import { downloadPensionData } from './sources/seguridad-social.mjs'
import { downloadBudgetData } from './sources/igae.mjs'
import { downloadEurostatData, downloadRevenueData } from './sources/eurostat.mjs'

/**
 * Main orchestrator - downloads all data sources and writes JSON files
 */
async function main() {
  console.log('╔═══════════════════════════════════════════════════════╗')
  console.log('║  Descargador de Datos - Dashboard Fiscal España      ║')
  console.log('╚═══════════════════════════════════════════════════════╝')
  console.log()
  console.log(`Inicio: ${new Date().toLocaleString('es-ES')}`)

  // Ensure output directory exists
  mkdirSync('src/data', { recursive: true })

  // Read existing data before downloading
  const existingData = readExistingData()
  displayExistingDataStatus(existingData)

  // Download all sources in parallel
  const startTime = Date.now()

  const results = await Promise.allSettled([
    downloadDebtData(),
    downloadDemographics(),
    downloadPensionData(),
    downloadBudgetData(),
    downloadEurostatData(),
    downloadCcaaDebtData(),
    downloadRevenueData()
  ])

  const [debtResult, demographicsResult, pensionsResult, budgetResult, eurostatResult, ccaaDebtResult, revenueResult] = results

  // Track success/failure
  const status = {
    debt: debtResult.status === 'fulfilled',
    demographics: demographicsResult.status === 'fulfilled',
    pensions: pensionsResult.status === 'fulfilled',
    budget: budgetResult.status === 'fulfilled',
    eurostat: eurostatResult.status === 'fulfilled',
    ccaaDebt: ccaaDebtResult.status === 'fulfilled',
    revenue: revenueResult.status === 'fulfilled'
  }

  // Write individual data files
  console.log('\n=== Escribiendo archivos JSON ===')

  if (status.debt) {
    writeDataFile('src/data/debt.json', debtResult.value)
    console.log('✅ debt.json')
  } else {
    console.error('❌ debt.json - Error:', debtResult.reason?.message)
  }

  if (status.demographics) {
    writeDataFile('src/data/demographics.json', demographicsResult.value)
    console.log('✅ demographics.json')
  } else {
    console.error('❌ demographics.json - Error:', demographicsResult.reason?.message)
  }

  if (status.pensions) {
    writeDataFile('src/data/pensions.json', pensionsResult.value)
    console.log('✅ pensions.json')
  } else {
    console.error('❌ pensions.json - Error:', pensionsResult.reason?.message)
  }

  if (status.budget) {
    writeDataFile('src/data/budget.json', budgetResult.value)
    console.log('✅ budget.json')
  } else {
    console.error('❌ budget.json - Error:', budgetResult.reason?.message)
  }

  if (status.eurostat) {
    writeDataFile('src/data/eurostat.json', eurostatResult.value)
    console.log('✅ eurostat.json')
  } else {
    console.error('❌ eurostat.json - Error:', eurostatResult.reason?.message)
  }

  if (status.ccaaDebt) {
    writeDataFile('src/data/ccaa-debt.json', ccaaDebtResult.value)
    console.log('✅ ccaa-debt.json')
  } else {
    console.error('❌ ccaa-debt.json - Error:', ccaaDebtResult.reason?.message)
  }

  if (status.revenue) {
    writeDataFile('src/data/revenue.json', revenueResult.value)
    console.log('✅ revenue.json')
  } else {
    console.error('❌ revenue.json - Error:', revenueResult.reason?.message)
  }

  // Write metadata file
  const meta = {
    lastDownload: new Date().toISOString(),
    duration: Date.now() - startTime,
    status,
    sources: {
      debt: {
        success: status.debt,
        lastUpdated: status.debt ? debtResult.value.lastUpdated : null,
        dataPoints: status.debt ? debtResult.value.historical.length : 0
      },
      demographics: {
        success: status.demographics,
        lastUpdated: status.demographics ? demographicsResult.value.lastUpdated : null
      },
      pensions: {
        success: status.pensions,
        lastUpdated: status.pensions ? pensionsResult.value.lastUpdated : null,
        dataPoints: status.pensions ? pensionsResult.value.historical.length : 0
      },
      budget: {
        success: status.budget,
        lastUpdated: status.budget ? budgetResult.value.lastUpdated : null,
        years: status.budget ? budgetResult.value.years.length : 0
      },
      eurostat: {
        success: status.eurostat,
        lastUpdated: status.eurostat ? eurostatResult.value.lastUpdated : null,
        year: status.eurostat ? eurostatResult.value.year : null
      },
      ccaaDebt: {
        success: status.ccaaDebt,
        lastUpdated: status.ccaaDebt ? ccaaDebtResult.value.lastUpdated : null,
        quarter: status.ccaaDebt ? ccaaDebtResult.value.quarter : null
      },
      revenue: {
        success: status.revenue,
        lastUpdated: status.revenue ? revenueResult.value.lastUpdated : null,
        latestYear: status.revenue ? revenueResult.value.latestYear : null
      }
    }
  }

  writeDataFile('src/data/meta.json', meta)
  console.log('✅ meta.json')

  // Compare old vs new data
  if (existingData.debt || existingData.demographics || existingData.pensions) {
    displayDataComparison(existingData, {
      debt: status.debt ? debtResult.value : null,
      demographics: status.demographics ? demographicsResult.value : null,
      pensions: status.pensions ? pensionsResult.value : null,
      budget: status.budget ? budgetResult.value : null
    })
  }

  // Display freshness warnings
  displayFreshnessWarnings({
    debt: status.debt ? debtResult.value : null,
    demographics: status.demographics ? demographicsResult.value : null,
    pensions: status.pensions ? pensionsResult.value : null,
    budget: status.budget ? budgetResult.value : null
  })

  // Summary
  console.log('\n╔═══════════════════════════════════════════════════════╗')
  console.log('║  Resumen                                              ║')
  console.log('╚═══════════════════════════════════════════════════════╝')
  console.log()

  const successCount = Object.values(status).filter(Boolean).length
  const totalCount = Object.keys(status).length

  console.log(`Fuentes exitosas: ${successCount}/${totalCount}`)
  console.log(`Duración: ${(meta.duration / 1000).toFixed(1)}s`)
  console.log(`Archivos generados: ${successCount + 1}`) // +1 for meta.json
  console.log()

  // Detailed source attribution summary
  console.log('=== Resumen de fuentes ===')

  if (status.debt && debtResult.value) {
    const debtAttr = debtResult.value.sourceAttribution?.totalDebt
    const latestDebt = debtResult.value.current?.totalDebt
    const latestDebtBillions = latestDebt ? (latestDebt / 1_000_000_000).toFixed(0) : 'N/A'
    const debtDate = debtAttr?.date || 'N/A'
    const isLive = debtAttr?.type === 'csv'
    console.log(`Deuda (BdE): ${isLive ? '✅' : '⚠️'} ${debtAttr?.type?.toUpperCase() || 'N/A'} (${latestDebtBillions}B€, ${debtDate})`)
  } else {
    console.log('Deuda (BdE): ❌ Error')
  }

  if (status.demographics && demographicsResult.value) {
    const popAttr = demographicsResult.value.sourceAttribution?.population
    const population = demographicsResult.value.population
    const popDate = popAttr?.date || 'N/A'
    const isLive = popAttr?.type === 'api'
    console.log(`Población: ${isLive ? '✅' : '⚠️'} ${popAttr?.type?.toUpperCase() || 'N/A'} (${(population / 1_000_000).toFixed(1)}M, ${popDate})`)

    const activeAttr = demographicsResult.value.sourceAttribution?.activePopulation
    const activePop = demographicsResult.value.activePopulation
    const activeDate = activeAttr?.date || 'N/A'
    const isActiveLive = activeAttr?.type === 'api'
    console.log(`Población activa: ${isActiveLive ? '✅' : '⚠️'} ${activeAttr?.type?.toUpperCase() || 'N/A'} (${(activePop / 1_000_000).toFixed(1)}M, ${activeDate})`)

    const gdpAttr = demographicsResult.value.sourceAttribution?.gdp
    const gdp = demographicsResult.value.gdp
    const gdpDate = gdpAttr?.date || 'N/A'
    const isGdpLive = gdpAttr?.type === 'api'
    console.log(`PIB: ${isGdpLive ? '✅' : '⚠️'} ${gdpAttr?.type?.toUpperCase() || 'N/A'} (${(gdp / 1_000_000_000_000).toFixed(2)}T€, ${gdpDate})`)

    const salaryAttr = demographicsResult.value.sourceAttribution?.averageSalary
    const salary = demographicsResult.value.averageSalary
    const salaryDate = salaryAttr?.date || 'N/A'
    const isSalaryLive = salaryAttr?.type === 'api'
    console.log(`Salario medio: ${isSalaryLive ? '✅' : '⚠️'} ${salaryAttr?.type?.toUpperCase() || 'N/A'} (${salary.toLocaleString('es-ES')}€, ${salaryDate})`)
  } else {
    console.log('Demografía: ❌ Error')
  }

  if (status.pensions && pensionsResult.value) {
    const pensionAttr = pensionsResult.value.sourceAttribution?.monthlyPayroll
    const monthlyPayroll = pensionsResult.value.current?.monthlyPayroll
    const isLive = pensionAttr?.type === 'api'
    console.log(`Pensiones: ${isLive ? '✅' : '⚠️'} ${pensionAttr?.type?.toUpperCase() || 'N/A'} (${(monthlyPayroll / 1_000_000_000).toFixed(2)}B€/mes)`)
  } else {
    console.log('Pensiones: ❌ Error')
  }

  if (status.budget && budgetResult.value) {
    const budgetAttr = budgetResult.value.sourceAttribution?.budget
    const latestYear = budgetResult.value.latestYear
    const latestTotal = budgetResult.value.byYear?.[String(latestYear)]?.total
    const isLive = budgetAttr?.type === 'csv'
    console.log(`Presupuestos: ${isLive ? '✅' : '⚠️'} ${budgetAttr?.type?.toUpperCase() || 'N/A'} (${latestTotal?.toLocaleString('es-ES') || 'N/A'} M€, ${latestYear})`)
  } else {
    console.log('Presupuestos: ❌ Error')
  }

  if (status.eurostat && eurostatResult.value) {
    const eurostatAttr = eurostatResult.value.sourceAttribution?.eurostat
    const indicatorCount = Object.keys(eurostatResult.value.indicators || {}).length
    const isLive = eurostatAttr?.type === 'api'
    console.log(`Eurostat: ${isLive ? '✅' : '⚠️'} ${eurostatAttr?.type?.toUpperCase() || 'N/A'} (${indicatorCount} indicadores, año ${eurostatResult.value.year})`)
  } else {
    console.log('Eurostat: ❌ Error')
  }

  if (status.ccaaDebt && ccaaDebtResult.value) {
    const ccaaAttr = ccaaDebtResult.value.sourceAttribution?.be1310
    const ccaaCount = ccaaDebtResult.value.ccaa?.length || 0
    const isLive = ccaaAttr?.type === 'csv'
    console.log(`Deuda CCAA: ${isLive ? '✅' : '⚠️'} ${ccaaAttr?.type?.toUpperCase() || 'N/A'} (${ccaaCount} comunidades, ${ccaaDebtResult.value.quarter})`)
  } else {
    console.log('Deuda CCAA: ❌ Error')
  }

  if (status.revenue && revenueResult.value) {
    const revenueAttr = revenueResult.value.sourceAttribution?.revenue
    const yearCount = revenueResult.value.years?.length || 0
    const isLive = revenueAttr?.type === 'api'
    console.log(`Revenue: ${isLive ? '✅' : '⚠️'} ${revenueAttr?.type?.toUpperCase() || 'N/A'} (${yearCount} años, último ${revenueResult.value.latestYear})`)
  } else {
    console.log('Revenue: ❌ Error')
  }
  console.log()

  // B3: Éxito parcial. Definir fuentes críticas.
  const CRITICAL_SOURCES = ['debt', 'demographics', 'pensions', 'budget']
  const failedCritical = CRITICAL_SOURCES.filter(source => !status[source])

  if (failedCritical.length === 0) {
    if (successCount === totalCount) {
      console.log('✅ Descarga completada exitosamente')
    } else {
      console.warn('⚠️  Descarga completada con errores en fuentes no críticas:',
        Object.keys(status).filter(s => !status[s]).join(', '))
    }
    process.exit(0)
  } else {
    console.error('❌ Error: Fallaron fuentes críticas:', failedCritical.join(', '))
    process.exit(1)
  }
}

/**
 * Write data file with pretty formatting
 */
function writeDataFile(path, data) {
  try {
    const json = JSON.stringify(data, null, 2)
    writeFileSync(path, json, 'utf-8')
  } catch (error) {
    console.error(`Error escribiendo ${path}:`, error.message)
    throw error
  }
}

/**
 * Read existing data files
 */
function readExistingData() {
  const existing = {
    debt: null,
    demographics: null,
    pensions: null,
    budget: null,
    meta: null
  }

  try {
    if (existsSync('src/data/debt.json')) {
      existing.debt = JSON.parse(readFileSync('src/data/debt.json', 'utf-8'))
    }
  } catch (e) {
    console.warn('⚠️  Error leyendo debt.json existente:', e.message)
  }

  try {
    if (existsSync('src/data/demographics.json')) {
      existing.demographics = JSON.parse(readFileSync('src/data/demographics.json', 'utf-8'))
    }
  } catch (e) {
    console.warn('⚠️  Error leyendo demographics.json existente:', e.message)
  }

  try {
    if (existsSync('src/data/pensions.json')) {
      existing.pensions = JSON.parse(readFileSync('src/data/pensions.json', 'utf-8'))
    }
  } catch (e) {
    console.warn('⚠️  Error leyendo pensions.json existente:', e.message)
  }

  try {
    if (existsSync('src/data/budget.json')) {
      existing.budget = JSON.parse(readFileSync('src/data/budget.json', 'utf-8'))
    }
  } catch (e) {
    console.warn('⚠️  Error leyendo budget.json existente:', e.message)
  }

  try {
    if (existsSync('src/data/meta.json')) {
      existing.meta = JSON.parse(readFileSync('src/data/meta.json', 'utf-8'))
    }
  } catch (e) {
    console.warn('⚠️  Error leyendo meta.json existente:', e.message)
  }

  return existing
}

/**
 * Display existing data status
 */
function displayExistingDataStatus(existing) {
  console.log('\n╔═══════════════════════════════════════════════════════╗')
  console.log('║  Estado Actual de los Datos                          ║')
  console.log('╚═══════════════════════════════════════════════════════╝')
  console.log()

  // Debt
  if (existing.debt) {
    const lastDebt = existing.debt.current?.totalDebt
    const lastDate = existing.debt.historical?.[existing.debt.historical.length - 1]?.date || 'desconocido'
    const dataPoints = existing.debt.historical?.length || 0
    const timeAgo = getTimeAgo(lastDate)
    console.log(`debt.json:         existe`)
    console.log(`  Último dato:     ${(lastDebt / 1_000_000_000).toLocaleString('es-ES')}B€ (${lastDate}, ${timeAgo})`)
    console.log(`  Datos históricos: ${dataPoints} puntos`)
    console.log(`  Fuente:          ${existing.debt.sourceAttribution?.totalDebt?.source || 'desconocida'}`)
  } else {
    console.log(`debt.json:         NO EXISTE`)
  }
  console.log()

  // Demographics
  if (existing.demographics) {
    const popDate = existing.demographics.sourceAttribution?.population?.date || 'desconocido'
    const gdpSource = existing.demographics.sourceAttribution?.gdp?.source || 'desconocida'
    const popTimeAgo = getTimeAgo(popDate)
    console.log(`demographics.json: existe`)
    console.log(`  Población:       ${existing.demographics.population?.toLocaleString('es-ES')} (${popDate}, ${popTimeAgo})`)
    console.log(`  PIB:             ${(existing.demographics.gdp / 1_000_000_000_000).toFixed(3)}T€ (${gdpSource})`)
    console.log(`  Población activa: ${(existing.demographics.activePopulation / 1_000_000).toFixed(2)}M`)
  } else {
    console.log(`demographics.json: NO EXISTE`)
  }
  console.log()

  // Pensions
  if (existing.pensions) {
    const payroll = existing.pensions.current?.monthlyPayroll
    const source = existing.pensions.sourceAttribution?.monthlyPayroll?.source || 'desconocida'
    console.log(`pensions.json:     existe`)
    console.log(`  Nómina mensual:  ${(payroll / 1_000_000_000).toFixed(3)}B€/mes`)
    console.log(`  Fuente:          ${source}`)
    console.log(`  Tipo:            ${existing.pensions.sourceAttribution?.monthlyPayroll?.type || 'desconocido'}`)
  } else {
    console.log(`pensions.json:     NO EXISTE`)
  }
  console.log()

  // Meta
  if (existing.meta) {
    const lastDownload = new Date(existing.meta.lastDownload)
    const downloadTimeAgo = getTimeAgo(existing.meta.lastDownload)
    console.log(`meta.json:         existe`)
    console.log(`  Última descarga: ${lastDownload.toLocaleString('es-ES')} (${downloadTimeAgo})`)
    console.log(`  Duración:        ${(existing.meta.duration / 1000).toFixed(1)}s`)
  } else {
    console.log(`meta.json:         NO EXISTE`)
  }
  console.log()
}

/**
 * Display comparison between old and new data
 */
function displayDataComparison(existing, newData) {
  console.log('\n╔═══════════════════════════════════════════════════════════════════════════════════════════════╗')
  console.log('║  Comparación Datos Existentes vs Nuevos                                                      ║')
  console.log('╚═══════════════════════════════════════════════════════════════════════════════════════════════╝')
  console.log()

  const colWidth = {
    label: 25,
    existing: 35,
    new: 35,
    change: 20
  }

  // Header
  console.log(
    padEnd('', colWidth.label) +
    padEnd('EXISTENTE', colWidth.existing) +
    padEnd('NUEVO', colWidth.new) +
    'CAMBIO'
  )
  console.log('─'.repeat(115))

  // Debt comparison
  if (existing.debt && newData.debt) {
    const oldTotal = existing.debt.current?.totalDebt
    const newTotal = newData.debt.current?.totalDebt
    const oldDate = existing.debt.historical?.[existing.debt.historical.length - 1]?.date
    const newDate = newData.debt.historical?.[newData.debt.historical.length - 1]?.date
    const oldPoints = existing.debt.historical?.length || 0
    const newPoints = newData.debt.historical?.length || 0
    const oldSource = existing.debt.sourceAttribution?.totalDebt?.source || 'desconocida'
    const newSource = newData.debt.sourceAttribution?.totalDebt?.source || 'desconocida'

    console.log(padEnd('Deuda total:', colWidth.label) +
      padEnd(`${oldTotal?.toLocaleString('es-ES')} €`, colWidth.existing) +
      padEnd(`${newTotal?.toLocaleString('es-ES')} €`, colWidth.new) +
      getChangeIndicator(oldTotal, newTotal))

    console.log(padEnd('  Fuente:', colWidth.label) +
      padEnd(`${oldSource} (${oldDate})`, colWidth.existing) +
      padEnd(`${newSource} (${newDate})`, colWidth.new) +
      (oldDate === newDate ? '= (misma fecha)' : '✓ (actualizado)'))

    console.log(padEnd('  Datos históricos:', colWidth.label) +
      padEnd(`${oldPoints} puntos`, colWidth.existing) +
      padEnd(`${newPoints} puntos`, colWidth.new) +
      getChangeIndicator(oldPoints, newPoints))

    // Subsectors
    const oldEstado = existing.debt.current?.debtBySubsector?.estado
    const newEstado = newData.debt.current?.debtBySubsector?.estado
    if (oldEstado && newEstado) {
      console.log(padEnd('  Estado:', colWidth.label) +
        padEnd(`${(oldEstado / 1_000_000_000).toFixed(1)}B€`, colWidth.existing) +
        padEnd(`${(newEstado / 1_000_000_000).toFixed(1)}B€`, colWidth.new) +
        getChangeIndicator(oldEstado, newEstado))
    }

    const oldCCAA = existing.debt.current?.debtBySubsector?.ccaa
    const newCCAA = newData.debt.current?.debtBySubsector?.ccaa
    if (oldCCAA && newCCAA) {
      console.log(padEnd('  CCAA:', colWidth.label) +
        padEnd(`${(oldCCAA / 1_000_000_000).toFixed(1)}B€`, colWidth.existing) +
        padEnd(`${(newCCAA / 1_000_000_000).toFixed(1)}B€`, colWidth.new) +
        getChangeIndicator(oldCCAA, newCCAA))
    }

    console.log()
  }

  // Demographics comparison
  if (existing.demographics && newData.demographics) {
    const oldPop = existing.demographics.population
    const newPop = newData.demographics.population
    const oldPopDate = existing.demographics.sourceAttribution?.population?.date
    const newPopDate = newData.demographics.sourceAttribution?.population?.date
    const oldPopSource = existing.demographics.sourceAttribution?.population?.source
    const newPopSource = newData.demographics.sourceAttribution?.population?.source

    console.log(padEnd('Población:', colWidth.label) +
      padEnd(`${oldPop?.toLocaleString('es-ES')}`, colWidth.existing) +
      padEnd(`${newPop?.toLocaleString('es-ES')}`, colWidth.new) +
      getChangeIndicator(oldPop, newPop))

    console.log(padEnd('  Fuente:', colWidth.label) +
      padEnd(`${oldPopSource} (${oldPopDate})`, colWidth.existing) +
      padEnd(`${newPopSource} (${newPopDate})`, colWidth.new) +
      (oldPopDate === newPopDate ? '= (misma fecha)' : '✓ (actualizado)'))

    const oldGDP = existing.demographics.gdp
    const newGDP = newData.demographics.gdp
    const oldGDPSource = existing.demographics.sourceAttribution?.gdp?.source
    const newGDPSource = newData.demographics.sourceAttribution?.gdp?.source

    console.log(padEnd('PIB:', colWidth.label) +
      padEnd(`${(oldGDP / 1_000_000_000_000).toFixed(3)}T€`, colWidth.existing) +
      padEnd(`${(newGDP / 1_000_000_000_000).toFixed(3)}T€`, colWidth.new) +
      getChangeIndicator(oldGDP, newGDP))

    console.log(padEnd('  Fuente:', colWidth.label) +
      padEnd(oldGDPSource || 'desconocida', colWidth.existing) +
      padEnd(newGDPSource || 'desconocida', colWidth.new) +
      (oldGDPSource === newGDPSource ? '= (misma fuente)' : '✓'))

    console.log()
  }

  // Pensions comparison
  if (existing.pensions && newData.pensions) {
    const oldPayroll = existing.pensions.current?.monthlyPayroll
    const newPayroll = newData.pensions.current?.monthlyPayroll
    const oldType = existing.pensions.sourceAttribution?.monthlyPayroll?.type
    const newType = newData.pensions.sourceAttribution?.monthlyPayroll?.type

    console.log(padEnd('Nómina pensiones:', colWidth.label) +
      padEnd(`${(oldPayroll / 1_000_000_000).toFixed(3)}B€/mes`, colWidth.existing) +
      padEnd(`${(newPayroll / 1_000_000_000).toFixed(3)}B€/mes`, colWidth.new) +
      getChangeIndicator(oldPayroll, newPayroll))

    console.log(padEnd('  Fuente:', colWidth.label) +
      padEnd(oldType || 'desconocido', colWidth.existing) +
      padEnd(newType || 'desconocido', colWidth.new) +
      (oldType === 'fallback' && newType === 'fallback' ? '⚠️  (ambos fallback)' : ''))

    console.log()
  }
}

/**
 * Display freshness warnings
 */
function displayFreshnessWarnings(data) {
  console.log('\n╔═══════════════════════════════════════════════════════╗')
  console.log('║  Alertas de Frescura de Datos                         ║')
  console.log('╚═══════════════════════════════════════════════════════╝')
  console.log()

  const warnings = []
  const successes = []

  // Check debt freshness
  if (data.debt) {
    const lastDate = data.debt.historical?.[data.debt.historical.length - 1]?.date
    const type = data.debt.sourceAttribution?.totalDebt?.type
    const ageMonths = getAgeInMonths(lastDate)

    if (type === 'csv' && ageMonths < 4) {
      successes.push(`✅  Deuda: datos frescos del BdE (último: ${lastDate}, hace ${ageMonths} ${ageMonths === 1 ? 'mes' : 'meses'})`)
    } else if (ageMonths >= 4) {
      warnings.push(`⚠️  Deuda: dato de ${lastDate} (hace ${ageMonths} meses) - puede estar desactualizado`)
    }
  }

  // Check population freshness
  if (data.demographics) {
    const popDate = data.demographics.sourceAttribution?.population?.date
    const popType = data.demographics.sourceAttribution?.population?.type
    const popYears = getAgeInYears(popDate)

    if (popType === 'api' && popYears >= 2) {
      warnings.push(`⚠️  Población: dato de ${popDate} (hace ${popYears} años!) - el INE API devuelve datos antiguos para tabla 56934`)
    } else if (popType === 'fallback') {
      warnings.push(`⚠️  Población: usando valor de referencia hardcoded - INE API no devuelve datos válidos`)
    } else if (popType === 'api') {
      successes.push(`✅  Población: datos del INE (${popDate}, hace ${popYears} ${popYears === 1 ? 'año' : 'años'})`)
    }

    // Check GDP
    const gdpType = data.demographics.sourceAttribution?.gdp?.type
    if (gdpType === 'fallback') {
      warnings.push(`⚠️  PIB: usando valor de referencia hardcoded (${(data.demographics.gdp / 1_000_000_000_000).toFixed(3)}T€) - INE API no devuelve datos válidos`)
    } else if (gdpType === 'api') {
      successes.push(`✅  PIB: datos del INE API`)
    }

    // Check active population
    const activeType = data.demographics.sourceAttribution?.activePopulation?.type
    if (activeType === 'fallback') {
      warnings.push(`⚠️  Población activa: usando valor de referencia hardcoded - INE EPA no accesible`)
    }
  }

  // Check pension data
  if (data.pensions) {
    const pensionType = data.pensions.sourceAttribution?.monthlyPayroll?.type
    if (pensionType === 'fallback') {
      warnings.push(`⚠️  Datos de pensiones: todo es fallback hardcoded - Seguridad Social no tiene API pública`)
    } else if (pensionType === 'api') {
      successes.push(`✅  Pensiones: datos en vivo de Seguridad Social`)
    }
  }

  // Display warnings first
  warnings.forEach(w => console.log(w))

  // Then successes
  if (successes.length > 0) {
    console.log()
    successes.forEach(s => console.log(s))
  }

  if (warnings.length === 0 && successes.length === 0) {
    console.log('ℹ️  No hay alertas de frescura')
  }

  console.log()
}

/**
 * Get time ago string
 */
function getTimeAgo(dateStr) {
  if (!dateStr) return 'desconocido'

  try {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now - date
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const diffMonths = Math.floor(diffDays / 30)
    const diffYears = Math.floor(diffDays / 365)

    if (diffDays === 0) return 'hoy'
    if (diffDays === 1) return 'ayer'
    if (diffDays < 30) return `hace ${diffDays} días`
    if (diffMonths === 1) return 'hace 1 mes'
    if (diffMonths < 12) return `hace ${diffMonths} meses`
    if (diffYears === 1) return 'hace 1 año'
    return `hace ${diffYears} años`
  } catch (e) {
    return 'fecha inválida'
  }
}

/**
 * Get age in months
 */
function getAgeInMonths(dateStr) {
  if (!dateStr) return 999

  try {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now - date
    return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30))
  } catch (e) {
    return 999
  }
}

/**
 * Get age in years
 */
function getAgeInYears(dateStr) {
  if (!dateStr) return 999

  try {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now - date
    return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 365))
  } catch (e) {
    return 999
  }
}

/**
 * Pad string to end
 */
function padEnd(str, length) {
  return str.padEnd(length, ' ')
}

/**
 * Get change indicator
 */
function getChangeIndicator(oldVal, newVal) {
  if (oldVal === undefined || newVal === undefined) return '?'
  if (oldVal === newVal) return '= (sin cambio)'

  const diff = newVal - oldVal
  const pct = ((diff / oldVal) * 100).toFixed(2)

  if (diff > 0) {
    return `↑ +${diff.toLocaleString('es-ES')} (+${pct}%)`
  } else {
    return `↓ ${diff.toLocaleString('es-ES')} (${pct}%)`
  }
}

// Run main
main().catch(error => {
  console.error('\n❌ Error fatal:', error)
  process.exit(1)
})
