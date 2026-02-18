// Format a number in es-ES locale with given decimal places
export function formatNumber(value: number, decimals?: number): string {
  return new Intl.NumberFormat("es-ES", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

// Format currency in euros (e.g., "1.699.234.567.890 €")
export function formatCurrency(value: number, decimals = 0): string {
  return new Intl.NumberFormat("es-ES", {
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

  if (absValue >= 1_000_000_000_000) {
    // Billones (trillions in English)
    return `${sign}${formatNumber(absValue / 1_000_000_000_000, 3)} B€`;
  } else if (absValue >= 1_000_000_000) {
    // Miles de millones (billions in English)
    return `${sign}${formatNumber(absValue / 1_000_000_000, 1)} mm€`;
  } else if (absValue >= 1_000_000) {
    // Millones
    return `${sign}${formatNumber(absValue / 1_000_000, 1)} M€`;
  } else if (absValue >= 1_000) {
    // Miles
    return `${sign}${formatNumber(absValue / 1_000, 1)} mil €`;
  }

  return formatCurrency(value);
}

// Format percentage with 1 decimal
export function formatPercent(value: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value / 100);
}

// Format a date string like "2025-Q4" or ISO string to human-readable Spanish
export function formatDate(date: string): string {
  // Handle quarter format (e.g., "2025-Q4")
  const quarterMatch = date.match(/^(\d{4})-Q([1-4])$/);
  if (quarterMatch) {
    const [, year, quarter] = quarterMatch;
    return `T${quarter} ${year}`;
  }

  // Handle ISO date strings
  try {
    const dateObj = new Date(date);
    return new Intl.DateTimeFormat("es-ES", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(dateObj);
  } catch {
    return date;
  }
}
