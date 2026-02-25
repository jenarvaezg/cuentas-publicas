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
});
