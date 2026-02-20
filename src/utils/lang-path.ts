import type { AppLanguage } from "@/i18n/messages";

export function getPathLanguage(pathname: string): AppLanguage {
  if (pathname === "/en" || pathname.startsWith("/en/")) {
    return "en";
  }
  return "es";
}

export function stripLanguagePrefix(pathname: string): string {
  if (pathname === "/en") return "/";
  if (pathname.startsWith("/en/")) {
    const stripped = pathname.slice(3);
    return stripped === "" ? "/" : stripped;
  }
  return pathname;
}

export function buildPathWithLanguage(pathname: string, language: AppLanguage): string {
  const basePath = stripLanguagePrefix(pathname);
  if (language === "en") {
    return `/en${basePath === "/" ? "" : basePath}`;
  }
  return basePath;
}
