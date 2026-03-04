import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("recharts", () => {
  const Passthrough = ({ children }: any) => <div>{children}</div>;
  return {
    ResponsiveContainer: Passthrough,
    LineChart: Passthrough,
    AreaChart: Passthrough,
    BarChart: Passthrough,
    CartesianGrid: () => null,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: ({ content }: any) =>
      content ? <div data-testid="tooltip-content">{content}</div> : null,
    Line: () => null,
    Area: () => null,
    Bar: Passthrough,
    Cell: ({ fill }: any) => <span data-testid="chart-cell" data-fill={fill} />,
    ReferenceLine: () => null,
    Legend: () => null,
  };
});

vi.mock("@/components/ChartTooltip", () => ({
  ChartTooltip: () => null,
}));

import { EUDemographicComparison } from "../EUDemographicComparison";
import { FertilityProjectionsChart, ProjectionTooltip } from "../FertilityProjectionsChart";
import { ImmigrationChart, SimpleTooltip as ImmigrationSimpleTooltip } from "../ImmigrationChart";
import { LifeExpectancyChart, SimpleTooltip as LifeExpSimpleTooltip } from "../LifeExpectancyChart";
import {
  MigrationFlowsChart,
  SimpleTooltip as MigrationSimpleTooltip,
} from "../MigrationFlowsChart";
import { ProjectionsChart, SimpleTooltip as ProjectionsSimpleTooltip } from "../ProjectionsChart";
import { ProvincialRankingChart } from "../ProvincialRankingChart";
import { SimpleTooltip as VitalSimpleTooltip, VitalTrendsChart } from "../VitalTrendsChart";

