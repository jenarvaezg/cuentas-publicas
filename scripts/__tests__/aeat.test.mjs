import { describe, it, expect, vi, beforeEach } from "vitest";
import { downloadTaxRevenueData } from "../sources/aeat.mjs";
import * as fetchUtils from "../lib/fetch-utils.mjs";
import XLSX from "xlsx";

vi.mock("../lib/fetch-utils.mjs", () => ({
  fetchWithRetry: vi.fn(),
}));

vi.mock("xlsx", () => ({
  default: {
    read: vi.fn(),
    utils: {
      sheet_to_json: vi.fn(),
    },
  },
}));

// ─────────────────────────────────────────────
// Test data builders
// ─────────────────────────────────────────────

/**
 * Build a national "Ingresos tributarios" row for a given year/month.
 * Column indices must match COL in aeat.mjs:
 *   0=year, 1=month, 2=monthName, 6=total, 29=irpf, 65=sociedades,
 *   82=irnr, 107=iva, 137=iieeTotal, 178=resto
 * Sub-columns for IIEE and Resto also populated.
 */
function buildNationalRow(year, month, values = {}) {
  const row = new Array(200).fill(0);
  row[0] = year;
  row[1] = month;
  row[2] = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ][month - 1];

  const {
    total = 1000,
    irpf = 400,
    sociedades = 200,
    irnr = 20,
    iva = 300,
    iiee = 60,
    resto = 20,
  } = values;

  // Main columns (values in thousands of euros)
  row[6] = total;
  row[29] = irpf;
  row[65] = sociedades;
  row[82] = irnr;
  row[107] = iva;
  row[137] = iiee;
  row[178] = resto;

  // IIEE sub-columns
  row[142] = 5; // alcohol
  row[147] = 5; // cerveza
  row[152] = 1; // productosIntermedios
  row[157] = 20; // hidrocarburos
  row[162] = 15; // tabaco
  row[168] = 8; // electricidad
  row[173] = 3; // envasesPlastico
  row[174] = 0; // carbon
  row[175] = 3; // mediosTransporte

  // Resto sub-columns
  row[180] = 4; // medioambientales
  row[183] = 4; // traficoExterior
  row[184] = 4; // primasSeguros
  row[185] = 0; // transaccionesFinancieras
  row[186] = 1; // serviciosDigitales
  row[187] = 2; // juego
  row[188] = 5; // tasas

  return row;
}

/**
 * Build 12 monthly rows for a complete year.
 */
function buildCompleteYear(year, values = {}) {
  return Array.from({ length: 12 }, (_, i) =>
    buildNationalRow(year, i + 1, values),
  );
}

/**
 * Build a delegaciones header row with D.E. columns.
 * Layout: [Ejercicio, Mes, Concepto, ..., D.E. Madrid, D.E. Cataluña, ...]
 */
function buildDelegacionesHeader() {
  return [
    "Ejercicio",
    "Mes",
    "Concepto",
    "Nacional",
    "D.E. Madrid",
    "D.E. Cataluña",
    "D.E. Andalucía",
  ];
}

/**
 * Build a delegaciones data row.
 */
function buildDelegacionesRow(year, month, concept, ccaaValues = {}) {
  const { madrid = 100, cataluna = 80, andalucia = 60 } = ccaaValues;
  return [year, month, concept, madrid + cataluna + andalucia, madrid, cataluna, andalucia];
}

/**
 * Build 12 months of delegaciones rows for a single concept.
 */
function buildDelegacionesConcept(year, concept, ccaaValues = {}) {
  return Array.from({ length: 12 }, (_, i) =>
    buildDelegacionesRow(year, i + 1, concept, ccaaValues),
  );
}

/**
 * Build a complete year of delegaciones with all concepts.
 */
