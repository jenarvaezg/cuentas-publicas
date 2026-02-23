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
  Tooltip: () => <div />,
  Legend: () => <div />,
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
    (useData as any).mockReturnValue({ ssSustainability: mockSustainabilityData });
    render(<SustainabilityBlock />);

    expect(screen.getByText("Sostenibilidad de la Seguridad Social")).toBeDefined();
    const statCards = screen.getAllByTestId("stat-card");
    expect(statCards.length).toBe(6);
  });

  it("renders all four charts", () => {
    (useData as any).mockReturnValue({ ssSustainability: mockSustainabilityData });
    render(<SustainabilityBlock />);

    expect(screen.getByTestId("area-chart")).toBeDefined();
    const lineCharts = screen.getAllByTestId("line-chart");
    expect(lineCharts.length).toBe(3);
  });

  it("renders Ageing Report source note", () => {
    (useData as any).mockReturnValue({ ssSustainability: mockSustainabilityData });
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
});
