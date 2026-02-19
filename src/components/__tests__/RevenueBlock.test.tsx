import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useData } from "@/hooks/useData";
import { RevenueBlock } from "../RevenueBlock";

vi.mock("@/hooks/useData", () => ({ useData: vi.fn() }));

vi.mock("recharts", async () => {
  const actual = await vi.importActual("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
    BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
    AreaChart: ({ children }: any) => <div data-testid="area-chart">{children}</div>,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
  };
});

vi.mock("../StatCard", () => ({
  StatCard: ({ label, value }: any) => (
    <div data-testid="stat-card">
      {label}: {value}
    </div>
  ),
}));

describe("RevenueBlock", () => {
  const mockRevenue = {
    years: [2022, 2023],
    latestYear: 2023,
    byYear: {
      "2023": {
        totalRevenue: 500000,
        totalExpenditure: 550000,
        balance: -50000,
        taxesDirect: 150000,
        socialContributions: 150000,
        taxesIndirect: 150000,
        otherRevenue: 50000,
      },
      "2022": {
        totalRevenue: 480000,
        totalExpenditure: 500000,
        balance: -20000,
        taxesDirect: 140000,
        socialContributions: 140000,
        taxesIndirect: 140000,
        otherRevenue: 60000,
      },
    },
  };

  beforeEach(() => {
    (useData as any).mockReturnValue({
      revenue: mockRevenue,
      demographics: { gdp: 1.6e12 },
    });
  });

  it("renders correctly and handles year change", () => {
    render(<RevenueBlock />);
    expect(screen.getByText("Ingresos vs Gastos Públicos")).toBeDefined();

    const select = screen.getByLabelText("Año") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "2022" } });
    expect(select.value).toBe("2022");
  });
});
