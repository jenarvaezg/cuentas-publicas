import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useData } from "../useData";

describe("useData", () => {
  it("returns all data objects", () => {
    const { result } = renderHook(() => useData());

    expect(result.current.debt).toBeDefined();
    expect(result.current.pensions).toBeDefined();
    expect(result.current.demographics).toBeDefined();
    expect(result.current.budget).toBeDefined();
    expect(result.current.eurostat).toBeDefined();
    expect(result.current.ccaaDebt).toBeDefined();
    expect(result.current.revenue).toBeDefined();
    expect(result.current.meta).toBeDefined();
  });
});
