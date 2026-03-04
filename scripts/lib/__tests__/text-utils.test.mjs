import { describe, it, expect } from "vitest";
import { normalizeText, toNumber } from "../text-utils.mjs";

describe("normalizeText", () => {
  it("lowercases text", () => {
    expect(normalizeText("HELLO")).toBe("hello");
  });

  it("removes accents (á→a, ñ→n, ü→u)", () => {
    expect(normalizeText("á")).toBe("a");
    expect(normalizeText("ñ")).toBe("n");
    expect(normalizeText("ü")).toBe("u");
    expect(normalizeText("Málaga")).toBe("malaga");
  });

  it("collapses multiple whitespace to single space", () => {
    expect(normalizeText("hello   world")).toBe("hello world");
    expect(normalizeText("a\t\tb")).toBe("a b");
    expect(normalizeText("x\n\ny")).toBe("x y");
  });

  it("trims leading/trailing whitespace", () => {
    expect(normalizeText("  hello  ")).toBe("hello");
  });

  it("handles null → empty string", () => {
    expect(normalizeText(null)).toBe("");
  });

  it("handles undefined → empty string", () => {
    expect(normalizeText(undefined)).toBe("");
  });

  it("handles numbers → string conversion", () => {
    expect(normalizeText(42)).toBe("42");
    expect(normalizeText(3.14)).toBe("3.14");
  });

  it("combined: accents + whitespace + uppercase", () => {
    expect(normalizeText("  ÑOÑO   España  ")).toBe("nono espana");
  });
});

describe("toNumber", () => {
  it("null → 0", () => {
    expect(toNumber(null)).toBe(0);
  });

  it("undefined → 0", () => {
    expect(toNumber(undefined)).toBe(0);
  });

  it("empty string → 0", () => {
    expect(toNumber("")).toBe(0);
  });

  it("number input (already a number) → same number", () => {
    expect(toNumber(42)).toBe(42);
    expect(toNumber(3.14)).toBe(3.14);
    expect(toNumber(-7)).toBe(-7);
  });

  it("simple string number '123' → 123", () => {
    expect(toNumber("123")).toBe(123);
  });

  it("Spanish locale '1.583.000' (dots as thousands) → 1583000", () => {
    expect(toNumber("1.583.000")).toBe(1583000);
  });

  it("Spanish decimal '12,5' (comma as decimal) → 12.5", () => {
    expect(toNumber("12,5")).toBe(12.5);
  });

  it("combined '1.234,56' → 1234.56", () => {
    expect(toNumber("1.234,56")).toBe(1234.56);
  });

  it("non-numeric string 'abc' → 0", () => {
    expect(toNumber("abc")).toBe(0);
  });

  it("NaN → 0 (typeof number but not finite)", () => {
    expect(toNumber(NaN)).toBe(0);
  });

  it("Infinity → 0 (typeof number but not finite)", () => {
    expect(toNumber(Infinity)).toBe(0);
    expect(toNumber(-Infinity)).toBe(0);
  });

  it("negative numbers '-5' → -5", () => {
    expect(toNumber("-5")).toBe(-5);
  });
});
