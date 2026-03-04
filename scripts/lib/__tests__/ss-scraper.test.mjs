import { describe, it, expect } from "vitest";
import { collectExcelCandidates, parseExcelMetadata } from "../ss-scraper.mjs";

describe("ss-scraper", () => {
  it("parsea metadatos de REGYYYYMM.xlsx", () => {
    const metadata = parseExcelMetadata(
      "https://www.seg-social.es/wps/wcm/connect/wss/id/REG202602.xlsx?MOD=AJPERES",
    );

    expect(metadata.filename).toBe("REG202602.xlsx");
    expect(metadata.excelDate).toBe("2026-02-01");
    expect(metadata.monthLabel).toBe("febrero 2026");
  });

  it("prioriza el REG más reciente detectado en la página", () => {
    const html = [
      '<a href="/wps/wcm/connect/wss/id-old/REG202512.xlsx?MOD=AJPERES">old</a>',
      '<a href="/wps/wcm/connect/wss/id-new/REG202602.xlsx?MOD=AJPERES">new</a>',
    ].join("");

    const candidates = collectExcelCandidates(html);

    expect(candidates[0]).toContain("REG202602.xlsx");
    expect(candidates.some((url) => url.includes("REG202512.xlsx"))).toBe(true);
    // Si la página ya expone un mes, no intentamos meses futuros sintéticos primero.
    expect(candidates.some((url) => url.includes("REG202603.xlsx"))).toBe(false);
  });

  it("genera fallback cuando no hay enlaces REG en el HTML", () => {
    const candidates = collectExcelCandidates("<html><body>sin xlsx</body></html>");

    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.every((url) => /REG\d{6}\.xlsx/i.test(url))).toBe(true);
  });
});
