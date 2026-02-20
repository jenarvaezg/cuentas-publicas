import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { I18nProvider } from "@/i18n/I18nProvider";
import { RoadmapSection } from "../RoadmapSection";

describe("RoadmapSection", () => {
  it("starts collapsed and expands on click", () => {
    render(<RoadmapSection />);

    expect(screen.queryByText(/estado actual/i)).toBeNull();

    const button = screen.getByRole("button");
    fireEvent.click(button);

    expect(screen.getByText(/estado actual/i)).toBeDefined();
    expect(screen.getByText(/Fase 1/)).toBeDefined();

    fireEvent.click(button);
    expect(screen.queryByText(/estado actual/i)).toBeNull();
  });

  it("renders english copy when lang=en", () => {
    window.history.replaceState(null, "", "/en");

    render(
      <I18nProvider>
        <RoadmapSection />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByRole("button"));

    expect(screen.getByText(/current project status/i)).toBeDefined();
    expect(screen.getByText(/Phase 1/i)).toBeDefined();
  });
});
