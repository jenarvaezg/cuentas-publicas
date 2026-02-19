import { describe, it, expect, vi, beforeEach } from 'vitest'
import { 
  downloadDebtData, 
  downloadCcaaDebtData,
  parseBdETransposedCSV, 
  parseCSVLine, 
  parseBdEDate, 
  parseSpanishNumberFromString,
  extractLatestFromApi,
  buildDebtResult
} from '../sources/bde.mjs'
import * as fetchUtils from '../lib/fetch-utils.mjs'

vi.mock('../lib/fetch-utils.mjs', () => ({
  fetchWithRetry: vi.fn()
}))

describe('bde source script', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  const be11bCsv = [
    'COD;S1;S2;S3;S4;S5;S6',
    'M1', 'M2',
    'DESC;aapp deuda pde total;estado deuda pde total;ccaa deuda pde;ccll deuda pde;seguridad social deuda;pib',
    'UNIT;M;M;M;M;M;M',
    'M3',
    ' DIC 2025 ; 1635000 ; 1250000 ; 320000 ; 25000 ; 40000 ; 1600000 ',
    ' NOV 2025 ; 1630000 ; 1245000 ; 315000 ; 25000 ; 45000 ; 1590000 '
  ].join('\n')

  it('downloads all debt data successfully', async () => {
    fetchUtils.fetchWithRetry.mockImplementation((url) => {
      if (url.includes('srdatosapp')) return Promise.resolve({ ok: true, json: () => Promise.resolve([{ Datos: [{ Valor: 1635000, Fecha: '2025-12-31' }] }]) })
      return Promise.resolve({ ok: true, text: () => Promise.resolve(be11bCsv) })
    })

    const result = await downloadDebtData()
    expect(result.current.totalDebt).toBe(1635000000000)
  })

  it('covers parsing functions', () => {
    expect(parseCSVLine('A;B')).toEqual(['A', 'B'])
    expect(parseBdEDate(' DIC 2025 ')).toBeDefined()
    expect(parseSpanishNumberFromString('1.234,56')).toBe(1234.56)
    expect(extractLatestFromApi([{ Datos: [{ Valor: 1 }] }])).toBeDefined()
    expect(parseBdETransposedCSV(be11bCsv, 'monthly').totalDebt.length).toBeGreaterThan(0)
  })

  it('downloads CCAA data successfully', async () => {
    const mockCsv = 'S;BE_13_9.1\nM1\nALIASES;BE_13_9.1\nD;Total\nU;M\nM3\n DIC 2025 ; 1000\n NOV 2025 ; 900'
    fetchUtils.fetchWithRetry.mockResolvedValue({ ok: true, text: () => Promise.resolve(mockCsv) })
    const result = await downloadCcaaDebtData()
    expect(result.total.debtAbsolute).toBe(900000) // Takes last row
  })
})
