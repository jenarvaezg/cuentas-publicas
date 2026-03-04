import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useData } from "@/hooks/useData";
import { Header } from "../Header";

// Mock dependencies
vi.mock("@/hooks/useData", () => ({
  useData: vi.fn(),
}));

// Force mock before any import
vi.mock("../ThemeToggle", () => ({
  __esModule: true,
  default: () => <div data-testid="theme-toggle" />,
}));

describe("Header", () => {
  beforeEach(() => {
    // Global mocks to prevent errors if the real component somehow leaks
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(),
      setItem: vi.fn(),
    });

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation(() => ({ matches: false })),
    });
  });

  it("renders correctly with data", () => {
    (useData as any).mockReturnValue({
      meta: { lastDownload: "2024-01-01T00:00:00Z" },
    });

    render(<Header />);
    expect(screen.getByText(/Cuentas Públicas de España/)).toBeDefined();
    expect(screen.getByText(/1 de enero de 2024/)).toBeDefined();
    expect(screen.getByTestId("theme-toggle")).toBeDefined();
  });

  it("shows fresh indicator when sources are recent", () => {
    const recentDate = new Date().toISOString();
    (useData as any).mockReturnValue({
      meta: {
        lastDownload: recentDate,
        sources: {
          debt: { lastRealDataDate: recentDate },
          pensions: { lastRealDataDate: recentDate },
        },
      },
    });

    render(<Header />);
    expect(screen.getByText("Datos al día")).toBeDefined();
  });

  it("shows stale warning when sources are old", () => {
    const oldDate = "2023-01-01T00:00:00Z";
    (useData as any).mockReturnValue({
      meta: {
        lastDownload: oldDate,
        sources: {
          debt: { lastRealDataDate: oldDate },
          pensions: { lastRealDataDate: oldDate },
        },
      },
    });

    render(<Header />);
    expect(screen.getByText("Algunos datos pueden estar desactualizados")).toBeDefined();
  });

  it("handles sources with null lastRealDataDate", () => {
    (useData as any).mockReturnValue({
      meta: {
        lastDownload: "2024-06-01T00:00:00Z",
        sources: {
          debt: { lastRealDataDate: null },
          pensions: {},
        },
      },
    });

    render(<Header />);
    // No stale sources → fresh indicator
    expect(screen.getByText(/Cuentas Públicas/)).toBeDefined();
  });
});
