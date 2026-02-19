import { describe, it, expect, vi, beforeEach } from 'vitest'
import { downloadBudgetData } from '../sources/igae.mjs'
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

describe('igae source script', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  const mockHeaderRow = [
    '', 'Concepto', '01.1', '01.2', '01.3', '01.4', '01.5', '01.6', '01.7', '01.8', 'Total 01',
    '02.1', '02.2', '02.3', '02.4', '02.5', 'Total 02',
    '03.1', '03.2', '03.3', '03.4', '03.5', '03.6', 'Total 03',
    '04.1', '04.2', '04.3', '04.4', '04.5', '04.6', '04.7', '04.8', '04.9', 'Total 04',
    '05.1', '05.2', '05.3', '05.4', '05.5', '05.6', 'Total 05',
    '06.1', '06.2', '06.3', '06.4', '06.5', '06.6', 'Total 06',
    '07.1', '07.2', '07.3', '07.4', '07.5', '07.6', 'Total 07',
    '08.1', '08.2', '08.3', '08.4', '08.5', '08.6', 'Total 08',
    '09.1', '09.2', '09.3', '09.4', '09.5', '09.6', '09.7', '09.8', 'Total 09',
    '10.1', '10.2', '10.3', '10.4', '10.5', '10.6', '10.7', '10.8', '10.9', 'Total 10',
    'GRAN TOTAL'
  ]

  const mockGastoRow = Array(mockHeaderRow.length).fill(0)
  mockGastoRow[1] = 'GASTO TOTAL'
  // Fill division totals (1000 each)
  const divIndices = [10, 16, 23, 33, 40, 47, 54, 61, 70, 80]
  divIndices.forEach(idx => mockGastoRow[idx] = 1000)
  mockGastoRow[81] = 10000 // Gran total

  it('downloads and parses IGAE budget data successfully', async () => {
    fetchUtils.fetchWithRetry.mockResolvedValue({
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(10))
    })

    XLSX.read.mockReturnValue({
      SheetNames: ['Indice', '2023', '2024', 'Apéndice'],
      Sheets: { '2023': {}, '2024': {} }
    })

    XLSX.utils.sheet_to_json.mockReturnValue([
      ...Array(7).fill([]),
      mockHeaderRow,
      mockGastoRow
    ])

    const result = await downloadBudgetData()

    expect(result.years).toContain(2023)
    expect(result.years).toContain(2024)
    expect(result.byYear['2024'].total).toBe(10000)
    expect(result.byYear['2024'].categories.length).toBe(10)
    expect(result.sourceAttribution.budget.type).toBe('csv')
  })

  it('uses fallback when download fails', async () => {
    fetchUtils.fetchWithRetry.mockRejectedValue(new Error('Network error'))
    
    const result = await downloadBudgetData()
    expect(result.years).toBeDefined()
    expect(result.sourceAttribution.budget.type).toBe('fallback')
  })

  it('handles cross-validation failure', async () => {
    fetchUtils.fetchWithRetry.mockResolvedValue({
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(10))
    })

    XLSX.read.mockReturnValue({
      SheetNames: ['2024'],
      Sheets: { '2024': {} }
    })

    const badGastoRow = [...mockGastoRow]
    badGastoRow[81] = 5000 // Gran total 5000 != sum(divs) 10000

    XLSX.utils.sheet_to_json.mockReturnValue([
      ...Array(7).fill([]),
      mockHeaderRow,
      badGastoRow
    ])

    const result = await downloadBudgetData()
    expect(result.byYear['2024'].total).toBe(5000)
  })

  it('handles detection failure and uses hardcoded constants', async () => {
    fetchUtils.fetchWithRetry.mockResolvedValue({
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(10))
    })

    XLSX.read.mockReturnValue({
      SheetNames: ['2024'],
      Sheets: { '2024': {} }
    })

    // Malformed header row (fewer than 10 divisions)
    XLSX.utils.sheet_to_json.mockReturnValue([
      ...Array(7).fill([]),
      ['Just', 'one', 'division', '01.1', 'Total 01'],
      mockGastoRow
    ])

    const result = await downloadBudgetData()
    expect(result).toBeDefined()
  })

  it('handles provisional years (e.g. 2024(P))', async () => {
    fetchUtils.fetchWithRetry.mockResolvedValue({
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(10))
    })

    XLSX.read.mockReturnValue({
      SheetNames: ['Indice', '2023', '2024(P)', 'Apéndice'],
      Sheets: { '2023': {}, '2024(P)': {} }
    })

    XLSX.utils.sheet_to_json.mockReturnValue([
      ...Array(7).fill([]),
      mockHeaderRow,
      mockGastoRow
    ])

    const result = await downloadBudgetData()
    expect(result.years).toContain(2024)
  })

  it('handles toNumber with various inputs', async () => {
    fetchUtils.fetchWithRetry.mockResolvedValue({
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(10))
    })
    XLSX.read.mockReturnValue({ SheetNames: ['2024'], Sheets: { '2024': {} } })
    
    // GASTO TOTAL in row 10 (not 8)
    XLSX.utils.sheet_to_json.mockReturnValue([
      ...Array(9).fill([]),
      [null, 'GASTO TOTAL', '1.000', 'invalid', '', undefined] 
    ])

    const result = await downloadBudgetData()
    expect(result).toBeDefined()
  })

  it('handles sheets with too few rows', async () => {
    fetchUtils.fetchWithRetry.mockResolvedValue({
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(10))
    })
    XLSX.read.mockReturnValue({ SheetNames: ['2024'], Sheets: { '2024': {} } })
    XLSX.utils.sheet_to_json.mockReturnValue([['just one row']])

    const result = await downloadBudgetData()
    expect(result).toBeDefined()
  })
})
