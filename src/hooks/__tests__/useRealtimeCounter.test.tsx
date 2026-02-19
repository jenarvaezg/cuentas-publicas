import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRealtimeCounter } from "../useRealtimeCounter";

// Mock formatNumber
vi.mock("@/utils/formatters", () => ({
  formatNumber: vi.fn((val) => Math.round(val).toString()),
}));

const TestCounter = ({ base, perSec, options, showDisplay = true, showAria = true }: any) => {
  const { displayRef, ariaRef } = useRealtimeCounter(base, perSec, options);
  return (
    <div>
      {showDisplay && <span ref={displayRef} data-testid="display" />}
      {showAria && <span ref={ariaRef} data-testid="aria" />}
    </div>
  );
};

describe("useRealtimeCounter 100% coverage", () => {
  let rafCallback: any = null;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((cb) => {
        rafCallback = cb;
        return 123;
      }),
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
      })),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("updates text content when refs are present", async () => {
    render(<TestCounter base={1000} perSec={100} />);
    const display = screen.getByTestId("display");
    expect(display.textContent).toBe("1000");

    await act(async () => {
      vi.setSystemTime(Date.now() + 1000);
      if (rafCallback) rafCallback();
    });
    expect(display.textContent).toBe("1100");
  });

  it("handles null refs gracefully (no crash)", async () => {
    // Render without span elements to force null refs
    render(<TestCounter base={1000} perSec={100} showDisplay={false} showAria={false} />);

    // Trigger RAF update loop - should not crash
    await act(async () => {
      vi.setSystemTime(Date.now() + 1000);
      if (rafCallback) rafCallback();
    });

    // Also trigger initial 5s aria update window - should not crash
    await act(async () => {
      vi.setSystemTime(Date.now() + 5000);
      if (rafCallback) rafCallback();
    });

    expect(true).toBe(true); // Reaching here means no crash
  });

  it("updates aria only every 5s", async () => {
    render(<TestCounter base={1000} perSec={100} />);
    const aria = screen.getByTestId("aria");

    // Before 5s
    await act(async () => {
      vi.setSystemTime(Date.now() + 1000);
      if (rafCallback) rafCallback();
    });
    expect(aria.textContent).toBe("1000");

    // After 5s (total 6s)
    await act(async () => {
      vi.setSystemTime(Date.now() + 5000);
      if (rafCallback) rafCallback();
    });
    expect(aria.textContent).toBe("1600");
  });

  it("stops animation on unmount", () => {
    const { unmount } = render(<TestCounter base={1000} perSec={10} />);
    unmount();
    expect(cancelAnimationFrame).toHaveBeenCalledWith(123);
  });

  it("skips animation if reduced motion is enabled", () => {
    window.matchMedia = vi.fn().mockImplementation(() => ({ matches: true })) as any;
    const rafSpy = vi.spyOn(global, "requestAnimationFrame");
    render(<TestCounter base={1000} perSec={10} />);
    expect(rafSpy).not.toHaveBeenCalled();
  });
});
