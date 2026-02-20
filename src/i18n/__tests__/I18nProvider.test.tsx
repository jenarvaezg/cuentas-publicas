import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { LanguageToggle } from "@/components/LanguageToggle";
import { I18nProvider, useI18n } from "../I18nProvider";

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

    expect(screen.getByRole("heading", { name: "Dashboard Fiscal de España" })).toBeDefined();
    expect(document.documentElement.lang).toBe("es");
  });

  it("hidrata idioma desde query param y permite cambiarlo", () => {
    window.history.replaceState(null, "", "/?lang=en");

    render(
      <I18nProvider>
        <LanguageToggle />
        <TitleProbe />
      </I18nProvider>,
    );

    expect(screen.getByRole("heading", { name: "Spain Fiscal Dashboard" })).toBeDefined();
    const selector = screen.getByLabelText("Language");
    expect((selector as HTMLSelectElement).value).toBe("en");

    fireEvent.change(selector, { target: { value: "es" } });

    expect(screen.getByRole("heading", { name: "Dashboard Fiscal de España" })).toBeDefined();
    expect(window.localStorage.getItem("cuentas-publicas-lang")).toBe("es");
    expect(window.location.search).toBe("");
  });

  it("interpreta /&lang=en como enlace legacy y lo normaliza", () => {
    window.history.replaceState(null, "", "/&lang=en");

    render(
      <I18nProvider>
        <LanguageToggle />
        <TitleProbe />
      </I18nProvider>,
    );

    expect(screen.getByRole("heading", { name: "Spain Fiscal Dashboard" })).toBeDefined();
    expect(window.location.pathname).toBe("/");
    expect(window.location.search).toBe("?lang=en");
  });
});
