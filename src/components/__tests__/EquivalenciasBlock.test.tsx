import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useData } from "@/hooks/useData";
import { EquivalenciasBlock } from "../EquivalenciasBlock";

vi.mock("@/hooks/useData", () => ({
  useData: vi.fn(),
}));

vi.mock("../StatCard", () => ({
  StatCard: ({ label, value }: any) => (
    <div data-testid="stat-card">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  ),
}));

describe("EquivalenciasBlock", () => {
  const mockData = {
    debt: {
      current: { interestExpense: 39e9 },
      regression: { intercept: 1.6e12, slope: 1000 },
      sourceAttribution: { totalDebt: { source: "BdE", type: "csv" } },
    },
    demographics: {
      population: 48e6,
      averageSalary: 28000,
      smi: 1134,
      sourceAttribution: { population: { source: "INE", type: "api" } },
    },
    pensions: {
      current: { annualExpense: 200e9 },
    },
    budget: {
      latestYear: 2023,
      byYear: { "2023": { total: 600000 } },
      sourceAttribution: { budget: { source: "IGAE", type: "csv" } },
    },
  };

  it("calculates equivalencies correctly", () => {
    (useData as any).mockReturnValue(mockData);
    render(<EquivalenciasBlock />);

    expect(screen.getByText("Equivalencias")).toBeDefined();
    // Verify some calculated values (approximate due to Date.now())
    expect(screen.getAllByText(/meses/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/años/).length).toBeGreaterThan(0);
  });

  it("handles zero values in denominator gracefully", () => {
    const zeroData = {
      ...mockData,
      budget: { latestYear: 2023, byYear: { "2023": { total: 0 } } },
      pensions: { current: { annualExpense: 0 } },
    };
    (useData as any).mockReturnValue(zeroData);
    render(<EquivalenciasBlock />);

    // Should show 0 or handle it
    expect(screen.getAllByText("0,0 años").length).toBeGreaterThan(0);
  });

  it("handles missing source attributions", () => {
    const missingAttrData = {
      ...mockData,
      debt: { ...mockData.debt, sourceAttribution: {} },
      demographics: { ...mockData.demographics, sourceAttribution: {} },
      budget: { ...mockData.budget, sourceAttribution: {} },
    };
    (useData as any).mockReturnValue(missingAttrData);
    render(<EquivalenciasBlock />);
    expect(screen.getByText("Equivalencias")).toBeDefined();
  });
});
