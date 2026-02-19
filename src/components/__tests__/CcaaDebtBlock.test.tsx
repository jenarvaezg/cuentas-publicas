import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useData } from "@/hooks/useData";
import { CcaaDebtBlock } from "../CcaaDebtBlock";

vi.mock("@/hooks/useData", () => ({ useData: vi.fn() }));

// Fully mock Recharts
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  XAxis: () => null,
  YAxis: ({ dataKey }: any) => <div data-testid="yaxis">{dataKey}</div>,
  Tooltip: () => null,
  Cell: () => null,
  ReferenceLine: () => <div data-testid="ref-line" />,
}));

describe("CcaaDebtBlock", () => {
  const mockCcaaDebt = {
    ccaa: [
      { code: "CA01", name: "Andalucía", debtToGDP: 18.3, debtAbsolute: 40e9 },
      { code: "CA09", name: "Cataluña", debtToGDP: 28.4, debtAbsolute: 89e9 },
    ],
    total: { debtToGDP: 20.4, debtAbsolute: 338e9 },
    quarter: "2025-Q3",
    sourceAttribution: {
      be1309: { source: "Banco de España be1309", url: "url1", type: "csv" },
      be1310: { source: "Banco de España be1310", url: "url2", type: "csv" },
    },
  };

  beforeEach(() => {
    (useData as any).mockReturnValue({ ccaaDebt: mockCcaaDebt });
  });

  it("renders correctly and switches metrics", () => {
    render(<CcaaDebtBlock />);
    expect(screen.getByText("Deuda por Comunidad Autónoma")).toBeDefined();

    // Initial metric is debtToGDP, should show be1310 source
    expect(screen.getByText(/be1310/)).toBeDefined();
    expect(screen.getByTestId("ref-line")).toBeDefined();

    // Switch metric to debtAbsolute
    const select = screen.getByLabelText("Métrica") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "debtAbsolute" } });

    expect(screen.getByText(/be1309/)).toBeDefined();
    // Reference line should be gone in absolute mode
    expect(screen.queryByTestId("ref-line")).toBeNull();
  });

  it("renders chart component", () => {
    render(<CcaaDebtBlock />);
    expect(screen.getByTestId("bar-chart")).toBeDefined();
  });
});
