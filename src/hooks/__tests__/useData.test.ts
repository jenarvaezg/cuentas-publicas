import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useData } from "../useData";

describe("useData", () => {
  it("returns all data objects", () => {
    const { result } = renderHook(() => useData());

    expect(result.current.debt).toBeDefined();
    expect(result.current.pensions).toBeDefined();
    expect(result.current.demographics).toBeDefined();
    expect(result.current.budget).toBeDefined();
    expect(result.current.eurostat).toBeDefined();
    expect(result.current.ccaaDebt).toBeDefined();
    expect(result.current.ccaaFiscalBalance).toBeDefined();
    expect(result.current.ccaaForalFlows).toBeDefined();
    expect(result.current.ccaaSpending).toBeDefined();
    expect(result.current.revenue).toBeDefined();
    expect(result.current.taxRevenue).toBeDefined();
    expect(result.current.meta).toBeDefined();
  });

  it("debt object has required shape fields", () => {
    const { result } = renderHook(() => useData());
    const { debt } = result.current;
    expect(typeof debt.current.totalDebt).toBe("number");
    expect(typeof debt.current.debtToGDP).toBe("number");
    expect(typeof debt.regression.slope).toBe("number");
    expect(typeof debt.regression.intercept).toBe("number");
    expect(typeof debt.regression.debtPerSecond).toBe("number");
    expect(Array.isArray(debt.historical)).toBe(true);
  });

  it("pensions object has required shape fields", () => {
    const { result } = renderHook(() => useData());
    const { pensions } = result.current;
    expect(typeof pensions.current.monthlyPayroll).toBe("number");
    expect(typeof pensions.current.totalPensions).toBe("number");
    expect(typeof pensions.current.expensePerSecond).toBe("number");
    expect(typeof pensions.regression.slope).toBe("number");
    expect(Array.isArray(pensions.historical)).toBe(true);
  });

  it("returns the same object reference on every render (memoization)", () => {
    const { result, rerender } = renderHook(() => useData());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it("debt.current.totalDebt is a positive number", () => {
    const { result } = renderHook(() => useData());
    expect(result.current.debt.current.totalDebt).toBeGreaterThan(0);
  });

  it("pensions.current.totalPensions is a positive number", () => {
    const { result } = renderHook(() => useData());
    expect(result.current.pensions.current.totalPensions).toBeGreaterThan(0);
  });

  it("ccaaFiscalBalance injects foral entries for overlapping years", () => {
    const { result } = renderHook(() => useData());
    const { ccaaFiscalBalance, ccaaForalFlows } = result.current;

    // Find years that exist in both datasets
    const fbYears = Object.keys(ccaaFiscalBalance.byYear);
    const foralYears = Object.keys(ccaaForalFlows.byYear);
    const commonYears = fbYears.filter((y) => foralYears.includes(y));

    if (commonYears.length > 0) {
      // When there's overlap, foral entries should be injected
      const year = commonYears[0];
      const entries = ccaaFiscalBalance.byYear[year].entries;
      const foralCodes = new Set(ccaaForalFlows.byYear[year].entries.map((e) => e.code));
      const foralEntries = entries.filter((e) => foralCodes.has(e.code));

      expect(foralEntries.length).toBeGreaterThan(0);
      for (const entry of foralEntries) {
        expect(entry.cededTaxes).toBe(0);
        expect(entry.transfers).toBe(0);
        expect(entry.transferToTaxRatio).toBeNull();
      }
    } else {
      // No overlap — foral injection doesn't apply, data passes through unchanged
      expect(fbYears.length).toBeGreaterThan(0);
      expect(foralYears.length).toBeGreaterThan(0);
    }
  });

  it("ccaaFiscalBalance entries are sorted by code", () => {
    const { result } = renderHook(() => useData());
    const { ccaaFiscalBalance, ccaaForalFlows } = result.current;
    const latestYear = String(ccaaForalFlows.latestYear);
    const entries = ccaaFiscalBalance.byYear[latestYear]?.entries ?? [];

    for (let i = 1; i < entries.length; i++) {
      expect(entries[i].code.localeCompare(entries[i - 1].code)).toBeGreaterThanOrEqual(0);
    }
  });

  it("all expected data fields are present", () => {
    const { result } = renderHook(() => useData());
    expect(result.current.ccaaDeficit).toBeDefined();
    expect(result.current.flows).toBeDefined();
    expect(result.current.ssSustainability).toBeDefined();
    expect(result.current.socialEconomy).toBeDefined();
    expect(result.current.livingConditions).toBeDefined();
    expect(result.current.unemploymentRegional).toBeDefined();
    expect(result.current.pensionsRegional).toBeDefined();
    expect(result.current.regionalAccounts).toBeDefined();
  });
});
