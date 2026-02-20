import { beforeEach, describe, expect, it } from "vitest";
import { updateSearchParams, updateSectionInUrl } from "../url-state";

describe("url-state", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("normalizes legacy ampersand path URLs to path prefixes", () => {
    window.history.replaceState(null, "", "/&lang=en");

    updateSearchParams({});

    expect(window.location.pathname).toBe("/en");
    expect(window.location.search).toBe("");
  });

  it("canonicalizes legacy ampersand path when updating query params", () => {
    window.history.replaceState(null, "", "/&lang=en?section=ccaa");

    updateSearchParams({ ccaaMetric: "debtAbsolute" });

    const params = new URLSearchParams(window.location.search);
    expect(window.location.pathname).toBe("/en");
    expect(params.get("section")).toBe("ccaa");
    expect(params.get("ccaaMetric")).toBe("debtAbsolute");
  });

  it("removes section and hash when active section is resumen", () => {
    window.history.replaceState(null, "", "/?section=resumen#resumen");

    updateSectionInUrl("resumen");

    expect(window.location.search).toBe("");
    expect(window.location.hash).toBe("");
  });

  it("sets section for non-summary sections and preserves other params", () => {
    window.history.replaceState(null, "", "/en");

    updateSectionInUrl("ccaa");

    const params = new URLSearchParams(window.location.search);
    expect(window.location.pathname).toBe("/en");
    expect(params.get("section")).toBe("ccaa");
  });
});
