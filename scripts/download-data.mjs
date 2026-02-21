import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs'
import { dirname } from 'path'
import { downloadDebtData, downloadCcaaDebtData } from './sources/bde.mjs'
import { downloadDemographics } from './sources/ine.mjs'
import { downloadPensionData } from './sources/seguridad-social.mjs'
import { downloadBudgetData } from './sources/igae.mjs'
import { downloadEurostatData, downloadRevenueData } from './sources/eurostat.mjs'
import { downloadTaxRevenueData } from './sources/aeat.mjs'
import { downloadCcaaFiscalBalanceData } from './sources/hacienda-fiscal-balance.mjs'

const SITE_URL = 'https://cuentas-publicas.es'

const SECTION_PAGE_DEFS = [
  {
    id: 'resumen',
    slugEs: 'resumen',
    slugEn: 'overview',
    titleEs: 'Resumen Fiscal de España',
    titleEn: 'Spain Fiscal Overview',
    descriptionEs: 'Visión general de deuda, pensiones, gasto e ingresos públicos de España.',
    descriptionEn: 'High-level overview of Spain debt, pensions, spending and public revenue.',
  },
  {
    id: 'deuda',
    slugEs: 'deuda',
    slugEn: 'debt',
    titleEs: 'Deuda Pública de España',
    titleEn: 'Spain Public Debt',
    descriptionEs: 'Métricas clave de deuda pública PDE, per cápita y ratio deuda/PIB.',
    descriptionEn: 'Key EDP public debt metrics, debt per capita and debt-to-GDP ratio.',
  },
  {
    id: 'coste-deuda',
    slugEs: 'coste-deuda',
    slugEn: 'debt-cost',
    titleEs: 'Coste de la Deuda Pública',
    titleEn: 'Public Debt Cost',
    descriptionEs: 'Gasto anual en intereses y coste medio estimado de la deuda pública.',
    descriptionEn: 'Annual interest spending and estimated average cost of public debt.',
  },
  {
    id: 'pensiones',
    slugEs: 'pensiones',
    slugEn: 'pensions',
    titleEs: 'Pensiones y Seguridad Social',
    titleEn: 'Pensions and Social Security',
    descriptionEs: 'Nómina mensual, déficit contributivo y ratio cotizantes/pensionista.',
    descriptionEn: 'Monthly payroll, contributory deficit and contributors-per-pensioner ratio.',
  },
  {
    id: 'ingresos-gastos',
    slugEs: 'ingresos-gastos',
    slugEn: 'revenue-spending',
    titleEs: 'Ingresos y Gastos Públicos',
    titleEn: 'Public Revenue and Expenditure',
    descriptionEs: 'Evolución histórica de ingresos, gastos y balance fiscal en España.',
    descriptionEn: 'Historical evolution of public revenue, expenditure and fiscal balance in Spain.',
  },
  {
    id: 'gasto-cofog',
    slugEs: 'gasto-cofog',
    slugEn: 'cofog-spending',
    titleEs: 'Gasto Público COFOG',
    titleEn: 'COFOG Public Spending',
    descriptionEs: 'Desglose funcional del gasto público por categorías COFOG.',
    descriptionEn: 'Functional public spending breakdown by COFOG categories.',
  },
  {
    id: 'recaudacion',
    slugEs: 'recaudacion',
    slugEn: 'tax-revenue',
    titleEs: 'Recaudación Tributaria',
    titleEn: 'Tax Revenue',
    descriptionEs: 'Desglose de la recaudación tributaria por impuesto y comunidad autónoma.',
    descriptionEn: 'Tax revenue breakdown by tax type and autonomous community.',
  },
  {
    id: 'ue',
    slugEs: 'comparativa-ue',
    slugEn: 'eu-comparison',
    titleEs: 'Comparativa Europea',
    titleEn: 'European Comparison',
    descriptionEs: 'Comparación de España frente a UE-27 y países de referencia.',
    descriptionEn: 'Comparison of Spain vs EU-27 and benchmark countries.',
  },
  {
    id: 'ccaa',
    slugEs: 'ccaa',
    slugEn: 'regions',
    titleEs: 'Deuda por Comunidad Autónoma',
    titleEn: 'Debt by Region',
    descriptionEs: 'Ranking y detalle de deuda de las Comunidades Autónomas.',
    descriptionEn: 'Ranking and details of debt across autonomous regions.',
  },
  {
    id: 'metodologia',
    slugEs: 'metodologia',
    slugEn: 'methodology',
    titleEs: 'Metodología y Fuentes',
    titleEn: 'Methodology and Sources',
    descriptionEs: 'Cómo se descargan, validan y transforman los datos del dashboard.',
    descriptionEn: 'How dashboard data is downloaded, validated and transformed.',
  },
]

