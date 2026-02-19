import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useData } from "@/hooks/useData";
import { PensionsBlock } from "../PensionsBlock";

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

vi.mock("../RealtimeCounter", () => ({
  RealtimeCounter: ({ perSecond }: any) => <div data-testid="realtime-counter">{perSecond}</div>,
}));

describe("PensionsBlock", () => {
  const mockData = {
    pensions: {
      lastUpdated: "2024-01-01T00:00:00Z",
      current: {
        expensePerSecond: 5000,
        annualExpense: 200e9,
        monthlyPayroll: 14e9,
        contributoryDeficit: 30e9,
        contributorsPerPensioner: 2.1,
        averagePensionRetirement: 1500,
        reserveFund: 2e9,
        totalPensions: 10e6,
      },
      historical: [{ date: "2023-01-01", monthlyPayroll: 13e9 }],
      sourceAttribution: {
        monthlyPayroll: { source: "SS", type: "csv" },
        totalPensions: { source: "SS", type: "csv" },
        affiliates: { source: "SS", type: "csv" },
        socialContributions: { source: "PGE", type: "fallback" },
      },
    },
    demographics: {
      gdp: 1.6e12,
      lastUpdated: "2024-01-01T00:00:00Z",
    },
  };

  it("renders with full data correctly", () => {
    (useData as any).mockReturnValue(mockData);
    render(<PensionsBlock />);

    expect(screen.getByText("Pensiones y Seguridad Social")).toBeDefined();
    expect(screen.getByTestId("realtime-counter")).toBeDefined();
    expect(screen.getByText("Nómina mensual total")).toBeDefined();
    expect(screen.getByText("Déficit contributivo")).toBeDefined();
  });

  it("handles missing source attributions", () => {
    const missingAttrData = {
      ...mockData,
      pensions: { ...mockData.pensions, sourceAttribution: {} },
    };
    (useData as any).mockReturnValue(missingAttrData);
    render(<PensionsBlock />);
    expect(screen.getByText("Pensiones y Seguridad Social")).toBeDefined();
  });
});
