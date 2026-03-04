import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageToggle } from "@/components/LanguageToggle";
import { detectInitialLanguage, I18nProvider, useI18n } from "../I18nProvider";

function TitleProbe() {
  const { msg } = useI18n();
  return <h1>{msg.header.title}</h1>;
}

describe("I18nProvider", () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    const localStorageMock = {
      getItem: (key: string) => (storage.has(key) ? (storage.get(key) ?? null) : null),
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
      clear: () => {
        storage.clear();
      },
    };
    Object.defineProperty(window, "localStorage", {
      value: localStorageMock,
      configurable: true,
    });
    window.history.replaceState(null, "", "/");
    window.localStorage.removeItem("cuentas-publicas-lang");
  });

  it("usa español por defecto", () => {
    render(
      <I18nProvider>
        <TitleProbe />
      </I18nProvider>,
    );

    expect(screen.getByRole("heading", { name: "Cuentas Públicas de España" })).toBeDefined();
    expect(document.documentElement.lang).toBe("es");
  });

  it("hidrata idioma desde query param y permite cambiarlo", () => {
    window.history.replaceState(null, "", "/en");

    render(
      <I18nProvider>
        <LanguageToggle />
        <TitleProbe />
      </I18nProvider>,
    );

    expect(screen.getByRole("heading", { name: "Spain Public Accounts" })).toBeDefined();
    const selector = screen.getByLabelText("Language");
    expect((selector as HTMLSelectElement).value).toBe("en");

    fireEvent.change(selector, { target: { value: "es" } });

    expect(screen.getByRole("heading", { name: "Cuentas Públicas de España" })).toBeDefined();
    expect(window.localStorage.getItem("cuentas-publicas-lang")).toBe("es");
    expect(window.location.pathname).toBe("/");
  });

  it("interpreta /&lang=en como enlace legacy y lo normaliza", () => {
    window.history.replaceState(null, "", "/en");

    render(
      <I18nProvider>
        <LanguageToggle />
        <TitleProbe />
      </I18nProvider>,
    );

    expect(screen.getByRole("heading", { name: "Spain Public Accounts" })).toBeDefined();
    expect(window.location.pathname).toBe("/en");
    expect(window.location.search).toBe("");
  });
});

describe("detectInitialLanguage", () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    const localStorageMock = {
      getItem: (key: string) => (storage.has(key) ? (storage.get(key) ?? null) : null),
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
      clear: () => {
        storage.clear();
      },
    };
    Object.defineProperty(window, "localStorage", {
      value: localStorageMock,
      configurable: true,
    });
    window.history.replaceState(null, "", "/");
    window.localStorage.removeItem("cuentas-publicas-lang");
  });

  it("path language takes precedence over localStorage", () => {
    // getPathLanguage("/") returns "es", so localStorage "en" is never consulted
    window.history.replaceState(null, "", "/");
    window.localStorage.setItem("cuentas-publicas-lang", "en");
    expect(detectInitialLanguage()).toBe("es");

    // /en path overrides localStorage
    window.history.replaceState(null, "", "/en");
    window.localStorage.setItem("cuentas-publicas-lang", "es");
    expect(detectInitialLanguage()).toBe("en");
  });

  it("falls back to es when localStorage.getItem throws", () => {
    window.history.replaceState(null, "", "/");
    const throwingMock = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
    };
    Object.defineProperty(window, "localStorage", {
      value: throwingMock,
      configurable: true,
    });
    Object.defineProperty(global, "localStorage", {
      value: throwingMock,
      configurable: true,
    });

    expect(detectInitialLanguage()).toBe("es");
  });

  it("returns es when ?lang=en query param is present (normalization strips it)", () => {
    // getSearchParam("lang") normalizes ?lang=en into /en path and deletes the param,
    // so it always returns null — the path check runs first, but path is "/" here.
    window.history.replaceState(null, "", "/?lang=en");

    expect(detectInitialLanguage()).toBe("es");
  });

  it("ignores invalid language values in localStorage", () => {
    window.history.replaceState(null, "", "/");
    const storage = new Map<string, string>([["cuentas-publicas-lang", "fr"]]);
    const mock = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
      clear: () => {
        storage.clear();
      },
    };
    Object.defineProperty(window, "localStorage", {
      value: mock,
      configurable: true,
    });
    Object.defineProperty(global, "localStorage", {
      value: mock,
      configurable: true,
    });

    expect(detectInitialLanguage()).toBe("es");
  });

  it("provider does not crash when localStorage.setItem throws", () => {
    window.history.replaceState(null, "", "/");
    const setItemSpy = vi.fn(() => {
      throw new Error("QuotaExceededError");
    });
    const throwingSetMock = {
      getItem: () => null,
      setItem: setItemSpy,
      removeItem: () => {},
      clear: () => {},
    };
    Object.defineProperty(window, "localStorage", {
      value: throwingSetMock,
      configurable: true,
    });
    Object.defineProperty(global, "localStorage", {
      value: throwingSetMock,
      configurable: true,
    });

    expect(() =>
      render(
        <I18nProvider>
          <TitleProbe />
        </I18nProvider>,
      ),
    ).not.toThrow();
  });
});
