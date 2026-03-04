import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CcaaTaxTab, CcaaTooltip } from "../CcaaTaxTab";
import type { NationalBarDatum } from "../NationalTaxChart";
import { NationalTaxChart, NationalTooltip } from "../NationalTaxChart";

vi.mock("recharts", async () => {
  const actual = await vi.importActual("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  };
});

// ─── NationalTaxChart ────────────────────────────────────────────────────────

const nationalData: NationalBarDatum[] = [
  { name: "IRPF", key: "irpf", amount: 115000, percentage: 40 },
  { name: "IVA", key: "iva", amount: 90000, percentage: 31 },
];

const baseNationalProps = {
  data: nationalData,
  height: 300,
  drilldown: null as null,
  iieeData: [],
  restoData: [],
  onBarClick: vi.fn(),
  onBackToOverview: vi.fn(),
  backToOverviewLabel: "Volver al resumen",
  noDataLabel: "Sin datos",
  clickHintLabel: "Haz clic en una barra",
  lang: "es",
};

describe("NationalTaxChart", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the chart with provided data without crashing", () => {
    render(<NationalTaxChart {...baseNationalProps} />);
    // BarChart is rendered (chart container present); hint label visible
    expect(screen.getByText("Haz clic en una barra")).toBeInTheDocument();
  });

  it("shows noDataLabel when data is empty", () => {
    render(<NationalTaxChart {...baseNationalProps} data={[]} />);
    expect(screen.getByText("Sin datos")).toBeInTheDocument();
    // click hint still shown when not in drilldown mode
    expect(screen.getByText("Haz clic en una barra")).toBeInTheDocument();
  });

  it("shows back button when drilldown is active and calls onBackToOverview on click", () => {
    const onBack = vi.fn();
    render(<NationalTaxChart {...baseNationalProps} drilldown="iiee" onBackToOverview={onBack} />);
    const backBtn = screen.getByText(/Volver al resumen/);
    expect(backBtn).toBeInTheDocument();
    fireEvent.click(backBtn);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("hides click hint when drilldown is active", () => {
    render(<NationalTaxChart {...baseNationalProps} drilldown="resto" />);
    expect(screen.queryByText("Haz clic en una barra")).not.toBeInTheDocument();
  });
});

// ─── NationalTooltip ─────────────────────────────────────────────────────────

