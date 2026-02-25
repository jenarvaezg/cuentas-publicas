import { describe, expect, it } from "vitest";
import { calculatePersonalTax } from "@/utils/personalTaxCalculator";

// ── Constants mirrored from source for clarity ────────────────────────
const SS_WORKER_RATE = 0.0647;
const SS_MAX_BASE_ANNUAL = 56_646;

describe("calculatePersonalTax", () => {
  // ── Zero / edge cases ─────────────────────────────────────────────

  describe("zero salary", () => {
    it("returns zero totalPersonalTax for zero grossSalary", () => {
      const result = calculatePersonalTax({ grossSalary: 0 });
      expect(result.totalPersonalTax).toBe(0);
    });

    it("returns zero irpf for zero grossSalary", () => {
      const result = calculatePersonalTax({ grossSalary: 0 });
      expect(result.irpf.total).toBe(0);
    });

    it("returns zero effectiveRate for zero grossSalary (no division by zero)", () => {
      const result = calculatePersonalTax({ grossSalary: 0 });
      expect(result.irpf.effectiveRate).toBe(0);
    });

    it("returns zero netSalary for zero grossSalary", () => {
      const result = calculatePersonalTax({ grossSalary: 0 });
      expect(result.netSalary).toBe(0);
    });
  });

  describe("very low income (below minimum)", () => {
    it("returns zero irpf for 1000 grossSalary (below mínimo personal)", () => {
      const result = calculatePersonalTax({ grossSalary: 1_000 });
      expect(result.irpf.total).toBe(0);
    });

    it("returns positive SS worker for 1000 grossSalary", () => {
      const result = calculatePersonalTax({ grossSalary: 1_000 });
      expect(result.ss.worker).toBeCloseTo(1_000 * SS_WORKER_RATE, 5);
    });
  });

  // ── IRPF bracket boundary tests ───────────────────────────────────

  describe.each([
    { grossSalary: 12_450, label: "at first bracket ceiling (12450)" },
    { grossSalary: 20_200, label: "at second bracket ceiling (20200)" },
    { grossSalary: 35_200, label: "at third bracket ceiling (35200)" },
    { grossSalary: 60_000, label: "at fourth bracket ceiling (60000)" },
    { grossSalary: 300_000, label: "at fifth bracket ceiling (300000)" },
  ])("bracket boundary: $label", ({ grossSalary }) => {
    it("returns non-negative irpf total", () => {
      const result = calculatePersonalTax({ grossSalary });
      expect(result.irpf.total).toBeGreaterThanOrEqual(0);
    });

    it("effectiveRate is between 0 and 1", () => {
      const result = calculatePersonalTax({ grossSalary });
      expect(result.irpf.effectiveRate).toBeGreaterThanOrEqual(0);
      expect(result.irpf.effectiveRate).toBeLessThanOrEqual(1);
    });

    it("totalTax does not exceed grossSalary", () => {
      const result = calculatePersonalTax({ grossSalary });
      const totalTax = result.irpf.total + result.ss.worker;
      expect(totalTax).toBeLessThanOrEqual(grossSalary);
    });

    it("irpf state + ccaa portions sum to irpf total", () => {
      const result = calculatePersonalTax({ grossSalary });
      expect(result.irpf.statePortion + result.irpf.ccaaPortion).toBeCloseTo(result.irpf.total, 5);
    });

    it("brackets array is non-empty for taxable incomes", () => {
      const result = calculatePersonalTax({ grossSalary });
      // At these salaries baseLiquidable should be > 0 (at least beyond mínimo personal)
      // For very low incomes brackets may be empty if baseLiquidable <= 0
      if (result.irpf.baseLiquidable > 0) {
        expect(result.irpf.brackets.length).toBeGreaterThan(0);
      }
    });
  });

  // ── SS max base cap ───────────────────────────────────────────────

  describe("SS maximum base cap", () => {
    it("caps SS worker at SS_MAX_BASE_ANNUAL for salary at cap", () => {
      const result = calculatePersonalTax({ grossSalary: SS_MAX_BASE_ANNUAL });
      expect(result.ss.base).toBe(SS_MAX_BASE_ANNUAL);
      expect(result.ss.worker).toBeCloseTo(SS_MAX_BASE_ANNUAL * SS_WORKER_RATE, 5);
    });

    it("caps SS worker at SS_MAX_BASE_ANNUAL for salary above cap", () => {
      const result = calculatePersonalTax({ grossSalary: 100_000 });
      expect(result.ss.base).toBe(SS_MAX_BASE_ANNUAL);
      expect(result.ss.worker).toBeCloseTo(SS_MAX_BASE_ANNUAL * SS_WORKER_RATE, 5);
    });

    it("does not cap SS for salary below cap", () => {
      const result = calculatePersonalTax({ grossSalary: 30_000 });
      expect(result.ss.base).toBe(30_000);
    });
  });

  // ── workIncomeReduction middle branch ─────────────────────────────

  describe("workIncomeReduction middle branch (netWorkIncome between 14047.5 and 19747.5)", () => {
    // grossSalary around 16000-21000 puts netWorkIncome in the partial-reduction zone
    // netWorkIncome = grossSalary - ssWorker - 2000 (GASTOS_DEDUCIBLES)
    // For grossSalary ≈ 17000: netWorkIncome ≈ 17000 - 1099.9 - 2000 ≈ 13900 (just below boundary)
    // For grossSalary ≈ 18000: netWorkIncome ≈ 18000 - 1164.6 - 2000 ≈ 14835 (in middle branch)
    // For grossSalary ≈ 23000: netWorkIncome ≈ 23000 - 1488.1 - 2000 ≈ 19512 (near upper boundary)

    it("applies partial workIncomeReduction for salary that yields netWorkIncome ~14835", () => {
      const result = calculatePersonalTax({ grossSalary: 18_000 });
      // reduction < 6498 and > 0 means partial reduction was applied
      // baseLiquidable = netWorkIncome - reduction where 0 < reduction < 6498
      // We verify indirectly: baseLiquidable < netWorkIncome and baseLiquidable > netWorkIncome - 6498
      const netWorkIncome = Math.max(0, 18_000 - 18_000 * SS_WORKER_RATE - 2_000);
      const reduction = Math.max(0, 6_498 - 1.14 * (netWorkIncome - 14_047.5));
      expect(reduction).toBeGreaterThan(0);
      expect(reduction).toBeLessThan(6_498);
      expect(result.irpf.baseLiquidable).toBeCloseTo(Math.max(0, netWorkIncome - reduction), 0);
    });

    it("returns zero reduction for salary that puts netWorkIncome above 19747.5", () => {
      // grossSalary of 24000: netWorkIncome ≈ 24000 - 1552.8 - 2000 ≈ 20447 > 19747.5
      const gross = 24_000;
      const ssWorker = Math.min(gross, SS_MAX_BASE_ANNUAL) * SS_WORKER_RATE;
      const netWorkIncome = Math.max(0, gross - ssWorker - 2_000);
      expect(netWorkIncome).toBeGreaterThan(19_747.5);
      const result = calculatePersonalTax({ grossSalary: gross });
      // When reduction = 0, baseLiquidable = netWorkIncome
      expect(result.irpf.baseLiquidable).toBeCloseTo(netWorkIncome, 0);
    });

    it("applies max reduction (6498) for salary that puts netWorkIncome <= 14047.5", () => {
      // grossSalary of 17000: netWorkIncome ≈ 17000 - 1099.9 - 2000 ≈ 13900
      const gross = 17_000;
      const ssWorker = Math.min(gross, SS_MAX_BASE_ANNUAL) * SS_WORKER_RATE;
      const netWorkIncome = Math.max(0, gross - ssWorker - 2_000);
      expect(netWorkIncome).toBeLessThanOrEqual(14_047.5);
      const result = calculatePersonalTax({ grossSalary: gross });
      // With max reduction: baseLiquidable = max(0, netWorkIncome - 6498)
      expect(result.irpf.baseLiquidable).toBeCloseTo(Math.max(0, netWorkIncome - 6_498), 0);
    });
  });

  // ── Custom monthlySpending parameter ─────────────────────────────

  describe("custom monthlySpending", () => {
    it("uses provided monthlySpending instead of default ratio", () => {
      const result = calculatePersonalTax({ grossSalary: 40_000, monthlySpending: 1_000 });
      expect(result.iva.monthlySpending).toBe(1_000);
    });

    it("computes IVA from annual spending derived from custom monthlySpending", () => {
      const monthlySpending = 1_500;
      const result = calculatePersonalTax({ grossSalary: 40_000, monthlySpending });
      const annualSpending = monthlySpending * 12;
      const expectedIva = annualSpending * (0.15 / 1.15);
      expect(result.iva.estimated).toBeCloseTo(expectedIva, 2);
    });
  });

  // ── Default spending ratio ────────────────────────────────────────

  describe("default spending ratio (70%)", () => {
    it("uses 70% of netSalary / 12 as monthlySpending when not provided", () => {
      const result = calculatePersonalTax({ grossSalary: 40_000 });
      const expectedMonthly = (result.netSalary * 0.7) / 12;
      expect(result.iva.monthlySpending).toBeCloseTo(expectedMonthly, 5);
    });

    it("IVA estimated is positive when netSalary > 0", () => {
      const result = calculatePersonalTax({ grossSalary: 40_000 });
      expect(result.iva.estimated).toBeGreaterThan(0);
    });
  });

  // ── invariant assertions across a range of salaries ──────────────

  describe.each([
    { grossSalary: 0 },
    { grossSalary: 1_000 },
    { grossSalary: 12_450 },
    { grossSalary: 20_200 },
    { grossSalary: 35_200 },
    { grossSalary: 40_000 },
    { grossSalary: 56_646 },
    { grossSalary: 60_000 },
    { grossSalary: 80_000 },
    { grossSalary: 300_000 },
    { grossSalary: 500_000 },
  ])("invariants for grossSalary=$grossSalary", ({ grossSalary }) => {
    it("effectiveRate is between 0 and 1", () => {
      const { irpf } = calculatePersonalTax({ grossSalary });
      expect(irpf.effectiveRate).toBeGreaterThanOrEqual(0);
      expect(irpf.effectiveRate).toBeLessThanOrEqual(1);
    });

    it("irpf.total + ss.worker does not exceed grossSalary", () => {
      const result = calculatePersonalTax({ grossSalary });
      expect(result.irpf.total + result.ss.worker).toBeLessThanOrEqual(grossSalary + 0.01);
    });

    it("netSalary equals grossSalary - irpf.total - ss.worker", () => {
      const result = calculatePersonalTax({ grossSalary });
      expect(result.netSalary).toBeCloseTo(grossSalary - result.irpf.total - result.ss.worker, 5);
    });

    it("totalPersonalTax equals irpf.total + ss.worker + iva.estimated", () => {
      const result = calculatePersonalTax({ grossSalary });
      expect(result.totalPersonalTax).toBeCloseTo(
        result.irpf.total + result.ss.worker + result.iva.estimated,
        5,
      );
    });

    it("totalWithEmployer equals totalPersonalTax + ss.employer", () => {
      const result = calculatePersonalTax({ grossSalary });
      expect(result.totalWithEmployer).toBeCloseTo(result.totalPersonalTax + result.ss.employer, 5);
    });

    it("irpf state + ccaa = irpf total", () => {
      const { irpf } = calculatePersonalTax({ grossSalary });
      expect(irpf.statePortion + irpf.ccaaPortion).toBeCloseTo(irpf.total, 5);
    });

    it("irpf.baseLiquidable is non-negative", () => {
      const { irpf } = calculatePersonalTax({ grossSalary });
      expect(irpf.baseLiquidable).toBeGreaterThanOrEqual(0);
    });
  });

  // ── Bracket breakdown structure ───────────────────────────────────

  describe("irpf bracket breakdown", () => {
    it("each bracket tax equals taxableAmount * rate", () => {
      const result = calculatePersonalTax({ grossSalary: 50_000 });
      for (const bracket of result.irpf.brackets) {
        expect(bracket.tax).toBeCloseTo(bracket.taxableAmount * bracket.rate, 5);
      }
    });

    it("sum of bracket taxes equals irpf total before mínimo personal deduction (gross check)", () => {
      const result = calculatePersonalTax({ grossSalary: 50_000 });
      const sumBrackets = result.irpf.brackets.reduce((s, b) => s + b.tax, 0);
      // sumBrackets = tax on baseLiquidable; irpf.total = max(0, sumBrackets - taxOnMinimo)
      expect(sumBrackets).toBeGreaterThanOrEqual(result.irpf.total);
    });

    it("returns empty brackets array when irpf baseLiquidable is 0", () => {
      // grossSalary 0 → baseLiquidable 0 → no brackets
      const result = calculatePersonalTax({ grossSalary: 0 });
      expect(result.irpf.brackets).toHaveLength(0);
    });

    it("brackets rates are monotonically non-decreasing", () => {
      const result = calculatePersonalTax({ grossSalary: 500_000 });
      const rates = result.irpf.brackets.map((b) => b.rate);
      for (let i = 1; i < rates.length; i++) {
        expect(rates[i]).toBeGreaterThanOrEqual(rates[i - 1]);
      }
    });
  });
});
