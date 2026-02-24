import { describe, it, expect } from "vitest";
import { enrichPensionWithSustainability } from "../sources/seguridad-social.mjs";

function makePensionData(overrides = {}) {
  return {
    lastUpdated: "2026-02-24T00:00:00.000Z",
    pipeline: { liveDataUsed: true, criticalFallback: false, fallbackReason: null },
    current: {
      monthlyPayroll: 15_910_000_000,
      monthlyPayrollSS: 14_251_000_000,
      monthlyPayrollClasesPasivas: 1_659_000_000,
      annualExpense: 222_740_000_000,
      totalPensions: 10_452_674,
      averagePensionRetirement: 1_563.56,
      affiliates: 21_300_000,
      pensioners: 10_452_674,
      contributorsPerPensioner: 2.038,
      expensePerSecond: 7_061,
      socialContributions: 210_000_000_000,
      contributoryDeficit: 12_740_000_000,
      reserveFund: 7_500_000_000,
      cumulativeDeficit: { base: 300_000_000_000, baseDate: "2026-01-01" },
      ...overrides,
    },
    historical: [],
    regression: { slope: 0, intercept: 0, lastDataTimestamp: 0, expensePerSecond: 0 },
    sourceAttribution: {
      monthlyPayroll: { source: "SS", type: "csv" },
      socialContributions: { source: "PGE", type: "fallback" },
      reserveFund: { source: "Estimación", type: "fallback" },
      affiliates: { source: "Estimación", type: "fallback" },
      contributorsPerPensioner: { source: "Derivado", type: "derived" },
      contributoryDeficit: { source: "Derivado", type: "derived" },
    },
  };
}

function makeSustainabilityData(overrides = {}) {
  return {
    lastUpdated: "2026-02-24T00:00:00.000Z",
    latestYear: 2024,
    years: [2020, 2021, 2022, 2023, 2024],
    byYear: {
      2024: { socialContributions: 210337, pensionExpenditure: 167000, ssBalance: 43337, pensionToGDP: 11.6 },
    },
    reserveFund: [
      { year: 2023, balance: 4365 },
      { year: 2024, balance: 5803 },
      { year: 2025, balance: 7500 },
    ],
    contributorsPerPensioner: [
      { year: 2024, ratio: 2.23 },
      { year: 2025, ratio: 2.20 },
    ],
    ...overrides,
  };
}

describe("enrichPensionWithSustainability", () => {
  it("enriches pension data with sustainability values", () => {
    const pension = makePensionData();
    const sustainability = makeSustainabilityData();

    const result = enrichPensionWithSustainability(pension, sustainability);

    // socialContributions: 210337 M€ → 210_337_000_000 €
    expect(result.current.socialContributions).toBe(210_337_000_000);
    // reserveFund: latest entry 7500 M€ → 7_500_000_000 €
    expect(result.current.reserveFund).toBe(7_500_000_000);
    // affiliates: ratio 2.20 × 10_452_674 pensioners
    expect(result.current.affiliates).toBe(Math.round(2.20 * 10_452_674));
    // contributorsPerPensioner recalculated
    expect(result.current.contributorsPerPensioner).toBeCloseTo(2.20, 1);
    // contributoryDeficit recalculated
    expect(result.current.contributoryDeficit).toBe(
      result.current.annualExpense - result.current.socialContributions,
    );

    // Source attributions updated to cross-reference
    expect(result.sourceAttribution.socialContributions.type).toBe("cross-reference");
    expect(result.sourceAttribution.reserveFund.type).toBe("cross-reference");
    expect(result.sourceAttribution.affiliates.type).toBe("cross-reference");
    expect(result.sourceAttribution.contributorsPerPensioner.type).toBe("cross-reference");
  });

  it("does not mutate original pension data", () => {
    const pension = makePensionData();
    const sustainability = makeSustainabilityData();
    const originalSC = pension.current.socialContributions;

    enrichPensionWithSustainability(pension, sustainability);

    expect(pension.current.socialContributions).toBe(originalSC);
    expect(pension.sourceAttribution.socialContributions.type).toBe("fallback");
  });

  it("returns pensionData unchanged when sustainabilityData is null", () => {
    const pension = makePensionData();
    const result = enrichPensionWithSustainability(pension, null);

    expect(result).toBe(pension);
  });

  it("returns pensionData unchanged when pensionData is null", () => {
    const sustainability = makeSustainabilityData();
    const result = enrichPensionWithSustainability(null, sustainability);

    expect(result).toBeNull();
  });

  it("falls back to pension defaults when yearData is missing for latestYear", () => {
    const pension = makePensionData();
    const sustainability = makeSustainabilityData({ byYear: {} });

    const result = enrichPensionWithSustainability(pension, sustainability);

    // socialContributions falls back to pension value
    expect(result.current.socialContributions).toBe(pension.current.socialContributions);
    // reserveFund and affiliates still enriched (they don't depend on byYear)
    expect(result.current.reserveFund).toBe(7_500_000_000);
    expect(result.sourceAttribution.socialContributions.type).toBe("fallback");
    expect(result.sourceAttribution.reserveFund.type).toBe("cross-reference");
  });

  it("falls back when reserveFund array is empty", () => {
    const pension = makePensionData();
    const sustainability = makeSustainabilityData({ reserveFund: [] });

    const result = enrichPensionWithSustainability(pension, sustainability);

    expect(result.current.reserveFund).toBe(pension.current.reserveFund);
    expect(result.sourceAttribution.reserveFund.type).toBe("fallback");
  });

  it("falls back when contributorsPerPensioner array is empty", () => {
    const pension = makePensionData();
    const sustainability = makeSustainabilityData({ contributorsPerPensioner: [] });

    const result = enrichPensionWithSustainability(pension, sustainability);

    expect(result.current.affiliates).toBe(pension.current.affiliates);
    expect(result.sourceAttribution.affiliates.type).toBe("fallback");
    expect(result.sourceAttribution.contributorsPerPensioner.type).toBe("derived");
  });

  it("handles zero socialContributions in sustainability data correctly", () => {
    const pension = makePensionData();
    const sustainability = makeSustainabilityData({
      byYear: { 2024: { socialContributions: 0, pensionExpenditure: 0, ssBalance: 0, pensionToGDP: 0 } },
    });

    const result = enrichPensionWithSustainability(pension, sustainability);

    // Should use 0 (explicit value), not fall back
    expect(result.current.socialContributions).toBe(0);
    expect(result.sourceAttribution.socialContributions.type).toBe("cross-reference");
  });

  it("preserves unrelated fields from original pension data", () => {
    const pension = makePensionData();
    const sustainability = makeSustainabilityData();

    const result = enrichPensionWithSustainability(pension, sustainability);

    expect(result.lastUpdated).toBe(pension.lastUpdated);
    expect(result.pipeline).toEqual(pension.pipeline);
    expect(result.current.monthlyPayroll).toBe(pension.current.monthlyPayroll);
    expect(result.current.totalPensions).toBe(pension.current.totalPensions);
    expect(result.current.cumulativeDeficit).toEqual(pension.current.cumulativeDeficit);
    expect(result.sourceAttribution.monthlyPayroll.type).toBe("csv");
  });
});
