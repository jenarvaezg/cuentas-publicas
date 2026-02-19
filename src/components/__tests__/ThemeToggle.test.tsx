import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ThemeToggle from "../ThemeToggle";

describe("ThemeToggle", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(),
      setItem: vi.fn(),
    });

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
      })),
    });

    document.documentElement.classList.remove("dark");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("initializes from localStorage if valid", () => {
    vi.mocked(localStorage.getItem).mockReturnValue("dark");
    render(<ThemeToggle />);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("initializes from matchMedia if localStorage is empty", () => {
    vi.mocked(localStorage.getItem).mockReturnValue(null);
    vi.mocked(window.matchMedia).mockReturnValue({ matches: true } as any);
    render(<ThemeToggle />);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("handles localStorage errors gracefully", () => {
    vi.mocked(localStorage.getItem).mockImplementation(() => {
      throw new Error("Blocked");
    });
    render(<ThemeToggle />);
    // Defaults to light if matchMedia is false
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("toggles theme on click", () => {
    vi.mocked(localStorage.getItem).mockReturnValue("light");
    render(<ThemeToggle />);

    const button = screen.getByRole("button");
    fireEvent.click(button);

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.setItem).toHaveBeenCalledWith("cuentas-publicas-theme", "dark");

    fireEvent.click(button);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.setItem).toHaveBeenCalledWith("cuentas-publicas-theme", "light");
  });
});
