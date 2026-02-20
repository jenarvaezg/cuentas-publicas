import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { I18nProvider } from "@/i18n/I18nProvider";
import { MethodologySection } from "../MethodologySection";

describe("MethodologySection", () => {
  it("starts collapsed and expands on click", () => {
    render(<MethodologySection />);

    // Check initial state
    expect(screen.queryByText(/Proyecto educativo/i)).toBeNull();

    const button = screen.getByRole("button");
    fireEvent.click(button);

    // Should be open now
    expect(screen.getByText(/Proyecto educativo que muestra/i)).toBeDefined();
    expect(screen.getByRole("heading", { name: /Deuda Pública/i })).toBeDefined();

    fireEvent.click(button);
    // Should be closed again
    expect(screen.queryByText(/Proyecto educativo/i)).toBeNull();
  });

  it("renders english methodology when lang=en", () => {
    window.history.replaceState(null, "", "/?lang=en");

    render(
      <I18nProvider>
        <MethodologySection />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByRole("button"));

    expect(screen.getByText(/Educational project showing/i)).toBeDefined();
    expect(screen.getByRole("heading", { name: /Public Debt/i })).toBeDefined();
  });
});