function toIsoDateString(value) {
  if (value == null) return null

  if (typeof value === 'number' && Number.isFinite(value)) {
    return `${Math.trunc(value)}-12-31`
  }

  const valueStr = String(value).trim()
  if (!valueStr) return null

  const yearMatch = valueStr.match(/^(\d{4})$/)
  if (yearMatch) return `${yearMatch[1]}-12-31`

  const quarterMatch = valueStr.match(/^(\d{4})-Q([1-4])$/i)
  if (quarterMatch) {
    const [_, year, quarter] = quarterMatch
    const quarterEndMonth = { '1': '03', '2': '06', '3': '09', '4': '12' }[quarter]
    const quarterEndDay = quarter === '1' ? '31' : quarter === '2' ? '30' : quarter === '3' ? '30' : '31'
    return `${year}-${quarterEndMonth}-${quarterEndDay}`
  }

  const parsed = new Date(valueStr)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 10)
}

function pickLatestDate(values) {
  const normalized = values
    .map(toIsoDateString)
    .filter(Boolean)
    .map(v => ({ raw: v, ts: new Date(v).getTime() }))
    .filter(v => !Number.isNaN(v.ts))

  if (normalized.length === 0) return null
  normalized.sort((a, b) => b.ts - a.ts)
  return normalized[0].raw
}

