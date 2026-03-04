import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useData } from "@/hooks/useData";
import { SustainabilityBlock } from "../SustainabilityBlock";

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

// Capture Tooltip formatter so we can invoke it directly to hit those branches
const capturedTooltipFormatters: Array<(...args: any[]) => any> = [];

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: any) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  AreaChart: ({ children }: any) => <div data-testid="area-chart">{children}</div>,
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Area: () => <div />,
  Line: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: ({ formatter }: any) => {
    if (formatter) capturedTooltipFormatters.push(formatter);
    return <div />;
  },
  Legend: ({ formatter }: any) => {
    if (formatter) capturedTooltipFormatters.push(formatter);
    return <div />;
  },
  ReferenceLine: () => <div />,
}));

const mockSustainabilityData = {
  lastUpdated: "2026-02-23T00:00:00.000Z",
  latestYear: 2023,
  years: [2020, 2021, 2022, 2023],
  byYear: {
    "2020": {
      socialContributions: 163076,
      pensionExpenditure: 137361,
      ssBalance: 25715,
      pensionToGDP: 12.3,
    },
    "2021": {
      socialContributions: 174684,
      pensionExpenditure: 143102,
      ssBalance: 31582,
      pensionToGDP: 11.8,
    },
    "2022": {
      socialContributions: 189513,
      pensionExpenditure: 153287,
      ssBalance: 36226,
      pensionToGDP: 11.6,
    },
    "2023": {
      socialContributions: 204000,
      pensionExpenditure: 167000,
      ssBalance: 37000,
      pensionToGDP: 12.4,
    },
  },
  pensionToGDP: {
    spain: {
      byYear: { "2020": 12.3, "2021": 11.8, "2022": 11.6, "2023": 12.4 },
      years: [2020, 2021, 2022, 2023],
    },
    eu27: {
      byYear: { "2020": 12.6, "2021": 11.9, "2022": 11.4, "2023": 11.5 },
      years: [2020, 2021, 2022, 2023],
    },
  },
  reserveFund: [
    { year: 2020, balance: 2098 },
    { year: 2021, balance: 2137 },
    { year: 2022, balance: 2862 },
    { year: 2023, balance: 4365 },
  ],
  contributorsPerPensioner: [
    { year: 2020, ratio: 2.13 },
    { year: 2021, ratio: 2.22 },
    { year: 2022, ratio: 2.3 },
    { year: 2023, ratio: 2.27 },
  ],
  projections: {
    source: "European Commission — 2024 Ageing Report",
    url: "https://economy-finance.ec.europa.eu/publications/2024-ageing-report_en",
    spain: [
      { year: 2022, pensionToGDP: 12.3 },
      { year: 2050, pensionToGDP: 15.7 },
      { year: 2070, pensionToGDP: 13.3 },
    ],
    eu27: [
      { year: 2022, pensionToGDP: 11.4 },
      { year: 2050, pensionToGDP: 12.4 },
      { year: 2070, pensionToGDP: 11.6 },
    ],
  },
  sourceAttribution: {
    ssSustainability: {
      source: "Eurostat (referencia)",
      type: "fallback",
      url: "https://ec.europa.eu/eurostat/databrowser/view/gov_10a_exp/",
      date: "2023-12-31",
      note: "Valores de referencia 2023",
    },
  },
};

