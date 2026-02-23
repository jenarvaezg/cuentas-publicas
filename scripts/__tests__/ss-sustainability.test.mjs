import { beforeEach, describe, expect, it, vi } from 'vitest'
import { downloadSSSustainability } from '../sources/ss-sustainability.mjs'
import * as fetchUtils from '../lib/fetch-utils.mjs'

vi.mock('../lib/fetch-utils.mjs', () => ({
  fetchWithRetry: vi.fn(),
}))

function createTimeSeriesJsonStat(byYear) {
  const years = Object.keys(byYear).map(Number).sort((a, b) => a - b)
  const timeIndex = Object.fromEntries(years.map((year, i) => [String(year), i]))
  const values = years.map((year) => byYear[String(year)])

  return {
    id: ['geo', 'time'],
    size: [1, years.length],
    dimension: {
      geo: { category: { index: { ES: 0 } } },
      time: { category: { index: timeIndex } },
    },
    value: values,
  }
}

function createGDPComparisonJsonStat(spainByYear, eu27ByYear) {
  const years = [...new Set([...Object.keys(spainByYear), ...Object.keys(eu27ByYear)])]
    .map(Number)
    .sort((a, b) => a - b)
  const timeIndex = Object.fromEntries(years.map((year, i) => [String(year), i]))
  const values = []

  for (const year of years) {
    values.push(spainByYear[String(year)] ?? null)
  }
  for (const year of years) {
    values.push(eu27ByYear[String(year)] ?? null)
  }

  return {
    id: ['geo', 'time'],
    size: [2, years.length],
    dimension: {
      geo: { category: { index: { ES: 0, EU27_2020: 1 } } },
      time: { category: { index: timeIndex } },
    },
    value: values,
  }
}

describe('ss-sustainability source script', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('cae a fallback cuando Eurostat no disponible', async () => {
    fetchUtils.fetchWithRetry.mockRejectedValue(new Error('Eurostat no disponible'))

    const result = await downloadSSSustainability()

    expect(result.sourceAttribution.ssSustainability.type).toBe('fallback')
    expect(result.latestYear).toBe(2023)
    expect(result.years).toContain(2020)
    expect(result.years).toContain(2023)
  })

  it('fallback contiene todos los campos obligatorios', async () => {
    fetchUtils.fetchWithRetry.mockRejectedValue(new Error('fail'))

    const result = await downloadSSSustainability()

    expect(result.lastUpdated).toBeDefined()
    expect(result.byYear).toBeDefined()
    expect(result.pensionToGDP).toBeDefined()
    expect(result.pensionToGDP.spain).toBeDefined()
    expect(result.pensionToGDP.eu27).toBeDefined()
    expect(result.reserveFund).toBeDefined()
    expect(result.reserveFund.length).toBeGreaterThan(0)
    expect(result.contributorsPerPensioner).toBeDefined()
    expect(result.contributorsPerPensioner.length).toBeGreaterThan(0)
    expect(result.projections).toBeDefined()
    expect(result.projections.spain.length).toBeGreaterThan(0)
    expect(result.projections.eu27.length).toBeGreaterThan(0)
  })

  it('calcula ssBalance como diferencia cotizaciones - gasto', async () => {
    fetchUtils.fetchWithRetry.mockRejectedValue(new Error('fail'))

    const result = await downloadSSSustainability()

    for (const year of result.years) {
      const data = result.byYear[String(year)]
      expect(data.ssBalance).toBe(data.socialContributions - data.pensionExpenditure)
    }
  })

  it('descarga datos API y construye serie temporal', async () => {
    fetchUtils.fetchWithRetry.mockImplementation((url) => {
      const parsed = new URL(url)
      const unit = parsed.searchParams.get('unit')
      const naItem = parsed.searchParams.get('na_item')

      // Pension expenditure MIO_EUR
      if (unit === 'MIO_EUR' && naItem === 'TE') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(createTimeSeriesJsonStat({
            2020: 137000, 2021: 143000, 2022: 153000, 2023: 167000
          })),
        })
      }

      // Pension expenditure %GDP
      if (unit === 'PC_GDP') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(createGDPComparisonJsonStat(
            { 2020: 12.3, 2021: 11.8, 2022: 11.6, 2023: 12.4 },
            { 2020: 12.6, 2021: 11.9, 2022: 11.4, 2023: 11.5 }
          )),
        })
      }

      // Social contributions
      if (naItem === 'D61REC') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(createTimeSeriesJsonStat({
            2020: 163000, 2021: 175000, 2022: 190000, 2023: 204000
          })),
        })
      }

      return Promise.reject(new Error('URL no esperada'))
    })

    const result = await downloadSSSustainability()

    expect(result.sourceAttribution.ssSustainability.type).toBe('api')
    expect(result.latestYear).toBe(2023)
    expect(result.years).toEqual([2020, 2021, 2022, 2023])
    expect(result.byYear['2023'].socialContributions).toBe(204000)
    expect(result.byYear['2023'].pensionExpenditure).toBe(167000)
    expect(result.byYear['2023'].ssBalance).toBe(37000)
    expect(result.byYear['2023'].pensionToGDP).toBe(12.4)
    expect(result.pensionToGDP.spain.byYear['2023']).toBe(12.4)
    expect(result.pensionToGDP.eu27.byYear['2023']).toBe(11.5)
  })

  it('siempre incluye hardcoded reserveFund y contributorsPerPensioner', async () => {
    fetchUtils.fetchWithRetry.mockRejectedValue(new Error('fail'))

    const result = await downloadSSSustainability()

    expect(result.reserveFund.some(r => r.year === 2011 && r.balance === 66815)).toBeTruthy()
    expect(result.contributorsPerPensioner.some(c => c.year === 2007 && c.ratio === 2.53)).toBeTruthy()
  })

  it('incluye proyecciones del Ageing Report', async () => {
    fetchUtils.fetchWithRetry.mockRejectedValue(new Error('fail'))

    const result = await downloadSSSustainability()

    const spain2050 = result.projections.spain.find(p => p.year === 2050)
    expect(spain2050).toBeDefined()
    expect(spain2050.pensionToGDP).toBe(15.7)

    const eu2050 = result.projections.eu27.find(p => p.year === 2050)
    expect(eu2050).toBeDefined()
    expect(eu2050.pensionToGDP).toBe(12.4)
  })
})