function getAttributionDates(sourceAttribution) {
  if (!sourceAttribution || typeof sourceAttribution !== 'object') return []
  return Object.values(sourceAttribution)
    .map(attr => attr?.date)
    .filter(Boolean)
}

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
  mkdirSync('public/api/v1', { recursive: true })

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
    downloadRevenueData(),
    downloadTaxRevenueData(),
    downloadCcaaFiscalBalanceData()
  ])

  const [
    debtResult,
    demographicsResult,
    pensionsResult,
    budgetResult,
    eurostatResult,
    ccaaDebtResult,
    revenueResult,
    taxRevenueResult,
    ccaaFiscalBalanceResult
  ] = results

  // Track success/failure
  const status = {
    debt: debtResult.status === 'fulfilled',
    demographics: demographicsResult.status === 'fulfilled',
    pensions: pensionsResult.status === 'fulfilled',
    budget: budgetResult.status === 'fulfilled',
    eurostat: eurostatResult.status === 'fulfilled',
    ccaaDebt: ccaaDebtResult.status === 'fulfilled',
    revenue: revenueResult.status === 'fulfilled',
    taxRevenue: taxRevenueResult.status === 'fulfilled',
    ccaaFiscalBalance: ccaaFiscalBalanceResult.status === 'fulfilled'
  }

  // Write individual data files
  console.log('\n=== Escribiendo archivos JSON ===')

  if (status.debt) {
    writeMirroredDataFile('debt.json', debtResult.value)
    console.log('✅ debt.json')
  } else {
    console.error('❌ debt.json - Error:', debtResult.reason?.message)
  }

  if (status.demographics) {
    writeMirroredDataFile('demographics.json', demographicsResult.value)
    console.log('✅ demographics.json')
  } else {
    console.error('❌ demographics.json - Error:', demographicsResult.reason?.message)
  }

  if (status.pensions) {
    writeMirroredDataFile('pensions.json', pensionsResult.value)
    console.log('✅ pensions.json')
  } else {
    console.error('❌ pensions.json - Error:', pensionsResult.reason?.message)
  }

  if (status.budget) {
    writeMirroredDataFile('budget.json', budgetResult.value)
    console.log('✅ budget.json')
  } else {
    console.error('❌ budget.json - Error:', budgetResult.reason?.message)
  }

  if (status.eurostat) {
    writeMirroredDataFile('eurostat.json', eurostatResult.value)
    console.log('✅ eurostat.json')
  } else {
    console.error('❌ eurostat.json - Error:', eurostatResult.reason?.message)
  }

  if (status.ccaaDebt) {
    writeMirroredDataFile('ccaa-debt.json', ccaaDebtResult.value)
    console.log('✅ ccaa-debt.json')
  } else {
    console.error('❌ ccaa-debt.json - Error:', ccaaDebtResult.reason?.message)
  }

  if (status.revenue) {
    writeMirroredDataFile('revenue.json', revenueResult.value)
    console.log('✅ revenue.json')
  } else {
    console.error('❌ revenue.json - Error:', revenueResult.reason?.message)
  }

  if (status.taxRevenue) {
    writeMirroredDataFile('tax-revenue.json', taxRevenueResult.value)
    console.log('✅ tax-revenue.json')
  } else {
    console.error('❌ tax-revenue.json - Error:', taxRevenueResult.reason?.message)
  }

  if (status.ccaaFiscalBalance) {
    writeMirroredDataFile('ccaa-fiscal-balance.json', ccaaFiscalBalanceResult.value)
    console.log('✅ ccaa-fiscal-balance.json')
  } else {
    console.error('❌ ccaa-fiscal-balance.json - Error:', ccaaFiscalBalanceResult.reason?.message)
  }

  // Write metadata file
  const nowIso = new Date().toISOString()
  const meta = {
    lastDownload: nowIso,
    duration: Date.now() - startTime,
    status,
    sources: {
      debt: {
        success: status.debt,
        lastUpdated: status.debt ? debtResult.value.lastUpdated : null,
        lastFetchAt: status.debt ? nowIso : null,
        lastRealDataDate: status.debt
          ? pickLatestDate([
            debtResult.value.historical?.[debtResult.value.historical.length - 1]?.date,
            ...getAttributionDates(debtResult.value.sourceAttribution)
          ])
          : null,
        dataPoints: status.debt ? debtResult.value.historical.length : 0
      },
      demographics: {
        success: status.demographics,
        lastUpdated: status.demographics ? demographicsResult.value.lastUpdated : null,
        lastFetchAt: status.demographics ? nowIso : null,
        lastRealDataDate: status.demographics
          ? pickLatestDate([
            ...getAttributionDates(demographicsResult.value.sourceAttribution)
          ])
          : null
      },
      pensions: {
        success: status.pensions,
        lastUpdated: status.pensions ? pensionsResult.value.lastUpdated : null,
        lastFetchAt: status.pensions ? nowIso : null,
        criticalFallback: status.pensions
          ? Boolean(pensionsResult.value.pipeline?.criticalFallback)
          : false,
        criticalFallbackReason: status.pensions
          ? pensionsResult.value.pipeline?.fallbackReason || null
          : null,
        lastRealDataDate: status.pensions
          ? pickLatestDate([
            pensionsResult.value.historical?.[pensionsResult.value.historical.length - 1]?.date,
            ...getAttributionDates(pensionsResult.value.sourceAttribution)
          ])
          : null,
        dataPoints: status.pensions ? pensionsResult.value.historical.length : 0
      },
      budget: {
        success: status.budget,
        lastUpdated: status.budget ? budgetResult.value.lastUpdated : null,
        lastFetchAt: status.budget ? nowIso : null,
        lastRealDataDate: status.budget
          ? pickLatestDate([
            budgetResult.value.latestYear,
            ...getAttributionDates(budgetResult.value.sourceAttribution)
          ])
          : null,
        years: status.budget ? budgetResult.value.years.length : 0
      },
      eurostat: {
        success: status.eurostat,
        lastUpdated: status.eurostat ? eurostatResult.value.lastUpdated : null,
        lastFetchAt: status.eurostat ? nowIso : null,
        lastRealDataDate: status.eurostat
          ? pickLatestDate([
            eurostatResult.value.year,
            ...getAttributionDates(eurostatResult.value.sourceAttribution)
          ])
          : null,
        year: status.eurostat ? eurostatResult.value.year : null
      },
      ccaaDebt: {
        success: status.ccaaDebt,
        lastUpdated: status.ccaaDebt ? ccaaDebtResult.value.lastUpdated : null,
        lastFetchAt: status.ccaaDebt ? nowIso : null,
        lastRealDataDate: status.ccaaDebt
          ? pickLatestDate([
            ccaaDebtResult.value.quarter,
            ...getAttributionDates(ccaaDebtResult.value.sourceAttribution)
          ])
          : null,
        quarter: status.ccaaDebt ? ccaaDebtResult.value.quarter : null
      },
      revenue: {
        success: status.revenue,
        lastUpdated: status.revenue ? revenueResult.value.lastUpdated : null,
        lastFetchAt: status.revenue ? nowIso : null,
        lastRealDataDate: status.revenue
          ? pickLatestDate([
            revenueResult.value.latestYear,
            ...getAttributionDates(revenueResult.value.sourceAttribution)
          ])
          : null,
        latestYear: status.revenue ? revenueResult.value.latestYear : null
      },
      taxRevenue: {
        success: status.taxRevenue,
        lastUpdated: status.taxRevenue ? taxRevenueResult.value.lastUpdated : null,
        lastFetchAt: status.taxRevenue ? nowIso : null,
        lastRealDataDate: status.taxRevenue
          ? pickLatestDate([
            taxRevenueResult.value.latestYear,
            ...getAttributionDates(taxRevenueResult.value.sourceAttribution)
          ])
          : null,
        latestYear: status.taxRevenue ? taxRevenueResult.value.latestYear : null,
        years: status.taxRevenue ? taxRevenueResult.value.years.length : 0
      },
      ccaaFiscalBalance: {
        success: status.ccaaFiscalBalance,
        lastUpdated: status.ccaaFiscalBalance ? ccaaFiscalBalanceResult.value.lastUpdated : null,
        lastFetchAt: status.ccaaFiscalBalance ? nowIso : null,
        lastRealDataDate: status.ccaaFiscalBalance
          ? pickLatestDate([
            ccaaFiscalBalanceResult.value.latestYear,
            ...getAttributionDates(ccaaFiscalBalanceResult.value.sourceAttribution)
          ])
          : null,
        latestYear: status.ccaaFiscalBalance ? ccaaFiscalBalanceResult.value.latestYear : null,
        years: status.ccaaFiscalBalance ? ccaaFiscalBalanceResult.value.years.length : 0
      }
    }
  }

  writeMirroredDataFile('meta.json', meta)
  writeDataFile('public/api/v1/index.json', buildPublicApiIndex(meta))
  console.log('✅ meta.json')
  console.log('✅ public/api/v1/index.json')

  const resolvedDebt = status.debt ? debtResult.value : existingData.debt
  const resolvedPensions = status.pensions ? pensionsResult.value : existingData.pensions
  const resolvedBudget = status.budget ? budgetResult.value : existingData.budget
  const resolvedRevenue = status.revenue ? revenueResult.value : null
  const resolvedTaxRevenue = status.taxRevenue ? taxRevenueResult.value : null

  // Write SEO static artifacts
  writeTextFile(
    'public/seo-snapshot.html',
    buildSeoSnapshotHtml({
      meta,
      debt: resolvedDebt,
      pensions: resolvedPensions,
      budget: resolvedBudget,
      revenue: resolvedRevenue
    })
  )
  const sectionPages = buildSectionSnapshotPages({
    meta,
    debt: resolvedDebt,
    pensions: resolvedPensions,
    budget: resolvedBudget,
    revenue: resolvedRevenue
  })

  for (const [path, html] of Object.entries(sectionPages)) {
    writeTextFile(path, html)
  }

  writeTextFile('public/sitemap.xml', buildSitemapXml(meta.lastDownload))
  writeTextFile('public/feed.xml', buildRssFeed(meta))
  console.log('✅ public/seo-snapshot.html')
  console.log('✅ public/sitemap.xml')
  console.log(`✅ ${Object.keys(sectionPages).length} páginas SSG de sección`)
  console.log('✅ public/feed.xml')

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

  if (status.taxRevenue && taxRevenueResult.value) {
    const taxRevAttr = taxRevenueResult.value.sourceAttribution?.series
    const yearCount = taxRevenueResult.value.years?.length || 0
    const isLive = taxRevAttr?.type === 'csv'
    console.log(`Tax Revenue: ${isLive ? '✅' : '⚠️'} ${taxRevAttr?.type?.toUpperCase() || 'N/A'} (${yearCount} años, último ${taxRevenueResult.value.latestYear})`)
  } else {
    console.log('Tax Revenue: ❌ Error')
  }

  if (status.ccaaFiscalBalance && ccaaFiscalBalanceResult.value) {
    const balanceAttr = ccaaFiscalBalanceResult.value.sourceAttribution?.balances
    const yearCount = ccaaFiscalBalanceResult.value.years?.length || 0
    const latestYear = ccaaFiscalBalanceResult.value.latestYear
    const latestEntries = ccaaFiscalBalanceResult.value.byYear?.[String(latestYear)]?.entries?.length || 0
    const isLive = balanceAttr?.type === 'xlsx'
    console.log(`Balanzas CCAA: ${isLive ? '✅' : '⚠️'} ${balanceAttr?.type?.toUpperCase() || 'N/A'} (${yearCount} años, ${latestEntries} CCAA en ${latestYear})`)
  } else {
    console.log('Balanzas CCAA: ❌ Error')
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

function writeMirroredDataFile(fileName, data) {
  writeDataFile(`src/data/${fileName}`, data)
  writeDataFile(`public/api/v1/${fileName}`, data)
}

function writeTextFile(path, text) {
  try {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, text, 'utf-8')
  } catch (error) {
    console.error(`Error escribiendo ${path}:`, error.message)
    throw error
  }
}

