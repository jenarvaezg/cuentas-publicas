import { beforeEach, describe, expect, it } from "vitest";
import { getSearchParam, updateSearchParams, updateSectionInUrl } from "../url-state";

describe("url-state", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("reads lang from legacy ampersand path URLs", () => {
    window.history.replaceState(null, "", "/&lang=en");

    expect(getSearchParam("lang")).toBe("en");
  });

  it("canonicalizes legacy ampersand path when updating query params", () => {
    window.history.replaceState(null, "", "/&lang=en?section=ccaa");

    updateSearchParams({ ccaaMetric: "debtAbsolute" });

    const params = new URLSearchParams(window.location.search);
    expect(window.location.pathname).toBe("/");
    expect(params.get("lang")).toBe("en");
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
    window.history.replaceState(null, "", "/?lang=en");

    updateSectionInUrl("ccaa");

    const params = new URLSearchParams(window.location.search);
    expect(params.get("lang")).toBe("en");
    expect(params.get("section")).toBe("ccaa");
  });
});
