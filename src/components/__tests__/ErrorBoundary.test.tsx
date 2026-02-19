import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ErrorBoundary from "../ErrorBoundary";

const ProblematicComponent = () => {
  throw new Error("Test Error");
};

describe("ErrorBoundary", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("renders children when no error occurs", () => {
    render(
      <ErrorBoundary>
        <div data-testid="child">Child Content</div>
      </ErrorBoundary>,
    );
    expect(screen.getByTestId("child")).toBeDefined();
  });

  it("renders error UI when a child crashes", () => {
    render(
      <ErrorBoundary>
        <ProblematicComponent />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Algo salió mal")).toBeDefined();
    expect(console.error).toHaveBeenCalled();
  });

  it("reloads page when reload button is clicked", () => {
    // Mock window.location.reload
    const reloadMock = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { reload: reloadMock },
    });

    render(
      <ErrorBoundary>
        <ProblematicComponent />
      </ErrorBoundary>,
    );

    const button = screen.getByText("Recargar página");
    fireEvent.click(button);
    expect(reloadMock).toHaveBeenCalled();
  });
});