function buildPublicApiIndex(meta) {
  return {
    apiVersion: 'v1',
    generatedAt: meta.lastDownload,
    basePath: '/api/v1',
    endpoints: [
      { path: '/api/v1/debt.json', source: 'Banco de España', description: 'Deuda pública PDE y series históricas' },
      { path: '/api/v1/pensions.json', source: 'Seguridad Social', description: 'Nómina, pensiones y métricas derivadas' },
      { path: '/api/v1/demographics.json', source: 'INE', description: 'Población, EPA, PIB, salario e IPC' },
      { path: '/api/v1/budget.json', source: 'IGAE', description: 'Gasto COFOG por año y categoría' },
      { path: '/api/v1/revenue.json', source: 'Eurostat', description: 'Ingresos y gastos públicos de España' },
      { path: '/api/v1/eurostat.json', source: 'Eurostat', description: 'Comparativa UE por indicadores fiscales' },
      { path: '/api/v1/ccaa-debt.json', source: 'Banco de España', description: 'Deuda de CCAA por comunidad' },
      { path: '/api/v1/tax-revenue.json', source: 'AEAT', description: 'Recaudación tributaria por impuesto y CCAA' },
      { path: '/api/v1/ccaa-fiscal-balance.json', source: 'Ministerio de Hacienda', description: 'Impuestos cedidos vs transferencias por CCAA (régimen común)' },
      { path: '/api/v1/meta.json', source: 'Pipeline', description: 'Estado de actualización y frescura de fuentes' }
    ],
    freshness: meta.sources
  }
}

