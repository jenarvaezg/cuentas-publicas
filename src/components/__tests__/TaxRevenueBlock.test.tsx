import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useData } from "@/hooks/useData";
import { TaxRevenueBlock } from "../TaxRevenueBlock";

vi.mock("@/hooks/useData", () => ({ useData: vi.fn() }));
vi.mock("@/utils/export", () => ({ exportElementToPng: vi.fn() }));

vi.mock("@/i18n/I18nProvider", () => ({
  useI18n: () => ({
    lang: "es",
    msg: {
      blocks: { taxRevenue: { title: "Recaudación Tributaria" } },
      common: { year: "Año" },
    },
  }),
}));

vi.mock("../ExportBlockButton", () => ({
  ExportBlockButton: () => <button type="button">Exportar</button>,
}));

vi.mock("../StatCard", () => ({
  StatCard: ({ label, value }: any) => (
    <div data-testid="stat-card">
      <span data-testid="stat-label">{label}</span>
      <span data-testid="stat-value">{value}</span>
    </div>
  ),
}));

let capturedNationalData: any[] = [];
let capturedCcaaData: any[] = [];
let barClickHandler: ((data: any) => void) | undefined;

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  BarChart: ({ children, data }: any) => {
    // Distinguish national vs CCAA by checking data shape
    if (data?.[0] && "amount" in data[0]) {
      capturedNationalData = data ?? [];
    } else if (data?.[0] && "value" in data[0]) {
      capturedCcaaData = data ?? [];
    }
    return (
      <div data-testid="bar-chart">
        {(data ?? []).map((d: any) => (
          <span key={d.key ?? d.code} data-testid="bar-row" data-key={d.key ?? d.code}>
            {d.name}
          </span>
        ))}
        {children}
      </div>
    );
  },
  Bar: ({ children, onClick }: any) => {
    barClickHandler = onClick;
    return <div data-testid="bar">{children}</div>;
  },
  Cell: ({ fill }: any) => <span data-testid="chart-cell" data-fill={fill} />,
  XAxis: () => null,
  YAxis: ({ dataKey }: any) => <div data-testid="yaxis">{dataKey}</div>,
  Tooltip: () => null,
}));

const mockTaxRevenue = {
  lastUpdated: "2025-01-01T00:00:00.000Z",
  years: [2023, 2024],
  latestYear: 2024,
  national: {
    "2023": {
      total: 271935,
      irpf: 120366,
      iva: 83308,
      sociedades: 32176,
      irnr: 3817,
      iiee: 21102,
      resto: 11166,
    },
    "2024": {
      total: 295028,
      irpf: 129538,
      iva: 90631,
      sociedades: 39136,
      irnr: 4039,
      iiee: 22150,
      resto: 9535,
      iieeBreakdown: {
        alcohol: 371,
        cerveza: 464,
        productosIntermedios: 24,
        hidrocarburos: 10283,
        tabaco: 6765,
        electricidad: 1529,
        envasesPlastico: 393,
        carbon: 0,
        mediosTransporte: 2321,
      },
      restoBreakdown: {
        medioambientales: 2103,
        traficoExterior: 2053,
        primasSeguros: 1853,
        transaccionesFinancieras: 0,
        serviciosDigitales: 33,
        juego: 115,
        tasas: 3378,
      },
    },
  },
  ccaa: {
    "2024": {
      entries: [
        {
          code: "CA01",
          name: "Andalucía",
          total: 28500,
          irpf: 12000,
          iva: 9000,
          sociedades: 4000,
          iiee: 2500,
          irnr: 1000,
        },
        {
          code: "CA09",
          name: "Cataluña",
          total: 45000,
          irpf: 20000,
          iva: 14000,
          sociedades: 6000,
          iiee: 3500,
          irnr: 1500,
        },
        {
          code: "CA13",
          name: "Madrid",
          total: 65000,
          irpf: 30000,
          iva: 18000,
          sociedades: 12000,
          iiee: 3000,
          irnr: 2000,
        },
      ],
    },
  },
  sourceAttribution: {
    series: { source: "AEAT", type: "csv" as const, date: "2024-12-31" },
  },
};

const mockDemographics = {
  population: 48_000_000,
};

beforeEach(() => {
  vi.resetAllMocks();
  (useData as any).mockReturnValue({
    taxRevenue: mockTaxRevenue,
    demographics: mockDemographics,
  });
  window.history.replaceState({}, "", "/");
  capturedNationalData = [];
  capturedCcaaData = [];
  barClickHandler = undefined;
});

