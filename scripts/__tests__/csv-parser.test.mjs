import { describe, it, expect } from 'vitest'
import { parseSpanishCSV, parseSpanishNumber } from '../lib/csv-parser.mjs'

describe('parseSpanishNumber', () => {
  it('parses Spanish number with thousands dot and decimal comma', () => {
    expect(parseSpanishNumber('1.234,56')).toBe(1234.56)
  })

  it('parses integer string', () => {
    expect(parseSpanishNumber('1234')).toBe(1234)
  })

  it('parses negative number', () => {
    expect(parseSpanishNumber('-1.234,56')).toBe(-1234.56)
  })

  it('returns original string for non-numeric input', () => {
    expect(parseSpanishNumber('Fecha')).toBe('Fecha')
  })

  it('returns empty string unchanged', () => {
    expect(parseSpanishNumber('')).toBe('')
  })

  it('handles zero', () => {
    expect(parseSpanishNumber('0')).toBe(0)
  })

  it('handles large numbers with multiple dot separators', () => {
    expect(parseSpanishNumber('1.234.567,89')).toBeCloseTo(1234567.89, 2)
  })
})

describe('parseSpanishCSV', () => {
  it('returns empty array for empty input', () => {
    expect(parseSpanishCSV('')).toEqual([])
  })

  it('returns empty array for null/undefined', () => {
    expect(parseSpanishCSV(null)).toEqual([])
    expect(parseSpanishCSV(undefined)).toEqual([])
  })

  it('parses a simple CSV with header and one data row', () => {
    const csv = 'Fecha;Valor\n2025-01-01;1.234,56'
    const result = parseSpanishCSV(csv)
    expect(result).toHaveLength(1)
    expect(result[0].Fecha).toBe('2025-01-01')
    expect(result[0].Valor).toBeCloseTo(1234.56, 2)
  })

  it('parses multiple data rows', () => {
    const csv = 'Periodo;Importe\n2024-Q1;1.000,00\n2024-Q2;2.000,00\n2024-Q3;3.000,00'
    const result = parseSpanishCSV(csv)
    expect(result).toHaveLength(3)
    expect(result[0].Importe).toBe(1000)
    expect(result[1].Importe).toBe(2000)
    expect(result[2].Importe).toBe(3000)
  })

  it('keeps string columns as strings', () => {
    const csv = 'Nombre;Codigo\nEspaña;ABC'
    const result = parseSpanishCSV(csv)
    expect(result[0].Nombre).toBe('España')
    expect(result[0].Codigo).toBe('ABC')
  })

  it('handles quoted header values', () => {
    const csv = '"Fecha";"Valor"\n2025-01-01;100'
    const result = parseSpanishCSV(csv)
    expect(result).toHaveLength(1)
    expect(result[0].Fecha).toBe('2025-01-01')
    expect(result[0].Valor).toBe(100)
  })

  it('ignores blank lines', () => {
    const csv = 'A;B\n\n1;2\n\n3;4'
    const result = parseSpanishCSV(csv)
    expect(result).toHaveLength(2)
  })

  it('parses multiple columns correctly', () => {
    const csv = 'Col1;Col2;Col3\n1,5;2.000;texto'
    const result = parseSpanishCSV(csv)
    expect(result[0].Col1).toBeCloseTo(1.5, 1)
    expect(result[0].Col2).toBe(2000)
    expect(result[0].Col3).toBe('texto')
  })
})