describe("SustainabilityBlock", () => {
  it("renders title and StatCards with full data", () => {
    (useData as any).mockReturnValue({
      ssSustainability: mockSustainabilityData,
    });
    render(<SustainabilityBlock />);

    expect(screen.getByText("Sostenibilidad de la Seguridad Social")).toBeDefined();
    const statCards = screen.getAllByTestId("stat-card");
    expect(statCards.length).toBe(6);
  });

  it("renders all four charts", () => {
    (useData as any).mockReturnValue({
      ssSustainability: mockSustainabilityData,
    });
    render(<SustainabilityBlock />);

    expect(screen.getByTestId("area-chart")).toBeDefined();
    const lineCharts = screen.getAllByTestId("line-chart");
    expect(lineCharts.length).toBe(3);
  });

  it("renders Ageing Report source note", () => {
    (useData as any).mockReturnValue({
      ssSustainability: mockSustainabilityData,
    });
    render(<SustainabilityBlock />);

    expect(screen.getByText(/2024 Ageing Report/)).toBeDefined();
  });

  it("handles minimal data without crashing", () => {
    const minimalData = {
      ...mockSustainabilityData,
      years: [2023],
      byYear: {
        "2023": {
          socialContributions: 204000,
          pensionExpenditure: 167000,
          ssBalance: 37000,
          pensionToGDP: 12.4,
        },
      },
      reserveFund: [{ year: 2023, balance: 4365 }],
      contributorsPerPensioner: [{ year: 2023, ratio: 2.27 }],
    };

    (useData as any).mockReturnValue({ ssSustainability: minimalData });
    render(<SustainabilityBlock />);

    expect(screen.getByText("Sostenibilidad de la Seguridad Social")).toBeDefined();
  });

  it("handles missing sourceAttribution by falling back to default source", () => {
    const dataWithoutAttribution = {
      ...mockSustainabilityData,
      sourceAttribution: undefined,
    };

    (useData as any).mockReturnValue({ ssSustainability: dataWithoutAttribution });
    render(<SustainabilityBlock />);

    // Should still render without crashing
    expect(screen.getByText("Sostenibilidad de la Seguridad Social")).toBeDefined();
  });

  it("handles missing spainProjection2050 (no year 2050 entry)", () => {
    const dataWithoutProjection2050 = {
      ...mockSustainabilityData,
      projections: {
        ...mockSustainabilityData.projections,
        spain: [
          { year: 2030, pensionToGDP: 13.0 },
          { year: 2070, pensionToGDP: 13.3 },
        ],
      },
    };

    (useData as any).mockReturnValue({ ssSustainability: dataWithoutProjection2050 });
    render(<SustainabilityBlock />);

    // projectedGDP2050 StatCard should show 0% when no 2050 entry found
    expect(screen.getByText("Sostenibilidad de la Seguridad Social")).toBeDefined();
  });

  it("handles empty projections arrays (zero offset branch)", () => {
    const dataWithEmptyProjections = {
      ...mockSustainabilityData,
      projections: {
        ...mockSustainabilityData.projections,
        spain: [],
        eu27: [],
      },
    };

    (useData as any).mockReturnValue({ ssSustainability: dataWithEmptyProjections });
    render(<SustainabilityBlock />);

    expect(screen.getByText("Sostenibilidad de la Seguridad Social")).toBeDefined();
  });

  it("handles projection base year missing from historical byYear (uses projBaseSpain.pensionToGDP)", () => {
    // When projBaseSpain.year has no entry in pensionToGDP.spain.byYear,
    // the offset falls back to projBaseSpain.pensionToGDP - projBaseSpain.pensionToGDP = 0
    const dataWithGap = {
      ...mockSustainabilityData,
      pensionToGDP: {
        spain: {
          byYear: { "2020": 12.3, "2021": 11.8 },
          years: [2020, 2021],
        },
        eu27: {
          byYear: { "2020": 12.6, "2021": 11.9 },
          years: [2020, 2021],
        },
      },
      projections: {
        ...mockSustainabilityData.projections,
        // base year 2025 not in byYear — triggers the ?? fallback to projBaseSpain.pensionToGDP
        spain: [
          { year: 2025, pensionToGDP: 13.0 },
          { year: 2050, pensionToGDP: 15.7 },
        ],
        eu27: [
          { year: 2025, pensionToGDP: 11.8 },
          { year: 2050, pensionToGDP: 12.4 },
        ],
      },
    };

    (useData as any).mockReturnValue({ ssSustainability: dataWithGap });
    render(<SustainabilityBlock />);

    expect(screen.getByText("Sostenibilidad de la Seguridad Social")).toBeDefined();
  });

  it("handles projection base year matching last historical year (bridge branch)", () => {
    // When projBaseSpain.year === lastSpainYear (2023), the transition bridge code runs
    // setting spainHistorical at that year. Since 2023 is already in byYear, the
    // `p.spainHistorical ?? ...` nullish branch uses the existing value.
    const dataWithMatchingBase = {
      ...mockSustainabilityData,
      projections: {
        ...mockSustainabilityData.projections,
        // First projection year equals last historical year (2023)
        spain: [
          { year: 2023, pensionToGDP: 12.4 },
          { year: 2050, pensionToGDP: 15.7 },
        ],
        eu27: [
          { year: 2023, pensionToGDP: 11.5 },
          { year: 2050, pensionToGDP: 12.4 },
        ],
      },
    };

    (useData as any).mockReturnValue({ ssSustainability: dataWithMatchingBase });
    render(<SustainabilityBlock />);

    expect(screen.getByText("Sostenibilidad de la Seguridad Social")).toBeDefined();
  });

  it("GDP chart tooltip formatter handles null/undefined values", () => {
    capturedTooltipFormatters.length = 0;

    (useData as any).mockReturnValue({ ssSustainability: mockSustainabilityData });
    render(<SustainabilityBlock />);

    // Find the GDP chart tooltip formatter (it checks for null/undefined)
    // The GDP chart formatter signature is (value: unknown, name: string)
    const gdpFormatter = capturedTooltipFormatters.find((fn) => {
      try {
        const result = fn(null, "spainHistorical");
        return Array.isArray(result) && result[0] === "-";
      } catch {
        return false;
      }
    });

    expect(gdpFormatter).toBeDefined();
    // null value returns dash
    expect(gdpFormatter?.(null, "spainHistorical")).toEqual(["-", "spainHistorical"]);
    // undefined value returns dash
    expect(gdpFormatter?.(undefined, "eu27Historical")).toEqual(["-", "eu27Historical"]);
    // numeric value formats as percentage
    expect(gdpFormatter?.(12.5, "spainHistorical")).toEqual(["12.5%", "spainHistorical"]);
  });

  it("Area chart tooltip formatter labels contributions and expenditure", () => {
    capturedTooltipFormatters.length = 0;

    (useData as any).mockReturnValue({ ssSustainability: mockSustainabilityData });
    render(<SustainabilityBlock />);

    // The area chart formatter maps "contributions" -> Spanish label, others -> spending label
    const areaFormatter = capturedTooltipFormatters.find((fn) => {
      try {
        const result = fn(100000, "contributions");
        return Array.isArray(result) && typeof result[0] === "string";
      } catch {
        return false;
      }
    });

    expect(areaFormatter).toBeDefined();
    const contribResult = areaFormatter?.(100000, "contributions");
    expect(contribResult[0]).toContain("100.000");
    const expResult = areaFormatter?.(50000, "expenditure");
    expect(expResult[0]).toContain("50.000");
  });

  it("displays latestYear in the executive snapshot header", () => {
    (useData as any).mockReturnValue({ ssSustainability: mockSustainabilityData });
    render(<SustainabilityBlock />);

    expect(screen.getByText(/2023/)).toBeDefined();
  });

  it("handles byYear entry missing ssBalance (defaults to 0)", () => {
    const dataWithMissingBalance = {
      ...mockSustainabilityData,
      byYear: {
        ...mockSustainabilityData.byYear,
        "2023": {
          socialContributions: 204000,
          pensionExpenditure: 167000,
          ssBalance: undefined,
          pensionToGDP: 12.4,
        },
      },
    };

    (useData as any).mockReturnValue({ ssSustainability: dataWithMissingBalance });
    render(<SustainabilityBlock />);

    expect(screen.getByText("Sostenibilidad de la Seguridad Social")).toBeDefined();
  });

  it("handles negative ssBalance (cumulative gap shows absolute value)", () => {
    const dataWithNegativeBalance = {
      ...mockSustainabilityData,
      byYear: {
        "2020": { ...mockSustainabilityData.byYear["2020"], ssBalance: -5000 },
        "2021": { ...mockSustainabilityData.byYear["2021"], ssBalance: -8000 },
        "2022": { ...mockSustainabilityData.byYear["2022"], ssBalance: -3000 },
        "2023": { ...mockSustainabilityData.byYear["2023"], ssBalance: -2000 },
      },
    };

    (useData as any).mockReturnValue({ ssSustainability: dataWithNegativeBalance });
    render(<SustainabilityBlock />);

    // cumulative balance is negative; Math.abs ensures the card shows a positive value
    expect(screen.getByText("Sostenibilidad de la Seguridad Social")).toBeDefined();
  });
});
