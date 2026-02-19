import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useData } from "@/hooks/useData";
import { DebtCostBlock } from "../DebtCostBlock";

vi.mock("@/hooks/useData", () => ({ useData: vi.fn() }));

vi.mock("../StatCard", () => ({
  StatCard: ({ label, value }: any) => (
    <div data-testid="stat-card">
      {label}: {value}
    </div>
  ),
}));

vi.mock("../RealtimeCounter", () => ({
  RealtimeCounter: ({ perSecond }: any) => <div data-testid="realtime-counter">{perSecond}</div>,
}));

describe("DebtCostBlock", () => {
  const mockDebt = {
    current: { interestExpense: 39e9 },
    regression: { intercept: 1.6e12, slope: 1000 },
    sourceAttribution: {
      interestExpense: { source: "PGE", type: "fallback" },
      totalDebt: { source: "BdE", type: "csv" },
    },
  };

  it("renders correctly", () => {
    (useData as any).mockReturnValue({ debt: mockDebt });
    render(<DebtCostBlock />);
    expect(screen.getByText("Coste de la Deuda")).toBeDefined();
    expect(screen.getByTestId("realtime-counter")).toBeDefined();
  });

  it("handles missing attributions", () => {
    (useData as any).mockReturnValue({
      debt: { ...mockDebt, sourceAttribution: {} },
    });
    render(<DebtCostBlock />);
    expect(screen.getByText("Coste de la Deuda")).toBeDefined();
  });
});
