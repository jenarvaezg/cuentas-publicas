import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as fetchUtils from '../lib/fetch-utils.mjs'
import {
  downloadCcaaForalFlowsData,
  parseEuskadiForalFlow,
  parseNavarraForalFlow,
} from '../sources/ccaa-foral-flows.mjs'

vi.mock('../lib/fetch-utils.mjs', () => ({
  fetchWithRetry: vi.fn(),
}))

describe('ccaa-foral-flows source script', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('parsea métricas clave de Navarra desde tabla HTML', () => {
    const html = `
      <table>
        <tr><td>Total Pagos Aportación Neta</td><td>611.223,1</td><td>698.643,6</td></tr>
        <tr><td>Total Ajustes fiscales</td><td>1.225.430,6</td><td>1.375.926,9</td></tr>
      </table>
    `

    const parsed = parseNavarraForalFlow(html)
    expect(parsed.paymentToState).toBe(698.644)
    expect(parsed.adjustmentsWithState).toBe(1375.927)
    expect(parsed.netFlowToState).toBe(-677.283)
  })

  it('parsea cupo provisional de Euskadi desde noticia CMCE', () => {
    const html = `
      <p><strong>CUPO L&Iacute;QUIDO PROV M&euro;</strong></p>
      <p>1.504,50</p>
    `

    const parsed = parseEuskadiForalFlow(html)
    expect(parsed.paymentToState).toBe(1504.5)
    expect(parsed.adjustmentsWithState).toBeNull()
    expect(parsed.netFlowToState).toBeNull()
  })

  it('descarga y construye dataset foral', async () => {
    fetchUtils.fetchWithRetry
      .mockResolvedValueOnce({
        text: () =>
          Promise.resolve(`
            <table>
              <tr><td>Total Pagos Aportación Neta</td><td>611.223,1</td><td>698.643,6</td></tr>
              <tr><td>Total Ajustes fiscales</td><td>1.225.430,6</td><td>1.375.926,9</td></tr>
            </table>
          `),
      })
      .mockResolvedValueOnce({
        text: () =>
          Promise.resolve(`
            <p><strong>CUPO L&Iacute;QUIDO PROV M&euro;</strong></p>
            <p>1.504,50</p>
          `),
      })

    const result = await downloadCcaaForalFlowsData()
    expect(result.latestYear).toBe(2024)
    expect(result.byYear['2024'].entries).toHaveLength(2)
    expect(result.sourceAttribution.foral.type).toBe('api')

    const navarra = result.byYear['2024'].entries.find((entry) => entry.code === 'CA15')
    const paisVasco = result.byYear['2024'].entries.find((entry) => entry.code === 'CA16')
    expect(navarra.paymentToState).toBe(698.644)
    expect(paisVasco.paymentToState).toBe(1504.5)
  })

  it('cae a fallback cuando no puede parsear fuentes', async () => {
    fetchUtils.fetchWithRetry.mockResolvedValue({
      text: () => Promise.resolve('<html>sin métricas esperadas</html>'),
    })

    const result = await downloadCcaaForalFlowsData()
    expect(result.sourceAttribution.foral.type).toBe('fallback')
    expect(result.byYear['2024'].entries).toHaveLength(2)
  })
})
