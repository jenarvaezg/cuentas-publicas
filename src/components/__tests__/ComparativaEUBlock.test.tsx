import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useData } from "@/hooks/useData";
import { ComparativaEUBlock } from "../ComparativaEUBlock";

vi.mock("@/hooks/useData", () => ({ useData: vi.fn() }));

vi.mock("recharts", async () => {
  const actual = await vi.importActual("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
    BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
    Cell: () => null,
    ReferenceLine: () => <div data-testid="ref-line" />,
  };
});

describe("ComparativaEUBlock", () => {
  const mockEurostat = {
    countries: ["ES", "DE", "EU27_2020"],
    countryNames: { ES: "España", DE: "Alemania", EU27_2020: "Media UE-27" },
    year: 2023,
    indicators: {
      debtToGDP: { ES: 107.7, DE: 66.1, EU27_2020: 83.5 },
      deficit: { ES: -3.6, DE: -2.5, EU27_2020: -3.3 },
    },
    indicatorMeta: {
      debtToGDP: { label: "Deuda/PIB", unit: "%" },
      deficit: { label: "Déficit", unit: "%" },
    },
    sourceAttribution: { eurostat: { name: "Eurostat Source", url: "url1" } },
  };

  beforeEach(() => {
    (useData as any).mockReturnValue({ eurostat: mockEurostat });
  });

  it("renders correctly and switches indicators", () => {
    render(<ComparativaEUBlock />);
    expect(screen.getByText("España en la Unión Europea")).toBeDefined();

    const select = screen.getByLabelText("Indicador") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "deficit" } });
    expect(select.value).toBe("deficit");
  });

  it("handles missing source attribution", () => {
    (useData as any).mockReturnValue({
      eurostat: { ...mockEurostat, sourceAttribution: {} },
    });
    render(<ComparativaEUBlock />);
    expect(screen.getByText("Eurostat")).toBeDefined();
  });
});
