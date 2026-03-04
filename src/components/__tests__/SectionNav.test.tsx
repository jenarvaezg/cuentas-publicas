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

  it("renders group buttons and item links", () => {
    window.history.replaceState({}, "", "/");
    render(<SectionNav groups={groups} />);

    expect(screen.getByRole("button", { name: "Fiscal" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Resumen" })).toBeDefined();
    expect(screen.getByRole("link", { name: "CCAA" })).toBeDefined();
  });

  it("renders nav with aria-label", () => {
    window.history.replaceState({}, "", "/");
    render(<SectionNav groups={groups} />);

    expect(screen.getByRole("navigation", { name: "Section navigation" })).toBeDefined();
  });

  it("sets active section from ?section= query param on mount", async () => {
    window.history.replaceState({}, "", "/?section=ccaa");

    render(<SectionNav groups={groups} />);

    await waitFor(() => {
      expect(window.location.search).toContain("section=ccaa");
    });
  });

  it("sets active section from hash on mount", async () => {
    window.history.replaceState({}, "", "/");
    window.location.hash = "#ccaa";

    render(<SectionNav groups={groups} />);

    await waitFor(() => {
      expect(window.location.search).toContain("section=ccaa");
    });

    // clean up
    window.history.replaceState({}, "", "/");
  });

  it("clicking group button with active item in that group navigates to active item", () => {
    window.history.replaceState({}, "", "/?section=ccaa");
    render(<SectionNav groups={groups} />);

    const groupButton = screen.getByRole("button", { name: "Fiscal" });
    fireEvent.click(groupButton);

    expect(window.location.search).toContain("section=ccaa");
  });

  it("clicking group button when active item is in another group navigates to first item", () => {
    const multiGroups = [
      {
        id: "fiscal",
        label: "Fiscal",
        items: [
          { id: "resumen", label: "Resumen" },
          { id: "ccaa", label: "CCAA" },
        ],
      },
      {
        id: "social",
        label: "Social",
        items: [{ id: "pensiones", label: "Pensiones" }],
      },
    ];

    window.history.replaceState({}, "", "/?section=ccaa");
    render(<SectionNav groups={multiGroups} />);

    // Click the second group — active item (ccaa) is in fiscal, not social
    const socialButton = screen.getByRole("button", { name: "Social" });
    fireEvent.click(socialButton);

    expect(window.location.search).toContain("section=pensiones");
  });

  it("IntersectionObserver sets active section when entry intersects", async () => {
    window.history.replaceState({}, "", "/");

    const section = document.createElement("div");
    section.id = "ccaa";
    document.body.appendChild(section);

    let observerCallback: IntersectionObserverCallback | null = null;
    const disconnectFn = vi.fn();

    class MockIO {
      observe = vi.fn();
      disconnect = disconnectFn;
      unobserve = vi.fn();
      takeRecords = vi.fn(() => []);
      root = null;
      rootMargin = "";
      thresholds = [0];
      constructor(cb: IntersectionObserverCallback) {
        observerCallback = cb;
      }
    }
    vi.stubGlobal("IntersectionObserver", MockIO);

    render(<SectionNav groups={groups} />);

    if (observerCallback) {
      (observerCallback as IntersectionObserverCallback)(
        [
          {
            isIntersecting: true,
            intersectionRatio: 0.8,
            target: section,
          } as unknown as IntersectionObserverEntry,
        ],
        new MockIO(() => {}) as unknown as IntersectionObserver,
      );
    }

    await waitFor(() => {
      expect(window.location.search).toContain("section=ccaa");
    });

    document.body.removeChild(section);
    vi.unstubAllGlobals();
  });

  it("IntersectionObserver does nothing when no entries intersect", async () => {
    window.history.replaceState({}, "", "/");

    let observerCallback: IntersectionObserverCallback | null = null;

    class MockIO {
      observe = vi.fn();
      disconnect = vi.fn();
      unobserve = vi.fn();
      takeRecords = vi.fn(() => []);
      root = null;
      rootMargin = "";
      thresholds = [0];
      constructor(cb: IntersectionObserverCallback) {
        observerCallback = cb;
      }
    }
    vi.stubGlobal("IntersectionObserver", MockIO);

    render(<SectionNav groups={groups} />);

    if (observerCallback) {
      (observerCallback as IntersectionObserverCallback)(
        [
          {
            isIntersecting: false,
            intersectionRatio: 0,
            target: { id: "ccaa" },
          } as any,
        ],
        new MockIO(() => {}) as unknown as IntersectionObserver,
      );
    }

    expect(window.location.search).toBe("");
    vi.unstubAllGlobals();
  });

  it("disconnects IntersectionObserver on unmount", () => {
    window.history.replaceState({}, "", "/");

    const disconnectFn = vi.fn();

    class MockIO {
      observe = vi.fn();
      disconnect = disconnectFn;
      unobserve = vi.fn();
      takeRecords = vi.fn(() => []);
      root = null;
      rootMargin = "";
      thresholds = [0];
      // biome-ignore lint/complexity/noUselessConstructor: need to match IO signature
      constructor(_cb: IntersectionObserverCallback) {}
    }
    vi.stubGlobal("IntersectionObserver", MockIO);

    const section = document.createElement("div");
    section.id = "resumen";
    document.body.appendChild(section);

    const { unmount } = render(<SectionNav groups={groups} />);
    unmount();

    expect(disconnectFn).toHaveBeenCalled();

    document.body.removeChild(section);
    vi.unstubAllGlobals();
  });
});
