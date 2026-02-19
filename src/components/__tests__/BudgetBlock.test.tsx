import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useData } from "@/hooks/useData";
import { useDeflator } from "@/hooks/useDeflator";
import { BudgetBlock } from "../BudgetBlock";

vi.mock("@/hooks/useData", () => ({ useData: vi.fn() }));
vi.mock("@/hooks/useDeflator", () => ({ useDeflator: vi.fn() }));

vi.mock("../StatCard", () => ({
  StatCard: ({ label, value }: any) => (
    <div data-testid="stat-card">
      {label}: {value}
    </div>
  ),
}));

vi.mock("../BudgetChart", () => ({
  BudgetChart: ({ onDrilldown }: any) => (
    <div data-testid="budget-chart">
      <button type="button" onClick={() => onDrilldown("01")}>
        Drilldown
      </button>
    </div>
  ),
}));

describe("BudgetBlock", () => {
  const mockBudget = {
    years: [2022, 2023],
    latestYear: 2023,
    byYear: {
      "2023": {
        total: 600000,
        categories: [
          {
            code: "01",
            name: "Gen",
            amount: 100000,
            percentage: 16.6,
            children: [{ code: "01.1", name: "Sub", amount: 50000 }],
          },
        ],
      },
      "2022": {
        total: 500000,
        categories: [{ code: "01", name: "Gen", amount: 90000, percentage: 18 }],
      },
    },
    sourceAttribution: { budget: { source: "IGAE", type: "csv" } },
  };

  const mockDeflator = {
    deflate: vi.fn((amt) => amt * 1.1),
    baseYear: 2024,
    available: true,
  };

  beforeEach(() => {
    vi.resetAllMocks();
    (useData as any).mockReturnValue({
      budget: mockBudget,
      demographics: { population: 48e6, gdp: 1.6e12 },
    });
    (useDeflator as any).mockReturnValue(mockDeflator);
  });

  it("renders and handles year change", () => {
    render(<BudgetBlock />);
    expect(screen.getByText(/Gasto Público por Funciones/)).toBeDefined();

    const select = screen.getByLabelText("Año") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "2022" } });
    expect(select.value).toBe("2022");
  });

  it("handles comparison and real terms toggle", () => {
    render(<BudgetBlock />);

    const compareSelect = screen.getByLabelText("Comparar") as HTMLSelectElement;
    fireEvent.change(compareSelect, { target: { value: "2022" } });

    // Toggle to real terms (default is true if available)
    const realBtn = screen.getByText("€ reales");
    fireEvent.click(realBtn);
    expect(mockDeflator.deflate).toHaveBeenCalled();

    const currBtn = screen.getByText("€ corrientes");
    fireEvent.click(currBtn);
    // Should stop deflating
  });

  it("handles compare mode changes", () => {
    render(<BudgetBlock />);
    fireEvent.change(screen.getByLabelText("Comparar"), {
      target: { value: "2022" },
    });

    const weightBtn = screen.getByText("% peso");
    fireEvent.click(weightBtn);
    expect(weightBtn.className).toContain("bg-primary");
  });

  it("handles drilldown", () => {
    render(<BudgetBlock />);
    const drillBtn = screen.getByText("Drilldown");
    fireEvent.click(drillBtn);
    // Should not crash, internal state updated
  });

  it("handles missing data for selected year", () => {
    (useData as any).mockReturnValue({
      budget: { ...mockBudget, byYear: {} },
      demographics: { population: 48e6, gdp: 1.6e12 },
    });
    render(<BudgetBlock />);
    expect(screen.queryByTestId("budget-chart")).toBeNull();
  });
});
