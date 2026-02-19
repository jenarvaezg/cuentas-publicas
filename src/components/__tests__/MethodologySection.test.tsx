import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MethodologySection } from "../MethodologySection";

describe("MethodologySection", () => {
  it("starts collapsed and expands on click", () => {
    render(<MethodologySection />);

    // Check initial state
    expect(screen.queryByText(/Este proyecto educativo/)).toBeNull();

    const button = screen.getByRole("button");
    fireEvent.click(button);

    // Should be open now
    expect(screen.getByText(/Este proyecto educativo/)).toBeDefined();
    expect(screen.getByText(/Deuda Pública/)).toBeDefined();

    fireEvent.click(button);
    // Should be closed again
    expect(screen.queryByText(/Este proyecto educativo/)).toBeNull();
  });
});
