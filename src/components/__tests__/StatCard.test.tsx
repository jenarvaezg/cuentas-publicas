import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SourceDetail } from "../StatCard";
import { StatCard } from "../StatCard";

// Mock Tooltip components to simplify testing
vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: any) => <div>{children}</div>,
  TooltipTrigger: ({ children }: any) => <div>{children}</div>,
  TooltipContent: ({ children }: any) => <div>{children}</div>,
  TooltipProvider: ({ children }: any) => <div>{children}</div>,
}));

// Mock SparklineChart
vi.mock("../SparklineChart", () => ({
  SparklineChart: () => <div data-testid="sparkline" />,
}));

describe("StatCard", () => {
  it("renders basic info correctly", () => {
    render(<StatCard label="Test Label" value="1.000€" />);
    expect(screen.getByText("Test Label")).toBeDefined();
    expect(screen.getByText("1.000€")).toBeDefined();
  });

  it("renders trend correctly", () => {
    const { rerender } = render(
      <StatCard label="L" value="V" trend={{ value: 10, label: "+10%" }} />,
    );
    expect(screen.getByText("+10%")).toBeDefined();

    rerender(<StatCard label="L" value="V" trend={{ value: -5, label: "-5%" }} />);
    expect(screen.getByText("-5%")).toBeDefined();
  });

  it("renders sparkline when data is provided", () => {
    render(<StatCard label="L" value="V" sparklineData={[1, 2, 3]} />);
    expect(screen.getByTestId("sparkline")).toBeDefined();
  });

  it("renders sources with and without urls", () => {
    const sources: SourceDetail[] = [
      { name: "Source 1", url: "https://example.com", note: "Note 1" },
      { name: "Source 2", date: "2024-01-01" },
    ];
    render(<StatCard label="L" value="V" sources={sources} />);

    expect(screen.getByText("Source 1")).toBeDefined();
    expect(screen.getByRole("link").getAttribute("href")).toBe("https://example.com");
    expect(screen.getByText("Source 2")).toBeDefined();
    expect(screen.getByText(/2024-01-01/)).toBeDefined();
    expect(screen.getByText(/Note 1/)).toBeDefined();
  });

  it("detects stale data correctly", () => {
    const oldDate = new Date();
    oldDate.setFullYear(oldDate.getFullYear() - 2);
    const staleDateStr = oldDate.toISOString().split("T")[0];

    const sources: SourceDetail[] = [{ name: "Stale", date: staleDateStr }];
    render(<StatCard label="L" value="V" sources={sources} />);

    expect(screen.getByText(new RegExp(`dato ${oldDate.getFullYear()}`))).toBeDefined();
  });

  it("handles invalid dates in sources", () => {
    const sources: SourceDetail[] = [{ name: "Invalid", date: "not-a-date" }];
    render(<StatCard label="L" value="V" sources={sources} />);
    // Should not show the stale badge
    expect(screen.queryByText(/dato/)).toBeNull();
  });

  it("renders tooltip if provided", () => {
    render(<StatCard label="L" value="V" tooltip="Help text" />);
    expect(screen.getByText("Help text")).toBeDefined();
  });
});
