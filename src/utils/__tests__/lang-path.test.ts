import { describe, expect, it } from "vitest";
import { buildPathWithLanguage, getPathLanguage, stripLanguagePrefix } from "@/utils/lang-path";

describe("getPathLanguage", () => {
  it('returns "en" for exact "/en" path', () => {
    expect(getPathLanguage("/en")).toBe("en");
  });

  it('returns "en" for "/en/sections/debt"', () => {
    expect(getPathLanguage("/en/sections/debt")).toBe("en");
  });

  it('returns "en" for "/en/" (trailing slash)', () => {
    expect(getPathLanguage("/en/")).toBe("en");
  });

  it('returns "es" for root "/"', () => {
    expect(getPathLanguage("/")).toBe("es");
  });

  it('returns "es" for Spanish path "/secciones/deuda"', () => {
    expect(getPathLanguage("/secciones/deuda")).toBe("es");
  });

  it('returns "es" for path that starts with "en" but not "/en"', () => {
    // e.g. "/energy" should not be detected as English
    expect(getPathLanguage("/energy")).toBe("es");
  });

  it('returns "es" for empty-like Spanish section path', () => {
    expect(getPathLanguage("/resumen")).toBe("es");
  });
});

describe("stripLanguagePrefix", () => {
  it('converts "/en" to "/"', () => {
    expect(stripLanguagePrefix("/en")).toBe("/");
  });

  it('converts "/en/" to "/"', () => {
    expect(stripLanguagePrefix("/en/")).toBe("/");
  });

  it('strips "/en" prefix from "/en/sections/debt"', () => {
    expect(stripLanguagePrefix("/en/sections/debt")).toBe("/sections/debt");
  });

  it('strips "/en" prefix from "/en/sections/pensions"', () => {
    expect(stripLanguagePrefix("/en/sections/pensions")).toBe("/sections/pensions");
  });

  it("leaves Spanish paths unchanged", () => {
    expect(stripLanguagePrefix("/secciones/deuda")).toBe("/secciones/deuda");
  });

  it('leaves root "/" unchanged', () => {
    expect(stripLanguagePrefix("/")).toBe("/");
  });

  it("leaves arbitrary non-en paths unchanged", () => {
    expect(stripLanguagePrefix("/resumen")).toBe("/resumen");
  });
});

describe("buildPathWithLanguage", () => {
  it('builds English root path "/en" from "/" with language "en"', () => {
    expect(buildPathWithLanguage("/", "en")).toBe("/en");
  });

  it('builds English section path from "/sections/debt" with language "en"', () => {
    expect(buildPathWithLanguage("/sections/debt", "en")).toBe("/en/sections/debt");
  });

  it('strips existing "/en" prefix before building new English path', () => {
    expect(buildPathWithLanguage("/en/sections/debt", "en")).toBe("/en/sections/debt");
  });

  it('returns Spanish path unchanged for language "es" from root', () => {
    expect(buildPathWithLanguage("/", "es")).toBe("/");
  });

  it('returns Spanish path from "/secciones/deuda" with language "es"', () => {
    expect(buildPathWithLanguage("/secciones/deuda", "es")).toBe("/secciones/deuda");
  });

  it('strips "/en" prefix when switching to "es"', () => {
    expect(buildPathWithLanguage("/en/sections/debt", "es")).toBe("/sections/debt");
  });

  it('returns "/" when switching from "/en" to "es"', () => {
    expect(buildPathWithLanguage("/en", "es")).toBe("/");
  });
});
