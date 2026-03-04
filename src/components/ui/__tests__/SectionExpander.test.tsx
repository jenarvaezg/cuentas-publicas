import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SectionExpander } from "../SectionExpander";

vi.mock("@/i18n/I18nProvider", () => ({
  useI18n: () => ({
    msg: {
      common: {
        fullAnalysis: "Análisis completo",
        showLess: "Ver menos",
      },
    },
  }),
}));

describe("SectionExpander", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("renders collapsed by default with fullAnalysis label", () => {
    render(
      <SectionExpander id="test-section">
        <p>Hidden content</p>
      </SectionExpander>,
    );
    expect(screen.getByText("Análisis completo")).toBeDefined();
  });

  it("shows count in label when count prop is provided", () => {
    render(
      <SectionExpander id="test-section" count={5}>
        <p>Hidden content</p>
      </SectionExpander>,
    );
    expect(screen.getByText("Análisis completo (5)")).toBeDefined();
  });

  it("renders expanded when defaultOpen is true", () => {
    render(
      <SectionExpander id="test-section" defaultOpen>
        <p>Visible content</p>
      </SectionExpander>,
    );
    expect(screen.getByText("Ver menos")).toBeDefined();
  });

  it("toggles between open and closed states", () => {
    render(
      <SectionExpander id="test-section">
        <p>Content</p>
      </SectionExpander>,
    );
    const button = screen.getByRole("button");
    expect(screen.getByText("Análisis completo")).toBeDefined();

    fireEvent.click(button);
    expect(screen.getByText("Ver menos")).toBeDefined();

    fireEvent.click(button);
    expect(screen.getByText("Análisis completo")).toBeDefined();
  });

  it("persists state to sessionStorage", () => {
    render(
      <SectionExpander id="my-section">
        <p>Content</p>
      </SectionExpander>,
    );
    expect(sessionStorage.getItem("section-expander-my-section")).toBe("false");

    fireEvent.click(screen.getByRole("button"));
    expect(sessionStorage.getItem("section-expander-my-section")).toBe("true");
  });

  it("reads initial state from sessionStorage", () => {
    sessionStorage.setItem("section-expander-restored", "true");
    render(
      <SectionExpander id="restored">
        <p>Content</p>
      </SectionExpander>,
    );
    expect(screen.getByText("Ver menos")).toBeDefined();
  });

  it("applies custom className", () => {
    const { container } = render(
      <SectionExpander id="styled" className="my-custom-class">
        <p>Content</p>
      </SectionExpander>,
    );
    expect(container.firstElementChild?.classList.contains("my-custom-class")).toBe(true);
  });
});
