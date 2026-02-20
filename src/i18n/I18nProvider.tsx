import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getSearchParam, updateSearchParams } from "@/utils/url-state";
import { type AppLanguage, type Messages, messages } from "./messages";

const STORAGE_KEY = "cuentas-publicas-lang";

interface I18nContextValue {
  lang: AppLanguage;
  setLang: (next: AppLanguage) => void;
  msg: Messages;
}

const defaultI18nContext: I18nContextValue = {
  lang: "es",
  setLang: () => {},
  msg: messages.es,
};

const I18nContext = createContext<I18nContextValue>(defaultI18nContext);

function isLanguage(value: string | null): value is AppLanguage {
  return value === "es" || value === "en";
}

export function detectInitialLanguage(): AppLanguage {
  const queryLanguage = getSearchParam("lang");
  if (isLanguage(queryLanguage)) return queryLanguage;

  try {
    const storedLanguage = localStorage.getItem(STORAGE_KEY);
    if (isLanguage(storedLanguage)) return storedLanguage;
  } catch {
    // Ignore localStorage access errors
  }

  return "es";
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<AppLanguage>(detectInitialLanguage);

  useEffect(() => {
    document.documentElement.lang = lang;

    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Ignore localStorage access errors
    }

    updateSearchParams({ lang: lang === "es" ? null : lang });
  }, [lang]);

  const value = useMemo<I18nContextValue>(
    () => ({
      lang,
      setLang,
      msg: messages[lang],
    }),
    [lang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
