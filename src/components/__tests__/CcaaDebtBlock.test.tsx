import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { cloneElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useData } from "@/hooks/useData";
import { CcaaDebtBlock } from "../CcaaDebtBlock";

vi.mock("@/hooks/useData", () => ({ useData: vi.fn() }));
vi.mock("@/utils/export", () => ({ exportElementToPng: vi.fn() }));

let tooltipPayload: any = null;
let capturedRows: string[] = [];
let axisSample = "";

// Mock Recharts with observable props
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  BarChart: ({ children, data }: any) => {
    capturedRows = (data ?? []).map((d: any) => d.name);
    return (
      <div data-testid="bar-chart">
        {capturedRows.map((name) => (
          <span key={name} data-testid="ccaa-row">
            {name}
          </span>
        ))}
        {children}
      </div>
    );
  },
  Bar: ({ children }: any) => <div data-testid="bar">{children}</div>,
  XAxis: ({ tickFormatter }: any) => {
    axisSample = tickFormatter ? String(tickFormatter(89_000_000_000)) : "";
    return <span data-testid="x-axis-sample">{axisSample}</span>;
  },
  YAxis: ({ dataKey }: any) => <div data-testid="yaxis">{dataKey}</div>,
  Tooltip: ({ content }: any) =>
    tooltipPayload && content
      ? cloneElement(content, { active: true, payload: [{ payload: tooltipPayload }] })
      : null,
  Cell: ({ fill }: any) => <span data-testid="ccaa-cell" data-fill={fill} />,
  ReferenceLine: () => <div data-testid="ref-line" />,
}));

