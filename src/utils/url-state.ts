import { buildPathWithLanguage } from "@/utils/lang-path";

function canUseWindow() {
  return typeof window !== "undefined";
}

function parseLegacyPathParams(pathname: string): {
  cleanPathname: string;
  params: URLSearchParams;
} | null {
  const match = pathname.match(/^(.*)\/&([^/]+)$/);
  if (!match) return null;

  const basePath = match[1] === "" ? "/" : match[1];
  const params = new URLSearchParams(match[2]);

  return {
    cleanPathname: basePath,
    params,
  };
}

function getCanonicalUrl() {
  const url = new URL(window.location.href);
  const legacyPath = parseLegacyPathParams(url.pathname);
  if (legacyPath) {
    // Apply params parsed from `/&key=value` path fragments.
    url.pathname = legacyPath.cleanPathname;
    legacyPath.params.forEach((value, key) => {
      if (!url.searchParams.has(key)) {
        url.searchParams.set(key, value);
      }
    });
  }
  normalizeLangQuery(url);
  return url;
}

function normalizeLangQuery(url: URL) {
  const langParam = url.searchParams.get("lang");
  if (!langParam) return;

  if (langParam === "en") {
    url.pathname = buildPathWithLanguage(url.pathname, "en");
  }

  url.searchParams.delete("lang");
}

function replaceUrlIfChanged(url: URL) {
  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (nextUrl !== currentUrl) {
    window.history.replaceState(window.history.state, "", nextUrl);
  }
}

export function getSearchParam(key: string): string | null {
  if (!canUseWindow()) return null;
  const url = getCanonicalUrl();
  return url.searchParams.get(key);
}

export function updateSearchParams(updates: Record<string, string | null | undefined>) {
  if (!canUseWindow()) return;

  const url = getCanonicalUrl();
  for (const [key, value] of Object.entries(updates)) {
    if (value == null || value === "") {
      url.searchParams.delete(key);
    } else {
      url.searchParams.set(key, value);
    }
  }

  replaceUrlIfChanged(url);
}

export function updateSectionInUrl(section: string | null | undefined) {
  if (!canUseWindow()) return;

  const url = getCanonicalUrl();

  if (!section || section === "resumen") {
    url.searchParams.delete("section");
    url.hash = "";
  } else {
    url.searchParams.set("section", section);
  }

  replaceUrlIfChanged(url);
}

export function replaceCurrentUrl(url: URL) {
  replaceUrlIfChanged(url);
}
