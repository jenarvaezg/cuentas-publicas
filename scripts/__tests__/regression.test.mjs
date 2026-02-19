import { describe, it, expect } from 'vitest'
import { linearRegression } from '../lib/regression.mjs'

describe('linearRegression', () => {
  it('returns zero slope/intercept for empty input', () => {
    const result = linearRegression([])
    expect(result.slope).toBe(0)
    expect(result.intercept).toBe(0)
    expect(result.predict(100)).toBe(0)
  })

  it('returns zero slope and y value for single point', () => {
    const result = linearRegression([{ x: 5, y: 42 }])
    expect(result.slope).toBe(0)
    expect(result.intercept).toBe(42)
    expect(result.predict(999)).toBe(42)
  })

  it('computes exact slope=1 and intercept=0 for y=x', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 3 },
    ]
    const result = linearRegression(points)
    expect(result.slope).toBeCloseTo(1, 10)
    expect(result.intercept).toBeCloseTo(0, 10)
  })

  it('computes slope=2 and intercept=1 for y=2x+1', () => {
    const points = [
      { x: 0, y: 1 },
      { x: 1, y: 3 },
      { x: 2, y: 5 },
      { x: 3, y: 7 },
    ]
    const result = linearRegression(points)
    expect(result.slope).toBeCloseTo(2, 10)
    expect(result.intercept).toBeCloseTo(1, 10)
  })

  it('predicts correctly using slope and intercept', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
    ]
    const result = linearRegression(points)
    expect(result.predict(5)).toBeCloseTo(5, 10)
    expect(result.predict(10)).toBeCloseTo(10, 10)
  })

  it('handles horizontal line (slope=0)', () => {
    const points = [
      { x: 1, y: 5 },
      { x: 2, y: 5 },
      { x: 3, y: 5 },
    ]
    const result = linearRegression(points)
    expect(result.slope).toBeCloseTo(0, 10)
    expect(result.intercept).toBeCloseTo(5, 10)
    expect(result.predict(100)).toBeCloseTo(5, 10)
  })

  it('handles negative slope', () => {
    const points = [
      { x: 0, y: 10 },
      { x: 1, y: 8 },
      { x: 2, y: 6 },
      { x: 3, y: 4 },
    ]
    const result = linearRegression(points)
    expect(result.slope).toBeCloseTo(-2, 10)
    expect(result.intercept).toBeCloseTo(10, 10)
  })

  it('returns a predict function', () => {
    const result = linearRegression([{ x: 0, y: 0 }, { x: 1, y: 1 }])
    expect(typeof result.predict).toBe('function')
  })

  it('handles vertical points (denominator=0)', () => {
    const points = [
      { x: 5, y: 10 },
      { x: 5, y: 20 },
    ]
    const result = linearRegression(points)
    expect(result.slope).toBe(0)
    expect(result.intercept).toBe(15) // (10+20)/2
  })

  it('handles null input', () => {
    const result = linearRegression(null)
    expect(result.slope).toBe(0)
    expect(result.intercept).toBe(0)
  })
})
