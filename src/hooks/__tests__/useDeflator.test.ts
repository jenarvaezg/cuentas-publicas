import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useData } from "@/hooks/useData";
import { useDeflator } from "../useDeflator";

vi.mock("@/hooks/useData", () => ({
  useData: vi.fn(),
}));

describe("useDeflator", () => {
  it("returns original amount if cpi is missing", () => {
    (useData as any).mockReturnValue({ demographics: {} });
    const { result } = renderHook(() => useDeflator());
    expect(result.current.deflate(100, 2023)).toBe(100);
    expect(result.current.available).toBe(false);
  });

  it("calculates deflated value correctly", () => {
    (useData as any).mockReturnValue({
      demographics: {
        cpi: {
          baseYear: 2024,
          byYear: {
            "2024": 120,
            "2020": 100,
          },
        },
      },
    });
    const { result } = renderHook(() => useDeflator());

    // amount * (120 / 100) = 100 * 1.2 = 120
    expect(result.current.deflate(100, 2020)).toBe(120);
    expect(result.current.available).toBe(true);
    expect(result.current.baseYear).toBe(2024);
  });

  it("returns original amount if year or base year is not in index", () => {
    (useData as any).mockReturnValue({
      demographics: {
        cpi: {
          baseYear: 2024,
          byYear: {
            "2024": 120,
          },
        },
      },
    });
    const { result } = renderHook(() => useDeflator());
    expect(result.current.deflate(100, 1900)).toBe(100);
  });
});
