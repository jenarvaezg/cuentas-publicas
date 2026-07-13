import { beforeEach, describe, expect, it, vi } from "vitest";
import * as fetchUtils from "../lib/fetch-utils.mjs";
import {
  buildNavarraFlowUrl,
  downloadCcaaForalFlowsData,
  parseEuskadiForalFlow,
  parseNavarraForalFlow,
  parseNavarraTaxRevenue,
} from "../sources/ccaa-foral-flows.mjs";

vi.mock("../lib/fetch-utils.mjs", () => ({
  fetchWithRetry: vi.fn(),
}));

const NAVARRA_HTML = `
  <table>
    <tr><td>Total Pagos Aportación Neta</td><td>611.223,1</td><td>698.643,6</td></tr>
    <tr><td>Total Ajustes fiscales</td><td>1.225.430,6</td><td>1.375.926,9</td></tr>
  </table>
`;

const NAVARRA_TAX_HTML = `
  <p>En el año 2024 se ingresaron en términos de caja 5.433.033,6 miles de euros.</p>
`;

const EUSKADI_HTML = `
  <p><strong>CUPO L&Iacute;QUIDO PROV M&euro;</strong></p>
  <p>1.504,50</p>
`;

function mockForalFetcher({ navarraFlow = NAVARRA_HTML, navarraTax = NAVARRA_TAX_HTML, euskadi = EUSKADI_HTML } = {}) {
  fetchUtils.fetchWithRetry.mockImplementation((url) => {
    if (url.includes("memoria-2026") || url.includes("memoria-2025")) {
      return Promise.reject(new Error("memoria not published"));
    }
    if (url.includes("recaudacion-liquida")) {
      return Promise.resolve({ ok: true, text: () => Promise.resolve(navarraTax) });
    }
    if (url.includes("cuadro-n")) {
      return Promise.resolve({ ok: true, text: () => Promise.resolve(navarraFlow) });
    }
    return Promise.resolve({ ok: true, text: () => Promise.resolve(euskadi) });
  });
}

describe("ccaa-foral-flows source script", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("construye URLs de memoria Navarra por año", () => {
    expect(buildNavarraFlowUrl(2024)).toContain("memoria-2024");
    expect(buildNavarraFlowUrl(2025)).toContain("memoria-2025");
  });

  it("parsea recaudación líquida Navarra desde memoria", () => {
    expect(parseNavarraTaxRevenue(NAVARRA_TAX_HTML)).toBeCloseTo(5433.034, 2);
  });

  it("parsea métricas clave de Navarra desde tabla HTML", () => {
    const parsed = parseNavarraForalFlow(NAVARRA_HTML, 5433);
    expect(parsed.paymentToState).toBe(698.644);
    expect(parsed.adjustmentsWithState).toBe(1375.927);
    expect(parsed.netFlowToState).toBe(-677.283);
    expect(parsed.taxRevenue).toBe(5433);
  });

  it("parsea cupo provisional de Euskadi desde noticia CMCE", () => {
    const parsed = parseEuskadiForalFlow(EUSKADI_HTML);
    expect(parsed.paymentToState).toBe(1504.5);
    expect(parsed.adjustmentsWithState).toBeNull();
    expect(parsed.netFlowToState).toBeNull();
  });

  it("descarga y construye dataset foral con recaudación en vivo", async () => {
    mockForalFetcher();

    const result = await downloadCcaaForalFlowsData();
    expect(result.latestYear).toBeGreaterThanOrEqual(2024);
    expect(result.byYear[String(result.latestYear)].entries).toHaveLength(2);
    expect(result.sourceAttribution.foral.type).toBe("api");
    expect(result.sourceAttribution.navarra.type).toBe("api");
    expect(result.sourceAttribution.euskadi.type).toBe("api");

    const navarra = result.byYear[String(result.latestYear)].entries.find((entry) => entry.code === "CA15");
    const paisVasco = result.byYear[String(result.latestYear)].entries.find((entry) => entry.code === "CA16");
    expect(navarra.paymentToState).toBe(698.644);
    expect(navarra.taxRevenue).toBeCloseTo(5433.034, 2);
    expect(paisVasco.paymentToState).toBe(1504.5);
  });

  it("usa fallback parcial cuando Navarra no es parseable pero Euskadi responde", async () => {
    mockForalFetcher({ navarraFlow: "<html>sin métricas de Navarra</html>" });

    const result = await downloadCcaaForalFlowsData();
    expect(result.sourceAttribution.foral.type).toBe("api");
    expect(result.sourceAttribution.navarra.type).toBe("fallback");
    expect(result.sourceAttribution.euskadi.type).toBe("api");
  });

  it("usa fallback parcial cuando Euskadi no es parseable pero Navarra responde", async () => {
    mockForalFetcher({ euskadi: "<html>sin cupo de Euskadi</html>" });

    const result = await downloadCcaaForalFlowsData();
    expect(result.sourceAttribution.foral.type).toBe("api");
    expect(result.sourceAttribution.navarra.type).toBe("api");
    expect(result.sourceAttribution.euskadi.type).toBe("fallback");
  });

  it("cae a fallback completo cuando ninguna fuente es parseable", async () => {
    mockForalFetcher({
      navarraFlow: "<html>sin métricas esperadas</html>",
      navarraTax: "<html>sin recaudación</html>",
      euskadi: "<html>sin cupo</html>",
    });

    const result = await downloadCcaaForalFlowsData();
    expect(result.sourceAttribution.foral.type).toBe("fallback");
    expect(result.sourceAttribution.navarra.type).toBe("fallback");
    expect(result.sourceAttribution.euskadi.type).toBe("fallback");
    expect(result.byYear[String(result.latestYear)].entries).toHaveLength(2);
  });
});
