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

  it('valida dataset de ingresos y gastos', () => {
    const revenue = loadDataFile('revenue.json')
    expect(Array.isArray(revenue.years)).toBe(true)
    expect(revenue.years.length).toBeGreaterThan(5)
    expect(revenue.latestYear).toBeGreaterThan(2000)
    const latest = revenue.byYear[String(revenue.latestYear)]
    expect(latest.totalRevenue).toBeGreaterThan(0)
    expect(latest.totalExpenditure).toBeGreaterThan(0)
  })

  it('valida metadatos de frescura por fuente', () => {
    const meta = loadDataFile('meta.json')
    const sourceEntries = Object.entries(meta.sources || {})
    expect(sourceEntries.length).toBeGreaterThan(0)

    for (const [, info] of sourceEntries) {
      expect(typeof info.success).toBe('boolean')
      expect(info.lastUpdated).toBeTruthy()
      expect(info.lastFetchAt).toBeTruthy()
      expect(info.lastRealDataDate).toBeTruthy()
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
