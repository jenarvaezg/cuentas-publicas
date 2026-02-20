import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildDebtResult,
  downloadCcaaDebtData,
  downloadDebtData,
  extractLatestFromApi,
  parseBdEDate,
  parseBdETransposedCSV,
  parseCSVLine,
  parseSpanishNumberFromString,
} from '../sources/bde.mjs'
import * as fetchUtils from '../lib/fetch-utils.mjs'
import * as regressionUtils from '../lib/regression.mjs'

vi.mock('../lib/fetch-utils.mjs', () => ({
  fetchWithRetry: vi.fn(),
}))

describe('bde source script', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  const be11bCsv = [
    'COD;S1;S2;S3;S4;S5;S6',
    'M1',
    'M2',
    'DESC;aapp deuda pde total;estado deuda pde total;ccaa deuda pde;ccll deuda pde;seguridad social deuda;pib',
    'UNIT;M;M;M;M;M;M',
    'M3',
    ' DIC 2025 ; 1635000 ; 1250000 ; 320000 ; 25000 ; 40000 ; 1600000 ',
    ' NOV 2025 ; 1630000 ; 1245000 ; 315000 ; 25000 ; 45000 ; 1590000 ',
  ].join('\n')

  it('prioriza API para total actual y conserva histórico/subsectores CSV', async () => {
    fetchUtils.fetchWithRetry.mockImplementation((url) => {
      if (url.includes('srdatosapp')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ Datos: [{ Valor: 1635000, Fecha: '2025-12-31' }] }]),
        })
      }
      return Promise.resolve({ ok: true, text: () => Promise.resolve(be11bCsv) })
    })

    const result = await downloadDebtData()

    expect(result.current.totalDebt).toBe(1635000000000)
    expect(result.sourceAttribution.totalDebt.type).toBe('api')
    expect(result.current.debtBySubsector.estado).toBe(1245000000)
    expect(result.historical.length).toBeGreaterThan(0)
  })

  it('buildDebtResult calcula variación interanual cuando hay más de 12 puntos', () => {
    const totalDebtSeries = []
    for (let i = 0; i <= 12; i++) {
      const d = new Date(Date.UTC(2024, 0 + i, 1))
      const isoDate = d.toISOString().split('T')[0]
      totalDebtSeries.push({
        date: isoDate,
        value: 1_000_000_000_000 + i * 10_000_000_000,
      })
    }

    const monthlyData = {
      totalDebt: totalDebtSeries,
      debtBySubsector: { estado: 700_000_000_000, ccaa: 200_000_000_000 },
      debtToGDP: [],
    }
    const quarterlyData = {
      totalDebt: [],
      debtBySubsector: {},
      debtToGDP: [{ date: '2024-12-31', value: 104.2 }],
    }

    const result = buildDebtResult(monthlyData, quarterlyData, null)

    expect(result.sourceAttribution.totalDebt.type).toBe('csv')
    expect(result.current.totalDebt).toBe(totalDebtSeries[12].value)
    expect(result.current.yearOverYearChange).toBeCloseTo(12, 3)
    expect(result.current.debtToGDP).toBe(104.2)
    expect(result.regression.debtPerSecond).toBeGreaterThan(0)
  })

  it('buildDebtResult no pisa CSV mensual con API más antigua', () => {
    const monthlyData = {
      totalDebt: [
        { date: '2025-10-31', value: 1_690_000_000_000 },
        { date: '2025-11-30', value: 1_698_000_000_000 },
      ],
      debtBySubsector: { estado: 1_500_000_000_000 },
      debtToGDP: [],
    }

    const result = buildDebtResult(monthlyData, null, {
      value: 1_709_000_000_000,
      date: '2025-07-01T08:15:00Z',
    })

    expect(result.current.totalDebt).toBe(1_698_000_000_000)
    expect(result.sourceAttribution.totalDebt.type).toBe('csv')
    expect(result.sourceAttribution.totalDebt.date).toBe('2025-11-30')
  })

  it('parseos básicos devuelven salida estable y tolerante a ruido', () => {
    expect(parseCSVLine('A;B')).toEqual(['A', 'B'])
    expect(parseCSVLine('"A","B, C","D"')).toEqual(['A', 'B, C', 'D'])
    expect(parseCSVLine('')).toEqual([])
    expect(parseBdEDate(' DIC 2025 ')).toBeDefined()
    expect(parseBdEDate('2025')).toBeNull()
    expect(parseBdEDate('ABC 2025')).toBeNull()
    expect(parseSpanishNumberFromString('1.234,56')).toBe(1234.56)
    expect(parseSpanishNumberFromString('abc')).toBe(0)
    expect(parseSpanishNumberFromString(null)).toBe(0)
    expect(parseBdETransposedCSV('', 'monthly').totalDebt).toEqual([])
  })

  it('extractLatestFromApi devuelve null para estructuras no usables', () => {
    expect(extractLatestFromApi({ foo: 'bar' })).toBeNull()
    expect(extractLatestFromApi([{ Datos: [{}] }])).toBeNull()
  })

  it('extractLatestFromApi usa fecha actual si falta Fecha y captura errores inesperados', () => {
    const directShape = extractLatestFromApi([
      { valor: 1_709_330, fechaValor: '2025-07-01T08:15:00Z' },
    ])
    expect(directShape).not.toBeNull()
    expect(directShape.value).toBe(1_709_330_000_000)
    expect(directShape.date).toBe('2025-07-01T08:15:00Z')

    const withoutDate = extractLatestFromApi([{ Datos: [{ Valor: 10 }] }])
    expect(withoutDate).not.toBeNull()
    expect(withoutDate.value).toBe(10_000_000)
    expect(withoutDate.date).toEqual(expect.any(String))

    const brokenSeries = new Proxy(
      {},
      {
        get() {
          throw new Error('broken payload')
        },
      }
    )
    expect(extractLatestFromApi([brokenSeries])).toBeNull()
  })

  it('parseBdETransposedCSV ignora filas incompletas y fechas inválidas', () => {
    const noisyCsv = [
      'COD;S1;S2;S3',
      'M1',
      'M2',
      'DESC;aapp deuda pde total;estado deuda pde total;pib',
      'UNIT;M;M;M',
      'M3',
      ' SOLO_FECHA ',
      ' FECHA_INVALIDA ; 100 ; 50 ; 200',
      ' DIC 2025 ; 0 ; 10 ; 0',
      ' NOV 2025 ; 100 ; 20 ; 200',
    ].join('\n')

    const parsed = parseBdETransposedCSV(noisyCsv, 'monthly')

    expect(parsed.totalDebt).toHaveLength(1)
    expect(parsed.totalDebt[0].value).toBe(100_000)
    expect(parsed.debtBySubsector.estado).toBe(20_000)
    expect(parsed.debtToGDP).toHaveLength(1)
    expect(parsed.debtToGDP[0].value).toBeCloseTo(50, 2)
  })

  it('parseBdETransposedCSV soporta CSV real de BdE con comas y campos entrecomillados', () => {
    const commaCsv = [
      '"CÓDIGO","S1","S2","S3","S4","S5","S6"',
      '"NÚMERO","1","2","3","4","5","6"',
      '"ALIAS","BE_11_B.1","BE_11_B.2","BE_11_B.4","BE_11_B.5","BE_11_B.6","BE_11_1.12"',
      '"DESCRIPCIÓN","PDE (SEC2010). AAPP. Deuda PDE. Total","PDE (SEC2010). Estado. Deuda PDE. Total","PDE (SEC2010). CCAA. Deuda PDE. Total","PDE (SEC2010). CCLL. Deuda PDE. Total","PDE (SEC2010). Administraciones de Seguridad Social. Deuda. Total","CNE. PIB pm. Precios corrientes"',
      '"UNIDADES","Miles de euros","Miles de euros","Miles de euros","Miles de euros","Miles de euros","Miles de euros"',
      '"FRECUENCIA","MENSUAL","MENSUAL","MENSUAL","MENSUAL","MENSUAL","MENSUAL"',
      '"META","_","_","_","_","_","_"',
      '"DIC 2025","1635000","1250000","320000","25000","40000","1600000"',
    ].join('\n')

    const parsed = parseBdETransposedCSV(commaCsv, 'monthly')

    expect(parsed.totalDebt).toHaveLength(1)
    expect(parsed.totalDebt[0].value).toBe(1_635_000_000)
    expect(parsed.debtBySubsector.estado).toBe(1_250_000_000)
    expect(parsed.debtBySubsector.ccaa).toBe(320_000_000)
    expect(parsed.debtBySubsector.ccll).toBe(25_000_000)
    expect(parsed.debtBySubsector.ss).toBe(40_000_000)
    expect(parsed.debtToGDP[0].value).toBeCloseTo(102.1875, 4)
  })

  it('downloadCcaaDebtData usa suma de CCAA si falta el total (.1)', async () => {
    const csv1309 = [
      'S;BE_13_9.2;BE_13_9.3',
      'M1',
      'ALIASES;BE_13_9.2;BE_13_9.3',
      'D;Andalucía;Aragón',
      'U;M;M',
      'M3',
      ' DIC 2025 ; 1000 ; 2000',
    ].join('\n')

    const csv1310 = [
      'S;BE_13_10.2;BE_13_10.3',
      'M1',
      'ALIASES;BE_13_10.2;BE_13_10.3',
      'D;Andalucía;Aragón',
      'U;M;M',
      'M3',
      ' DIC 2025 ; 10 ; 20',
    ].join('\n')

    fetchUtils.fetchWithRetry.mockImplementation((url) => {
      if (url.includes('be1309.csv')) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve(csv1309) })
      }
      return Promise.resolve({ ok: true, text: () => Promise.resolve(csv1310) })
    })

    const result = await downloadCcaaDebtData()

    expect(result.total.debtAbsolute).toBe(3000000)
    expect(result.total.debtToGDP).toBe(0)
    expect(result.ccaa.find((c) => c.code === 'CA01').debtAbsolute).toBe(1000000)
    expect(result.ccaa.find((c) => c.code === 'CA02').debtToGDP).toBe(20)
  })

  it('downloadCcaaDebtData prioriza el total explícito (.1) sobre la suma', async () => {
    const csv1309 = [
      'S;BE_13_9.1;BE_13_9.2;BE_13_9.3',
      'M1',
      'ALIASES;BE_13_9.1;BE_13_9.2;BE_13_9.3',
      'D;Total;Andalucía;Aragón',
      'U;M;M;M',
      'M3',
      ' DIC 2025 ; 9000 ; 1000 ; 2000',
    ].join('\n')

    const csv1310 = [
      'S;BE_13_10.1;BE_13_10.2;BE_13_10.3',
      'M1',
      'ALIASES;BE_13_10.1;BE_13_10.2;BE_13_10.3',
      'D;Total;Andalucía;Aragón',
      'U;M;M;M',
      'M3',
      ' DIC 2025 ; 15 ; 10 ; 20',
    ].join('\n')

    fetchUtils.fetchWithRetry.mockImplementation((url) => {
      if (url.includes('be1309.csv')) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve(csv1309) })
      }
      return Promise.resolve({ ok: true, text: () => Promise.resolve(csv1310) })
    })

    const result = await downloadCcaaDebtData()

    expect(result.total.debtAbsolute).toBe(9_000_000)
    expect(result.total.debtToGDP).toBe(15)
  })

  it('downloadCcaaDebtData parsea formato CSV actual de BdE con comas', async () => {
    const csv1309 = [
      '"CÓDIGO","S1","S2","S3"',
      '"NÚMERO","1","2","3"',
      '"ALIAS","BE_13_9.1","BE_13_9.2","BE_13_9.3"',
      '"DESCRIPCIÓN","Total","Andalucía","Aragón"',
      '"UNIDADES","Miles de euros","Miles de euros","Miles de euros"',
      '"FRECUENCIA","TRIMESTRAL","TRIMESTRAL","TRIMESTRAL"',
      '"DIC 2025","9000","1000","2000"',
    ].join('\n')

    const csv1310 = [
      '"CÓDIGO","S1","S2","S3"',
      '"NÚMERO","1","2","3"',
      '"ALIAS","BE_13_10.1","BE_13_10.2","BE_13_10.3"',
      '"DESCRIPCIÓN","Total","Andalucía","Aragón"',
      '"UNIDADES","Porcentaje","Porcentaje","Porcentaje"',
      '"FRECUENCIA","TRIMESTRAL","TRIMESTRAL","TRIMESTRAL"',
      '"DIC 2025","15.0","10.0","20.0"',
    ].join('\n')

    fetchUtils.fetchWithRetry.mockImplementation((url) => {
      if (url.includes('be1309.csv')) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve(csv1309) })
      }
      return Promise.resolve({ ok: true, text: () => Promise.resolve(csv1310) })
    })

    const result = await downloadCcaaDebtData()

    expect(result.total.debtAbsolute).toBe(9_000_000)
    expect(result.total.debtToGDP).toBe(15)
    expect(result.ccaa.find((c) => c.code === 'CA01').debtAbsolute).toBe(1_000_000)
  })

  it('downloadCcaaDebtData maneja filas vacías/corruptas y cae a fecha actual sin datos', async () => {
    const csv1309NoData = [
      'S;BE_13_9.1;BE_13_9.2',
      'M1',
      'ALIASES;BE_13_9.1;BE_13_9.2',
      'D;Total;Andalucía',
      'U;M;M',
      'M3',
      ' ; 100 ; 200',
      ' FECHA_INVALIDA ; 100 ; 200',
      ' DIC 2025 ; _ ; _',
      ' NOV 2025 ; 0 ; 0',
    ].join('\n')

    const csv1310NoData = [
      'S;BE_13_10.1;BE_13_10.2',
      'M1',
      'ALIASES;BE_13_10.1;BE_13_10.2',
      'D;Total;Andalucía',
      'U;M;M',
      'M3',
      ' ; 10 ; 20',
      ' FECHA_INVALIDA ; 10 ; 20',
      ' DIC 2025 ; _ ; _',
      ' NOV 2025 ; 0 ; 0',
    ].join('\n')

    fetchUtils.fetchWithRetry.mockImplementation((url) => {
      if (url.includes('be1309.csv')) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve(csv1309NoData) })
      }
      return Promise.resolve({ ok: true, text: () => Promise.resolve(csv1310NoData) })
    })

    const result = await downloadCcaaDebtData()

    expect(result.total.debtAbsolute).toBe(0)
    expect(result.total.debtToGDP).toBe(0)
    expect(result.quarter).toMatch(/^\d{4}-Q[1-4]$/)
    expect(result.sourceAttribution.be1309.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('downloadCcaaDebtData cae a fallback si falla una descarga crítica', async () => {
    fetchUtils.fetchWithRetry.mockImplementation((url) => {
      if (url.includes('be1309.csv')) return Promise.reject(new Error('be1309 timeout'))
      return Promise.resolve({ ok: true, text: () => Promise.resolve('irrelevante') })
    })

    const result = await downloadCcaaDebtData()

    expect(result.sourceAttribution.be1309.type).toBe('fallback')
    expect(result.ccaa.length).toBe(17)
    expect(result.total.debtToGDP).toBeGreaterThan(0)
  })

  it('downloadCcaaDebtData cae a fallback si falla be1310', async () => {
    const csv1309 = [
      'S;BE_13_9.1;BE_13_9.2',
      'M1',
      'ALIASES;BE_13_9.1;BE_13_9.2',
      'D;Total;Andalucía',
      'U;M;M',
      'M3',
      ' DIC 2025 ; 1000 ; 900',
    ].join('\n')

    fetchUtils.fetchWithRetry.mockImplementation((url) => {
      if (url.includes('be1309.csv')) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve(csv1309) })
      }
      return Promise.reject(new Error('be1310 timeout'))
    })

    const result = await downloadCcaaDebtData()

    expect(result.sourceAttribution.be1310.type).toBe('fallback')
    expect(result.ccaa.length).toBe(17)
  })

  it('downloadCcaaDebtData cae a fallback si el CSV viene truncado', async () => {
    fetchUtils.fetchWithRetry.mockImplementation((url) => {
      if (url.includes('be1309.csv')) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve('S;A\nM1') })
      }
      return Promise.resolve({ ok: true, text: () => Promise.resolve('S;B\nM1') })
    })

    const result = await downloadCcaaDebtData()

    expect(result.sourceAttribution.be1309.type).toBe('fallback')
    expect(result.total.debtAbsolute).toBeGreaterThan(0)
  })

  it('buildDebtResult usa fuentes trimestrales y soporta histórico vacío', () => {
    const quarterlyOnly = buildDebtResult(
      null,
      {
        totalDebt: [{ date: '2025-01-31', value: 2_000_000_000 }],
        debtBySubsector: { ccaa: 200_000_000 },
        debtToGDP: [],
      },
      null
    )

    expect(quarterlyOnly.current.totalDebt).toBe(2_000_000_000)
    expect(quarterlyOnly.current.debtBySubsector.ccaa).toBe(200_000_000)
    expect(quarterlyOnly.current.debtToGDP).toBe(0)

    const empty = buildDebtResult(null, null, null)
    expect(empty.current.totalDebt).toBe(0)
    expect(empty.historical).toEqual([])
    expect(empty.regression.debtPerSecond).toBe(0)
    expect(empty.sourceAttribution.totalDebt.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('downloadDebtData devuelve fallback cuando falla el cálculo de regresión', async () => {
    const be11bSimple = [
      'COD;S1;S2;S3',
      'M1',
      'M2',
      'DESC;aapp deuda pde total;estado deuda pde total;pib',
      'UNIT;M;M;M',
      'M3',
      ' DIC 2025 ; 1635000 ; 1250000 ; 1600000 ',
    ].join('\n')

    const regressionSpy = vi
      .spyOn(regressionUtils, 'linearRegression')
      .mockImplementation(() => {
        throw new Error('regression exploded')
      })

    fetchUtils.fetchWithRetry.mockImplementation((url) => {
      if (url.includes('srdatosapp')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ Datos: [{ Valor: 1635000, Fecha: '2025-12-31' }] }]),
        })
      }
      return Promise.resolve({ ok: true, text: () => Promise.resolve(be11bSimple) })
    })

    const result = await downloadDebtData()

    expect(result.sourceAttribution.totalDebt.type).toBe('fallback')
    expect(result.current.totalDebt).toBeGreaterThan(0)

    regressionSpy.mockRestore()
  })
})
