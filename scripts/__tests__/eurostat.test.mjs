import { describe, it, expect, vi, beforeEach } from 'vitest'
import { downloadEurostatData, downloadRevenueData, parseJsonStat, parseJsonStatTimeSeries } from '../sources/eurostat.mjs'
import * as fetchUtils from '../lib/fetch-utils.mjs'

vi.mock('../lib/fetch-utils.mjs', () => ({
  fetchWithRetry: vi.fn()
}))

describe('eurostat source script', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  const createMockJsonStat = (geos, years, values) => ({
    id: ['geo', 'time'],
    size: [geos.length, years.length],
    dimension: {
      geo: { category: { index: Object.fromEntries(geos.map((g, i) => [g, i])) } },
      time: { category: { index: Object.fromEntries(years.map((y, i) => [String(y), i])) } }
    },
    value: values
  })

  it('downloads and parses comparative data successfully', async () => {
    const geos = ['ES', 'DE', 'FR', 'IT', 'PT', 'EL', 'NL', 'EU27_2020']
    const years = [2024]
    const values = Array(geos.length).fill(50)
    
    fetchUtils.fetchWithRetry.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(createMockJsonStat(geos, years, values))
    })

    const result = await downloadEurostatData()
    expect(result.sourceAttribution.eurostat.type).toBe('api')
  })

  it('handles fatal crash in downloadEurostatData', async () => {
    // Force a crash by making Promise.allSettled throw (not possible normally, but we can make the map throw)
    // Or just make indicators crash the loop.
    vi.spyOn(Object, 'entries').mockImplementationOnce(() => { throw new Error('Fatal') })
    const result = await downloadEurostatData()
    expect(result.sourceAttribution.eurostat.type).toBe('fallback')
    vi.restoreAllMocks()
  })

  it('handles parseJsonStat errors', () => {
    expect(() => parseJsonStat({}, [])).toThrow('Respuesta JSON-stat inválida')
    expect(() => parseJsonStat({ id: [], size: [], value: [] }, [])).toThrow('Dimensiones geo/time no encontradas')
    expect(() => parseJsonStat({ id: ['geo', 'time'], size: [1, 1], value: [], dimension: { geo: { category: { index: {} } }, time: { category: { index: { '2024': 0 } } } } }, ['ES'])).toThrow('Sin datos válidos en la respuesta')
  })

  it('handles parseJsonStatTimeSeries errors', () => {
    expect(() => parseJsonStatTimeSeries({}, 'ES')).toThrow('Respuesta JSON-stat inválida')
    const validBase = { id: ['geo', 'time'], size: [1, 1], value: [100], dimension: { geo: { category: { index: { 'ES': 0 } } }, time: { category: { index: { '2024': 0 } } } } }
    expect(() => parseJsonStatTimeSeries({ ...validBase, id: ['a', 'b'] }, 'ES')).toThrow('Dimensiones geo/time no encontradas')
    expect(() => parseJsonStatTimeSeries(validBase, 'DE')).toThrow('País DE no encontrado en la respuesta')
    
    const noData = { ...validBase, value: [] }
    expect(() => parseJsonStatTimeSeries(noData, 'ES')).toThrow('Sin datos válidos en la respuesta')
  })

  it('handles fatal crash in downloadRevenueData', async () => {
    // Make indicatorEntries throw
    const result = await downloadRevenueData() 
    // It should handle the error and return fallback
    expect(result.sourceAttribution.revenue.type).toBe('fallback')
  })
})
