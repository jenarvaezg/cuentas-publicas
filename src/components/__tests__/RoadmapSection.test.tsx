import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RoadmapSection } from "../RoadmapSection";

describe("RoadmapSection", () => {
  it("starts collapsed and expands on click", () => {
    render(<RoadmapSection />);

    expect(screen.queryByText(/estado actual del proyecto/)).toBeNull();

    const button = screen.getByRole("button");
    fireEvent.click(button);

    expect(screen.getByText(/estado actual del proyecto/)).toBeDefined();
    expect(screen.getByText(/Fase 1/)).toBeDefined();

    fireEvent.click(button);
    expect(screen.queryByText(/estado actual del proyecto/)).toBeNull();
  });
});
