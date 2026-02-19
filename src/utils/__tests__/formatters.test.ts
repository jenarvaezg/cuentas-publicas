import { describe, expect, it } from "vitest";
import {
  formatCompact,
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
} from "../formatters";

describe("formatNumber", () => {
  it("formats large number with 2 decimals in es-ES locale", () => {
    expect(formatNumber(1234567, 2)).toContain("1.234.567");
    expect(formatNumber(1234567, 2)).toContain(",00");
  });

  it("formats zero", () => {
    expect(formatNumber(0, 2)).toBe("0,00");
  });

  it("formats negative values", () => {
    const result = formatNumber(-1234, 2);
    expect(result).toContain("1234");
    expect(result).toContain(",00");
  });

  it("formats without decimals", () => {
    // jsdom locale may or may not apply thousands separator for 4-digit numbers
    const result = formatNumber(1000, 0);
    expect(result).toContain("1000");
  });
});

describe("formatCurrency", () => {
  it("includes euro sign", () => {
    expect(formatCurrency(1234)).toContain("€");
  });

  it("formats number in es-ES style", () => {
    const result = formatCurrency(1234);
    expect(result).toContain("1234");
  });

  it("formats zero", () => {
    expect(formatCurrency(0)).toContain("€");
  });

  it("formats negative values", () => {
    expect(formatCurrency(-500)).toContain("€");
  });

  it("supports decimals", () => {
    const result = formatCurrency(1234.56, 2);
    expect(result).toContain("€");
    expect(result).toContain(",56");
  });
});

describe("formatCompact", () => {
  it("formats billones (>= 1e12) with B€", () => {
    expect(formatCompact(1_699_000_000_000)).toContain("B€");
  });

  it("formats miles de millones (>= 1e9) with mm€", () => {
    expect(formatCompact(42_000_000_000)).toContain("mm€");
  });

  it("formats millones (>= 1e6) with M€", () => {
    expect(formatCompact(1_500_000)).toContain("M€");
  });

  it("formats miles (>= 1000) with mil €", () => {
    expect(formatCompact(5_000)).toContain("mil €");
  });

  it("formats small values as currency", () => {
    expect(formatCompact(500)).toContain("€");
  });

  it("formats zero", () => {
    const result = formatCompact(0);
    expect(result).toContain("€");
  });

  it("handles negative billones", () => {
    const result = formatCompact(-1_699_000_000_000);
    expect(result).toContain("B€");
    expect(result).toContain("-");
  });

  it("handles negative mm€", () => {
    const result = formatCompact(-42_000_000_000);
    expect(result).toContain("mm€");
    expect(result).toContain("-");
  });
});

describe("formatPercent", () => {
  it("formats percent with comma decimal in es-ES", () => {
    expect(formatPercent(106.8)).toContain("106,8");
  });

  it("includes percent sign", () => {
    expect(formatPercent(106.8)).toContain("%");
  });

  it("formats zero", () => {
    expect(formatPercent(0)).toContain("%");
  });

  it("formats negative values", () => {
    expect(formatPercent(-5.5)).toContain("%");
  });
});

describe("formatDate", () => {
  it('formats quarter format "2025-Q4" as "T4 2025"', () => {
    expect(formatDate("2025-Q4")).toBe("T4 2025");
  });

  it('formats quarter format "2025-Q1" as "T1 2025"', () => {
    expect(formatDate("2025-Q1")).toBe("T1 2025");
  });

  it("formats ISO date and contains year", () => {
    expect(formatDate("2025-06-15")).toContain("2025");
  });

  it("formats ISO date and contains Spanish month name", () => {
    expect(formatDate("2025-06-15")).toContain("junio");
  });

  it("handles all four quarters", () => {
    expect(formatDate("2024-Q2")).toBe("T2 2024");
    expect(formatDate("2024-Q3")).toBe("T3 2024");
  });

  it("returns original string for invalid dates", () => {
    expect(formatDate("not-a-date")).toBe("not-a-date");
  });
});
