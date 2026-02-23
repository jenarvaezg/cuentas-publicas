import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import XLSX from 'xlsx'
import * as fetchUtils from '../lib/fetch-utils.mjs'
import {
  detectYearLinks,
  downloadCcaaSpendingData,
  parseYearWorkbook,
} from '../sources/ccaa-spending.mjs'

vi.mock('../lib/fetch-utils.mjs', () => ({
  fetchWithRetry: vi.fn(),
}))

vi.mock('xlsx', () => ({
  default: {
    read: vi.fn(),
    utils: {
      sheet_to_json: vi.fn(),
    },
  },
}))

function buildCcaaSheetRows(name, divisionValues, total) {
  const headerRow = [
    '2024(P)',
    '',
    '01. Servicios públicos generales',
    '02. Defensa',
    '03. Orden público y seguridad',
    '04. Asuntos económicos',
    '05. Protección del medio ambiente',
    '06. Vivienda y servicios comunitarios',
    '07. Salud',
    '08. Ocio, cultura y religión',
    '09. Educación',
    '10. Protección social',
    'TOTAL',
  ]

  const gastoRow = [
    '',
    'GASTO TOTAL',
    divisionValues['01'],
    divisionValues['02'],
    divisionValues['03'],
    divisionValues['04'],
    divisionValues['05'],
    divisionValues['06'],
    divisionValues['07'],
    divisionValues['08'],
    divisionValues['09'],
    divisionValues['10'],
    total,
  ]

  return [
    [name],
    ['Gasto por divisiones COFOG'],
    ['SEC 2010'],
    ['Millones de euros'],
    ['Fecha de actualización: 28/11/2025'],
    [''],
    headerRow,
    [''],
    gastoRow,
  ]
}

describe('ccaa-spending source script', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-23T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('detecta enlaces de años en el índice IGAE', () => {
    const html = `
      <a href="/Documents/CCAA-A/COFOG_A_Detalle_CCAA_2022.xlsx">2022</a>
      <a href="/Documents/CCAA-A/COFOG_A_Detalle_CCAA_2024.xlsx">2024</a>
      <a href="/Documents/CCAA-A/COFOG_A_Detalle_CCAA_2023.xlsx">2023</a>
    `

    const links = detectYearLinks(html)
    expect(links.map((l) => l.year)).toEqual([2022, 2023, 2024])
    expect(links[0].url).toContain('COFOG_A_Detalle_CCAA_2022.xlsx')
  })

  it('parsea un workbook anual por CCAA con top división', () => {
    XLSX.utils.sheet_to_json.mockImplementation((sheet) => sheet.__rows)

    const workbook = {
      SheetNames: ['Indice', 'Tabla1a', 'Tabla2a', 'Tabla13a'],
      Sheets: {
        Tabla2a: {
          __rows: buildCcaaSheetRows(
            'Andalucía',
            {
              '01': 100,
              '02': 0,
              '03': 30,
              '04': 140,
              '05': 20,
              '06': 10,
              '07': 400,
              '08': 15,
              '09': 300,
              '10': 120,
            },
            1135,
          ),
        },
        Tabla13a: {
          __rows: buildCcaaSheetRows(
            'Madrid',
            {
              '01': 250,
              '02': 0,
              '03': 45,
              '04': 310,
              '05': 35,
              '06': 28,
              '07': 520,
              '08': 34,
              '09': 410,
              '10': 390,
            },
            2022,
          ),
        },
      },
    }

    const parsed = parseYearWorkbook(2024, workbook)
    expect(parsed.entries).toHaveLength(2)

    const andalucia = parsed.entries.find((entry) => entry.code === 'CA01')
    expect(andalucia.total).toBe(1135)
    expect(andalucia.topDivisionCode).toBe('07')
    expect(andalucia.divisions['09']).toBe(300)

    expect(parsed.totals.total).toBe(3157)
    expect(parsed.totals.divisions['07']).toBe(920)
  })

  it('descarga y procesa varios años', async () => {
    XLSX.utils.sheet_to_json.mockImplementation((sheet) => sheet.__rows)

    fetchUtils.fetchWithRetry.mockImplementation((url) => {
      if (url.includes('COFOG_A_Detalle_CCAA_2024.xlsx')) {
        return Promise.resolve({
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
        })
      }
      if (url.includes('COFOG_A_Detalle_CCAA_2023.xlsx')) {
        return Promise.resolve({
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
        })
      }
      return Promise.reject(new Error('HTTP 404'))
    })

    XLSX.read
      .mockReturnValueOnce({
        SheetNames: ['Tabla2a', 'Tabla13a'],
        Sheets: {
          Tabla2a: {
            __rows: buildCcaaSheetRows(
              'Andalucía',
              {
                '01': 100,
                '02': 0,
                '03': 30,
                '04': 140,
                '05': 20,
                '06': 10,
                '07': 400,
                '08': 15,
                '09': 300,
                '10': 120,
              },
              1135,
            ),
          },
          Tabla13a: {
            __rows: buildCcaaSheetRows(
              'Madrid',
              {
                '01': 250,
                '02': 0,
                '03': 45,
                '04': 310,
                '05': 35,
                '06': 28,
                '07': 520,
                '08': 34,
                '09': 410,
                '10': 390,
              },
              2022,
            ),
          },
        },
      })
      .mockReturnValueOnce({
        SheetNames: ['Tabla2a'],
        Sheets: {
          Tabla2a: {
            __rows: buildCcaaSheetRows(
              'Andalucía',
              {
                '01': 90,
                '02': 0,
                '03': 20,
                '04': 120,
                '05': 18,
                '06': 12,
                '07': 350,
                '08': 14,
                '09': 260,
                '10': 100,
              },
              984,
            ),
          },
        },
      })

    const result = await downloadCcaaSpendingData()
    expect(result.years).toEqual([2023, 2024])
    expect(result.latestYear).toBe(2024)
    expect(result.byYear['2024'].entries).toHaveLength(2)
    expect(result.sourceAttribution.spending.type).toBe('xlsx')
  })

  it('cae a fallback cuando no se puede descargar ningún año', async () => {
    fetchUtils.fetchWithRetry.mockRejectedValue(new Error('Network down'))

    const result = await downloadCcaaSpendingData()
    expect(result.sourceAttribution.spending.type).toBe('fallback')
    expect(result.latestYear).toBe(2024)
    expect(result.byYear['2024'].entries.length).toBeGreaterThan(0)
  })
})