function buildSeoSnapshotHtml({ meta, debt, pensions, budget, revenue }) {
  const debtTotal = debt?.current?.totalDebt
  const debtDate = debt?.historical?.[debt.historical.length - 1]?.date || 'N/D'
  const pensionsMonthly = pensions?.current?.monthlyPayroll
  const pensionsDate = pensions?.sourceAttribution?.monthlyPayroll?.date || 'N/D'
  const latestBudgetYear = budget?.latestYear || 'N/D'
  const budgetTotal = latestBudgetYear !== 'N/D'
    ? budget?.byYear?.[String(latestBudgetYear)]?.total
    : null
  const latestRevenueYear = revenue?.latestYear || 'N/D'

  const fmt = new Intl.NumberFormat('es-ES')
  const fmtCompact = new Intl.NumberFormat('es-ES', { notation: 'compact', maximumFractionDigits: 1 })

  const debtLabel = Number.isFinite(debtTotal) ? `${fmtCompact.format(debtTotal)} €` : 'N/D'
  const pensionsLabel = Number.isFinite(pensionsMonthly) ? `${fmtCompact.format(pensionsMonthly)} €/mes` : 'N/D'
  const budgetLabel = Number.isFinite(budgetTotal) ? `${fmt.format(Math.round(budgetTotal))} M€` : 'N/D'

  const lastUpdated = new Date(meta.lastDownload).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })

  return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Snapshot SEO | Cuentas Públicas</title>
    <meta name="description" content="Resumen estático pre-renderizado de Cuentas Públicas de España para SEO." />
    <link rel="canonical" href="${SITE_URL}/seo-snapshot.html" />
    <style>
      body { font-family: Manrope, system-ui, sans-serif; max-width: 900px; margin: 2rem auto; padding: 0 1rem; color: #0f172a; }
      h1 { margin-bottom: .5rem; }
      .muted { color: #475569; }
      .grid { display: grid; gap: .75rem; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); margin-top: 1rem; }
      .card { border: 1px solid #cbd5e1; border-radius: .75rem; padding: .85rem 1rem; background: #f8fafc; }
      .label { font-size: .82rem; color: #334155; margin-bottom: .35rem; }
      .value { font-weight: 700; font-size: 1.05rem; }
      ul { margin-top: .5rem; }
    </style>
  </head>
  <body>
    <main>
      <h1>Cuentas Públicas de España en Tiempo Real</h1>
      <p class="muted">Snapshot pre-renderizado para motores de búsqueda. Actualizado: ${lastUpdated}.</p>

      <section class="grid" aria-label="Métricas principales">
        <article class="card">
          <div class="label">Deuda pública total</div>
          <div class="value">${debtLabel}</div>
          <div class="muted">Último dato oficial: ${debtDate}</div>
        </article>
        <article class="card">
          <div class="label">Nómina mensual de pensiones</div>
          <div class="value">${pensionsLabel}</div>
          <div class="muted">Referencia de dato: ${pensionsDate}</div>
        </article>
        <article class="card">
          <div class="label">Gasto COFOG (último año)</div>
          <div class="value">${budgetLabel}</div>
          <div class="muted">Año: ${latestBudgetYear}</div>
        </article>
        <article class="card">
          <div class="label">Ingresos/Gastos públicos (último año)</div>
          <div class="value">${latestRevenueYear}</div>
          <div class="muted">Serie anual Eurostat</div>
        </article>
      </section>

      <section>
        <h2>Fuentes oficiales</h2>
        <ul>
          <li>Banco de España (deuda PDE)</li>
          <li>INE (población, PIB, IPC, EPA)</li>
          <li>Seguridad Social (pensiones contributivas)</li>
          <li>IGAE (COFOG)</li>
          <li>Eurostat (comparativa UE e ingresos/gastos)</li>
        </ul>
      </section>

      <p class="muted">Versión interactiva: <a href="${SITE_URL}/">${SITE_URL}/</a></p>
    </main>
  </body>
</html>`
}

function formatSnapshotMetrics({ debt, pensions, budget, revenue, locale }) {
  const debtTotal = debt?.current?.totalDebt
  const debtDate = debt?.historical?.[debt.historical.length - 1]?.date || (locale === 'en-US' ? 'N/A' : 'N/D')
  const pensionsMonthly = pensions?.current?.monthlyPayroll
  const pensionsDate = pensions?.sourceAttribution?.monthlyPayroll?.date || (locale === 'en-US' ? 'N/A' : 'N/D')
  const latestBudgetYear = budget?.latestYear || (locale === 'en-US' ? 'N/A' : 'N/D')
  const budgetTotal = typeof latestBudgetYear === 'number'
    ? budget?.byYear?.[String(latestBudgetYear)]?.total
    : null
  const latestRevenueYear = revenue?.latestYear || (locale === 'en-US' ? 'N/A' : 'N/D')

  const fmt = new Intl.NumberFormat(locale)
  const fmtCompact = new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 })

  const debtLabel = Number.isFinite(debtTotal) ? `${fmtCompact.format(debtTotal)} €` : (locale === 'en-US' ? 'N/A' : 'N/D')
  const pensionsLabel = Number.isFinite(pensionsMonthly)
    ? `${fmtCompact.format(pensionsMonthly)} ${locale === 'en-US' ? '€/month' : '€/mes'}`
    : (locale === 'en-US' ? 'N/A' : 'N/D')
  const budgetLabel = Number.isFinite(budgetTotal)
    ? `${fmt.format(Math.round(budgetTotal))} ${locale === 'en-US' ? 'M€' : 'M€'}`
    : (locale === 'en-US' ? 'N/A' : 'N/D')

  return {
    debtLabel,
    debtDate,
    pensionsLabel,
    pensionsDate,
    budgetLabel,
    latestBudgetYear,
    latestRevenueYear
  }
}

function buildSectionPath(section, lang) {
  return lang === 'en'
    ? `/en/sections/${section.slugEn}.html`
    : `/secciones/${section.slugEs}.html`
}

function buildSectionSnapshotPages({ meta, debt, pensions, budget, revenue }) {
  const pages = {}

  for (const section of SECTION_PAGE_DEFS) {
    for (const lang of ['es', 'en']) {
      const routePath = buildSectionPath(section, lang)
      pages[`public${routePath}`] = buildSectionSnapshotHtml({
        section,
        lang,
        meta,
        debt,
        pensions,
        budget,
        revenue
      })
    }
  }

  return pages
}

function buildSectionSnapshotHtml({ section, lang, meta, debt, pensions, budget, revenue }) {
  const isEnglish = lang === 'en'
  const locale = isEnglish ? 'en-US' : 'es-ES'
  const title = isEnglish ? section.titleEn : section.titleEs
  const description = isEnglish ? section.descriptionEn : section.descriptionEs
  const routePath = buildSectionPath(section, lang)
  const interactiveUrl = `${SITE_URL}/?section=${section.id}${isEnglish ? '&lang=en' : ''}`
  const lastUpdated = new Date(meta.lastDownload).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })

  const metrics = formatSnapshotMetrics({ debt, pensions, budget, revenue, locale })

  const labels = isEnglish
    ? {
      heading: 'Static route for SEO indexing',
      debt: 'Public debt',
      debtDate: 'Latest official date',
      pensions: 'Monthly pensions payroll',
      pensionsDate: 'Data reference',
      budget: 'COFOG spending',
      budgetYear: 'Year',
      revenue: 'Revenue/expenditure latest year',
      revenueSeries: 'Eurostat annual series',
      cta: 'Open interactive dashboard section',
      home: 'Back to dashboard home',
      language: 'Language',
      methodology: 'This page is generated automatically from the same datasets used by the SPA.',
    }
    : {
      heading: 'Ruta estática para indexación SEO',
      debt: 'Deuda pública',
      debtDate: 'Última fecha oficial',
      pensions: 'Nómina mensual de pensiones',
      pensionsDate: 'Referencia de dato',
      budget: 'Gasto COFOG',
      budgetYear: 'Año',
      revenue: 'Ingresos/gastos último año',
      revenueSeries: 'Serie anual Eurostat',
      cta: 'Abrir sección interactiva del dashboard',
      home: 'Volver al inicio del dashboard',
      language: 'Idioma',
      methodology: 'Esta página se genera automáticamente con los mismos datasets de la SPA.',
    }

  return `<!DOCTYPE html>
<html lang="${lang}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title} | ${isEnglish ? 'Spain Public Accounts' : 'Cuentas Públicas de España'}</title>
    <meta name="description" content="${description}" />
    <link rel="canonical" href="${SITE_URL}${routePath}" />
    <link rel="alternate" hreflang="es" href="${SITE_URL}${buildSectionPath(section, 'es')}" />
    <link rel="alternate" hreflang="en" href="${SITE_URL}${buildSectionPath(section, 'en')}" />
    <style>
      body { font-family: Manrope, system-ui, sans-serif; max-width: 900px; margin: 2rem auto; padding: 0 1rem; color: #0f172a; }
      h1 { margin-bottom: .4rem; }
      .muted { color: #475569; }
      .grid { display: grid; gap: .75rem; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); margin-top: 1rem; }
      .card { border: 1px solid #cbd5e1; border-radius: .75rem; padding: .85rem 1rem; background: #f8fafc; }
      .label { font-size: .82rem; color: #334155; margin-bottom: .35rem; }
      .value { font-weight: 700; font-size: 1.05rem; }
      .cta { display: inline-block; margin-top: 1rem; border: 1px solid #1d4ed8; color: #1d4ed8; text-decoration: none; border-radius: .6rem; padding: .5rem .75rem; }
      .cta:hover { background: #eff6ff; }
      .links { margin-top: .8rem; display: flex; gap: .8rem; flex-wrap: wrap; }
    </style>
  </head>
  <body>
    <main>
      <h1>${title}</h1>
      <p class="muted">${labels.heading} · ${description}</p>
      <p class="muted">${labels.methodology} ${isEnglish ? 'Updated' : 'Actualizado'}: ${lastUpdated}.</p>

      <section class="grid" aria-label="${isEnglish ? 'Main metrics' : 'Métricas principales'}">
        <article class="card">
          <div class="label">${labels.debt}</div>
          <div class="value">${metrics.debtLabel}</div>
          <div class="muted">${labels.debtDate}: ${metrics.debtDate}</div>
        </article>
        <article class="card">
          <div class="label">${labels.pensions}</div>
          <div class="value">${metrics.pensionsLabel}</div>
          <div class="muted">${labels.pensionsDate}: ${metrics.pensionsDate}</div>
        </article>
        <article class="card">
          <div class="label">${labels.budget}</div>
          <div class="value">${metrics.budgetLabel}</div>
          <div class="muted">${labels.budgetYear}: ${metrics.latestBudgetYear}</div>
        </article>
        <article class="card">
          <div class="label">${labels.revenue}</div>
          <div class="value">${metrics.latestRevenueYear}</div>
          <div class="muted">${labels.revenueSeries}</div>
        </article>
      </section>

      <a class="cta" href="${interactiveUrl}">${labels.cta}</a>
      <div class="links">
        <a href="${SITE_URL}/">${labels.home}</a>
        <a href="${SITE_URL}${routePath}">${labels.language}: ${lang.toUpperCase()}</a>
      </div>
    </main>
  </body>
</html>`
}

function buildSitemapXml(lastDownload) {
  const isoDate = new Date(lastDownload).toISOString()
  const routes = [
    { path: '/', priority: '1.0', changefreq: 'daily' },
    { path: '/seo-snapshot.html', priority: '0.8', changefreq: 'weekly' },
    { path: '/api/v1/index.json', priority: '0.6', changefreq: 'weekly' },
    { path: '/feed.xml', priority: '0.6', changefreq: 'daily' },
  ]

  for (const section of SECTION_PAGE_DEFS) {
    routes.push({ path: buildSectionPath(section, 'es'), priority: '0.55', changefreq: 'weekly' })
    routes.push({ path: buildSectionPath(section, 'en'), priority: '0.55', changefreq: 'weekly' })
  }

  const urls = routes.map((route) => `  <url>
    <loc>${SITE_URL}${route.path}</loc>
    <lastmod>${isoDate}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function buildRssFeed(meta) {
  const updatedAt = new Date(meta.lastDownload)
  const buildDate = updatedAt.toUTCString()
  const sourceEntries = Object.entries(meta.sources || {})

  const overviewItem = {
    title: 'Actualización automática de datasets fiscales',
    link: `${SITE_URL}/seo-snapshot.html`,
    guid: `update-${updatedAt.toISOString()}`,
    pubDate: buildDate,
    description: `Generación completada en ${updatedAt.toISOString()} con ${sourceEntries.length} fuentes monitorizadas.`
  }

  const sourceItems = sourceEntries.map(([name, info]) => {
    const freshnessDate = info.lastRealDataDate || info.lastUpdated || meta.lastDownload
    const statusLabel = info.success ? 'OK' : 'ERROR'
    const fallbackNote = name === 'pensions' && info.criticalFallback
      ? ` FALLBACK CRÍTICO: ${info.criticalFallbackReason || 'sin motivo reportado'}.`
      : ''

    return {
      title: `[${statusLabel}] ${name}`,
      link: `${SITE_URL}/api/v1/meta.json`,
      guid: `${name}-${freshnessDate}-${info.lastFetchAt || meta.lastDownload}`,
      pubDate: new Date(info.lastFetchAt || meta.lastDownload).toUTCString(),
      description: `Fuente ${name}. Fecha real de dato: ${freshnessDate}.${fallbackNote}`
    }
  })

  const allItems = [overviewItem, ...sourceItems]
    .map((item) => `  <item>
    <title>${escapeXml(item.title)}</title>
    <link>${escapeXml(item.link)}</link>
    <guid isPermaLink="false">${escapeXml(item.guid)}</guid>
    <pubDate>${escapeXml(item.pubDate)}</pubDate>
    <description>${escapeXml(item.description)}</description>
  </item>`)
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>Cuentas Públicas de España — Actualizaciones</title>
  <link>${SITE_URL}/</link>
  <description>Feed RSS con actualizaciones automáticas del pipeline de datos fiscales.</description>
  <language>es-es</language>
  <lastBuildDate>${buildDate}</lastBuildDate>
${allItems}
</channel>
</rss>`
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
    } else if (pensionType === 'csv') {
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
