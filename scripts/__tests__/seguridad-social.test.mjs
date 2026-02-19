import { describe, it, expect, vi, beforeEach } from 'vitest'
import { downloadPensionData, buildPensionResult, buildHistoricalData, fetchFromSSExcel } from '../sources/seguridad-social.mjs'
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

  it('downloads all pension data successfully', async () => {
    fetchUtils.fetchWithRetry.mockImplementation((url) => {
      if (url.includes('EST24')) return Promise.resolve({ ok: true, text: () => Promise.resolve('<a href="REG202601.xlsx">L</a>') })
      return Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(1)), text: () => Promise.resolve('b') })
    })

    XLSX.read.mockReturnValue({
      SheetNames: ['Indice', 'Régimen_clase'],
      Sheets: { 'Régimen_clase': {} }
    })

    const mockHeader = ['R', 'pensiones', 'nómina', 'media', '...', '...', '...', 'jub', 'nómina jub', 'media jub']
    const mockTotal = ['Total sistema', 10000000, 14000000000, 1400, 0, 0, 0, 6000000, 9000000000, 1500]

    XLSX.utils.sheet_to_json.mockReturnValue([ ...Array(5).fill([]), mockHeader, mockTotal ])

    const result = await downloadPensionData()
    expect(result.current.monthlyPayrollSS).toBe(14000000000)
  })

  it('covers fallback logic', () => {
    const result = buildPensionResult(null)
    expect(result.sourceAttribution.monthlyPayroll.type).toBe('fallback')
  })
})
