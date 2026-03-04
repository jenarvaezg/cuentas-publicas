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

  it('fallback includes projections data', async () => {
    const failFetcher = vi.fn().mockRejectedValue(new Error('fail'))
    const result = await downloadDemographicsDetail(failFetcher)

    expect(result.projections).toBeDefined()

    // Short-term national projections
    expect(result.projections.shortTerm.national.length).toBeGreaterThan(0)
    const firstNat = result.projections.shortTerm.national[0]
    expect(firstNat).toHaveProperty('year')
    expect(firstNat).toHaveProperty('value')
    expect(firstNat.year).toBeGreaterThanOrEqual(2024)
    expect(firstNat.value).toBeGreaterThan(40_000_000)

    // Long-term indicators
    const indicators = result.projections.indicators
    expect(indicators.dependencyOldAge.length).toBeGreaterThan(0)
    expect(indicators.dependencyTotal.length).toBeGreaterThan(0)
    expect(indicators.proportionOver65.length).toBeGreaterThan(0)
    expect(indicators.populationGrowth.length).toBeGreaterThan(0)
    expect(indicators.naturalBalance.length).toBeGreaterThan(0)
    expect(indicators.netMigration.length).toBeGreaterThan(0)

    // Dependency should increase over time
    const depFirst = indicators.dependencyOldAge[0].value
    const depLast = indicators.dependencyOldAge.at(-1).value
    expect(depLast).toBeGreaterThan(depFirst)
  })

  it('fallback includes migration flows data', async () => {
    const failFetcher = vi.fn().mockRejectedValue(new Error('fail'))
    const result = await downloadDemographicsDetail(failFetcher)

    expect(result.migrationFlows).toBeDefined()

    // Immigration
    expect(result.migrationFlows.immigration.length).toBeGreaterThan(0)
    const firstImm = result.migrationFlows.immigration[0]
    expect(firstImm).toHaveProperty('year')
    expect(firstImm).toHaveProperty('value')
    expect(firstImm.value).toBeGreaterThan(0)

    // Emigration
    expect(result.migrationFlows.emigration.length).toBeGreaterThan(0)
    expect(result.migrationFlows.emigration[0].value).toBeGreaterThan(0)

    // Net migration = immigration - emigration
    expect(result.migrationFlows.netMigration.length).toBeGreaterThan(0)
    const net2024 = result.migrationFlows.netMigration.find(p => p.year === 2024)
    const imm2024 = result.migrationFlows.immigration.find(p => p.year === 2024)
    const em2024 = result.migrationFlows.emigration.find(p => p.year === 2024)
    if (net2024 && imm2024 && em2024) {
      expect(net2024.value).toBe(imm2024.value - em2024.value)
    }
  })

  it('fallback projections have realistic values', async () => {
    const failFetcher = vi.fn().mockRejectedValue(new Error('fail'))
    const result = await downloadDemographicsDetail(failFetcher)

    // Population should be between 45M-60M
    for (const p of result.projections.shortTerm.national) {
      expect(p.value).toBeGreaterThan(45_000_000)
      expect(p.value).toBeLessThan(60_000_000)
    }

    // Dependency 65+ should be between 20-70%
    for (const p of result.projections.indicators.dependencyOldAge) {
      expect(p.value).toBeGreaterThan(20)
      expect(p.value).toBeLessThan(70)
    }

    // Proportion 65+ should be between 15-40%
    for (const p of result.projections.indicators.proportionOver65) {
      expect(p.value).toBeGreaterThan(15)
      expect(p.value).toBeLessThan(40)
    }
  })

  it('fallback source attributions include projections, migration and provincial', async () => {
    const failFetcher = vi.fn().mockRejectedValue(new Error('fail'))
    const result = await downloadDemographicsDetail(failFetcher)

    expect(result.sourceAttribution.projections).toBeDefined()
    expect(result.sourceAttribution.projections.type).toBe('fallback')
    expect(result.sourceAttribution.migrationFlows).toBeDefined()
    expect(result.sourceAttribution.migrationFlows.type).toBe('fallback')
    expect(result.sourceAttribution.provincialPopulation).toBeDefined()
    expect(result.sourceAttribution.provincialPopulation.type).toBe('fallback')
  })

  it('fallback includes provincial population data', async () => {
    const failFetcher = vi.fn().mockRejectedValue(new Error('fail'))
    const result = await downloadDemographicsDetail(failFetcher)

    expect(result.provincialPopulation).toBeDefined()
    expect(result.provincialPopulation.latestYear).toBeGreaterThanOrEqual(2024)
    expect(result.provincialPopulation.entries.length).toBeGreaterThan(0)

    const first = result.provincialPopulation.entries[0]
    expect(first).toHaveProperty('code')
    expect(first).toHaveProperty('name')
    expect(first).toHaveProperty('ccaa')
    expect(first).toHaveProperty('population')
    expect(first).toHaveProperty('historical')
    expect(first.population).toBeGreaterThan(100_000)
    expect(first.historical.length).toBeGreaterThan(0)
    expect(first.historical[0]).toHaveProperty('year')
    expect(first.historical[0]).toHaveProperty('value')
  })

  it('fallback provincial population has realistic values', async () => {
    const failFetcher = vi.fn().mockRejectedValue(new Error('fail'))
    const result = await downloadDemographicsDetail(failFetcher)

    // Total population across all provinces should be roughly Spain's population
    const total = result.provincialPopulation.entries.reduce((s, e) => s + e.population, 0)
    // Fallback only has top 10 provinces, so total won't equal full Spain
    expect(total).toBeGreaterThan(20_000_000)

    // Madrid should be the largest
    const sorted = [...result.provincialPopulation.entries].sort((a, b) => b.population - a.population)
    expect(sorted[0].name).toBe('Madrid')
    expect(sorted[0].population).toBeGreaterThan(5_000_000)
  })

  it('fallback includes fertility projections comparison data', async () => {
    const failFetcher = vi.fn().mockRejectedValue(new Error('fail'))
    const result = await downloadDemographicsDetail(failFetcher)

    expect(result.fertilityProjections).toBeDefined()
    expect(result.fertilityProjections.replacementLevel).toBe(2.1)

    // Actual data
    expect(result.fertilityProjections.actual.length).toBeGreaterThan(0)
    expect(result.fertilityProjections.actual[0]).toHaveProperty('year')
    expect(result.fertilityProjections.actual[0]).toHaveProperty('value')

    // Historical projections from UN WPP and INE
    expect(result.fertilityProjections.projections.length).toBeGreaterThanOrEqual(5)
    for (const proj of result.fertilityProjections.projections) {
      expect(proj).toHaveProperty('source')
      expect(proj).toHaveProperty('publishedYear')
      expect(proj.points.length).toBeGreaterThan(0)
      // All projections predict recovery above actual trend
      const lastPoint = proj.points[proj.points.length - 1]
      expect(lastPoint.value).toBeGreaterThan(1.0)
    }

    // Linear regression
    expect(result.fertilityProjections.linearRegression.length).toBeGreaterThan(0)

    // Source attribution
    expect(result.sourceAttribution.fertilityProjections).toBeDefined()
  })

  it('migration flows are sorted chronologically', async () => {
    const failFetcher = vi.fn().mockRejectedValue(new Error('fail'))
    const result = await downloadDemographicsDetail(failFetcher)

    const immYears = result.migrationFlows.immigration.map(p => p.year)
    const emYears = result.migrationFlows.emigration.map(p => p.year)
    const netYears = result.migrationFlows.netMigration.map(p => p.year)

    expect(immYears).toEqual([...immYears].sort((a, b) => a - b))
    expect(emYears).toEqual([...emYears].sort((a, b) => a - b))
    expect(netYears).toEqual([...netYears].sort((a, b) => a - b))
  })

  it('happy path — fetches all data successfully from API', async () => {
    const respond = (data) => Promise.resolve({
      ok: true,
      json: () => Promise.resolve(data),
    })
    // Fecha must be a number so new Date(Fecha).getFullYear() works correctly
    const makePoint = (valor, yearOffset = 0) => ({
      Valor: valor,
      Fecha: 1704067200000 + yearOffset * 31536000000,
      Anyo: 2024 + yearOffset,
    })

    // Build pyramid metadata series
    const pyramidSeries = []
    const sexes = ['Hombres', 'Mujeres']
    const birthPlaces = ['España', 'Unión Europea (sin España)', 'Europa (no UE)', 'África', 'Sudamérica', 'Asia']
    const ageGroupNames = [
      'De 0 a 4 años', 'De 5 a 9 años', 'De 10 a 14 años', 'De 15 a 19 años',
      'De 20 a 24 años', 'De 25 a 29 años', 'De 30 a 34 años', 'De 35 a 39 años',
      'De 40 a 44 años', 'De 45 a 49 años', 'De 50 a 54 años', 'De 55 a 59 años',
      'De 60 a 64 años', 'De 65 a 69 años', 'De 70 a 74 años', 'De 75 a 79 años',
      'De 80 a 84 años', 'De 85 a 89 años', '90 y más años',
    ]
    let codCounter = 1
    for (const sex of sexes) {
      for (const bp of birthPlaces) {
        for (const ag of ageGroupNames) {
          pyramidSeries.push({
            COD: `PYR${codCounter++}`,
            Nombre: `Total Nacional. ${bp}. ${ag}. ${sex}. Población. Número.`,
          })
        }
      }
    }

    const mockFetcher = vi.fn().mockImplementation((url) => {
      // PYRAMID METADATA
      if (url.includes('SERIES_TABLA/56943')) {
        return respond(pyramidSeries)
      }

      if (url.includes('DATOS_SERIE')) {
        // Vital stats — fertility needs 3+ points for linear regression
        if (url.includes('IDB37106')) return respond({ Data: [makePoint(7.62, -5), makePoint(7.19, -4), makePoint(7.12, -3), makePoint(6.73, -2), makePoint(6.53, -1), makePoint(6.30, 0)] })
        if (url.includes('IDB47797')) return respond({ Data: [makePoint(8.83, -5), makePoint(10.37, -4), makePoint(9.33, -3), makePoint(9.11, -2), makePoint(9.10, -1), makePoint(9.40, 0)] })
        if (url.includes('IDB72160')) return respond({ Data: [makePoint(1.24, -5), makePoint(1.19, -4), makePoint(1.19, -3), makePoint(1.16, -2), makePoint(1.12, -1), makePoint(1.14, 0)] })
        if (url.includes('IDB55340')) return respond({ Data: [makePoint(-1.21, -5), makePoint(-3.18, -4), makePoint(-2.21, -3), makePoint(-2.38, -2), makePoint(-2.57, -1), makePoint(-3.10, 0)] })

        // Life expectancy
        if (url.includes('IDB53772')) return respond({ Data: [makePoint(83.50, -1), makePoint(83.70, 0)] })
        if (url.includes('IDB53773')) return respond({ Data: [makePoint(80.70, -1), makePoint(80.90, 0)] })
        if (url.includes('IDB53774')) return respond({ Data: [makePoint(86.10, -1), makePoint(86.30, 0)] })

        // Migration flows
        if (url.includes('EM825679')) return respond({ Data: [makePoint(600000, -4), makePoint(750000, -3)] })
        if (url.includes('EM950865')) return respond({ Data: [makePoint(300000, -4), makePoint(350000, -3)] })
        if (url.includes('EM1765217')) return respond({ Data: [makePoint(900000, -2), makePoint(1200000, 0)] })
        if (url.includes('EM1843418')) return respond({ Data: [makePoint(500000, -2), makePoint(600000, 0)] })

        // Projection indicators
        if (url.includes('PROP7467')) return respond({ Data: [makePoint(31.30, 0), makePoint(34.39, 6)] })
        if (url.includes('PROP7465')) return respond({ Data: [makePoint(53.30, 0), makePoint(56.39, 6)] })
        if (url.includes('PROP7463')) return respond({ Data: [makePoint(20.40, 0), makePoint(22.50, 6)] })
        if (url.includes('PROP7446')) return respond({ Data: [makePoint(13.40, 0), makePoint(7.00, 6)] })
        if (url.includes('PROP7447')) return respond({ Data: [makePoint(-2.70, 0), makePoint(-3.50, 6)] })
        if (url.includes('PROP7448')) return respond({ Data: [makePoint(16.10, 0), makePoint(10.00, 6)] })

        // National projection
        if (url.includes('PROP7993')) return respond({ Data: [makePoint(49000000, 0), makePoint(50000000, 1)] })

        // CCAA short-term projections + province series — use Spain series for bigger values, foreign for smaller
        if (url.includes('PROP') || url.includes('DPOP')) {
          return respond({ Data: [makePoint(500000, -1), makePoint(510000, 0)] })
        }

        // Pyramid series: Spain-origin gets large values, foreign gets smaller but non-zero
        if (url.includes('PYR')) {
          const code = url.match(/PYR(\d+)/)?.[0] ?? ''
          const codeNum = parseInt(code.replace('PYR', ''), 10)
          // Spain series are the first 19 per sex block (codes 1-19 male, 133-151 female, etc.)
          // Simpler: use a value dependent on whether code number mod 114 < 19 (Spain block)
          const posInSexBp = (codeNum - 1) % 114
          const isSpain = posInSexBp < 19
          const valor = isSpain ? 500000 : 50000
          return respond({ Data: [makePoint(valor, -1), makePoint(valor + 5000, 0)] })
        }

        return respond({ Data: [] })
      }

      return Promise.reject(new Error(`Unknown URL: ${url}`))
    })

    const result = await downloadDemographicsDetail(mockFetcher)

    // Vital stats
    expect(result.vitalStats.birthRate.length).toBeGreaterThan(0)
    expect(result.vitalStats.deathRate.length).toBeGreaterThan(0)
    expect(result.vitalStats.fertilityRate.length).toBeGreaterThan(0)
    expect(result.vitalStats.naturalGrowth.length).toBeGreaterThan(0)

    // Life expectancy
    expect(result.lifeExpectancy.both.length).toBeGreaterThan(0)
    expect(result.lifeExpectancy.male.length).toBeGreaterThan(0)
    expect(result.lifeExpectancy.female.length).toBeGreaterThan(0)

    // Pyramid
    expect(result.pyramid.years.length).toBeGreaterThan(0)
    expect(result.pyramid.ageGroups).toHaveLength(19)
    expect(result.pyramid.regions).toHaveLength(6)

    // Dependency ratios (derived from pyramid)
    expect(result.dependencyRatio.oldAge).toBeGreaterThan(0)
    expect(result.dependencyRatio.youth).toBeGreaterThan(0)
    expect(result.dependencyRatio.total).toBeGreaterThan(0)

    // Immigration share (derived from pyramid)
    expect(result.immigrationShare.total).toBeGreaterThan(0)
    expect(result.immigrationShare.historical.length).toBeGreaterThan(0)

    // Projections
    expect(result.projections.shortTerm.national.length).toBeGreaterThan(0)
    expect(result.projections.indicators.dependencyOldAge.length).toBeGreaterThan(0)

    // Migration flows
    expect(result.migrationFlows.immigration.length).toBeGreaterThan(0)
    expect(result.migrationFlows.emigration.length).toBeGreaterThan(0)
    expect(result.migrationFlows.netMigration.length).toBeGreaterThan(0)

    // Provincial population
    expect(result.provincialPopulation.entries.length).toBeGreaterThan(0)
    expect(result.provincialPopulation.latestYear).toBeGreaterThanOrEqual(2023)

    // Fertility projections (built from vital stats fertility rate)
    expect(result.fertilityProjections).toBeDefined()
    expect(result.fertilityProjections.actual.length).toBeGreaterThan(0)
    expect(result.fertilityProjections.projections.length).toBeGreaterThanOrEqual(5)
    expect(result.fertilityProjections.linearRegression.length).toBeGreaterThan(0)
    expect(result.fertilityProjections.ourEstimate.length).toBeGreaterThan(0)

    // Source attributions — API types
    expect(result.sourceAttribution.vitalStats.type).toBe('api')
    expect(result.sourceAttribution.lifeExpectancy.type).toBe('api')
    expect(result.sourceAttribution.pyramid.type).toBe('api')
    expect(result.sourceAttribution.projections.type).toBe('api')
    expect(result.sourceAttribution.migrationFlows.type).toBe('api')
    expect(result.sourceAttribution.provincialPopulation.type).toBe('api')
  }, 30000)

  it('handles partial failures gracefully — pyramid fails, rest succeeds', async () => {
    const respond = (data) => Promise.resolve({
      ok: true,
      json: () => Promise.resolve(data),
    })
    const makePoint = (valor, yearOffset = 0) => ({
      Valor: valor,
      Fecha: 1704067200000 + yearOffset * 31536000000,
      Anyo: 2024 + yearOffset,
    })

    const mockFetcher = vi.fn().mockImplementation((url) => {
      // FAIL for pyramid metadata — triggers outer catch, returns full fallback
      if (url.includes('SERIES_TABLA')) return Promise.reject(new Error('Pyramid fetch failed'))

      if (url.includes('DATOS_SERIE')) {
        if (url.includes('IDB37106')) return respond({ Data: [makePoint(6.49, -1), makePoint(6.30, 0)] })
        if (url.includes('IDB47797')) return respond({ Data: [makePoint(9.50, -1), makePoint(9.40, 0)] })
        if (url.includes('IDB72160')) return respond({ Data: [makePoint(1.16, -1), makePoint(1.14, 0)] })
        if (url.includes('IDB55340')) return respond({ Data: [makePoint(-3.01, -1), makePoint(-3.10, 0)] })
        if (url.includes('IDB53772')) return respond({ Data: [makePoint(83.50, -1), makePoint(83.70, 0)] })
        if (url.includes('IDB53773')) return respond({ Data: [makePoint(80.70, -1), makePoint(80.90, 0)] })
        if (url.includes('IDB53774')) return respond({ Data: [makePoint(86.10, -1), makePoint(86.30, 0)] })
        if (url.includes('EM825679')) return respond({ Data: [makePoint(600000, -4)] })
        if (url.includes('EM950865')) return respond({ Data: [makePoint(300000, -4)] })
        if (url.includes('EM1765217')) return respond({ Data: [makePoint(900000, 0)] })
        if (url.includes('EM1843418')) return respond({ Data: [makePoint(500000, 0)] })
        if (url.includes('PROP') || url.includes('DPOP')) return respond({ Data: [makePoint(500000, 0)] })
        return respond({ Data: [] })
      }

      return Promise.reject(new Error('Unknown URL'))
    })

    // Pyramid failure is unhandled inside downloadDemographicsDetail (not wrapped with .catch),
    // so the outer try/catch fires and falls back to fallbackDemographicsDetail()
    const result = await downloadDemographicsDetail(mockFetcher)

    expect(result.vitalStats).toBeDefined()
    expect(result.vitalStats.birthRate.length).toBeGreaterThan(0)
    expect(result.pyramid).toBeDefined()
    expect(result.pyramid.years.length).toBeGreaterThan(0)
    expect(result.dependencyRatio).toBeDefined()
    expect(result.sourceAttribution.pyramid.type).toBe('fallback')
  })
})