describe("TaxRevenueBlock", () => {
  it("renders title and 4 StatCards", () => {
    render(<TaxRevenueBlock />);
    expect(screen.getByText("Recaudación Tributaria")).toBeDefined();

    const cards = screen.getAllByTestId("stat-card");
    expect(cards).toHaveLength(4);

    const labels = screen.getAllByTestId("stat-label").map((el) => el.textContent);
    expect(labels).toContain("Recaudación neta total");
    expect(labels).toContain("Mayor impuesto");
    expect(labels).toContain("Variación interanual");
    expect(labels).toContain("Recaudación per cápita");
  });

  it("shows correct StatCard values for latest year", () => {
    render(<TaxRevenueBlock />);

    // YoY: (295028 - 271935) / 271935 * 100 ≈ +8.5%
    const values = screen.getAllByTestId("stat-value").map((el) => el.textContent);
    const yoyValue = values.find((v) => v?.startsWith("+"));
    expect(yoyValue).toBeDefined();
    expect(yoyValue).toContain("+");

    // Per capita: 295028 * 1e6 / 48e6 ≈ 6146 €
    const perCapitaValue = values.find((v) => v?.includes("€") && !v.includes("mm€"));
    expect(perCapitaValue).toBeDefined();
  });

  it("year selector changes displayed year", () => {
    render(<TaxRevenueBlock />);
    const select = screen.getByLabelText("Año") as HTMLSelectElement;
    expect(select.value).toBe("2024");

    fireEvent.change(select, { target: { value: "2023" } });
    expect(select.value).toBe("2023");
  });

  it("Nacional tab shows 6 tax bars by default", () => {
    render(<TaxRevenueBlock />);

    // Nacional is the default tab — national chart data should have 6 items
    expect(capturedNationalData).toHaveLength(6);

    const expectedKeys = ["irpf", "iva", "sociedades", "iiee", "irnr", "resto"];
    const renderedKeys = capturedNationalData.map((d) => d.key);
    for (const key of expectedKeys) {
      expect(renderedKeys).toContain(key);
    }
  });

  it("Nacional tab bars are sorted descending by amount", () => {
    render(<TaxRevenueBlock />);

    const amounts = capturedNationalData.map((d) => d.amount);
    for (let i = 1; i < amounts.length; i++) {
      expect(amounts[i - 1]).toBeGreaterThanOrEqual(amounts[i]);
    }
  });

  it("drilldown into IIEE shows 9 subcategory bars", () => {
    render(<TaxRevenueBlock />);

    // Simulate clicking the IIEE bar via the captured onClick handler
    expect(barClickHandler).toBeDefined();
    act(() => {
      barClickHandler?.({
        key: "iiee",
        name: "Impuestos Especiales",
        amount: 22150,
        percentage: 7.5,
      });
    });

    // After drilldown, national data should now be IIEE breakdown (9 items)
    expect(capturedNationalData).toHaveLength(9);

    const iieeKeys = [
      "alcohol",
      "cerveza",
      "productosIntermedios",
      "hidrocarburos",
      "tabaco",
      "electricidad",
      "envasesPlastico",
      "carbon",
      "mediosTransporte",
    ];
    const renderedKeys = capturedNationalData.map((d) => d.key);
    for (const key of iieeKeys) {
      expect(renderedKeys).toContain(key);
    }
  });

  it("back button exits drilldown and shows 6 bars again", () => {
    render(<TaxRevenueBlock />);

    // Drill into IIEE
    act(() => {
      barClickHandler?.({
        key: "iiee",
        name: "Impuestos Especiales",
        amount: 22150,
        percentage: 7.5,
      });
    });
    expect(capturedNationalData).toHaveLength(9);

    // Back button should appear
    const backBtn = screen.getByText(/Volver al resumen/);
    expect(backBtn).toBeInTheDocument();
    fireEvent.click(backBtn);

    // Should return to 6-bar overview
    expect(capturedNationalData).toHaveLength(6);
    expect(screen.queryByText(/Volver al resumen/)).toBeNull();
  });

  it("year change resets drilldown", () => {
    render(<TaxRevenueBlock />);

    act(() => {
      barClickHandler?.({
        key: "iiee",
        name: "Impuestos Especiales",
        amount: 22150,
        percentage: 7.5,
      });
    });
    expect(capturedNationalData).toHaveLength(9);

    const select = screen.getByLabelText("Año") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "2023" } });

    // 2023 has no iieeBreakdown → back to 6-bar national view
    expect(capturedNationalData).toHaveLength(6);
    expect(screen.queryByText(/Volver al resumen/)).toBeNull();
  });

  it("CCAA tab shows chart when entries are present", () => {
    render(<TaxRevenueBlock />);

    const ccaaBtn = screen.getByText("Por CCAA");
    fireEvent.click(ccaaBtn);

    // Should render CCAA chart data with 3 regions
    expect(capturedCcaaData).toHaveLength(3);

    const names = capturedCcaaData.map((d) => d.name);
    expect(names).toContain("Andalucía");
    expect(names).toContain("Cataluña");
    expect(names).toContain("Madrid");
  });

  it("CCAA tab shows empty state when no entries for selected year", () => {
    (useData as any).mockReturnValue({
      taxRevenue: {
        ...mockTaxRevenue,
        ccaa: {},
      },
      demographics: mockDemographics,
    });

    render(<TaxRevenueBlock />);
    const ccaaBtn = screen.getByText("Por CCAA");
    fireEvent.click(ccaaBtn);

    expect(screen.getByText("Datos por CCAA no disponibles para este año.")).toBeInTheDocument();
  });

  it("CCAA tab marks top 3 regions correctly", () => {
    render(<TaxRevenueBlock />);
    const ccaaBtn = screen.getByText("Por CCAA");
    fireEvent.click(ccaaBtn);

    // Sorted desc by total: Madrid(65000), Cataluña(45000), Andalucía(28500)
    const sorted = capturedCcaaData.map((d) => d.name);
    expect(sorted[0]).toBe("Madrid");
    expect(sorted[1]).toBe("Cataluña");
    expect(sorted[2]).toBe("Andalucía");

    expect(capturedCcaaData[0].isTop3).toBe(true);
    expect(capturedCcaaData[1].isTop3).toBe(true);
    expect(capturedCcaaData[2].isTop3).toBe(true);
  });

  it("tax type selector in CCAA mode filters by tax type", () => {
    render(<TaxRevenueBlock />);
    const ccaaBtn = screen.getByText("Por CCAA");
    fireEvent.click(ccaaBtn);

    // Default is total — Madrid highest
    expect(capturedCcaaData[0].name).toBe("Madrid");

    const taxTypeSelect = screen.getByLabelText("Impuesto") as HTMLSelectElement;
    fireEvent.change(taxTypeSelect, { target: { value: "irpf" } });
    expect(taxTypeSelect.value).toBe("irpf");

    // IRPF: Madrid 30000, Cataluña 20000, Andalucía 12000 — same order
    expect(capturedCcaaData[0].name).toBe("Madrid");
    expect(capturedCcaaData[0].value).toBe(30000);
  });

  it("does not dirty the URL on mount with default values", () => {
    render(<TaxRevenueBlock />);
    expect(window.location.search).toBe("");
  });

  it("updates URL when non-default year is selected", () => {
    render(<TaxRevenueBlock />);
    const select = screen.getByLabelText("Año") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "2023" } });
    expect(window.location.search).toContain("taxYear=2023");
  });

  it("updates URL when CCAA tab is selected", () => {
    render(<TaxRevenueBlock />);
    const ccaaBtn = screen.getByText("Por CCAA");
    fireEvent.click(ccaaBtn);
    expect(window.location.search).toContain("taxTab=ccaa");
  });

  it("renders national chart component", () => {
    render(<TaxRevenueBlock />);
    expect(screen.getByTestId("bar-chart")).toBeDefined();
  });

  it("preserves negative CCAA values without clamping", () => {
    (useData as any).mockReturnValue({
      taxRevenue: {
        ...mockTaxRevenue,
        ccaa: {
          "2024": {
            entries: [
              {
                code: "CA13",
                name: "Madrid",
                total: 65000,
                irpf: 30000,
                iva: 18000,
                sociedades: 12000,
                iiee: 3000,
                irnr: 2000,
              },
              {
                code: "CA15",
                name: "Navarra",
                total: -50,
                irpf: -20,
                iva: -15,
                sociedades: -10,
                iiee: -3,
                irnr: -2,
              },
            ],
          },
        },
      },
      demographics: mockDemographics,
    });

    render(<TaxRevenueBlock />);
    const ccaaBtn = screen.getByText("Por CCAA");
    fireEvent.click(ccaaBtn);

    expect(capturedCcaaData).toHaveLength(2);

    const madrid = capturedCcaaData.find((d) => d.name === "Madrid");
    const navarra = capturedCcaaData.find((d) => d.name === "Navarra");

    // Values are preserved as-is, no clamping
    expect(madrid?.value).toBe(65000);
    expect(navarra?.value).toBe(-50);
  });
});
