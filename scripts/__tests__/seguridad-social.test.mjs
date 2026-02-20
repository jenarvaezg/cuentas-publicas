import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { downloadPensionData, buildPensionResult, fetchFromSSExcel } from '../sources/seguridad-social.mjs'
import * as fetchUtils from '../lib/fetch-utils.mjs'
import XLSX from 'xlsx'

vi.mock('../lib/fetch-utils.mjs', () => ({
  fetchWithRetry: vi.fn()
}))

vi.mock('xlsx', () => ({
  default: {
    read: vi.fn(),
    utils: {
      sheet_to_json: vi.fn()
    }
  }
}))

describe('seguridad-social source script', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function mockFetchWithExcelLink(href = 'REG202601.xlsx') {
    fetchUtils.fetchWithRetry.mockImplementation((url) => {
      if (url.includes('EST24')) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve(`<a href="${href}">L</a>`) })
      }
      return Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(1)) })
    })
  }

  it('parsea correctamente el layout real (Numero/Importe/P. media) sin warning', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mockFetchWithExcelLink('REG202601.xlsx')

    XLSX.read.mockReturnValue({
      SheetNames: ['Indice', 'Régimen_clase'],
      Sheets: { 'Régimen_clase': {} }
    })

    XLSX.utils.sheet_to_json.mockReturnValue([
      ['RÉGIMEN', 'CLASE DE PENSIÓN'],
      ['', 'TOTAL', '', '', 'INCAPACIDAD PERMANENTE', '', '', 'JUBILACIÓN'],
      ['', 'Número', 'Importe (€)', 'P. media (€/mes)', 'Número', 'Importe (€)', 'P. media (€/mes)', 'Número', 'Importe (€)', 'P. media (€/mes)'],
      ['Total sistema', 10452674, 14250714014, 1363.87, 0, 0, 0, 6520000, 10230000000, 1563.56]
    ])

    const result = await fetchFromSSExcel()

    expect(result.monthlyPayrollSS).toBe(14250714014)
    expect(result.totalPensions).toBe(10452674)
    expect(result.averagePensionRetirement).toBe(1563.56)
    expect(result.date).toBe('2026-01-01')
    expect(fetchUtils.fetchWithRetry.mock.calls[1][0]).toBe('https://www.seg-social.es/REG202601.xlsx')
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('mantiene warning si no encuentra una cabecera confiable', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mockFetchWithExcelLink('/REG202601.xlsx')

    XLSX.read.mockReturnValue({
      SheetNames: ['Indice', 'Régimen_clase'],
      Sheets: { 'Régimen_clase': {} }
    })

    const mockTotal = ['Total sistema', 10000000, 14000000000, 1400, 0, 0, 0, 6000000, 9000000000, 1500]
    XLSX.utils.sheet_to_json.mockReturnValue([['cabecera desconocida'], mockTotal])

    const result = await fetchFromSSExcel()

    expect(result.monthlyPayrollSS).toBe(14000000000)
    expect(result.totalPensions).toBe(10000000)
    expect(
      warnSpy.mock.calls.some(([message]) =>
        String(message).includes('No se pudo encontrar la fila de cabecera')
      )
    ).toBe(true)
  })

  it('downloads all pension data successfully', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mockFetchWithExcelLink('REG202601.xlsx')

    XLSX.read.mockReturnValue({
      SheetNames: ['Indice', 'Régimen_clase'],
      Sheets: { 'Régimen_clase': {} }
    })

    const mockHeader = ['R', 'pensiones', 'nómina', 'media', '...', '...', '...', 'jub', 'nómina jub', 'media jub']
    const mockTotal = ['Total sistema', 10000000, 14000000000, 1400, 0, 0, 0, 6000000, 9000000000, 1500]

    XLSX.utils.sheet_to_json.mockReturnValue([...Array(5).fill([]), mockHeader, mockTotal])

    const result = await downloadPensionData()
    expect(result.current.monthlyPayrollSS).toBe(14000000000)
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('covers fallback logic', () => {
    const result = buildPensionResult(null)
    expect(result.sourceAttribution.monthlyPayroll.type).toBe('fallback')
  })

  it('usa URL alternativa cuando falla el primer candidato REG', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    fetchUtils.fetchWithRetry.mockImplementation((url) => {
      if (url.includes('EST24')) {
        return Promise.resolve({
          ok: true,
          text: () =>
            Promise.resolve(
              '<a href="/REG202601.xlsx">Primario</a><a href="/alt/REG202512.xlsx">Alternativo</a>'
            )
        })
      }
      if (url.includes('/REG202601.xlsx')) {
        return Promise.reject(new Error('404 primario'))
      }
      return Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(1)) })
    })

    XLSX.read.mockReturnValue({
      SheetNames: ['Indice', 'Régimen_clase'],
      Sheets: { 'Régimen_clase': {} }
    })
    XLSX.utils.sheet_to_json.mockReturnValue([
      ['RÉGIMEN', 'CLASE DE PENSIÓN'],
      ['', 'TOTAL', '', '', 'INCAPACIDAD PERMANENTE', '', '', 'JUBILACIÓN'],
      ['', 'Número', 'Importe (€)', 'P. media (€/mes)', 'Número', 'Importe (€)', 'P. media (€/mes)', 'Número', 'Importe (€)', 'P. media (€/mes)'],
      ['Total sistema', 10452674, 14250714014, 1363.87, 0, 0, 0, 6520000, 10230000000, 1563.56]
    ])

    const result = await fetchFromSSExcel()

    expect(result.monthlyPayrollSS).toBe(14250714014)
    expect(fetchUtils.fetchWithRetry.mock.calls.some(([url]) => String(url).includes('/alt/REG202512.xlsx'))).toBe(true)
    expect(
      warnSpy.mock.calls.some(([message]) => String(message).includes('Falló REG202601.xlsx'))
    ).toBe(true)
  })
})