describe("NationalTooltip", () => {
  it("returns null when not active", () => {
    const { container } = render(<NationalTooltip active={false} />);
    expect(container.firstChild).toBeNull();
  });

  it("returns null when payload is empty", () => {
    const { container } = render(<NationalTooltip active={true} payload={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders name, amount and percentage when active with payload", () => {
    const payload = [
      {
        payload: {
          name: "IRPF",
          key: "irpf",
          amount: 115000,
          percentage: 40.5,
        },
      },
    ];
    render(<NationalTooltip active={true} payload={payload} />);
    expect(screen.getByText("IRPF")).toBeInTheDocument();
    expect(screen.getByText(/115\.000/)).toBeInTheDocument();
    expect(screen.getByText(/40,5/)).toBeInTheDocument();
  });
});

// ─── CcaaTooltip ─────────────────────────────────────────────────────────────

describe("CcaaTooltip", () => {
  it("returns null when not active", () => {
    const { container } = render(<CcaaTooltip active={false} metricLabel="Recaudación" />);
    expect(container.firstChild).toBeNull();
  });

  it("returns null when payload is empty", () => {
    const { container } = render(
      <CcaaTooltip active={true} payload={[]} metricLabel="Recaudación" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders name, metric label and value when active with payload", () => {
    const payload = [{ payload: { name: "Madrid", code: "MD", value: 75000, isTop3: true } }];
    render(<CcaaTooltip active={true} payload={payload} metricLabel="Recaudación" />);
    expect(screen.getByText("Madrid")).toBeInTheDocument();
    expect(screen.getByText(/Recaudación/)).toBeInTheDocument();
    expect(screen.getByText(/75\.000/)).toBeInTheDocument();
  });
});

// ─── CcaaTaxTab ──────────────────────────────────────────────────────────────

const ccaaData = [
  { name: "Madrid", code: "MD", value: 75000, isTop3: true },
  { name: "Cataluña", code: "CT", value: 60000, isTop3: true },
  { name: "Andalucía", code: "AN", value: 30000, isTop3: false },
];

const baseCopy = {
  ccaaMode: "Vista",
  ccaaModeAeat: "Recaudación AEAT",
  ccaaModeBalance: "Balance fiscal",
  taxType: "Tipo de impuesto",
  allTaxes: "Todos los impuestos",
  balanceMetric: "Métrica",
  balanceNet: "Saldo neto",
  balanceCeded: "Impuestos cedidos",
  balanceTransfers: "Transferencias",
  top3: "Top 3",
  restRegions: "Resto",
  balancePositive: "Contribuidor neto",
  balanceNegative: "Receptor neto",
  ccaaNoData: "Sin datos CCAA",
  balanceNoData: "Sin datos balance",
  foralNote: "Nota foral",
  balanceCoverageNote: "Nota cobertura balance",
  balanceFormulaNote: "Nota fórmula balance",
};

const taxNames: Record<string, string> = {
  irpf: "IRPF",
  iva: "IVA",
  sociedades: "Sociedades",
  iiee: "IIEE",
  irnr: "IRNR",
};

const baseCcaaProps = {
  data: ccaaData,
  chartHeight: 400,
  xDomain: [0, 80000] as [number, number],
  ccaaMode: "aeat" as const,
  selectedTaxType: "total" as const,
  selectedBalanceMetric: "netBalance" as const,
  metricLabel: "Recaudación",
  taxNames,
  onCcaaModeChange: vi.fn(),
  onTaxTypeChange: vi.fn(),
  onBalanceMetricChange: vi.fn(),
  copy: baseCopy,
};

describe("CcaaTaxTab", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders chart with data and shows top3/rest legend", () => {
    render(<CcaaTaxTab {...baseCcaaProps} />);
    expect(screen.getByText("Top 3")).toBeInTheDocument();
    expect(screen.getByText("Resto")).toBeInTheDocument();
    expect(screen.getByText("Nota foral")).toBeInTheDocument();
  });

  it("shows ccaaNoData when data is empty", () => {
    render(<CcaaTaxTab {...baseCcaaProps} data={[]} />);
    expect(screen.getByText("Sin datos CCAA")).toBeInTheDocument();
  });

  it("calls onCcaaModeChange when mode select changes", () => {
    const onModeChange = vi.fn();
    render(<CcaaTaxTab {...baseCcaaProps} onCcaaModeChange={onModeChange} />);
    fireEvent.change(screen.getByRole("combobox", { name: /Vista/i }), {
      target: { value: "balance" },
    });
    expect(onModeChange).toHaveBeenCalledWith("balance");
  });

  it("shows balance legend and formula note in balance mode with netBalance metric", () => {
    render(<CcaaTaxTab {...baseCcaaProps} ccaaMode="balance" selectedBalanceMetric="netBalance" />);
    expect(screen.getByText("Contribuidor neto")).toBeInTheDocument();
    expect(screen.getByText("Receptor neto")).toBeInTheDocument();
    expect(screen.getByText("Nota fórmula balance")).toBeInTheDocument();
    expect(screen.getByText("Nota cobertura balance")).toBeInTheDocument();
  });

  it("shows balanceNoData in balance mode when data is empty", () => {
    render(<CcaaTaxTab {...baseCcaaProps} ccaaMode="balance" data={[]} />);
    expect(screen.getByText("Sin datos balance")).toBeInTheDocument();
  });

  it("calls onTaxTypeChange when tax type select changes in aeat mode", () => {
    const onTaxTypeChange = vi.fn();
    render(<CcaaTaxTab {...baseCcaaProps} onTaxTypeChange={onTaxTypeChange} />);
    fireEvent.change(screen.getByRole("combobox", { name: /Tipo de impuesto/i }), {
      target: { value: "irpf" },
    });
    expect(onTaxTypeChange).toHaveBeenCalledWith("irpf");
  });

  it("calls onBalanceMetricChange when balance metric select changes in balance mode", () => {
    const onBalanceMetricChange = vi.fn();
    render(
      <CcaaTaxTab
        {...baseCcaaProps}
        ccaaMode="balance"
        onBalanceMetricChange={onBalanceMetricChange}
      />,
    );
    fireEvent.change(screen.getByRole("combobox", { name: /Métrica/i }), {
      target: { value: "cededTaxes" },
    });
    expect(onBalanceMetricChange).toHaveBeenCalledWith("cededTaxes");
  });

  it("shows top3/rest legend in balance mode with non-netBalance metric", () => {
    render(<CcaaTaxTab {...baseCcaaProps} ccaaMode="balance" selectedBalanceMetric="cededTaxes" />);
    expect(screen.getByText("Top 3")).toBeInTheDocument();
    expect(screen.getByText("Resto")).toBeInTheDocument();
    expect(screen.getByText("Nota cobertura balance")).toBeInTheDocument();
  });
});
