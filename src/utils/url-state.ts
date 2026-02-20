function canUseWindow() {
  return typeof window !== "undefined";
}

export function getSearchParam(key: string): string | null {
  if (!canUseWindow()) return null;
  return new URLSearchParams(window.location.search).get(key);
}

export function updateSearchParams(updates: Record<string, string | null | undefined>) {
  if (!canUseWindow()) return;

  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(updates)) {
    if (value == null || value === "") {
      url.searchParams.delete(key);
    } else {
      url.searchParams.set(key, value);
    }
  }

  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(window.history.state, "", nextUrl);
}
