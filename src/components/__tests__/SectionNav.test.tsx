import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SectionNav } from "../SectionNav";

vi.mock("@/i18n/I18nProvider", () => ({
  useI18n: () => ({
    msg: {
      common: {
        sectionNavigationAria: "Section navigation",
      },
    },
  }),
}));

describe("SectionNav", () => {
  const groups = [
    {
      id: "fiscal",
      label: "Fiscal",
      items: [
        { id: "resumen", label: "Resumen" },
        { id: "ccaa", label: "CCAA" },
      ],
    },
  ];

  it("limpia section/hash cuando la sección activa es resumen", () => {
    window.history.replaceState({}, "", "/?section=resumen#resumen");

    render(<SectionNav groups={groups} />);

    expect(window.location.search).toBe("");
    expect(window.location.hash).toBe("");
  });

  it("persiste sección no-resumen y limpia al volver a resumen", async () => {
    window.history.replaceState({}, "", "/");

    render(<SectionNav groups={groups} />);

    fireEvent.click(screen.getByRole("link", { name: "CCAA" }));
    expect(window.location.search).toContain("section=ccaa");

    fireEvent.click(screen.getByRole("link", { name: "Resumen" }));

    await waitFor(() => {
      expect(window.location.search).toBe("");
      expect(window.location.hash).toBe("");
    });
  });
});
