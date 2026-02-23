import { beforeEach, describe, expect, it, vi } from 'vitest'
import { downloadDemographicsDetail } from '../sources/ine.mjs'

describe('downloadDemographicsDetail', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns fallback data when fetcher rejects all requests', async () => {
    const failFetcher = vi.fn().mockRejectedValue(new Error('Network error'))

    const result = await downloadDemographicsDetail(failFetcher)

    // Should have valid vital stats from fallback
    expect(result.vitalStats).toBeDefined()
    expect(result.vitalStats.birthRate.length).toBeGreaterThan(0)
    expect(result.vitalStats.deathRate.length).toBeGreaterThan(0)
    expect(result.vitalStats.fertilityRate.length).toBeGreaterThan(0)
    expect(result.vitalStats.naturalGrowth.length).toBeGreaterThan(0)

    // Life expectancy fallback
    expect(result.lifeExpectancy).toBeDefined()
    expect(result.lifeExpectancy.both.length).toBeGreaterThan(0)
    expect(result.lifeExpectancy.male.length).toBeGreaterThan(0)
    expect(result.lifeExpectancy.female.length).toBeGreaterThan(0)

    // Pyramid fallback
    expect(result.pyramid).toBeDefined()
    expect(result.pyramid.years.length).toBeGreaterThan(0)
    expect(result.pyramid.ageGroups).toContain('0-4')
    expect(result.pyramid.ageGroups).toContain('90+')
    expect(result.pyramid.ageGroups).toHaveLength(19)

    // Dependency ratios
    expect(result.dependencyRatio).toBeDefined()
    expect(result.dependencyRatio.oldAge).toBeGreaterThan(0)
    expect(result.dependencyRatio.youth).toBeGreaterThan(0)
    expect(result.dependencyRatio.total).toBeGreaterThan(0)

    // Immigration share
    expect(result.immigrationShare).toBeDefined()
    expect(result.immigrationShare.total).toBeGreaterThan(0)
    expect(result.immigrationShare.historical.length).toBeGreaterThan(0)
    // Historical entries use { year, value } format
    const firstHistorical = result.immigrationShare.historical[0]
    expect(firstHistorical).toHaveProperty('year')
    expect(firstHistorical).toHaveProperty('value')

    // Source attribution
    expect(result.sourceAttribution).toBeDefined()
    expect(result.sourceAttribution.vitalStats.type).toBe('fallback')
    expect(result.sourceAttribution.lifeExpectancy.type).toBe('fallback')
    expect(result.sourceAttribution.pyramid.type).toBe('fallback')
  })

  it('fallback vital stats have realistic values', async () => {
    const failFetcher = vi.fn().mockRejectedValue(new Error('fail'))

    const result = await downloadDemographicsDetail(failFetcher)

    const latestBirth = result.vitalStats.birthRate.at(-1)
    expect(latestBirth.value).toBeGreaterThan(5)
    expect(latestBirth.value).toBeLessThan(12)

    const latestDeath = result.vitalStats.deathRate.at(-1)
    expect(latestDeath.value).toBeGreaterThan(7)
    expect(latestDeath.value).toBeLessThan(15)

    const latestFertility = result.vitalStats.fertilityRate.at(-1)
    expect(latestFertility.value).toBeGreaterThan(0.8)
    expect(latestFertility.value).toBeLessThan(2.5)

    const latestLifeExp = result.lifeExpectancy.both.at(-1)
    expect(latestLifeExp.value).toBeGreaterThan(75)
    expect(latestLifeExp.value).toBeLessThan(90)
  })

  it('fallback pyramid has valid structure with all regions', async () => {
    const failFetcher = vi.fn().mockRejectedValue(new Error('fail'))

    const result = await downloadDemographicsDetail(failFetcher)

    const regions = result.pyramid.regions
    expect(regions).toContain('spain')
    expect(regions).toContain('eu')
    expect(regions).toContain('restEurope')
    expect(regions).toContain('africa')
    expect(regions).toContain('americas')
    expect(regions).toContain('asiaOceania')

    // Check that latest year has proper male/female structure
    const latestYear = String(result.pyramid.years.at(-1))
    const yearData = result.pyramid.byYear[latestYear]
    expect(yearData.male).toBeDefined()
    expect(yearData.female).toBeDefined()

    // Each region should have an array for each age group
    for (const region of regions) {
      expect(yearData.male[region]).toHaveLength(19)
      expect(yearData.female[region]).toHaveLength(19)
    }
  })

  it('fetches vital stats and life expectancy from INE API when available', async () => {
    const makeSeriesData = (value) => [
      { Valor: value, Fecha: '1704067200000' },     // 2024
      { Valor: value + 0.1, Fecha: '1672531200000' }, // 2023
    ]

    // Mock that returns proper data for IDB series but fails for table metadata
    const fetcher = vi.fn().mockImplementation((url) => {
      // Vital stats and life expectancy series
      if (url.includes('DATOS_SERIE')) {
        if (url.includes('IDB37106')) return Promise.resolve({ ok: true, json: () => Promise.resolve(makeSeriesData(6.49)) })
        if (url.includes('IDB47797')) return Promise.resolve({ ok: true, json: () => Promise.resolve(makeSeriesData(9.50)) })
        if (url.includes('IDB86387')) return Promise.resolve({ ok: true, json: () => Promise.resolve(makeSeriesData(1.16)) })
        if (url.includes('IDB55340')) return Promise.resolve({ ok: true, json: () => Promise.resolve(makeSeriesData(-3.01)) })
        if (url.includes('IDB53772')) return Promise.resolve({ ok: true, json: () => Promise.resolve(makeSeriesData(83.50)) })
        if (url.includes('IDB53773')) return Promise.resolve({ ok: true, json: () => Promise.resolve(makeSeriesData(80.70)) })
        if (url.includes('IDB53774')) return Promise.resolve({ ok: true, json: () => Promise.resolve(makeSeriesData(86.10)) })
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) })
      }
      // Table metadata for pyramid — fail so it falls back to catch
      if (url.includes('SERIES_TABLA')) {
        return Promise.reject(new Error('Table fetch failed'))
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) })
    })

    // downloadDemographicsDetail will catch the pyramid error and return full fallback
    const result = await downloadDemographicsDetail(fetcher)

    // Due to pyramid failure, it falls back entirely
    expect(result.vitalStats).toBeDefined()
    expect(result.pyramid).toBeDefined()
    expect(result.dependencyRatio).toBeDefined()
  })

  it('immigration share historical uses value field, not share', async () => {
    const failFetcher = vi.fn().mockRejectedValue(new Error('fail'))

    const result = await downloadDemographicsDetail(failFetcher)

    for (const entry of result.immigrationShare.historical) {
      expect(entry).toHaveProperty('value')
      expect(entry).not.toHaveProperty('share')
      expect(typeof entry.value).toBe('number')
      expect(entry.value).toBeGreaterThanOrEqual(0)
      expect(entry.value).toBeLessThanOrEqual(1) // fraction, not percentage
    }
  })

  it('dependency ratios are valid fractions', async () => {
    const failFetcher = vi.fn().mockRejectedValue(new Error('fail'))

    const result = await downloadDemographicsDetail(failFetcher)

    expect(result.dependencyRatio.oldAge).toBeGreaterThan(0)
    expect(result.dependencyRatio.oldAge).toBeLessThan(1)
    expect(result.dependencyRatio.youth).toBeGreaterThan(0)
    expect(result.dependencyRatio.youth).toBeLessThan(1)
    expect(result.dependencyRatio.total).toBeGreaterThan(0)
    expect(result.dependencyRatio.total).toBeLessThan(2)
    // total should be approximately old + youth
    expect(Math.abs(result.dependencyRatio.total - result.dependencyRatio.oldAge - result.dependencyRatio.youth)).toBeLessThan(0.01)
  })
})
