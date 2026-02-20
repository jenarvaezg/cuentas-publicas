import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  downloadEurostatData,
  downloadRevenueData,
  parseJsonStat,
  parseJsonStatTimeSeries,
} from '../sources/eurostat.mjs'
import * as fetchUtils from '../lib/fetch-utils.mjs'

vi.mock('../lib/fetch-utils.mjs', () => ({
  fetchWithRetry: vi.fn(),
}))

function createComparativeJsonStat(geos, years, valueFn) {
  const geoIndex = Object.fromEntries(geos.map((geo, i) => [geo, i]))
  const timeIndex = Object.fromEntries(years.map((year, i) => [String(year), i]))
  const values = []

  for (const geo of geos) {
    for (const year of years) {
      values.push(valueFn(geo, year))
    }
  }

  return {
    id: ['geo', 'time'],
    size: [geos.length, years.length],
    dimension: {
      geo: { category: { index: geoIndex } },
      time: { category: { index: timeIndex } },
    },
    value: values,
  }
}

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

describe('eurostat source script', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('mezcla indicadores API + fallback cuando algunos indicadores fallan', async () => {
    const geos = ['ES', 'DE', 'FR', 'IT', 'PT', 'EL', 'NL', 'EU27_2020']
    const years = [2023, 2024]

    fetchUtils.fetchWithRetry.mockImplementation((url) => {
      const parsed = new URL(url)
      const naItem = parsed.searchParams.get('na_item')
      const dataset = parsed.pathname.split('/').pop()

      if (dataset === 'gov_10dd_edpt1' && naItem === 'B9') {
        return Promise.reject(new Error('B9 temporalmente no disponible'))
      }

      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve(
            createComparativeJsonStat(geos, years, (geo, year) => {
              if (year === 2024 && geo === 'PT') return null
              return year === 2024 ? 50 : 45
            })
          ),
      })
    })

    const result = await downloadEurostatData()

    expect(result.year).toBe(2024)
    expect(result.sourceAttribution.eurostat.type).toBe('api')
    expect(result.indicators.debtToGDP.ES).toBe(50)
    expect(result.indicators.debtToGDP.PT).toBe(45)
    expect(result.indicators.deficit.ES).toBeTypeOf('number')
    expect(result.indicatorMeta.unemploymentRate.label).toBe('Tasa de paro')
  })

  it('parseJsonStat usa índices string y descarta años no numéricos', () => {
    const data = {
      id: ['geo', 'time'],
      size: [1, 3],
      dimension: {
        geo: { category: { index: { ES: 0 } } },
        time: { category: { index: { foo: 0, '2023': 1, '2024': 2 } } },
      },
      value: { 1: 101.37, 2: 104.58 },
    }

    const parsed = parseJsonStat(data, ['ES'])

    expect(parsed.year).toBe(2024)
    expect(parsed.values.ES).toBe(104.6)
  })

  it('parseJsonStatTimeSeries construye serie ordenada con índices string', () => {
    const data = {
      id: ['geo', 'time'],
      size: [1, 3],
      dimension: {
        geo: { category: { index: { ES: 0 } } },
        time: { category: { index: { foo: 0, '2024': 1, '2023': 2 } } },
      },
      value: { 1: 220_000, 2: 210_000 },
    }

    const parsed = parseJsonStatTimeSeries(data, 'ES')

    expect(parsed.years).toEqual([2023, 2024])
    expect(parsed.byYear['2023']).toBe(210000)
    expect(parsed.byYear['2024']).toBe(220000)
  })

  it('downloadRevenueData agrega años válidos y calcula otherRevenue con datos parciales', async () => {
    fetchUtils.fetchWithRetry.mockImplementation((url) => {
      const parsed = new URL(url)
      const naItem = parsed.searchParams.get('na_item')

      if (naItem === 'D5REC') {
        return Promise.reject(new Error('D5REC no publicado para el último corte'))
      }

      const byIndicator = {
        TR: { 2022: 300000, 2023: 330000 },
        TE: { 2023: 350000 },
        B9: { 2023: -20000 },
        D2REC: { 2023: 80000 },
        D61REC: { 2021: 90000, 2022: 100000, 2023: 110000 },
      }

      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(createTimeSeriesJsonStat(byIndicator[naItem] || {})),
      })
    })

    const result = await downloadRevenueData()

    expect(result.sourceAttribution.revenue.type).toBe('api')
    expect(result.latestYear).toBe(2023)
    expect(result.years).toEqual([2022, 2023])
    expect(result.byYear['2022'].totalRevenue).toBe(300000)
    expect(result.byYear['2022'].totalExpenditure).toBe(0)
    expect(result.byYear['2022'].otherRevenue).toBe(200000)
    expect(result.byYear['2023'].taxesDirect).toBe(0)
    expect(result.byYear['2023'].otherRevenue).toBe(140000)
    expect(result.byYear['2021']).toBeUndefined()
  })

  it('downloadRevenueData cae a fallback cuando no hay ningún año utilizable', async () => {
    fetchUtils.fetchWithRetry.mockRejectedValue(new Error('Eurostat no disponible'))

    const result = await downloadRevenueData()

    expect(result.sourceAttribution.revenue.type).toBe('fallback')
    expect(result.latestYear).toBe(2024)
    expect(result.years).toEqual([2024])
  })

  it('valida errores explícitos de parseo', () => {
    expect(() => parseJsonStat({}, [])).toThrow('Respuesta JSON-stat inválida')
    expect(() => parseJsonStat({ id: [], size: [], value: [] }, [])).toThrow(
      'Dimensiones geo/time no encontradas'
    )
    expect(() =>
      parseJsonStat(
        {
          id: ['geo', 'time'],
          size: [1, 1],
          value: [],
          dimension: {
            geo: { category: { index: {} } },
            time: { category: { index: { '2024': 0 } } },
          },
        },
        ['ES']
      )
    ).toThrow('Sin datos válidos en la respuesta')
  })
})
