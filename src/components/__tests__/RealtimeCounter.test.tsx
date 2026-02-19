import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useRealtimeCounter } from "@/hooks/useRealtimeCounter";
import { RealtimeCounter } from "../RealtimeCounter";

vi.mock("@/hooks/useRealtimeCounter", () => ({
  useRealtimeCounter: vi.fn(),
}));

describe("RealtimeCounter", () => {
  it("renders with label and applies refs", () => {
    const displayRef = { current: null };
    const ariaRef = { current: null };
    (useRealtimeCounter as any).mockReturnValue({ displayRef, ariaRef });

    render(<RealtimeCounter baseValue={100} perSecond={10} label="Test Counter" />);

    expect(screen.getByText("Test Counter")).toBeDefined();
    // Recharts / DOM check
    const spans = document.querySelectorAll("span");
    // One for display (hidden), one for aria (sr-only)
    expect(spans.length).toBeGreaterThanOrEqual(2);
  });
});
