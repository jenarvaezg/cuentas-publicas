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
      {
        code: "CA15",
        name: "Navarra",
        debtToGDP: 14.2,
        debtAbsolute: 9e9,
        debtYoYChangeAbsolute: 0.2e9,
        debtYoYChangePct: 2.1,
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
          {
            code: "CA15",
            name: "Navarra",
            total: 3_200,
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

  const mockCcaaFiscalBalance = {
    years: [2023],
    latestYear: 2023,
    byYear: {
      "2023": {
        entries: [
          {
            code: "CA09",
            name: "Cataluña",
            cededTaxes: 1267,
            transfers: 1457,
            netBalance: 190,
            transferToTaxRatio: 1.15,
            cededTaxesBreakdown: { irpf: 0, iva: 0, iiee: 0 },
            transfersBreakdown: {
              fondoGarantia: 0,
              fondoSuficiencia: 0,
              fondoCompetitividad: 0,
              fondoCooperacion: 0,
            },
          },
        ],
      },
    },
  };

  const mockCcaaSpending = {
    years: [2024],
    latestYear: 2024,
    byYear: {
      "2024": {
        entries: [
          {
            code: "CA09",
            name: "Cataluña",
            total: 109_200,
            divisions: {
              "01": 11_100,
              "02": 0,
              "03": 3_200,
              "04": 8_400,
              "05": 2_600,
              "06": 1_700,
              "07": 42_900,
              "08": 2_800,
              "09": 25_700,
              "10": 10_800,
            },
            topDivisionCode: "07",
            topDivisionName: "Salud",
            topDivisionAmount: 42_900,
            topDivisionPct: 39.3,
          },
          {
            code: "CA17",
            name: "C. Valenciana",
            total: 30_500,
            divisions: {
              "01": 2_100,
              "02": 0,
              "03": 1_200,
              "04": 2_400,
              "05": 600,
              "06": 700,
              "07": 12_900,
              "08": 800,
              "09": 8_700,
              "10": 1_100,
            },
            topDivisionCode: "07",
            topDivisionName: "Salud",
            topDivisionAmount: 12_900,
            topDivisionPct: 42.3,
          },
        ],
      },
    },
  };

  const mockCcaaForalFlows = {
    years: [2024],
    latestYear: 2024,
    byYear: {
      "2024": {
        entries: [
          {
            code: "CA15",
            name: "Navarra",
            regime: "foral",
            paymentToState: 699,
            adjustmentsWithState: 1376,
            netFlowToState: -677,
            detail: {
              paymentLabel: "Total Pagos Aportación Neta",
              adjustmentsLabel: "Total Ajustes fiscales",
              unit: "M€",
            },
          },
        ],
      },
    },
  };

  const mockCcaaDeficit = {
    latestYear: 2023,
    data: {
      CA09: -3850,
      CA17: -2200,
      CA15: 150,
      CA01: -1200,
    },
  };

  beforeEach(() => {
    (useData as any).mockReturnValue({
      ccaaDebt: mockCcaaDebt,
      taxRevenue: mockTaxRevenue,
      ccaaFiscalBalance: mockCcaaFiscalBalance,
      ccaaForalFlows: mockCcaaForalFlows,
      ccaaSpending: mockCcaaSpending,
      ccaaDeficit: mockCcaaDeficit,
    });
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

    expect(capturedRows).toEqual(["Cataluña", "C. Valenciana", "Andalucía", "Navarra", "Madrid"]);
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
    expect(screen.getByText(/Déficit CCAA \(oficial\)/)).toBeInTheDocument();
    expect(screen.getByText(/Gasto CCAA \(oficial\)/)).toBeInTheDocument();
  });

  it("al cambiar a deuda absoluta reordena y sincroniza URL", () => {
    render(<CcaaDebtBlock />);
    const metricSelect = screen.getByLabelText("Métrica") as HTMLSelectElement;
    fireEvent.change(metricSelect, { target: { value: "debtAbsolute" } });

    expect(capturedRows).toEqual(["Andalucía", "C. Valenciana", "Madrid", "Cataluña", "Navarra"]);
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
    expect(screen.getByText(/Gasto total/)).toBeInTheDocument();
    expect(screen.getByText(/Ingresos tributarios AEAT/)).toBeInTheDocument();
    expect(window.location.search).toContain("ccaa=CA17");
  });

  it("muestra saldo oficial de Hacienda cuando hay dato para la comunidad", () => {
    window.history.replaceState({}, "", "/?section=ccaa&ccaa=CA09");
    render(<CcaaDebtBlock />);

    expect(screen.getByText(/Saldo CCAA \(oficial\)/)).toBeInTheDocument();
    expect(screen.getByText(/Saldo neto:\s*\+190 M€/)).toBeInTheDocument();
    expect(screen.getByText(/Gasto CCAA \(oficial\)/)).toBeInTheDocument();
    expect(screen.getByText(/Gasto total:\s*109\.200 M€/)).toBeInTheDocument();
    expect(screen.getByText(/Función principal:\s*Salud/)).toBeInTheDocument();
    expect(screen.getByText(/año oficial 2023/)).toBeInTheDocument();
  });

  it("muestra referencias forales cuando no hay balanza de régimen común", () => {
    window.history.replaceState({}, "", "/?section=ccaa&ccaa=CA15");
    render(<CcaaDebtBlock />);

    expect(
      screen.getByText(/Para esta comunidad se muestran referencias forales/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Pago al Estado:\s*699 M€/)).toBeInTheDocument();
    expect(screen.getByText(/Ajustes con el Estado:\s*1[.,]?376 M€/)).toBeInTheDocument();
    expect(screen.getByText(/Flujo neto:\s*-677 M€/)).toBeInTheDocument();
    expect(screen.getByText(/año foral 2024/)).toBeInTheDocument();
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
