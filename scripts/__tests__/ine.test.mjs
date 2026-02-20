import { beforeEach, describe, expect, it, vi } from 'vitest'
import { downloadDemographics, formatINEDate } from '../sources/ine.mjs'
import * as fetchUtils from '../lib/fetch-utils.mjs'

vi.mock('../lib/fetch-utils.mjs', () => ({
  fetchWithRetry: vi.fn(),
}))

describe('ine source script', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('formatINEDate maneja valores nulos y timestamp en string', () => {
    expect(formatINEDate(0)).toBe('sin fecha')
    expect(formatINEDate('1735689600000')).toBe('2025-01-01')
  })

  it('descarga demografía completa cuando todas las series son válidas', async () => {
    fetchUtils.fetchWithRetry.mockImplementation((url) => {
      let data = []
      if (url.includes('ECP320')) data = [{ Valor: 49000000, Fecha: 1735689600000 }]
      if (url.includes('EPA387794')) data = [{ Valor: 24000, Fecha: 1735689600000 }] // miles
      if (url.includes('CNTR6597')) {
        data = Array(8)
          .fill(0)
          .map((_, i) => ({ Valor: 400000, Fecha: 1735689600000 - i * 100000000 }))
      }
      if (url.includes('EAES741')) data = [{ Valor: 28000, Fecha: 1735689600000 }]
      if (url.includes('IPC278296')) data = [{ Valor: 115, Fecha: 1735689600000 }]
      if (url.includes('IPC290750')) data = [{ Valor: 2.7, Fecha: 1735689600000 }]

      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ Data: data }),
      })
    })

    const result = await downloadDemographics()

    expect(result.population).toBe(49000000)
    expect(result.activePopulation).toBe(24000000)
    expect(result.averageSalary).toBe(28000)
    expect(result.sourceAttribution.population.type).toBe('api')
    expect(result.sourceAttribution.cpi.type).toBe('api')
  })

  it('aplica fallback parcial cuando población llega fuera de rango', async () => {
    fetchUtils.fetchWithRetry.mockImplementation((url) => {
      let data = []
      if (url.includes('ECP320')) data = [{ Valor: 65000000, Fecha: 1735689600000 }] // fuera de rango
      if (url.includes('EPA387794')) data = [{ Valor: 25000, Fecha: 1735689600000 }]
      if (url.includes('CNTR6597')) {
        data = Array(8)
          .fill(0)
          .map((_, i) => ({ Valor: 420000, Fecha: 1735689600000 - i * 100000000 }))
      }
      if (url.includes('EAES741')) data = [{ Valor: 30000, Fecha: 1735689600000 }]
      if (url.includes('IPC278296')) data = [{ Valor: 112, Fecha: 1735689600000 }]
      if (url.includes('IPC290750')) data = [{ Valor: 3.1, Fecha: 1735689600000 }]

      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ Data: data }),
      })
    })

    const result = await downloadDemographics()

    expect(result.sourceAttribution.population.type).toBe('fallback')
    expect(result.population).toBe(49570725)
    expect(result.sourceAttribution.activePopulation.type).toBe('api')
    expect(result.sourceAttribution.gdp.type).toBe('api')
  })

  it('usa último año disponible como base IPC cuando no existe 2024', async () => {
    fetchUtils.fetchWithRetry.mockImplementation((url) => {
      let data = []
      if (url.includes('ECP320')) data = [{ Valor: 49000000, Fecha: 1735689600000 }]
      if (url.includes('EPA387794')) data = [{ Valor: 24000, Fecha: 1735689600000 }]
      if (url.includes('CNTR6597')) {
        data = Array(8)
          .fill(0)
          .map((_, i) => ({ Valor: 400000, Fecha: 1735689600000 - i * 100000000 }))
      }
      if (url.includes('EAES741')) data = [{ Valor: 28000, Fecha: 1735689600000 }]
      if (url.includes('IPC278296')) data = [{ Valor: 108, Fecha: 1672531200000 }] // 2023
      if (url.includes('IPC290750')) data = [] // sin variaciones -> no reconstrucción

      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ Data: data }),
      })
    })

    const result = await downloadDemographics()

    expect(result.cpi.baseYear).toBe(2023)
    expect(result.cpi.byYear['2023']).toBe(108)
    expect(result.sourceAttribution.cpi.type).toBe('api')
  })

  it('usa fallback cuando hay errores de red en sub-fetches', async () => {
    fetchUtils.fetchWithRetry.mockRejectedValue(new Error('Network error'))

    const result = await downloadDemographics()

    expect(result.sourceAttribution.population.type).toBe('fallback')
    expect(result.sourceAttribution.activePopulation.type).toBe('fallback')
    expect(result.sourceAttribution.cpi.type).toBe('fallback')
  })

  it('cubre fallback global si ocurre error no controlado en el flujo principal', async () => {
    fetchUtils.fetchWithRetry.mockImplementation((url) => {
      if (url.includes('EPA')) return Promise.resolve(undefined)
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ Data: [] }) })
    })

    const result = await downloadDemographics()

    expect(result.sourceAttribution.population.type).toBe('fallback')
    expect(result.sourceAttribution.gdp.type).toBe('fallback')
    expect(result.smi).toBe(1221)
  })
})
