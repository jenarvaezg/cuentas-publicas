import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useData } from "@/hooks/useData";
import { BreakdownTooltip, HistoricalTooltip, RevenueBlock } from "../RevenueBlock";

vi.mock("@/hooks/useData", () => ({ useData: vi.fn() }));

let capturedBreakdownData: any[] = [];
let capturedHistoricalData: any[] = [];

vi.mock("recharts", async () => {
  const actual = await vi.importActual("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
    BarChart: ({ children, data }: any) => {
      capturedBreakdownData = data ?? [];
      return <div data-testid="bar-chart">{children}</div>;
    },
    AreaChart: ({ children, data }: any) => {
      capturedHistoricalData = data ?? [];
      return <div data-testid="area-chart">{children}</div>;
    },
    Bar: ({ children }: any) => <div>{children}</div>,
    Area: ({ dataKey }: any) => <div data-testid={`area-${String(dataKey)}`} />,
    CartesianGrid: () => null,
    Cell: () => null,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
  };
});

vi.mock("../StatCard", () => ({
  StatCard: ({ label, value, className, sources }: any) => (
    <div data-testid="stat-card">
      <span data-testid="stat-label">{label}</span>
      <span data-testid="stat-value">{value}</span>
      <span data-testid="stat-class">{className ?? ""}</span>
      <span data-testid="stat-source">{sources?.[0]?.name ?? ""}</span>
    </div>
  ),
}));

describe("RevenueBlock", () => {
  const mockRevenue = {
    years: [2023, 2024],
    latestYear: 2024,
    byYear: {
      "2024": {
        totalRevenue: 500000,
        totalExpenditure: 500000,
        balance: 0,
        taxesDirect: 180000,
        socialContributions: 140000,
        taxesIndirect: 120000,
        otherRevenue: 60000,
      },
      "2023": {
        totalRevenue: 600000,
        totalExpenditure: 550000,
        balance: 50000,
        taxesDirect: 220000,
        socialContributions: 160000,
        taxesIndirect: 140000,
        otherRevenue: 80000,
      },
    },
    sourceAttribution: {
      revenue: {
        source: "Eurostat",
        type: "api",
        url: "https://ec.europa.eu/eurostat/databrowser/view/gov_10a_main/",
        date: "2026-01-01",
      },
    },
  };

  beforeEach(() => {
    (useData as any).mockReturnValue({
      revenue: mockRevenue,
      demographics: { gdp: 2e12 },
    });
    capturedBreakdownData = [];
    capturedHistoricalData = [];
  });

  it("recalcula tarjetas y composición al cambiar de año", () => {
    render(<RevenueBlock />);
    expect(screen.getByText("Ingresos vs Gastos Públicos")).toBeDefined();

    expect(screen.getAllByTestId("stat-card")).toHaveLength(4);
    expect(screen.getByText("Superávit")).toBeInTheDocument();
    expect(screen.getByText(/25,0\s*%/)).toBeInTheDocument();

    expect(capturedBreakdownData.map((d) => d.key)).toEqual([
      "taxesDirect",
      "socialContributions",
      "taxesIndirect",
      "otherRevenue",
    ]);

    const select = screen.getByLabelText("Año") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "2023" } });
    expect(select.value).toBe("2023");
    expect(screen.getByText(/30,0\s*%/)).toBeInTheDocument();
    expect(screen.getByText("50,0 mm€")).toBeInTheDocument();
    expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
    expect(screen.getByTestId("area-chart")).toBeInTheDocument();
    expect(capturedHistoricalData).toHaveLength(2);
  });

  it("oculta breakdown e histórico cuando no hay datos útiles", () => {
    (useData as any).mockReturnValue({
      revenue: {
        years: [2024],
        latestYear: 2024,
        byYear: {
          "2024": {
            totalRevenue: 0,
            totalExpenditure: 100,
            balance: -100,
            taxesDirect: 0,
            socialContributions: 0,
            taxesIndirect: 0,
            otherRevenue: 0,
          },
        },
      },
      demographics: { gdp: 0 },
    });

    render(<RevenueBlock />);
    expect(screen.queryByTestId("bar-chart")).toBeNull();
    expect(screen.queryByTestId("area-chart")).toBeNull();
    expect(screen.getByText(/0,0\s*%/)).toBeInTheDocument();
  });

  it("usa fuente fallback de Eurostat cuando no hay sourceAttribution", () => {
    (useData as any).mockReturnValue({
      revenue: {
        years: [2024, 2023],
        latestYear: 2024,
        byYear: mockRevenue.byYear,
      },
      demographics: { gdp: 2e12 },
    });

    render(<RevenueBlock />);
    expect(screen.getAllByText("Eurostat — gov_10a_main")).toHaveLength(3);
  });

  it("tooltips muestran breakdown y saldo histórico correctamente", () => {
    const { rerender } = render(
      <BreakdownTooltip
        active
        payload={[
          {
            payload: {
              name: "Impuestos directos",
              key: "taxesDirect",
              amount: 220000,
              percentage: 36.67,
            },
          },
        ]}
      />,
    );

    expect(screen.getByText("Impuestos directos")).toBeInTheDocument();
    expect(screen.getByText(/220\.000 M€ \(36,7%\)/)).toBeInTheDocument();

    rerender(
      <HistoricalTooltip
        active
        label={2024}
        payload={[
          { dataKey: "ingresos", value: 500000, color: "green" },
          { dataKey: "gastos", value: 550000, color: "red" },
        ]}
      />,
    );
    expect(screen.getByText("Déficit: -50.000 M€")).toBeInTheDocument();

    rerender(
      <HistoricalTooltip
        active
        label={2023}
        payload={[
          { dataKey: "ingresos", value: 600000, color: "green" },
          { dataKey: "gastos", value: 550000, color: "red" },
        ]}
      />,
    );
    expect(screen.getByText("Superávit: 50.000 M€")).toBeInTheDocument();
  });
});
