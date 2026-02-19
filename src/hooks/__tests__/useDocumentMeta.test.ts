import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useDocumentMeta } from "../useDocumentMeta";

describe("useDocumentMeta", () => {
  beforeEach(() => {
    document.title = "";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.remove();
  });

  it("updates document title", () => {
    renderHook(() => useDocumentMeta("New Title"));
    expect(document.title).toBe("New Title");
  });

  it("updates meta description if element exists", () => {
    const meta = document.createElement("meta");
    meta.setAttribute("name", "description");
    document.head.appendChild(meta);

    renderHook(() => useDocumentMeta("Title", "New Description"));
    expect(meta.getAttribute("content")).toBe("New Description");
  });

  it("does nothing if description meta is missing", () => {
    renderHook(() => useDocumentMeta("Title", "New Description"));
    // No error should be thrown
    expect(document.title).toBe("Title");
  });
});