// ---------------------------------------------------------------------------
// VitalTrendsChart
// ---------------------------------------------------------------------------
describe("VitalTrendsChart", () => {
  const data = [
    { year: 2022, birthRate: 6.73, deathRate: 9.11 },
    { year: 2023, birthRate: 6.53, deathRate: 9.1 },
  ];

  it("renders title when data has more than 1 item", () => {
    render(
      <VitalTrendsChart
        data={data}
        title="Natalidad vs mortalidad"
        birthRateLabel="Natalidad"
        deathRateLabel="Mortalidad"
      />,
    );
    expect(screen.getByText("Natalidad vs mortalidad")).toBeDefined();
  });

  it("returns null when data has 1 or fewer items", () => {
    const { container } = render(
      <VitalTrendsChart
        data={[{ year: 2023, birthRate: 6.5, deathRate: 9.1 }]}
        title="Natalidad vs mortalidad"
        birthRateLabel="Natalidad"
        deathRateLabel="Mortalidad"
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// LifeExpectancyChart
// ---------------------------------------------------------------------------
describe("LifeExpectancyChart", () => {
  const data = [
    { year: 2022, both: 83.08, male: 80.35, female: 85.75 },
    { year: 2023, both: 83.5, male: 80.7, female: 86.1 },
  ];

  it("renders title when data has more than 1 item", () => {
    render(
      <LifeExpectancyChart
        data={data}
        title="Esperanza de vida"
        bothLabel="Total"
        maleLabel="Hombres"
        femaleLabel="Mujeres"
        yearsLabel="años"
      />,
    );
    expect(screen.getByText("Esperanza de vida")).toBeDefined();
  });

  it("returns null when data is empty", () => {
    const { container } = render(
      <LifeExpectancyChart
        data={[]}
        title="Esperanza de vida"
        bothLabel="Total"
        maleLabel="Hombres"
        femaleLabel="Mujeres"
        yearsLabel="años"
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// ImmigrationChart
// ---------------------------------------------------------------------------
describe("ImmigrationChart", () => {
  const data = [
    { year: 2022, share: 17.0 },
    { year: 2023, share: 18.9 },
  ];

  it("renders title when data has more than 1 item", () => {
    render(
      <ImmigrationChart
        data={data}
        title="Población nacida en el extranjero"
        shareLabel="% extranjeros"
      />,
    );
    expect(screen.getByText("Población nacida en el extranjero")).toBeDefined();
  });

  it("returns null when data is empty", () => {
    const { container } = render(
      <ImmigrationChart
        data={[]}
        title="Población nacida en el extranjero"
        shareLabel="% extranjeros"
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// MigrationFlowsChart
// ---------------------------------------------------------------------------
describe("MigrationFlowsChart", () => {
  const data = [
    {
      year: 2022,
      immigration: 800000,
      emigration: 400000,
      netMigration: 400000,
    },
    {
      year: 2023,
      immigration: 900000,
      emigration: 420000,
      netMigration: 480000,
    },
  ];

  it("renders title when data has more than 1 item", () => {
    render(
      <MigrationFlowsChart
        data={data}
        title="Flujos migratorios"
        immigrationLabel="Inmigración"
        emigrationLabel="Emigración"
        netLabel="Saldo neto"
      />,
    );
    expect(screen.getByText("Flujos migratorios")).toBeDefined();
  });

  it("returns null when data is empty", () => {
    const { container } = render(
      <MigrationFlowsChart
        data={[]}
        title="Flujos migratorios"
        immigrationLabel="Inmigración"
        emigrationLabel="Emigración"
        netLabel="Saldo neto"
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// ProjectionsChart
// ---------------------------------------------------------------------------
describe("ProjectionsChart", () => {
  const populationData = [
    { year: 2024, population: 48_500_000 },
    { year: 2030, population: 49_000_000 },
  ];
  const agingData = [
    { year: 2024, dependencyOldAge: 30, proportionOver65: 20 },
    { year: 2030, dependencyOldAge: 35, proportionOver65: 23 },
  ];

  it("renders both titles when both datasets have more than 1 item", () => {
    render(
      <ProjectionsChart
        populationData={populationData}
        agingData={agingData}
        populationTitle="Proyección de población"
        agingTitle="Envejecimiento"
        populationLabel="Población"
        dependencyLabel="Tasa dependencia"
        proportionLabel="% mayores 65"
        millionLabel="M"
      />,
    );
    expect(screen.getByText("Proyección de población")).toBeDefined();
    expect(screen.getByText("Envejecimiento")).toBeDefined();
  });

  it("returns null when both datasets have 1 or fewer items", () => {
    const { container } = render(
      <ProjectionsChart
        populationData={[{ year: 2024, population: 48_500_000 }]}
        agingData={[{ year: 2024, dependencyOldAge: 30, proportionOver65: 20 }]}
        populationTitle="Proyección de población"
        agingTitle="Envejecimiento"
        populationLabel="Población"
        dependencyLabel="Tasa dependencia"
        proportionLabel="% mayores 65"
        millionLabel="M"
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders only population chart when agingData has 1 or fewer items", () => {
    render(
      <ProjectionsChart
        populationData={populationData}
        agingData={[]}
        populationTitle="Proyección de población"
        agingTitle="Envejecimiento"
        populationLabel="Población"
        dependencyLabel="Tasa dependencia"
        proportionLabel="% mayores 65"
        millionLabel="M"
      />,
    );
    expect(screen.getByText("Proyección de población")).toBeDefined();
    expect(screen.queryByText("Envejecimiento")).toBeNull();
  });

  it("renders only aging chart when populationData has 1 or fewer items", () => {
    render(
      <ProjectionsChart
        populationData={[]}
        agingData={agingData}
        populationTitle="Proyección de población"
        agingTitle="Envejecimiento"
        populationLabel="Población"
        dependencyLabel="Tasa dependencia"
        proportionLabel="% mayores 65"
        millionLabel="M"
      />,
    );
    expect(screen.queryByText("Proyección de población")).toBeNull();
    expect(screen.getByText("Envejecimiento")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// FertilityProjectionsChart
// ---------------------------------------------------------------------------
describe("FertilityProjectionsChart", () => {
  const actual = [
    { year: 2020, value: 1.23 },
    { year: 2021, value: 1.19 },
  ];

  it("renders title with valid actual data", () => {
    render(
      <FertilityProjectionsChart
        actual={actual}
        projections={[]}
        linearRegression={[]}
        ourEstimate={[]}
        replacementLevel={2.1}
        title="Proyecciones de fertilidad"
        actualLabel="Real"
        regressionLabel="Regresión"
        ourEstimateLabel="Estimación propia"
        replacementLabel="Nivel de reemplazo"
      />,
    );
    expect(screen.getByText("Proyecciones de fertilidad")).toBeDefined();
  });

  it("returns null when actual data is empty", () => {
    const { container } = render(
      <FertilityProjectionsChart
        actual={[]}
        projections={[]}
        linearRegression={[]}
        ourEstimate={[]}
        replacementLevel={2.1}
        title="Proyecciones de fertilidad"
        actualLabel="Real"
        regressionLabel="Regresión"
        ourEstimateLabel="Estimación propia"
        replacementLabel="Nivel de reemplazo"
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders legend for projections, regression and estimate", () => {
    render(
      <FertilityProjectionsChart
        actual={actual}
        projections={[
          {
            source: "UN 2024",
            publishedYear: 2024,
            points: [
              { year: 2025, value: 1.3 },
              { year: 2030, value: 1.4 },
            ],
          },
          {
            source: "INE 2024",
            publishedYear: 2024,
            points: [
              { year: 2025, value: 1.2 },
              { year: 2030, value: 1.35 },
            ],
          },
        ]}
        linearRegression={[
          { year: 2022, value: 1.15 },
          { year: 2030, value: 1.0 },
        ]}
        ourEstimate={[
          { year: 2021, value: 1.19 },
          { year: 2026, value: 1.25 },
        ]}
        replacementLevel={2.1}
        title="Proyecciones de fertilidad"
        actualLabel="Real"
        regressionLabel="Regresión 10a"
        ourEstimateLabel="Estimación propia"
        replacementLabel="Nivel de reemplazo"
      />,
    );
    expect(screen.getByText("UN 2024")).toBeDefined();
    expect(screen.getByText("INE 2024")).toBeDefined();
    expect(screen.getByText("Regresión 10a")).toBeDefined();
    expect(screen.getByText("Estimación propia")).toBeDefined();
    expect(screen.getByText("Nivel de reemplazo")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// EUDemographicComparison
// ---------------------------------------------------------------------------
describe("EUDemographicComparison", () => {
  const data = [
    {
      country: "España",
      countryCode: "ES",
      value: 6.5,
      isSpain: true,
      isEU: false,
    },
    {
      country: "Alemania",
      countryCode: "DE",
      value: 8.1,
      isSpain: false,
      isEU: false,
    },
  ];

  const indicatorLabels = {
    birthRate: "Natalidad",
    deathRate: "Mortalidad",
    fertilityRate: "Fertilidad",
    lifeExpectancy: "Esperanza de vida",
  } as const;

  const units = {
    birthRate: "‰",
    deathRate: "‰",
    fertilityRate: "hijos/mujer",
    lifeExpectancy: "años",
  } as const;

  it("renders title and indicator select when data is non-empty", () => {
    render(
      <EUDemographicComparison
        data={data}
        eu27Value={7.9}
        selectedIndicator="birthRate"
        onIndicatorChange={vi.fn()}
        title="Comparativa UE"
        indicatorLabels={indicatorLabels}
        units={units}
        eu27Avg="Media UE-27"
        eurostatYear={2023}
      />,
    );
    expect(screen.getByText("Comparativa UE")).toBeDefined();
    // The select element contains all indicator options
    expect(screen.getByText("Natalidad")).toBeDefined();
  });

  it("returns null when data is empty", () => {
    const { container } = render(
      <EUDemographicComparison
        data={[]}
        eu27Value={null}
        selectedIndicator="birthRate"
        onIndicatorChange={vi.fn()}
        title="Comparativa UE"
        indicatorLabels={indicatorLabels}
        units={units}
        eu27Avg="Media UE-27"
        eurostatYear={2023}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("calls onIndicatorChange when select changes", () => {
    const onIndicatorChange = vi.fn();
    render(
      <EUDemographicComparison
        data={data}
        eu27Value={7.9}
        selectedIndicator="birthRate"
        onIndicatorChange={onIndicatorChange}
        title="Comparativa UE"
        indicatorLabels={indicatorLabels}
        units={units}
        eu27Avg="Media UE-27"
        eurostatYear={2023}
      />,
    );
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "fertilityRate" },
    });
    expect(onIndicatorChange).toHaveBeenCalledWith("fertilityRate");
  });

  it("renders without reference line when eu27Value is null", () => {
    render(
      <EUDemographicComparison
        data={data}
        eu27Value={null}
        selectedIndicator="birthRate"
        onIndicatorChange={vi.fn()}
        title="Comparativa UE"
        indicatorLabels={indicatorLabels}
        units={units}
        eu27Avg="Media UE-27"
        eurostatYear={2023}
      />,
    );
    expect(screen.getByText("Comparativa UE")).toBeDefined();
    expect(screen.getByText(/Eurostat 2023/)).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// SimpleTooltip — VitalTrendsChart
// ---------------------------------------------------------------------------
describe("VitalSimpleTooltip", () => {
  const payload = [
    { dataKey: "birthRate", name: "Natalidad", value: 6.73, color: "#3b82f6" },
    { dataKey: "deathRate", name: "Mortalidad", value: 9.11, color: "#f43f5e" },
  ];

  it("returns null when active is false", () => {
    const { container } = render(
      <VitalSimpleTooltip active={false} payload={payload} label={2023} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders label and values when active with payload", () => {
    render(<VitalSimpleTooltip active={true} payload={payload} label={2023} suffix="‰" />);
    expect(screen.getByText("2023")).toBeDefined();
    expect(screen.getByText(/Natalidad/)).toBeDefined();
    expect(screen.getByText(/Mortalidad/)).toBeDefined();
  });

  it("returns null when label is missing", () => {
    const { container } = render(
      <VitalSimpleTooltip active={true} payload={payload} label={undefined} />,
    );
    expect(container.firstChild).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// SimpleTooltip — LifeExpectancyChart
// ---------------------------------------------------------------------------
describe("LifeExpSimpleTooltip", () => {
  const payload = [
    { dataKey: "both", name: "Total", value: 83.08, color: "#3b82f6" },
    { dataKey: "male", name: "Hombres", value: 80.35, color: "#14b8a6" },
  ];

  it("returns null when active is false", () => {
    const { container } = render(
      <LifeExpSimpleTooltip active={false} payload={payload} label={2023} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders label and series names when active", () => {
    render(<LifeExpSimpleTooltip active={true} payload={payload} label={2023} suffix=" años" />);
    expect(screen.getByText("2023")).toBeDefined();
    expect(screen.getByText(/Total/)).toBeDefined();
    expect(screen.getByText(/Hombres/)).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// SimpleTooltip — ImmigrationChart
// ---------------------------------------------------------------------------
describe("ImmigrationSimpleTooltip", () => {
  const payload = [{ dataKey: "share", name: "% extranjeros", value: 18.9, color: "#8b5cf6" }];

  it("returns null when active is false", () => {
    const { container } = render(
      <ImmigrationSimpleTooltip active={false} payload={payload} label={2023} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders label and value when active", () => {
    render(<ImmigrationSimpleTooltip active={true} payload={payload} label={2023} suffix="%" />);
    expect(screen.getByText("2023")).toBeDefined();
    expect(screen.getByText(/% extranjeros/)).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// SimpleTooltip — MigrationFlowsChart
// ---------------------------------------------------------------------------
describe("MigrationSimpleTooltip", () => {
  const payload = [
    {
      dataKey: "immigration",
      name: "Inmigración",
      value: 900000,
      color: "#22c55e",
    },
    {
      dataKey: "emigration",
      name: "Emigración",
      value: 420000,
      color: "#f43f5e",
    },
  ];

  it("returns null when active is false", () => {
    const { container } = render(
      <MigrationSimpleTooltip active={false} payload={payload} label={2023} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders label and series names (values formatted as K) when active", () => {
    render(<MigrationSimpleTooltip active={true} payload={payload} label={2023} />);
    expect(screen.getByText("2023")).toBeDefined();
    expect(screen.getByText(/Inmigración/)).toBeDefined();
    expect(screen.getByText(/Emigración/)).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// SimpleTooltip — ProjectionsChart
// ---------------------------------------------------------------------------
describe("ProjectionsSimpleTooltip", () => {
  const payload = [
    {
      dataKey: "dependencyOldAge",
      name: "Tasa dependencia",
      value: 35,
      color: "#f97316",
    },
    {
      dataKey: "proportionOver65",
      name: "% mayores 65",
      value: 23,
      color: "#a855f7",
    },
  ];

  it("returns null when active is false", () => {
    const { container } = render(
      <ProjectionsSimpleTooltip active={false} payload={payload} label={2030} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders label and values when active", () => {
    render(<ProjectionsSimpleTooltip active={true} payload={payload} label={2030} suffix="%" />);
    expect(screen.getByText("2030")).toBeDefined();
    expect(screen.getByText(/Tasa dependencia/)).toBeDefined();
    expect(screen.getByText(/% mayores 65/)).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// ProjectionTooltip — FertilityProjectionsChart
// ---------------------------------------------------------------------------
describe("ProjectionTooltip", () => {
  const payload = [
    { dataKey: "actual", name: "Real", value: 1.19, color: "#3b82f6" },
    { dataKey: "regression", name: "Regresión", value: 1.05, color: "#22c55e" },
  ];

  it("returns null when active is false", () => {
    const { container } = render(
      <ProjectionTooltip active={false} payload={payload} label={2025} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders label and series names when active", () => {
    render(<ProjectionTooltip active={true} payload={payload} label={2025} />);
    expect(screen.getByText("2025")).toBeDefined();
    expect(screen.getByText(/Real/)).toBeDefined();
    expect(screen.getByText(/Regresión/)).toBeDefined();
  });

  it("filters out null values", () => {
    const payloadWithNull = [
      { dataKey: "actual", name: "Real", value: 1.19, color: "#3b82f6" },
      { dataKey: "proj_UN", name: "UN", value: null, color: "#f87171" },
    ];
    render(<ProjectionTooltip active={true} payload={payloadWithNull as any} label={2030} />);
    expect(screen.getByText(/Real/)).toBeDefined();
    expect(screen.queryByText(/UN/)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// ProvincialRankingChart
// ---------------------------------------------------------------------------
describe("ProvincialRankingChart", () => {
  const entries = [
    {
      code: "28",
      name: "Madrid",
      ccaa: "Comunidad de Madrid",
      population: 6_751_000,
    },
    { code: "08", name: "Barcelona", ccaa: "Cataluña", population: 5_680_000 },
    {
      code: "46",
      name: "Valencia",
      ccaa: "Comunitat Valenciana",
      population: 2_575_000,
    },
  ];

  it("renders title and tab buttons when entries are non-empty", () => {
    render(
      <ProvincialRankingChart
        entries={entries}
        latestYear={2024}
        title="Ranking por población"
        ccaaLabel="CCAA"
        provincesLabel="Provincias"
        populationLabel="habitantes"
        millionLabel="M"
      />,
    );
    expect(screen.getByText(/Ranking por población/)).toBeDefined();
    expect(screen.getByText("CCAA")).toBeDefined();
    expect(screen.getByText("Provincias")).toBeDefined();
  });

  it("returns null when entries is empty", () => {
    const { container } = render(
      <ProvincialRankingChart
        entries={[]}
        latestYear={2024}
        title="Ranking por población"
        ccaaLabel="CCAA"
        provincesLabel="Provincias"
        populationLabel="habitantes"
        millionLabel="M"
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("switches to provinces view when Provincias tab is clicked", () => {
    render(
      <ProvincialRankingChart
        entries={entries}
        latestYear={2024}
        title="Ranking por población"
        ccaaLabel="CCAA"
        provincesLabel="Provincias"
        populationLabel="habitantes"
        millionLabel="M"
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Provincias" }));
    // Provincias tab becomes selected
    expect(screen.getByRole("tab", { name: "Provincias" }).getAttribute("aria-selected")).toBe(
      "true",
    );
    // Province data has 3 entries (Madrid 6.75M, Barcelona 5.68M > LARGE_THRESHOLD, Valencia 2.57M normal)
    // Cell components are rendered for each province entry
    const cells = screen.getAllByTestId("chart-cell");
    expect(cells.length).toBe(3);
    // Two provinces above LARGE_THRESHOLD (5M) get COLOR_LARGE, one gets COLOR_NORMAL
    const largeCells = cells.filter((c) => c.getAttribute("data-fill") === "hsl(var(--chart-2))");
    expect(largeCells.length).toBe(2);
  });
});