function buildCompleteDelegacionesYear(year) {
  return [
    ...buildDelegacionesConcept(year, "Total Ingresos netos", {
      madrid: 100,
      cataluna: 80,
      andalucia: 60,
    }),
    ...buildDelegacionesConcept(year, "IRPF Ingresos netos", {
      madrid: 40,
      cataluna: 30,
      andalucia: 20,
    }),
    ...buildDelegacionesConcept(year, "IVA Ingresos netos", {
      madrid: 30,
      cataluna: 25,
      andalucia: 20,
    }),
    ...buildDelegacionesConcept(year, "I.SOCIEDADES Ingresos netos", {
      madrid: 20,
      cataluna: 15,
      andalucia: 10,
    }),
    ...buildDelegacionesConcept(year, "II.EE. Ingresos netos", {
      madrid: 5,
      cataluna: 5,
      andalucia: 5,
    }),
    ...buildDelegacionesConcept(year, "IRNR Ingresos netos", {
      madrid: 5,
      cataluna: 5,
      andalucia: 5,
    }),
  ];
}

// ─────────────────────────────────────────────
// Mock setup helpers
// ─────────────────────────────────────────────

function mockFetchBothOk() {
  fetchUtils.fetchWithRetry.mockResolvedValue({
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
  });
}

function mockFetchNationalOkCcaaFail() {
  let callCount = 0;
  fetchUtils.fetchWithRetry.mockImplementation(() => {
    callCount++;
    if (callCount === 1) {
      // National fetch succeeds
      return Promise.resolve({
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
      });
    }
    // CCAA fetch fails
    return Promise.reject(new Error("CCAA download failed"));
  });
}

function mockXlsxNational(rows) {
  XLSX.read.mockReturnValue({
    SheetNames: ["Ingresos tributarios"],
    Sheets: { "Ingresos tributarios": {} },
  });
  XLSX.utils.sheet_to_json.mockReturnValue(rows);
}

function mockXlsxBoth(nationalRows, delegacionesRows) {
  let callCount = 0;
  XLSX.read.mockImplementation(() => {
    callCount++;
    if (callCount === 1) {
      return {
        SheetNames: ["Ingresos tributarios"],
        Sheets: { "Ingresos tributarios": {} },
      };
    }
    return {
      SheetNames: ["Datos_delegaciones"],
      Sheets: { Datos_delegaciones: {} },
    };
  });

  let jsonCallCount = 0;
  XLSX.utils.sheet_to_json.mockImplementation(() => {
    jsonCallCount++;
    if (jsonCallCount === 1) return nationalRows;
    return delegacionesRows;
  });
}

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

