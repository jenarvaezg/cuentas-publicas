import { describe, it, expect, vi, beforeEach } from 'vitest'
import { downloadDemographics, formatINEDate } from '../sources/ine.mjs'
import * as fetchUtils from '../lib/fetch-utils.mjs'

vi.mock('../lib/fetch-utils.mjs', () => ({
  fetchWithRetry: vi.fn()
}))

describe('ine source script', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('downloads all demographics successfully', async () => {
    fetchUtils.fetchWithRetry.mockImplementation((url) => {
      let data = []
      if (url.includes('ECP320')) data = [{ Valor: 49000000, Fecha: 1735689600000 }]
      if (url.includes('EPA387794')) data = [{ Valor: 24000, Fecha: 1735689600000 }] // 24M
      if (url.includes('CNTR6597')) {
        data = Array(8).fill(0).map((_, i) => ({ Valor: 400000, Fecha: 1735689600000 - i * 100000000 }))
      }
      if (url.includes('EAES741')) data = [{ Valor: 28000, Fecha: 1735689600000 }]
      if (url.includes('IPC')) data = [{ Valor: 115, Fecha: 1735689600000 }]
      
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ Data: data })
      })
    })

    const result = await downloadDemographics()
    expect(result.population).toBe(49000000)
    expect(result.activePopulation).toBe(24000000)
    expect(result.averageSalary).toBe(28000)
  })

  it('triggers errors in sub-fetches', async () => {
    fetchUtils.fetchWithRetry.mockImplementation(() => Promise.reject(new Error('Network error')))
    const result = await downloadDemographics()
    expect(result.sourceAttribution.population.type).toBe('fallback')
  })

  it('triggers fatal error in main loop', async () => {
    // We can't easily mock Promise.allSettled globally without side effects, 
    // but we can make one of the fetchers return something that satisfies fulfilled 
    // but is actually undefined.
    // However, the code does: const activePop = activePopulation.status === 'fulfilled' ? activePopulation.value : fallbackActivePopulation()
    // If we make fetchActivePopulation return undefined (resolved), it will crash on activePop.value
    
    fetchUtils.fetchWithRetry.mockImplementation((url) => {
      if (url.includes('EPA')) return Promise.resolve(undefined); // Will crash when doing .json()
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ Data: [] }) });
    });

    const result = await downloadDemographics();
    expect(result.sourceAttribution.population.type).toBe('fallback');
  });
})
