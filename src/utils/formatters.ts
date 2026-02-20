function getCurrentLanguage(): "es" | "en" {
  if (
    typeof document !== "undefined" &&
    document.documentElement.lang.toLowerCase().startsWith("en")
  ) {
    return "en";
  }
  return "es";
}

function getCurrentLocale(): string {
  return getCurrentLanguage() === "en" ? "en-GB" : "es-ES";
}

// Format a number in current UI locale with given decimal places
export function formatNumber(value: number, decimals?: number): string {
  return new Intl.NumberFormat(getCurrentLocale(), {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

// Format currency in euros (e.g., "1.699.234.567.890 €")
export function formatCurrency(value: number, decimals = 0): string {
  return new Intl.NumberFormat(getCurrentLocale(), {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

// Abbreviate large numbers: M€ for millions, mm€ for billions (Spanish convention)
// e.g., 1_699_000_000_000 → "1.699 mm€" (miles de millones)
export function formatCompact(value: number): string {
  const absValue = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  const isEnglish = getCurrentLanguage() === "en";

  if (absValue >= 1_000_000_000_000) {
    return `${sign}${formatNumber(absValue / 1_000_000_000_000, 3)} ${isEnglish ? "T€" : "B€"}`;
  } else if (absValue >= 1_000_000_000) {
    return `${sign}${formatNumber(absValue / 1_000_000_000, 1)} ${isEnglish ? "B€" : "mm€"}`;
  } else if (absValue >= 1_000_000) {
    return `${sign}${formatNumber(absValue / 1_000_000, 1)} M€`;
  } else if (absValue >= 1_000) {
    return `${sign}${formatNumber(absValue / 1_000, 1)} ${isEnglish ? "k€" : "mil €"}`;
  }

  return formatCurrency(value);
}

// Format percentage with 1 decimal
export function formatPercent(value: number): string {
  return new Intl.NumberFormat(getCurrentLocale(), {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value / 100);
}

// Format a date string like "2025-Q4" or ISO string in current UI locale
export function formatDate(date: string): string {
  const isEnglish = getCurrentLanguage() === "en";
  const quarterPrefix = isEnglish ? "Q" : "T";

  const quarterMatch = date.match(/^(\d{4})-Q([1-4])$/);
  if (quarterMatch) {
    const [, year, quarter] = quarterMatch;
    return `${quarterPrefix}${quarter} ${year}`;
  }

  try {
    const dateObj = new Date(date);
    return new Intl.DateTimeFormat(getCurrentLocale(), {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(dateObj);
  } catch {
    return date;
  }
}
