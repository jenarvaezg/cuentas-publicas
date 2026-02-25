import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'

function loadDataFile(name) {
  const filePath = resolve(process.cwd(), 'src/data', name)
  return JSON.parse(readFileSync(filePath, 'utf-8'))
}

function loadApiFile(name) {
  const filePath = resolve(process.cwd(), 'public/api/v1', name)
  return JSON.parse(readFileSync(filePath, 'utf-8'))
}

function loadPublicJson(path) {
  const filePath = resolve(process.cwd(), 'public', path)
  return JSON.parse(readFileSync(filePath, 'utf-8'))
}

function loadPublicText(path) {
  const filePath = resolve(process.cwd(), 'public', path)
  return readFileSync(filePath, 'utf-8')
}

describe('data integrity', () => {
  it('valida invariantes de deuda', () => {
    const debt = loadDataFile('debt.json')
    expect(debt.current.totalDebt).toBeGreaterThan(0)
    expect(debt.current.debtToGDP).toBeGreaterThan(0)
    expect(debt.current.interestExpense).toBeGreaterThan(0)
    expect(Array.isArray(debt.historical)).toBe(true)
    expect(debt.historical.length).toBeGreaterThan(12)
  })

  it('valida invariantes de pensiones', () => {
    const pensions = loadDataFile('pensions.json')
    expect(pensions.current.monthlyPayroll).toBeGreaterThan(0)
    expect(pensions.current.totalPensions).toBeGreaterThan(0)
    expect(pensions.current.averagePensionRetirement).toBeGreaterThan(0)
    expect(pensions.current.contributorsPerPensioner).toBeGreaterThan(0)
  })

  it('valida consistencia COFOG', () => {
    const budget = loadDataFile('budget.json')
    expect(Number.isFinite(budget.latestYear)).toBe(true)
    const latest = budget.byYear[String(budget.latestYear)]
    expect(latest).toBeDefined()
    expect(Array.isArray(latest.categories)).toBe(true)
    expect(latest.categories.length).toBe(10)

    const categoriesSum = latest.categories.reduce((acc, cat) => acc + (cat.amount || 0), 0)
    const tolerance = Math.max(1, latest.total * 0.02)
    expect(Math.abs(categoriesSum - latest.total)).toBeLessThanOrEqual(tolerance)
  })

  it('valida dataset CCAA', () => {
    const ccaa = loadDataFile('ccaa-debt.json')
    expect(Array.isArray(ccaa.ccaa)).toBe(true)
    expect(ccaa.ccaa.length).toBe(17)
    expect(ccaa.total.debtToGDP).toBeGreaterThan(0)
    expect(ccaa.total.debtAbsolute).toBeGreaterThan(0)
    const withYoY = ccaa.ccaa.find((entry) => typeof entry.debtYoYChangeAbsolute === 'number')
    expect(withYoY).toBeTruthy()
    expect(typeof ccaa.total.debtYoYChangeAbsolute).toBe('number')
  })

  it('valida consistencia de códigos CCAA entre datasets territoriales', () => {
    const ccaaDebt = loadDataFile('ccaa-debt.json')
    const taxRevenue = loadDataFile('tax-revenue.json')
    const fiscalBalance = loadDataFile('ccaa-fiscal-balance.json')
    const ccaaSpending = loadDataFile('ccaa-spending.json')
    const ccaaForalFlows = loadDataFile('ccaa-foral-flows.json')

    const debtCodes = new Set(ccaaDebt.ccaa.map((entry) => entry.code))
    expect(debtCodes.size).toBe(17)

    const latestTaxCcaaYear = Math.max(
      ...Object.keys(taxRevenue.ccaa || {}).map((year) => Number(year)),
    )
    expect(Number.isFinite(latestTaxCcaaYear)).toBe(true)
    const taxEntries = taxRevenue.ccaa?.[String(latestTaxCcaaYear)]?.entries || []
    const taxCodes = new Set(taxEntries.map((entry) => entry.code))

    // AEAT delegaciones debe cubrir 17 CCAA (incluye forales, aunque con alcance limitado)
    expect(taxCodes.size).toBe(17)
    expect([...debtCodes].every((code) => taxCodes.has(code))).toBe(true)

    const latestBalanceYear = String(fiscalBalance.latestYear)
    const balanceEntries = fiscalBalance.byYear?.[latestBalanceYear]?.entries || []
    const balanceCodes = new Set(balanceEntries.map((entry) => entry.code))

    // Hacienda (régimen común) excluye forales: esperamos 15 códigos solapados
    expect(balanceCodes.size).toBe(15)
    const overlap = [...balanceCodes].filter((code) => debtCodes.has(code))
    expect(overlap.length).toBe(15)

    // Guardrail explícito: forales no deben aparecer en balance de régimen común
    expect(balanceCodes.has('CA15')).toBe(false)
    expect(balanceCodes.has('CA16')).toBe(false)

    const latestSpendingYear = String(ccaaSpending.latestYear)
    const spendingEntries = ccaaSpending.byYear?.[latestSpendingYear]?.entries || []
    const spendingCodes = new Set(spendingEntries.map((entry) => entry.code))
    expect(spendingCodes.size).toBe(17)
    expect([...debtCodes].every((code) => spendingCodes.has(code))).toBe(true)

    const latestForalYear = String(ccaaForalFlows.latestYear)
    const foralEntries = ccaaForalFlows.byYear?.[latestForalYear]?.entries || []
    const foralCodes = new Set(foralEntries.map((entry) => entry.code))
    expect(foralCodes.size).toBe(2)
    expect(foralCodes.has('CA15')).toBe(true)
    expect(foralCodes.has('CA16')).toBe(true)
  })

  it('valida dataset de ingresos y gastos', () => {
    const revenue = loadDataFile('revenue.json')
    expect(Array.isArray(revenue.years)).toBe(true)
    expect(revenue.years.length).toBeGreaterThan(5)
    expect(revenue.latestYear).toBeGreaterThan(2000)
    const latest = revenue.byYear[String(revenue.latestYear)]
    expect(latest.totalRevenue).toBeGreaterThan(0)
    expect(latest.totalExpenditure).toBeGreaterThan(0)
  })

  it('valida integridad de recaudación tributaria AEAT', () => {
    const taxRevenue = loadDataFile('tax-revenue.json')
    expect(Array.isArray(taxRevenue.years)).toBe(true)
    expect(taxRevenue.years.length).toBeGreaterThan(5)
    expect(Number.isFinite(taxRevenue.latestYear)).toBe(true)

    const latest = taxRevenue.national[String(taxRevenue.latestYear)]
    expect(latest).toBeDefined()
    expect(latest.total).toBeGreaterThan(0)
    expect(latest.irpf).toBeGreaterThanOrEqual(0)
    expect(latest.iva).toBeGreaterThanOrEqual(0)
    expect(latest.sociedades).toBeGreaterThanOrEqual(0)
    expect(latest.irnr).toBeGreaterThanOrEqual(0)
    expect(latest.iiee).toBeGreaterThanOrEqual(0)
    expect(latest.resto).toBeGreaterThanOrEqual(0)

    const components = latest.irpf + latest.iva + latest.sociedades + latest.irnr + latest.iiee + latest.resto
    const tolerance = Math.max(1, latest.total * 0.02)
    expect(Math.abs(components - latest.total)).toBeLessThanOrEqual(tolerance)

    const iieeBreakdown = Object.values(latest.iieeBreakdown || {}).reduce((acc, value) => acc + value, 0)
    expect(iieeBreakdown).toBeGreaterThanOrEqual(0)
    expect(iieeBreakdown).toBeLessThanOrEqual(Math.max(1, latest.iiee * 1.05))

    const latestCcaa = taxRevenue.ccaa?.[String(taxRevenue.latestYear)]
    if (latestCcaa) {
      expect(Array.isArray(latestCcaa.entries)).toBe(true)
      expect(latestCcaa.entries.length).toBeGreaterThanOrEqual(10)

      for (const entry of latestCcaa.entries) {
        expect(typeof entry.code).toBe('string')
        expect(typeof entry.name).toBe('string')
        expect(Number.isFinite(entry.total)).toBe(true)
        expect(Number.isFinite(entry.irpf)).toBe(true)
        expect(Number.isFinite(entry.iva)).toBe(true)
      }
    }
  })

  it('valida balanzas fiscales CCAA', () => {
    const balances = loadDataFile('ccaa-fiscal-balance.json')
    expect(Array.isArray(balances.years)).toBe(true)
    expect(balances.years.length).toBeGreaterThan(0)
    expect(Number.isFinite(balances.latestYear)).toBe(true)

    const latest = balances.byYear[String(balances.latestYear)]
    expect(latest).toBeDefined()
    expect(Array.isArray(latest.entries)).toBe(true)
    expect(latest.entries.length).toBeGreaterThanOrEqual(10)

    const madrid = latest.entries.find((entry) => entry.code === 'CA13')
    expect(madrid).toBeDefined()
    expect(Number.isFinite(madrid.netBalance)).toBe(true)
  })

  it('valida gasto funcional CCAA (IGAE detalle)', () => {
    const spending = loadDataFile('ccaa-spending.json')
    expect(Array.isArray(spending.years)).toBe(true)
    expect(spending.years.length).toBeGreaterThan(0)
    expect(Number.isFinite(spending.latestYear)).toBe(true)

    const latest = spending.byYear[String(spending.latestYear)]
    expect(latest).toBeDefined()
    expect(Array.isArray(latest.entries)).toBe(true)
    expect(latest.entries.length).toBe(17)

    const madrid = latest.entries.find((entry) => entry.code === 'CA13')
    expect(madrid).toBeDefined()
    expect(madrid.total).toBeGreaterThan(0)
    expect(Number.isFinite(madrid.divisions['07'])).toBe(true)
    expect(Number.isFinite(madrid.topDivisionPct)).toBe(true)
  })

  it('valida flujos Sankey multi-año (flows.json)', () => {
    const flows = loadDataFile('flows.json')
    expect(Number.isFinite(flows.latestYear)).toBe(true)
    expect(Array.isArray(flows.years)).toBe(true)
    expect(flows.years.length).toBeGreaterThanOrEqual(10)
    expect(flows.years[0]).toBeGreaterThanOrEqual(2012)
    expect(flows.years[flows.years.length - 1]).toBe(flows.latestYear)

    // years array matches byYear keys
    const byYearKeys = Object.keys(flows.byYear).map(Number).sort((a, b) => a - b)
    expect(byYearKeys).toEqual(flows.years)

    // Validate each year's graph
    for (const year of flows.years) {
      const yd = flows.byYear[String(year)]
      expect(yd).toBeDefined()
      expect(Array.isArray(yd.nodes)).toBe(true)
      expect(Array.isArray(yd.links)).toBe(true)
      expect(yd.nodes.length).toBeGreaterThan(5)
      expect(yd.links.length).toBeGreaterThan(5)

      // Mass balance: inputs to CONSOLIDADO == outputs from CONSOLIDADO
      const totalIn = yd.links
        .filter((l) => l.target === 'CONSOLIDADO')
        .reduce((sum, l) => sum + l.amount, 0)
      const totalOut = yd.links
        .filter((l) => l.source === 'CONSOLIDADO')
        .reduce((sum, l) => sum + l.amount, 0)
      expect(totalIn).toBe(totalOut)
    }
  })

  it('valida flujos forales CCAA (Navarra y País Vasco)', () => {
    const foral = loadDataFile('ccaa-foral-flows.json')
    expect(Array.isArray(foral.years)).toBe(true)
    expect(foral.years.length).toBeGreaterThan(0)
    expect(Number.isFinite(foral.latestYear)).toBe(true)

    const latest = foral.byYear[String(foral.latestYear)]
    expect(latest).toBeDefined()
    expect(Array.isArray(latest.entries)).toBe(true)
    expect(latest.entries.length).toBe(2)

    const navarra = latest.entries.find((entry) => entry.code === 'CA15')
    const paisVasco = latest.entries.find((entry) => entry.code === 'CA16')
    expect(navarra).toBeDefined()
    expect(paisVasco).toBeDefined()
    expect(Number.isFinite(navarra.paymentToState)).toBe(true)
    expect(Number.isFinite(paisVasco.paymentToState)).toBe(true)
  })

  it('valida metadatos de frescura por fuente', () => {
    const meta = loadDataFile('meta.json')
    const sourceEntries = Object.entries(meta.sources || {})
    expect(sourceEntries.length).toBeGreaterThan(0)

    for (const [key, info] of sourceEntries) {
      expect(typeof info.success).toBe('boolean')
      if (info.success) {
        expect(info.lastUpdated).toBeTruthy()
        expect(info.lastFetchAt).toBeTruthy()
        if (key !== 'demographics' && key !== 'flowsSankey') {
          expect(info.lastRealDataDate).toBeTruthy()
        }
      }
    }

    if (meta.sources.eurostat) {
      expect(meta.sources.eurostat.lastRealDataDate).toBe(
        `${meta.sources.eurostat.year}-12-31`,
      )
    }

    if (meta.sources.revenue) {
      expect(meta.sources.revenue.lastRealDataDate).toBe(
        `${meta.sources.revenue.latestYear}-12-31`,
      )
    }
  })

  it('valida publicación de API versionada en public/api/v1', () => {
    const files = [
      'debt.json',
      'demographics.json',
      'pensions.json',
      'budget.json',
      'eurostat.json',
      'ccaa-debt.json',
      'revenue.json',
      'tax-revenue.json',
      'ccaa-fiscal-balance.json',
      'ccaa-spending.json',
      'ccaa-foral-flows.json',
      'pensions-regional.json',
      'meta.json',
      'index.json'
    ]

    for (const file of files) {
      const apiPayload = loadApiFile(file)
      expect(apiPayload).toBeTruthy()
    }

    const apiIndex = loadApiFile('index.json')
    expect(apiIndex.apiVersion).toBe('v1')
    expect(Array.isArray(apiIndex.endpoints)).toBe(true)
    expect(apiIndex.endpoints.length).toBeGreaterThan(5)
    expect(apiIndex.endpoints.some((endpoint) => endpoint.path === '/api/v1/tax-revenue.json')).toBe(
      true,
    )
    expect(
      apiIndex.endpoints.some((endpoint) => endpoint.path === '/api/v1/ccaa-fiscal-balance.json'),
    ).toBe(true)
    expect(apiIndex.endpoints.some((endpoint) => endpoint.path === '/api/v1/ccaa-spending.json')).toBe(
      true,
    )
    expect(apiIndex.endpoints.some((endpoint) => endpoint.path === '/api/v1/ccaa-foral-flows.json')).toBe(
      true,
    )
    expect(apiIndex.endpoints.some((endpoint) => endpoint.path === '/api/v1/pensions-regional.json')).toBe(
      true,
    )
  })

  it('valida consistencia entre catálogo API y OpenAPI', () => {
    const apiIndex = loadApiFile('index.json')
    const openapi = loadPublicJson('api/openapi.json')

    const indexPaths = new Set(apiIndex.endpoints.map((endpoint) => endpoint.path))
    const openapiPaths = new Set(Object.keys(openapi.paths || {}))

    for (const path of indexPaths) {
      expect(openapiPaths.has(path)).toBe(true)
    }
  })

  it('valida feed RSS de actualizaciones', () => {
    const feed = loadPublicText('feed.xml')
    expect(feed).toContain('<rss version="2.0">')
    expect(feed).toContain('<title>Cuentas Públicas de España — Actualizaciones</title>')
    expect(feed).toContain('/api/v1/meta.json')
    expect(feed).toContain('<item>')
  })

  it('valida sitemap con rutas SSG multi-idioma y feed', () => {
    const sitemap = loadPublicText('sitemap.xml')
    expect(sitemap).toContain('https://cuentas-publicas.es/feed.xml')
    expect(sitemap).toContain('https://cuentas-publicas.es/secciones/deuda.html')
    expect(sitemap).toContain('https://cuentas-publicas.es/en/sections/debt.html')
    expect(sitemap).toContain('https://cuentas-publicas.es/secciones/metodologia.html')
    expect(sitemap).toContain('https://cuentas-publicas.es/en/sections/methodology.html')
  })

  it('valida páginas SSG de secciones con canonical y CTA interactiva', () => {
    const paths = [
      'secciones/deuda.html',
      'secciones/pensiones.html',
      'en/sections/debt.html',
      'en/sections/pensions.html'
    ]

    for (const path of paths) {
      const fullPath = resolve(process.cwd(), 'public', path)
      expect(existsSync(fullPath)).toBe(true)
      const html = readFileSync(fullPath, 'utf-8')
      expect(html).toContain('<link rel="canonical"')
      expect(html).toContain('?section=')
    }
  })
})
