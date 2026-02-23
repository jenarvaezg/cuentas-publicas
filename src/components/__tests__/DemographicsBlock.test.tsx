import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useData } from "@/hooks/useData";
import { DemographicsBlock } from "../DemographicsBlock";

vi.mock("@/hooks/useData", () => ({ useData: vi.fn() }));

vi.mock("../StatCard", () => ({
  StatCard: ({ label, value }: any) => (
    <div data-testid="stat-card">
      {label}: {value}
    </div>
  ),
}));

vi.mock("../PopulationPyramidChart", () => ({
  PopulationPyramidChart: () => <div data-testid="pyramid-chart">Pyramid</div>,
}));

vi.mock("../ExportBlockButton", () => ({
  ExportBlockButton: () => null,
}));

vi.mock("recharts", () => {
  const Passthrough = ({ children }: any) => <div>{children}</div>;
  return {
    ResponsiveContainer: Passthrough,
    LineChart: Passthrough,
    AreaChart: Passthrough,
    CartesianGrid: () => null,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
    Line: () => <div data-testid="line" />,
    Area: () => <div data-testid="area" />,
    Legend: () => null,
  };
});

const baseDemographics = {
  population: 48_500_000,
  activePopulation: 24_000_000,
  gdp: 1_600_000_000_000,
  averageSalary: 28_000,
  smi: 1_134,
  cpi: { baseYear: 2024, byYear: { "2024": 110 } },
  sourceAttribution: {
    population: { source: "INE", type: "api", url: "https://ine.es" },
  },
  vitalStats: {
    birthRate: [
      { year: 2022, value: 6.73 },
      { year: 2023, value: 6.53 },
      { year: 2024, value: 6.49 },
    ],
    deathRate: [
      { year: 2022, value: 9.11 },
      { year: 2023, value: 9.1 },
      { year: 2024, value: 9.5 },
    ],
    fertilityRate: [
      { year: 2022, value: 1.16 },
      { year: 2023, value: 1.12 },
      { year: 2024, value: 1.16 },
    ],
    naturalGrowth: [
      { year: 2022, value: -2.38 },
      { year: 2023, value: -2.57 },
      { year: 2024, value: -3.01 },
    ],
  },
  lifeExpectancy: {
    both: [
      { year: 2022, value: 83.08 },
      { year: 2023, value: 83.5 },
    ],
    male: [
      { year: 2022, value: 80.35 },
      { year: 2023, value: 80.7 },
    ],
    female: [
      { year: 2022, value: 85.75 },
      { year: 2023, value: 86.1 },
    ],
  },
  pyramid: {
    years: [2023, 2024],
    ageGroups: ["0-4", "5-9", "10-14", "15-19", "65-69", "70-74"],
    regions: ["spain", "eu", "restEurope", "africa", "americas", "asiaOceania"],
    byYear: {
      "2024": {
        male: {
          spain: [1000, 1100, 1200, 1300, 800, 700],
          eu: [50, 60, 70, 80, 30, 20],
          restEurope: [10, 10, 10, 10, 5, 5],
          africa: [100, 90, 80, 70, 10, 5],
          americas: [80, 70, 60, 50, 20, 10],
          asiaOceania: [20, 20, 15, 10, 5, 3],
        },
        female: {
          spain: [950, 1050, 1150, 1250, 850, 750],
          eu: [45, 55, 65, 75, 35, 25],
          restEurope: [8, 8, 8, 8, 6, 6],
          africa: [90, 80, 70, 60, 12, 8],
          americas: [85, 75, 65, 55, 25, 15],
          asiaOceania: [18, 18, 13, 8, 6, 4],
        },
      },
    },
  },
  dependencyRatio: { oldAge: 0.3, youth: 0.22, total: 0.52 },
  immigrationShare: {
    total: 0.189,
    byRegion: { eu: 0.052, africa: 0.038, americas: 0.068 },
    historical: [
      { year: 2023, value: 0.17 },
      { year: 2024, value: 0.189 },
    ],
  },
};

describe("DemographicsBlock", () => {
  it("renders title and 8 stat cards", () => {
    (useData as any).mockReturnValue({ demographics: baseDemographics });
    render(<DemographicsBlock />);

    expect(screen.getByText("Demografía")).toBeDefined();
    const cards = screen.getAllByTestId("stat-card");
    expect(cards).toHaveLength(8);
  });

  it("shows population pyramid when pyramid data exists", () => {
    (useData as any).mockReturnValue({ demographics: baseDemographics });
    render(<DemographicsBlock />);

    expect(screen.getByTestId("pyramid-chart")).toBeDefined();
  });

  it("renders vital trends line chart", () => {
    (useData as any).mockReturnValue({ demographics: baseDemographics });
    render(<DemographicsBlock />);

    expect(screen.getByText("Natalidad vs mortalidad (30 años)")).toBeDefined();
    expect(screen.getAllByTestId("line").length).toBeGreaterThanOrEqual(2);
  });

  it("renders life expectancy chart", () => {
    (useData as any).mockReturnValue({ demographics: baseDemographics });
    render(<DemographicsBlock />);

    expect(screen.getByText("Esperanza de vida al nacer")).toBeDefined();
  });

  it("renders immigration trend chart", () => {
    (useData as any).mockReturnValue({ demographics: baseDemographics });
    render(<DemographicsBlock />);

    expect(screen.getByText("Evolución % nacidos en el extranjero")).toBeDefined();
    expect(screen.getAllByTestId("area").length).toBeGreaterThanOrEqual(1);
  });

  it("handles missing optional data gracefully", () => {
    (useData as any).mockReturnValue({
      demographics: {
        ...baseDemographics,
        vitalStats: undefined,
        lifeExpectancy: undefined,
        pyramid: undefined,
        dependencyRatio: undefined,
        immigrationShare: undefined,
      },
    });
    render(<DemographicsBlock />);

    expect(screen.getByText("Demografía")).toBeDefined();
    const cards = screen.getAllByTestId("stat-card");
    expect(cards).toHaveLength(8);
    expect(screen.queryByTestId("pyramid-chart")).toBeNull();
  });

  it("displays N/D for stat cards when data is missing", () => {
    (useData as any).mockReturnValue({
      demographics: {
        ...baseDemographics,
        vitalStats: undefined,
        lifeExpectancy: undefined,
        dependencyRatio: undefined,
        immigrationShare: undefined,
      },
    });
    render(<DemographicsBlock />);

    const cards = screen.getAllByTestId("stat-card");
    const ndCards = cards.filter((c) => c.textContent?.includes("N/D"));
    expect(ndCards.length).toBeGreaterThanOrEqual(5);
  });
});
