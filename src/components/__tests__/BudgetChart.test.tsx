import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { cloneElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BudgetChart, CustomTooltip } from "../BudgetChart";

let clickEntry: { code?: string } = { code: "01" };
let tooltipDatum: any = null;
let capturedAxisSample = "";

vi.mock("recharts", async () => {
  const actual = await vi.importActual("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
    BarChart: ({ children, data }: any) => (
      <div data-testid="bar-chart">
        {(data ?? []).map((d: any) => (
          <span key={d.code} data-testid="datum-name">
            {d.name}
          </span>
        ))}
        {children}
      </div>
    ),
    Bar: ({ onClick, dataKey, children, cursor }: any) => (
      <button
        type="button"
        data-testid={`bar-${String(dataKey)}`}
        data-cursor={cursor ?? ""}
        onClick={() => onClick?.(clickEntry)}
      >
        {children}
      </button>
    ),
    XAxis: ({ tickFormatter }: any) => {
      if (!tickFormatter) return null;
      capturedAxisSample = String(tickFormatter(12.34));
      return <span data-testid="x-axis-sample">{capturedAxisSample}</span>;
    },
    YAxis: () => null,
    Tooltip: ({ content }: any) =>
      tooltipDatum && content
        ? cloneElement(content, { active: true, payload: [{ payload: tooltipDatum }] })
        : null,
    Cell: ({ fill }: any) => <span data-testid="cell-fill" data-fill={fill} />,
    ReferenceLine: ({ x }: any) => <div data-testid="reference-line">{String(x)}</div>,
  };
});

describe("BudgetChart", () => {
  const categories = [
    {
      code: "01",
      name: "Servicios generales",
      amount: 120,
      percentage: 12,
      children: [
        { code: "01.1", name: "Órganos ejecutivos", amount: 70, percentage: 7 },
        { code: "01.2", name: "Servicios fiscales", amount: 50, percentage: 5 },
      ],
    },
    {
      code: "02",
      name: "Defensa",
      amount: 60,
      percentage: 6,
    },
  ];

  const comparisonCategories = [
    {
      code: "01",
      name: "Servicios generales",
      amount: 100,
      percentage: 10,
      children: [
        { code: "01.1", name: "Órganos ejecutivos", amount: 60, percentage: 6 },
        { code: "01.2", name: "Servicios fiscales", amount: 40, percentage: 4 },
      ],
    },
    {
      code: "02",
      name: "Defensa",
      amount: 80,
      percentage: 8,
    },
  ];

  beforeEach(() => {
    clickEntry = { code: "01" };
    tooltipDatum = null;
    capturedAxisSample = "";
  });

  afterEach(() => {
    cleanup();
  });

  it("solo permite drilldown en categorías con hijos y muestra breadcrumb funcional", () => {
    const onDrilldown = vi.fn();
    const { rerender } = render(
      <BudgetChart
        categories={categories as any}
        selectedYear={2024}
        drilldownCategory={null}
        onDrilldown={onDrilldown}
        compareMode="absoluto"
      />,
    );

    fireEvent.click(screen.getByTestId("bar-amount"));
    expect(onDrilldown).toHaveBeenCalledWith("01");

    clickEntry = { code: "02" };
    fireEvent.click(screen.getByTestId("bar-amount"));
    expect(onDrilldown).toHaveBeenCalledTimes(1);

    rerender(
      <BudgetChart
        categories={categories as any}
        selectedYear={2024}
        drilldownCategory="01"
        onDrilldown={onDrilldown}
        compareMode="absoluto"
      />,
    );

    fireEvent.click(screen.getByTestId("bar-amount"));
    expect(onDrilldown).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText("Todas las funciones"));
    expect(onDrilldown).toHaveBeenCalledWith(null);
  });

  it("en modo cambio colorea por signo y muestra línea de referencia en 0", () => {
    tooltipDatum = {
      name: "Servicios generales",
      code: "01",
      amount: 120,
      percentage: 12,
      comparison: 100,
      comparisonPercentage: 10,
      change: 20,
    };

    render(
      <BudgetChart
        categories={categories as any}
        comparisonCategories={comparisonCategories as any}
        comparisonYear={2023}
        selectedYear={2024}
        drilldownCategory={null}
        onDrilldown={vi.fn()}
        compareMode="cambio"
        euroLabel="€ reales"
      />,
    );

    expect(screen.getByText("Aumento")).toBeInTheDocument();
    expect(screen.getByText("Descenso")).toBeInTheDocument();
    expect(screen.getByText("(€ reales)")).toBeInTheDocument();
    expect(screen.getByTestId("reference-line")).toBeInTheDocument();
    expect(screen.getByTestId("bar-change")).toBeInTheDocument();
    expect(screen.queryByTestId("bar-comparison")).toBeNull();

    const fills = screen.getAllByTestId("cell-fill").map((el) => el.getAttribute("data-fill"));
    expect(fills).toContain("hsl(155, 55%, 40%)");
    expect(fills).toContain("hsl(0, 65%, 50%)");
    expect(screen.getByText(/\+20,0%/)).toBeInTheDocument();
    expect(capturedAxisSample).toContain("%");
  });

  it("en modo pesos muestra barras comparativas porcentuales y oculta etiqueta de euros", () => {
    tooltipDatum = {
      name: "Servicios generales",
      code: "01",
      amount: 120,
      percentage: 12,
      comparison: 100,
      comparisonPercentage: 10,
      change: 20,
    };

    render(
      <BudgetChart
        categories={categories as any}
        comparisonCategories={comparisonCategories as any}
        comparisonYear={2023}
        selectedYear={2024}
        drilldownCategory={null}
        onDrilldown={vi.fn()}
        compareMode="pesos"
        euroLabel="€ reales"
      />,
    );

    expect(screen.getByTestId("bar-percentage")).toBeInTheDocument();
    expect(screen.getByTestId("bar-comparisonPercentage")).toBeInTheDocument();
    expect(screen.queryByTestId("reference-line")).toBeNull();
    expect(screen.queryByText("(€ reales)")).toBeNull();
    expect(capturedAxisSample).toContain("%");
  });

  it("CustomTooltip renderiza valores según modo", () => {
    const payload = [
      {
        payload: {
          name: "Defensa",
          code: "02",
          amount: 60,
          percentage: 6,
          comparison: 80,
          comparisonPercentage: 8,
          change: -25,
        },
      },
    ];

    const { rerender } = render(
      <CustomTooltip
        active
        payload={payload as any}
        isChangeMode
        selectedYear={2024}
        comparisonYear={2023}
      />,
    );
    expect(screen.getByText("Defensa")).toBeInTheDocument();
    expect(screen.getByText("-25,0%")).toBeInTheDocument();

    rerender(
      <CustomTooltip
        active
        payload={payload as any}
        isWeightMode
        hasComparison
        selectedYear={2024}
        comparisonYear={2023}
      />,
    );
    expect(screen.getByText(/2024:/)).toBeInTheDocument();
    expect(screen.getByText(/2023:/)).toBeInTheDocument();

    rerender(<CustomTooltip active={false} payload={payload as any} />);
    expect(screen.queryByText("Defensa")).toBeNull();
  });
});