describe("CcaaDebtBlock", () => {
  const mockCcaaDebt = {
    ccaa: [
      {
        code: "CA01",
        name: "Andalucía",
        debtToGDP: 18.3,
        debtAbsolute: 89e9,
        debtYoYChangeAbsolute: 1.2e9,
        debtYoYChangePct: 1.4,
      },
      {
        code: "CA09",
        name: "Cataluña",
        debtToGDP: 28.4,
        debtAbsolute: 40e9,
        debtYoYChangeAbsolute: 2.1e9,
        debtYoYChangePct: 5.5,
      },
      {
        code: "CA13",
        name: "Madrid",
        debtToGDP: 12.1,
        debtAbsolute: 55e9,
        debtYoYChangeAbsolute: -0.8e9,
        debtYoYChangePct: -1.4,
      },
      {
        code: "CA17",
        name: "C. Valenciana",
        debtToGDP: 20.7,
        debtAbsolute: 72e9,
        debtYoYChangeAbsolute: 1.7e9,
        debtYoYChangePct: 2.4,
      },
    ],
    total: { debtToGDP: 20.4, debtAbsolute: 338e9 },
    quarter: "2025-Q3",
    sourceAttribution: {
      be1309: { source: "Banco de España be1309", url: "url1", type: "csv" },
      be1310: { source: "Banco de España be1310", url: "url2", type: "csv" },
    },
  };

  const mockTaxRevenue = {
    latestYear: 2024,
    ccaa: {
      "2024": {
        entries: [
          {
            code: "CA01",
            name: "Andalucía",
            total: 18_000,
            irpf: 0,
            iva: 0,
            sociedades: 0,
            iiee: 0,
            irnr: 0,
          },
          {
            code: "CA09",
            name: "Cataluña",
            total: 22_500,
            irpf: 0,
            iva: 0,
            sociedades: 0,
            iiee: 0,
            irnr: 0,
          },
          {
            code: "CA13",
            name: "Madrid",
            total: 20_100,
            irpf: 0,
            iva: 0,
            sociedades: 0,
            iiee: 0,
            irnr: 0,
          },
          {
            code: "CA17",
            name: "C. Valenciana",
            total: 16_400,
            irpf: 0,
            iva: 0,
            sociedades: 0,
            iiee: 0,
            irnr: 0,
          },
        ],
      },
    },
  };

  beforeEach(() => {
    (useData as any).mockReturnValue({ ccaaDebt: mockCcaaDebt, taxRevenue: mockTaxRevenue });
    window.history.replaceState({}, "", "/");
    tooltipPayload = {
      name: "Cataluña",
      code: "CA09",
      value: 28.4,
      isTop3: true,
    };
    capturedRows = [];
    axisSample = "";
  });

  it("ordena por deuda/PIB y marca visualmente top 3", () => {
    render(<CcaaDebtBlock />);
    expect(screen.getByText("Deuda por Comunidad Autónoma")).toBeDefined();

    expect(capturedRows).toEqual(["Cataluña", "C. Valenciana", "Andalucía", "Madrid"]);
    expect(screen.getByText(/be1310/)).toBeDefined();
    expect(screen.getByTestId("ref-line")).toBeDefined();
    expect(screen.getByText("Total nacional")).toBeInTheDocument();
    expect(screen.getByText(/% del PIB/)).toBeInTheDocument();

    const fills = screen.getAllByTestId("ccaa-cell").map((el) => el.getAttribute("data-fill"));
    expect(fills.slice(0, 3)).toEqual([
      "hsl(215, 65%, 45%)",
      "hsl(215, 65%, 45%)",
      "hsl(215, 65%, 45%)",
    ]);
    expect(fills[3]).toBe("hsl(215, 30%, 65%)");
  });

  it("hidrata estado desde query params", () => {
    window.history.replaceState({}, "", "/?section=ccaa&ccaa=CA09&ccaaMetric=debtAbsolute");
    render(<CcaaDebtBlock />);

    expect((screen.getByLabelText("Comunidad") as HTMLSelectElement).value).toBe("CA09");
    expect((screen.getByLabelText("Métrica") as HTMLSelectElement).value).toBe("debtAbsolute");
    expect(screen.getByText("Detalle: Cataluña")).toBeInTheDocument();
    expect(screen.getByText(/Déficit CCAA \(proxy\)/)).toBeInTheDocument();
    expect(screen.getByText(/Gasto CCAA \(proxy\)/)).toBeInTheDocument();
  });

  it("al cambiar a deuda absoluta reordena y sincroniza URL", () => {
    render(<CcaaDebtBlock />);
    const metricSelect = screen.getByLabelText("Métrica") as HTMLSelectElement;
    fireEvent.change(metricSelect, { target: { value: "debtAbsolute" } });

    expect(capturedRows).toEqual(["Andalucía", "C. Valenciana", "Madrid", "Cataluña"]);
    expect(screen.getByText(/be1309/)).toBeDefined();
    expect(screen.queryByTestId("ref-line")).toBeNull();
    expect(screen.queryByText("Total nacional")).toBeNull();
    expect(axisSample).toContain("mm€");
    expect(screen.getByText(/mm€/)).toBeInTheDocument();
    expect(window.location.search).toContain("ccaaMetric=debtAbsolute");
    expect(window.location.search).not.toContain("section=");
  });

  it("muestra detalle y proxies al seleccionar comunidad", () => {
    render(<CcaaDebtBlock />);
    const communitySelect = screen.getByLabelText("Comunidad") as HTMLSelectElement;
    fireEvent.change(communitySelect, { target: { value: "CA17" } });

    expect(screen.getByText("Detalle: C. Valenciana")).toBeInTheDocument();
    expect(screen.getByText(/Proxy por variación deuda/)).toBeInTheDocument();
    expect(screen.getByText(/Gasto estimado/)).toBeInTheDocument();
    expect(screen.getByText(/Ingresos tributarios AEAT/)).toBeInTheDocument();
    expect(window.location.search).toContain("ccaa=CA17");
  });

  it("no ensucia la URL en el montaje con valores por defecto", () => {
    render(<CcaaDebtBlock />);

    expect(window.location.search).toBe("");
  });

  it("renders chart component", () => {
    render(<CcaaDebtBlock />);
    expect(screen.getByTestId("bar-chart")).toBeDefined();
  });
});
