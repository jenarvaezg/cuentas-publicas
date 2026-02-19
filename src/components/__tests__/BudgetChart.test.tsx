import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BudgetChart } from "../BudgetChart";

vi.mock("recharts", async () => {
  const actual = await vi.importActual("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
    BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
    Bar: ({ onClick }: any) => (
      <button type="button" data-testid="bar" onClick={() => onClick?.({ code: "01" })}>
        bar mock
      </button>
    ),
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
    Cell: () => null,
    ReferenceLine: () => null,
  };
});

describe("BudgetChart", () => {
  const mockCategories = [
    {
      code: "01",
      name: "General",
      amount: 100,
      percentage: 10,
      children: [{ code: "01.1", name: "Sub", amount: 50, percentage: 5 }],
    },
  ];

  it("renders correctly and handles drilldown click", () => {
    const onDrilldown = vi.fn();
    render(
      <BudgetChart
        categories={mockCategories}
        selectedYear={2023}
        drilldownCategory={null}
        onDrilldown={onDrilldown}
        compareMode="absoluto"
      />,
    );

    expect(screen.getByTestId("bar-chart")).toBeDefined();
    const bar = screen.getByTestId("bar");
    fireEvent.click(bar);
    expect(onDrilldown).toHaveBeenCalledWith("01");
  });

  it("renders breadcrumb and allows going back", () => {
    const onDrilldown = vi.fn();
    render(
      <BudgetChart
        categories={mockCategories}
        selectedYear={2023}
        drilldownCategory="01"
        onDrilldown={onDrilldown}
        compareMode="absoluto"
      />,
    );

    expect(screen.getByText("Todas las funciones")).toBeDefined();
    fireEvent.click(screen.getByText("Todas las funciones"));
    expect(onDrilldown).toHaveBeenCalledWith(null);
  });
});
