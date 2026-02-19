import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useData } from "@/hooks/useData";
import { DebtBlock } from "../DebtBlock";

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
  RealtimeCounter: ({ baseValue }: any) => <div data-testid="realtime-counter">{baseValue}</div>,
}));

describe("DebtBlock", () => {
  const mockData = {
    debt: {
      current: {
        debtToGDP: 107.7,
        yearOverYearChange: 2.1,
        debtBySubsector: { estado: 1.2e12, ccaa: 3e11, ccll: 2e10, ss: 4e10 },
      },
      regression: { intercept: 1.6e12, slope: 1000, debtPerSecond: 1000 },
      historical: [
        { date: "2023-01-01", totalDebt: 1.5e12 },
        { date: "2024-01-01", totalDebt: 1.6e12 },
      ],
      sourceAttribution: { totalDebt: { source: "BdE", type: "csv" } },
    },
    demographics: {
      population: 48e6,
      activePopulation: 24e6,
      lastUpdated: "2024-01-01T00:00:00Z",
    },
  };

  it("renders with full data correctly", () => {
    (useData as any).mockReturnValue(mockData);
    render(<DebtBlock />);

    expect(screen.getByText("Deuda Pública (PDE)")).toBeDefined();
    expect(screen.getByTestId("realtime-counter")).toBeDefined();
    expect(screen.getByText("Deuda per cápita")).toBeDefined();
    expect(screen.getByText("Deuda CCAA")).toBeDefined();
  });

  it("handles empty historical data", () => {
    const emptyData = {
      ...mockData,
      debt: { ...mockData.debt, historical: [], sourceAttribution: {} },
    };
    (useData as any).mockReturnValue(emptyData);
    render(<DebtBlock />);

    expect(screen.getByText(/último dato: N\/D/)).toBeDefined();
  });
});
