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

      // Contributory spending MIO_EUR
      if (unit === 'MIO_EUR' && naItem === 'D62PAY') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(createTimeSeriesJsonStat({
            2020: 201000, 2021: 200000, 2022: 199000, 2023: 219000
          })),
        })
      }

      // Contributory spending %GDP
      if (unit === 'PC_GDP' && naItem === 'D62PAY') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(createGDPComparisonJsonStat(
            { 2020: 17.8, 2021: 16.2, 2022: 14.5, 2023: 14.6 },
            { 2020: 13.7, 2021: 12.6, 2022: 11.9, 2023: 11.9 }
          )),
        })
      }

      // Social contributions
      if (naItem === 'D61REC') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(createTimeSeriesJsonStat({
            2020: 152000, 2021: 161000, 2022: 170000, 2023: 186000
          })),
        })
      }

      return Promise.reject(new Error('URL no esperada'))
    })

    const result = await downloadSSSustainability()

    expect(result.sourceAttribution.ssSustainability.type).toBe('api')
    expect(result.latestYear).toBe(2023)
    expect(result.years).toEqual([2020, 2021, 2022, 2023])
    expect(result.byYear['2023'].socialContributions).toBe(186000)
    expect(result.byYear['2023'].pensionExpenditure).toBe(219000)
    expect(result.byYear['2023'].ssBalance).toBe(-33000)
    expect(result.byYear['2023'].pensionToGDP).toBe(14.6)
    expect(result.pensionToGDP.spain.byYear['2023']).toBe(14.6)
    expect(result.pensionToGDP.eu27.byYear['2023']).toBe(11.9)
  })

  it('excluye años incompletos para evitar ceros artificiales', async () => {
    fetchUtils.fetchWithRetry.mockImplementation((url) => {
      const parsed = new URL(url)
      const unit = parsed.searchParams.get('unit')
      const naItem = parsed.searchParams.get('na_item')

      if (unit === 'MIO_EUR' && naItem === 'D62PAY') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(createTimeSeriesJsonStat({
            2022: 199000, 2023: 219000
          })),
        })
      }

      if (unit === 'PC_GDP' && naItem === 'D62PAY') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(createGDPComparisonJsonStat(
            { 2022: 14.5, 2023: 14.6 },
            { 2022: 11.9, 2023: 11.9 }
          )),
        })
      }

      if (naItem === 'D61REC') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(createTimeSeriesJsonStat({
            2022: 170000, 2023: 186000, 2024: 200000
          })),
        })
      }

      return Promise.reject(new Error('URL no esperada'))
    })

    const result = await downloadSSSustainability()

    expect(result.years).toEqual([2022, 2023])
    expect(result.latestYear).toBe(2023)
    expect(result.byYear['2024']).toBeUndefined()
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