describe("aeat source script", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // ───── Happy path ─────

  describe("happy path — national + CCAA", () => {
    it("descarga y parsea datos nacionales y CCAA correctamente", async () => {
      mockFetchBothOk();

      const nationalRows = [
        ["header", "row", "ignored"],
        ...buildCompleteYear(2023),
        ...buildCompleteYear(2024, { total: 2000, irpf: 800, iva: 600, sociedades: 400, irnr: 40, iiee: 120, resto: 40 }),
      ];
      const delegacionesRows = [
        buildDelegacionesHeader(),
        ...buildCompleteDelegacionesYear(2024),
      ];

      mockXlsxBoth(nationalRows, delegacionesRows);

      const result = await downloadTaxRevenueData();

      // Structure
      expect(result.lastUpdated).toBeDefined();
      expect(result.years).toEqual([2023, 2024]);
      expect(result.latestYear).toBe(2024);
      expect(result.national).toBeDefined();
      expect(result.ccaa).toBeDefined();
      expect(result.sourceAttribution.series.type).toBe("xlsx");
      expect(result.sourceAttribution.delegaciones.type).toBe("xlsx");
    });

    it("agrega correctamente 12 meses de datos nacionales a totales anuales", async () => {
      mockFetchBothOk();

      // Each month: total=1000 (thousands), so annual = 12*1000 = 12000 thousands = 12 millions
      const nationalRows = [...buildCompleteYear(2024)];
      mockXlsxBoth(nationalRows, [buildDelegacionesHeader()]);

      const result = await downloadTaxRevenueData();

      const y2024 = result.national["2024"];
      expect(y2024.total).toBe(12); // 12000 thousands → 12 millions
      expect(y2024.irpf).toBe(5); // 400*12/1000 ≈ 5 (rounded)
      expect(y2024.iva).toBe(4); // 300*12/1000 ≈ 4
      expect(y2024.sociedades).toBe(2); // 200*12/1000 ≈ 2
    });

    it("incluye breakdown de IIEE y Resto en datos nacionales", async () => {
      mockFetchBothOk();
      mockXlsxBoth([...buildCompleteYear(2024)], [buildDelegacionesHeader()]);

      const result = await downloadTaxRevenueData();
      const y2024 = result.national["2024"];

      expect(y2024.iieeBreakdown).toBeDefined();
      expect(y2024.iieeBreakdown).toHaveProperty("alcohol");
      expect(y2024.iieeBreakdown).toHaveProperty("hidrocarburos");
      expect(y2024.iieeBreakdown).toHaveProperty("tabaco");
      expect(y2024.iieeBreakdown).toHaveProperty("electricidad");
      expect(y2024.iieeBreakdown).toHaveProperty("envasesPlastico");

      expect(y2024.restoBreakdown).toBeDefined();
      expect(y2024.restoBreakdown).toHaveProperty("medioambientales");
      expect(y2024.restoBreakdown).toHaveProperty("traficoExterior");
      expect(y2024.restoBreakdown).toHaveProperty("tasas");
    });

    it("parsea datos CCAA correctamente con 3 comunidades", async () => {
      mockFetchBothOk();

      const delegacionesRows = [
        buildDelegacionesHeader(),
        ...buildCompleteDelegacionesYear(2024),
      ];
      mockXlsxBoth([...buildCompleteYear(2024)], delegacionesRows);

      const result = await downloadTaxRevenueData();

      const ccaa2024 = result.ccaa["2024"];
      expect(ccaa2024).toBeDefined();
      expect(ccaa2024.entries.length).toBe(3);

      // Entries sorted by CA code
      const madrid = ccaa2024.entries.find((e) => e.name === "Madrid");
      expect(madrid).toBeDefined();
      expect(madrid.code).toBe("CA13");
      // 100 thousands * 12 months / 1000 = 1 million (rounded)
      expect(madrid.total).toBe(1);

      const cataluna = ccaa2024.entries.find((e) => e.name === "Cataluña");
      expect(cataluna).toBeDefined();
      expect(cataluna.code).toBe("CA09");

      const andalucia = ccaa2024.entries.find(
        (e) => e.name === "Andalucía",
      );
      expect(andalucia).toBeDefined();
      expect(andalucia.code).toBe("CA01");
    });

    it("ordena entries CCAA por código de comunidad", async () => {
      mockFetchBothOk();
      mockXlsxBoth(
        [...buildCompleteYear(2024)],
        [buildDelegacionesHeader(), ...buildCompleteDelegacionesYear(2024)],
      );

      const result = await downloadTaxRevenueData();
      const codes = result.ccaa["2024"].entries.map((e) => e.code);

      // CA01 (Andalucía), CA09 (Cataluña), CA13 (Madrid)
      expect(codes).toEqual(["CA01", "CA09", "CA13"]);
    });
  });

  // ───── Incomplete year filtering ─────

  describe("filtrado de años incompletos", () => {
    it("omite años nacionales con menos de 12 meses", async () => {
      mockFetchBothOk();

      const completeYear = buildCompleteYear(2023);
      // Only 6 months for 2024
      const incompleteYear = Array.from({ length: 6 }, (_, i) =>
        buildNationalRow(2024, i + 1),
      );

      mockXlsxBoth([...completeYear, ...incompleteYear], [buildDelegacionesHeader()]);

      const result = await downloadTaxRevenueData();

      expect(result.years).toContain(2023);
      expect(result.years).not.toContain(2024);
      expect(result.national["2023"]).toBeDefined();
      expect(result.national["2024"]).toBeUndefined();
    });

    it("omite año CCAA si el concepto 'total' tiene menos de 12 meses", async () => {
      mockFetchBothOk();

      const header = ["Ejercicio", "Mes", "Concepto", "Nacional", "D.E. Madrid"];
      const rows = [header];

      // 2023: complete (12 months of total)
      for (let m = 1; m <= 12; m++) {
        rows.push([2023, m, "Total Ingresos netos", 100, 100]);
      }
      // 2024: incomplete (only 6 months of total)
      for (let m = 1; m <= 6; m++) {
        rows.push([2024, m, "Total Ingresos netos", 100, 100]);
      }

      mockXlsxBoth(
        [...buildCompleteYear(2023), ...buildCompleteYear(2024)],
        rows,
      );

      const result = await downloadTaxRevenueData();

      expect(result.ccaa["2023"]).toBeDefined(); // complete
      expect(result.ccaa["2024"]).toBeUndefined(); // incomplete — omitted
    });
  });

  // ───── Validation ─────

  describe("validación de componentes", () => {
    it("emite warning cuando la suma de componentes difiere del total > 1%", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      mockFetchBothOk();

      // total = 1000 pero componentes suman mucho menos (irpf=100 + iva=100 + ... = ~300)
      const mismatchRows = buildCompleteYear(2024, {
        total: 10000,
        irpf: 100,
        iva: 100,
        sociedades: 50,
        irnr: 10,
        iiee: 20,
        resto: 10,
      });

      mockXlsxBoth(mismatchRows, [buildDelegacionesHeader()]);
      await downloadTaxRevenueData();

      expect(
        warnSpy.mock.calls.some(([msg]) =>
          String(msg).includes("Validación"),
        ),
      ).toBe(true);
      warnSpy.mockRestore();
    });

    it("no emite warning cuando componentes suman correctamente", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      mockFetchBothOk();

      // Components sum to total exactly
      const rows = buildCompleteYear(2024, {
        total: 1000,
        irpf: 400,
        iva: 300,
        sociedades: 200,
        irnr: 20,
        iiee: 60,
        resto: 20,
      });

      mockXlsxBoth(rows, [buildDelegacionesHeader()]);
      await downloadTaxRevenueData();

      expect(
        warnSpy.mock.calls.some(([msg]) =>
          String(msg).includes("Validación"),
        ),
      ).toBe(false);
      warnSpy.mockRestore();
    });
  });

  // ───── Number parsing ─────

  describe("parseo de números (toNum)", () => {
    it("maneja celdas con formato español (puntos de miles, coma decimal)", async () => {
      mockFetchBothOk();

      // Build rows with Spanish-formatted strings in the total column
      const rows = [];
      for (let m = 1; m <= 12; m++) {
        const row = new Array(200).fill(0);
        row[0] = 2024;
        row[1] = m;
        row[2] = "Mes";
        row[6] = "1.234.567,89"; // Spanish format: 1,234,567.89
        row[29] = "500.000";
        row[65] = "200.000";
        row[82] = "10.000";
        row[107] = "400.000";
        row[137] = "100.000";
        row[178] = "24.567,89";
        rows.push(row);
      }

      mockXlsxBoth(rows, [buildDelegacionesHeader()]);

      const result = await downloadTaxRevenueData();
      const y2024 = result.national["2024"];

      // 1234567.89 * 12 months / 1000 = ~14815 millions
      expect(y2024.total).toBe(14815);
    });

    it("trata null, undefined y cadenas vacías como cero", async () => {
      mockFetchBothOk();

      const rows = [];
      for (let m = 1; m <= 12; m++) {
        const row = new Array(200).fill(0);
        row[0] = 2024;
        row[1] = m;
        row[2] = "Mes";
        row[6] = m <= 4 ? null : m <= 8 ? undefined : "";
        rows.push(row);
      }

      mockXlsxBoth(rows, [buildDelegacionesHeader()]);

      const result = await downloadTaxRevenueData();
      expect(result.national["2024"].total).toBe(0);
    });

    it("trata texto no numérico como cero", async () => {
      mockFetchBothOk();

      const rows = [];
      for (let m = 1; m <= 12; m++) {
        const row = new Array(200).fill(0);
        row[0] = 2024;
        row[1] = m;
        row[2] = "Mes";
        row[6] = "N/A";
        rows.push(row);
      }

      mockXlsxBoth(rows, [buildDelegacionesHeader()]);

      const result = await downloadTaxRevenueData();
      expect(result.national["2024"].total).toBe(0);
    });
  });

  // ───── Row filtering ─────

  describe("filtrado de filas no válidas", () => {
    it("ignora filas de cabecera y filas con año fuera de rango", async () => {
      mockFetchBothOk();

      const rows = [
        ["Año", "Mes", "Concepto", "", "", "", "Total"], // header
        ["", 1, "Enero", 0, 0, 0, 999], // no year
        [1800, 1, "Enero", 0, 0, 0, 999], // year too old
        [2200, 1, "Enero", 0, 0, 0, 999], // year too far
        ...buildCompleteYear(2024),
      ];

      mockXlsxBoth(rows, [buildDelegacionesHeader()]);

      const result = await downloadTaxRevenueData();

      expect(result.years).toEqual([2024]);
      expect(result.national["1800"]).toBeUndefined();
      expect(result.national["2200"]).toBeUndefined();
    });

    it("ignora filas con mes fuera de rango (0, 13, negativo)", async () => {
      mockFetchBothOk();

      const goodRows = buildCompleteYear(2024);
      const badRows = [
        buildNationalRow(2024, 0),
        buildNationalRow(2024, 13),
        buildNationalRow(2024, -1),
      ];
      // Add values that would make the totals wrong if counted
      for (const row of badRows) {
        row[6] = 999999;
      }

      mockXlsxBoth([...goodRows, ...badRows], [buildDelegacionesHeader()]);

      const result = await downloadTaxRevenueData();

      // total = 1000 * 12 / 1000 = 12 (bad rows should NOT be included)
      expect(result.national["2024"].total).toBe(12);
    });
  });

  // ───── Fallback behavior ─────

  describe("fallback", () => {
    it("usa datos de referencia nacionales si falla la descarga", async () => {
      fetchUtils.fetchWithRetry.mockRejectedValue(
        new Error("Network error"),
      );

      const result = await downloadTaxRevenueData();

      expect(result.national["2024"]).toBeDefined();
      expect(result.national["2024"].total).toBe(295028);
      expect(result.national["2024"].irpf).toBe(129538);
      expect(result.sourceAttribution.series.type).toBe("fallback");
      expect(result.sourceAttribution.series.note).toMatch(
        /referencia|descarga.*no disponible/i,
      );
    });

    it("continúa sin datos CCAA si falla solo la descarga de delegaciones", async () => {
      mockFetchNationalOkCcaaFail();

      const nationalRows = [...buildCompleteYear(2024)];
      mockXlsxNational(nationalRows);

      const result = await downloadTaxRevenueData();

      // National data is present
      expect(result.national["2024"]).toBeDefined();
      expect(result.sourceAttribution.series.type).toBe("xlsx");

      // CCAA is empty but not broken
      expect(result.ccaa).toEqual({});
      expect(result.sourceAttribution.delegaciones.type).toBe("fallback");
    });

    it("usa referencia nacional y CCAA vacío si ambas descargas fallan", async () => {
      fetchUtils.fetchWithRetry.mockRejectedValue(
        new Error("Everything is down"),
      );

      const result = await downloadTaxRevenueData();

      expect(result.sourceAttribution.series.type).toBe("fallback");
      expect(result.sourceAttribution.delegaciones.type).toBe("fallback");
      expect(result.national["2024"].total).toBe(295028);
      expect(Object.keys(result.ccaa).length).toBe(0);
    });
  });

  // ───── Sheet selection ─────

  describe("selección de hoja Excel", () => {
    it('busca hoja "Ingresos tributarios" por nombre', async () => {
      mockFetchBothOk();

      XLSX.read.mockReturnValue({
        SheetNames: ["Indice", "Resumen", "Ingresos tributarios", "Cuadros"],
        Sheets: { "Ingresos tributarios": {} },
      });
      XLSX.utils.sheet_to_json.mockReturnValue([...buildCompleteYear(2024)]);

      const result = await downloadTaxRevenueData();
      expect(result.national["2024"]).toBeDefined();
    });

    it("cae a la primera hoja si no encuentra por nombre", async () => {
      mockFetchBothOk();

      XLSX.read.mockReturnValue({
        SheetNames: ["Datos2024"],
        Sheets: { Datos2024: {} },
      });
      XLSX.utils.sheet_to_json.mockReturnValue([...buildCompleteYear(2024)]);

      const result = await downloadTaxRevenueData();
      expect(result.national["2024"]).toBeDefined();
    });
  });

  // ───── CCAA column detection ─────

  describe("detección de columnas CCAA", () => {
    it("solo mapea columnas con prefijo D.E., ignora provincias", async () => {
      mockFetchBothOk();

      const header = [
        "Ejercicio",
        "Mes",
        "Concepto",
        "Total Nacional",
        "D.E. Madrid",
        "Almería", // province — should be ignored
        "Cádiz", // province — should be ignored
        "D.E. Andalucía",
      ];

      const rows = [header];
      for (let m = 1; m <= 12; m++) {
        rows.push([2024, m, "Total Ingresos netos", 300, 100, 50, 50, 100]);
      }

      mockXlsxBoth([...buildCompleteYear(2024)], rows);

      const result = await downloadTaxRevenueData();

      const entries = result.ccaa["2024"]?.entries ?? [];
      const names = entries.map((e) => e.name);

      expect(names).toContain("Madrid");
      expect(names).toContain("Andalucía");
      expect(names).not.toContain("Almería");
      expect(names).not.toContain("Cádiz");
    });

    it("lanza error si no detecta ninguna columna CCAA", async () => {
      mockFetchBothOk();

      const header = ["Ejercicio", "Mes", "Concepto", "Total"];
      mockXlsxBoth([...buildCompleteYear(2024)], [header, [2024, 1, "Total Ingresos netos", 100]]);

      // Should handle CCAA error gracefully (empty ccaa)
      const result = await downloadTaxRevenueData();
      expect(Object.keys(result.ccaa).length).toBe(0);
    });
  });

  // ───── Concept matching ─────

  describe("matcheo de conceptos en delegaciones", () => {
    it("mapea todos los conceptos AEAT correctamente", async () => {
      mockFetchBothOk();

      const header = ["Ejercicio", "Mes", "Concepto", "Nacional", "D.E. Madrid"];
      const rows = [header];

      // All 6 concepts for 12 months
      const concepts = [
        "Total Ingresos netos",
        "IRPF Ingresos netos",
        "IVA Ingresos netos",
        "I.SOCIEDADES Ingresos netos",
        "II.EE. Ingresos netos",
        "IRNR Ingresos netos",
      ];

      for (const concept of concepts) {
        for (let m = 1; m <= 12; m++) {
          rows.push([2024, m, concept, 100, 100]);
        }
      }

      mockXlsxBoth([...buildCompleteYear(2024)], rows);

      const result = await downloadTaxRevenueData();

      const madrid = result.ccaa["2024"]?.entries?.find(
        (e) => e.name === "Madrid",
      );
      expect(madrid).toBeDefined();
      expect(madrid.total).toBeGreaterThan(0);
      expect(madrid.irpf).toBeGreaterThan(0);
      expect(madrid.iva).toBeGreaterThan(0);
      expect(madrid.sociedades).toBeGreaterThan(0);
      expect(madrid.iiee).toBeGreaterThan(0);
      expect(madrid.irnr).toBeGreaterThan(0);
    });

    it("ignora conceptos desconocidos sin romper", async () => {
      mockFetchBothOk();

      const header = ["Ejercicio", "Mes", "Concepto", "Nacional", "D.E. Madrid"];
      const rows = [header];

      // Known concept
      for (let m = 1; m <= 12; m++) {
        rows.push([2024, m, "Total Ingresos netos", 100, 100]);
      }
      // Unknown concept — should be silently ignored
      for (let m = 1; m <= 12; m++) {
        rows.push([2024, m, "Concepto inventado XYZ", 999, 999]);
      }

      mockXlsxBoth([...buildCompleteYear(2024)], rows);

      const result = await downloadTaxRevenueData();

      const madrid = result.ccaa["2024"]?.entries?.find(
        (e) => e.name === "Madrid",
      );
      expect(madrid).toBeDefined();
      // Only "total" was matched, so total = 100*12/1000 = 1
      expect(madrid.total).toBe(1);
    });
  });

  // ───── Multiple years ─────

  describe("múltiples años", () => {
    it("procesa varios años nacionales ordenados cronológicamente", async () => {
      mockFetchBothOk();

      const rows = [
        ...buildCompleteYear(2022, { total: 500 }),
        ...buildCompleteYear(2024, { total: 1000 }),
        ...buildCompleteYear(2023, { total: 750 }),
      ];

      mockXlsxBoth(rows, [buildDelegacionesHeader()]);

      const result = await downloadTaxRevenueData();

      expect(result.years).toEqual([2022, 2023, 2024]);
      expect(result.latestYear).toBe(2024);

      // 500*12/1000 = 6, 750*12/1000 = 9, 1000*12/1000 = 12
      expect(result.national["2022"].total).toBe(6);
      expect(result.national["2023"].total).toBe(9);
      expect(result.national["2024"].total).toBe(12);
    });
  });

  // ───── Source attribution ─────

  describe("atribución de fuentes", () => {
    it("incluye URLs de AEAT en la atribución", async () => {
      mockFetchBothOk();
      mockXlsxBoth(
        [...buildCompleteYear(2024)],
        [buildDelegacionesHeader(), ...buildCompleteDelegacionesYear(2024)],
      );

      const result = await downloadTaxRevenueData();

      expect(result.sourceAttribution.series.url).toMatch(
        /agenciatributaria\.gob\.es/,
      );
      expect(result.sourceAttribution.delegaciones.url).toMatch(
        /agenciatributaria\.gob\.es/,
      );
    });

    it("incluye rango de años en la descripción de fuente", async () => {
      mockFetchBothOk();
      mockXlsxBoth(
        [...buildCompleteYear(2022), ...buildCompleteYear(2024)],
        [buildDelegacionesHeader()],
      );

      const result = await downloadTaxRevenueData();

      expect(result.sourceAttribution.series.source).toMatch(/2022.*2024/);
    });
  });

  // ───── Delegaciones header detection ─────

  describe("detección del header de delegaciones", () => {
    it('detecta header que contiene "Ejercicio"', async () => {
      mockFetchBothOk();

      const rows = [
        ["Título del informe", "", "", ""],
        ["", "", "", ""],
        ["Ejercicio", "Mes", "Concepto", "D.E. Madrid"],
        ...Array.from({ length: 12 }, (_, i) => [
          2024, i + 1, "Total Ingresos netos", 100,
        ]),
      ];

      mockXlsxBoth([...buildCompleteYear(2024)], rows);

      const result = await downloadTaxRevenueData();

      expect(result.ccaa["2024"]?.entries?.length).toBe(1);
    });

    it('detecta header que contiene "delegac"', async () => {
      mockFetchBothOk();

      const rows = [
        ["Resumen por delegaciones", "", "", "D.E. Cataluña"],
        ...Array.from({ length: 12 }, (_, i) => [
          2024, i + 1, "Total Ingresos netos", 80,
        ]),
      ];

      mockXlsxBoth([...buildCompleteYear(2024)], rows);

      const result = await downloadTaxRevenueData();

      expect(result.ccaa["2024"]?.entries?.length).toBe(1);
    });
  });

  // ───── Edge cases for delegaciones rows ─────

  describe("edge cases delegaciones", () => {
    it("ignora filas vacías y filas sin datos", async () => {
      mockFetchBothOk();

      const header = buildDelegacionesHeader();
      const rows = [
        header,
        [], // empty row
        null, // null row
        [2024, 1, "Total Ingresos netos", 240, 100, 80, 60],
      ];

      // Only 1 month so incomplete year, but shouldn't crash
      mockXlsxBoth([...buildCompleteYear(2024)], rows);

      const result = await downloadTaxRevenueData();

      // CCAA should be empty (only 1 month = incomplete)
      expect(Object.keys(result.ccaa).length).toBe(0);
    });

    it("maneja año con string parseables como número", async () => {
      mockFetchBothOk();

      const header = ["Ejercicio", "Mes", "Concepto", "D.E. Madrid"];
      const rows = [header];
      for (let m = 1; m <= 12; m++) {
        rows.push(["2024", m, "Total Ingresos netos", 100]); // year as string
      }

      mockXlsxBoth([...buildCompleteYear(2024)], rows);

      const result = await downloadTaxRevenueData();
      expect(result.ccaa["2024"]).toBeDefined();
    });
  });
});
