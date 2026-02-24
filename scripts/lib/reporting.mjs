import { readFileSync, existsSync } from "fs";

export function readExistingData() {
  const existing = {
    debt: null,
    demographics: null,
    pensions: null,
    budget: null,
    meta: null,
  };

  try {
    if (existsSync("src/data/debt.json")) {
      existing.debt = JSON.parse(readFileSync("src/data/debt.json", "utf-8"));
    }
  } catch (e) {
    console.warn("⚠️  Error leyendo debt.json existente:", e.message);
  }

  try {
    if (existsSync("src/data/demographics.json")) {
      existing.demographics = JSON.parse(
        readFileSync("src/data/demographics.json", "utf-8"),
      );
    }
  } catch (e) {
    console.warn("⚠️  Error leyendo demographics.json existente:", e.message);
  }

  try {
    if (existsSync("src/data/pensions.json")) {
      existing.pensions = JSON.parse(
        readFileSync("src/data/pensions.json", "utf-8"),
      );
    }
  } catch (e) {
    console.warn("⚠️  Error leyendo pensions.json existente:", e.message);
  }

  try {
    if (existsSync("src/data/budget.json")) {
      existing.budget = JSON.parse(
        readFileSync("src/data/budget.json", "utf-8"),
      );
    }
  } catch (e) {
    console.warn("⚠️  Error leyendo budget.json existente:", e.message);
  }

  try {
    if (existsSync("src/data/meta.json")) {
      existing.meta = JSON.parse(
        readFileSync("src/data/meta.json", "utf-8"),
      );
    }
  } catch (e) {
    console.warn("⚠️  Error leyendo meta.json existente:", e.message);
  }

  return existing;
}

export function displayExistingDataStatus(existing) {
  console.log(
    "\n╔═══════════════════════════════════════════════════════╗",
  );
  console.log(
    "║  Estado Actual de los Datos                          ║",
  );
  console.log(
    "╚═══════════════════════════════════════════════════════╝",
  );
  console.log();

  if (existing.debt) {
    const lastDebt = existing.debt.current?.totalDebt;
    const lastDate =
      existing.debt.historical?.[existing.debt.historical.length - 1]?.date ||
      "desconocido";
    const dataPoints = existing.debt.historical?.length || 0;
    const timeAgo = getTimeAgo(lastDate);
    console.log("debt.json:         existe");
    console.log(
      `  Último dato:     ${(lastDebt / 1_000_000_000).toLocaleString("es-ES")}B€ (${lastDate}, ${timeAgo})`,
    );
    console.log(`  Datos históricos: ${dataPoints} puntos`);
    console.log(
      `  Fuente:          ${existing.debt.sourceAttribution?.totalDebt?.source || "desconocida"}`,
    );
  } else {
    console.log("debt.json:         NO EXISTE");
  }
  console.log();

  if (existing.demographics) {
    const popDate =
      existing.demographics.sourceAttribution?.population?.date ||
      "desconocido";
    const gdpSource =
      existing.demographics.sourceAttribution?.gdp?.source || "desconocida";
    const popTimeAgo = getTimeAgo(popDate);
    console.log("demographics.json: existe");
    console.log(
      `  Población:       ${existing.demographics.population?.toLocaleString("es-ES")} (${popDate}, ${popTimeAgo})`,
    );
    console.log(
      `  PIB:             ${(existing.demographics.gdp / 1_000_000_000_000).toFixed(3)}T€ (${gdpSource})`,
    );
    console.log(
      `  Población activa: ${(existing.demographics.activePopulation / 1_000_000).toFixed(2)}M`,
    );
  } else {
    console.log("demographics.json: NO EXISTE");
  }
  console.log();

  if (existing.pensions) {
    const payroll = existing.pensions.current?.monthlyPayroll;
    const source =
      existing.pensions.sourceAttribution?.monthlyPayroll?.source ||
      "desconocida";
    console.log("pensions.json:     existe");
    console.log(
      `  Nómina mensual:  ${(payroll / 1_000_000_000).toFixed(3)}B€/mes`,
    );
    console.log(`  Fuente:          ${source}`);
    console.log(
      `  Tipo:            ${existing.pensions.sourceAttribution?.monthlyPayroll?.type || "desconocido"}`,
    );
  } else {
    console.log("pensions.json:     NO EXISTE");
  }
  console.log();

  if (existing.meta) {
    const lastDownload = new Date(existing.meta.lastDownload);
    const downloadTimeAgo = getTimeAgo(existing.meta.lastDownload);
    console.log("meta.json:         existe");
    console.log(
      `  Última descarga: ${lastDownload.toLocaleString("es-ES")} (${downloadTimeAgo})`,
    );
    console.log(
      `  Duración:        ${(existing.meta.duration / 1000).toFixed(1)}s`,
    );
  } else {
    console.log("meta.json:         NO EXISTE");
  }
  console.log();
}

export function displayDataComparison(existing, newData) {
  console.log(
    "\n╔═══════════════════════════════════════════════════════════════════════════════════════════════╗",
  );
  console.log(
    "║  Comparación Datos Existentes vs Nuevos                                                      ║",
  );
  console.log(
    "╚═══════════════════════════════════════════════════════════════════════════════════════════════╝",
  );
  console.log();

  const colWidth = {
    label: 25,
    existing: 35,
    new: 35,
  };

  console.log(
    padEnd("", colWidth.label) +
      padEnd("EXISTENTE", colWidth.existing) +
      padEnd("NUEVO", colWidth.new) +
      "CAMBIO",
  );
  console.log("─".repeat(115));

  if (existing.debt && newData.debt) {
    const oldTotal = existing.debt.current?.totalDebt;
    const newTotal = newData.debt.current?.totalDebt;
    const oldDate =
      existing.debt.historical?.[existing.debt.historical.length - 1]?.date;
    const newDate =
      newData.debt.historical?.[newData.debt.historical.length - 1]?.date;
    const oldPoints = existing.debt.historical?.length || 0;
    const newPoints = newData.debt.historical?.length || 0;
    const oldSource =
      existing.debt.sourceAttribution?.totalDebt?.source || "desconocida";
    const newSource =
      newData.debt.sourceAttribution?.totalDebt?.source || "desconocida";

    console.log(
      padEnd("Deuda total:", colWidth.label) +
        padEnd(`${oldTotal?.toLocaleString("es-ES")} €`, colWidth.existing) +
        padEnd(`${newTotal?.toLocaleString("es-ES")} €`, colWidth.new) +
        getChangeIndicator(oldTotal, newTotal),
    );

    console.log(
      padEnd("  Fuente:", colWidth.label) +
        padEnd(`${oldSource} (${oldDate})`, colWidth.existing) +
        padEnd(`${newSource} (${newDate})`, colWidth.new) +
        (oldDate === newDate ? "= (misma fecha)" : "✓ (actualizado)"),
    );

    console.log(
      padEnd("  Datos históricos:", colWidth.label) +
        padEnd(`${oldPoints} puntos`, colWidth.existing) +
        padEnd(`${newPoints} puntos`, colWidth.new) +
        getChangeIndicator(oldPoints, newPoints),
    );

    const oldEstado = existing.debt.current?.debtBySubsector?.estado;
    const newEstado = newData.debt.current?.debtBySubsector?.estado;
    if (oldEstado && newEstado) {
      console.log(
        padEnd("  Estado:", colWidth.label) +
          padEnd(
            `${(oldEstado / 1_000_000_000).toFixed(1)}B€`,
            colWidth.existing,
          ) +
          padEnd(
            `${(newEstado / 1_000_000_000).toFixed(1)}B€`,
            colWidth.new,
          ) +
          getChangeIndicator(oldEstado, newEstado),
      );
    }

    const oldCCAA = existing.debt.current?.debtBySubsector?.ccaa;
    const newCCAA = newData.debt.current?.debtBySubsector?.ccaa;
    if (oldCCAA && newCCAA) {
      console.log(
        padEnd("  CCAA:", colWidth.label) +
          padEnd(
            `${(oldCCAA / 1_000_000_000).toFixed(1)}B€`,
            colWidth.existing,
          ) +
          padEnd(
            `${(newCCAA / 1_000_000_000).toFixed(1)}B€`,
            colWidth.new,
          ) +
          getChangeIndicator(oldCCAA, newCCAA),
      );
    }

    console.log();
  }

  if (existing.demographics && newData.demographics) {
    const oldPop = existing.demographics.population;
    const newPop = newData.demographics.population;
    const oldPopDate =
      existing.demographics.sourceAttribution?.population?.date;
    const newPopDate = newData.demographics.sourceAttribution?.population?.date;
    const oldPopSource =
      existing.demographics.sourceAttribution?.population?.source;
    const newPopSource =
      newData.demographics.sourceAttribution?.population?.source;

    console.log(
      padEnd("Población:", colWidth.label) +
        padEnd(`${oldPop?.toLocaleString("es-ES")}`, colWidth.existing) +
        padEnd(`${newPop?.toLocaleString("es-ES")}`, colWidth.new) +
        getChangeIndicator(oldPop, newPop),
    );

    console.log(
      padEnd("  Fuente:", colWidth.label) +
        padEnd(`${oldPopSource} (${oldPopDate})`, colWidth.existing) +
        padEnd(`${newPopSource} (${newPopDate})`, colWidth.new) +
        (oldPopDate === newPopDate
          ? "= (misma fecha)"
          : "✓ (actualizado)"),
    );

    const oldGDP = existing.demographics.gdp;
    const newGDP = newData.demographics.gdp;
    const oldGDPSource =
      existing.demographics.sourceAttribution?.gdp?.source;
    const newGDPSource =
      newData.demographics.sourceAttribution?.gdp?.source;

    console.log(
      padEnd("PIB:", colWidth.label) +
        padEnd(
          `${(oldGDP / 1_000_000_000_000).toFixed(3)}T€`,
          colWidth.existing,
        ) +
        padEnd(
          `${(newGDP / 1_000_000_000_000).toFixed(3)}T€`,
          colWidth.new,
        ) +
        getChangeIndicator(oldGDP, newGDP),
    );

    console.log(
      padEnd("  Fuente:", colWidth.label) +
        padEnd(oldGDPSource || "desconocida", colWidth.existing) +
        padEnd(newGDPSource || "desconocida", colWidth.new) +
        (oldGDPSource === newGDPSource ? "= (misma fuente)" : "✓"),
    );

    console.log();
  }

  if (existing.pensions && newData.pensions) {
    const oldPayroll = existing.pensions.current?.monthlyPayroll;
    const newPayroll = newData.pensions.current?.monthlyPayroll;
    const oldType =
      existing.pensions.sourceAttribution?.monthlyPayroll?.type;
    const newType = newData.pensions.sourceAttribution?.monthlyPayroll?.type;

    console.log(
      padEnd("Nómina pensiones:", colWidth.label) +
        padEnd(
          `${(oldPayroll / 1_000_000_000).toFixed(3)}B€/mes`,
          colWidth.existing,
        ) +
        padEnd(
          `${(newPayroll / 1_000_000_000).toFixed(3)}B€/mes`,
          colWidth.new,
        ) +
        getChangeIndicator(oldPayroll, newPayroll),
    );

    console.log(
      padEnd("  Fuente:", colWidth.label) +
        padEnd(oldType || "desconocido", colWidth.existing) +
        padEnd(newType || "desconocido", colWidth.new) +
        (oldType === "fallback" && newType === "fallback"
          ? "⚠️  (ambos fallback)"
          : ""),
    );

    console.log();
  }
}

export function displayFreshnessWarnings(data) {
  console.log(
    "\n╔═══════════════════════════════════════════════════════╗",
  );
  console.log(
    "║  Alertas de Frescura de Datos                         ║",
  );
  console.log(
    "╚═══════════════════════════════════════════════════════╝",
  );
  console.log();

  const warnings = [];
  const successes = [];

  if (data.debt) {
    const lastDate =
      data.debt.historical?.[data.debt.historical.length - 1]?.date;
    const type = data.debt.sourceAttribution?.totalDebt?.type;
    const ageMonths = getAgeInMonths(lastDate);

    if (type === "csv" && ageMonths < 4) {
      successes.push(
        `✅  Deuda: datos frescos del BdE (último: ${lastDate}, hace ${ageMonths} ${ageMonths === 1 ? "mes" : "meses"})`,
      );
    } else if (ageMonths >= 4) {
      warnings.push(
        `⚠️  Deuda: dato de ${lastDate} (hace ${ageMonths} meses) - puede estar desactualizado`,
      );
    }
  }

  if (data.demographics) {
    const popDate = data.demographics.sourceAttribution?.population?.date;
    const popType = data.demographics.sourceAttribution?.population?.type;
    const popYears = getAgeInYears(popDate);

    if (popType === "api" && popYears >= 2) {
      warnings.push(
        `⚠️  Población: dato de ${popDate} (hace ${popYears} años!) - el INE API devuelve datos antiguos para tabla 56934`,
      );
    } else if (popType === "fallback") {
      warnings.push(
        "⚠️  Población: usando valor de referencia hardcoded - INE API no devuelve datos válidos",
      );
    } else if (popType === "api") {
      successes.push(
        `✅  Población: datos del INE (${popDate}, hace ${popYears} ${popYears === 1 ? "año" : "años"})`,
      );
    }

    const gdpType = data.demographics.sourceAttribution?.gdp?.type;
    if (gdpType === "fallback") {
      warnings.push(
        `⚠️  PIB: usando valor de referencia hardcoded (${(data.demographics.gdp / 1_000_000_000_000).toFixed(3)}T€) - INE API no devuelve datos válidos`,
      );
    } else if (gdpType === "api") {
      successes.push("✅  PIB: datos del INE API");
    }

    const activeType =
      data.demographics.sourceAttribution?.activePopulation?.type;
    if (activeType === "fallback") {
      warnings.push(
        "⚠️  Población activa: usando valor de referencia hardcoded - INE EPA no accesible",
      );
    }
  }

  if (data.pensions) {
    const pensionType =
      data.pensions.sourceAttribution?.monthlyPayroll?.type;
    if (pensionType === "fallback") {
      warnings.push(
        "⚠️  Datos de pensiones: todo es fallback hardcoded - Seguridad Social no tiene API pública",
      );
    } else if (pensionType === "csv") {
      successes.push("✅  Pensiones: datos en vivo de Seguridad Social");
    }
  }

  warnings.forEach((w) => console.log(w));

  if (successes.length > 0) {
    console.log();
    successes.forEach((s) => console.log(s));
  }

  if (warnings.length === 0 && successes.length === 0) {
    console.log("ℹ️  No hay alertas de frescura");
  }

  console.log();
}

export function getTimeAgo(dateStr) {
  if (!dateStr) return "desconocido";

  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    if (diffDays === 0) return "hoy";
    if (diffDays === 1) return "ayer";
    if (diffDays < 30) return `hace ${diffDays} días`;
    if (diffMonths === 1) return "hace 1 mes";
    if (diffMonths < 12) return `hace ${diffMonths} meses`;
    if (diffYears === 1) return "hace 1 año";
    return `hace ${diffYears} años`;
  } catch (e) {
    return "fecha inválida";
  }
}

export function getAgeInMonths(dateStr) {
  if (!dateStr) return 999;

  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30));
  } catch (e) {
    return 999;
  }
}

export function getAgeInYears(dateStr) {
  if (!dateStr) return 999;

  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 365));
  } catch (e) {
    return 999;
  }
}

export function padEnd(str, length) {
  return str.padEnd(length, " ");
}

export function getChangeIndicator(oldVal, newVal) {
  if (oldVal === undefined || newVal === undefined) return "?";
  if (oldVal === newVal) return "= (sin cambio)";

  const diff = newVal - oldVal;
  const pct = ((diff / oldVal) * 100).toFixed(2);

  if (diff > 0) {
    return `↑ +${diff.toLocaleString("es-ES")} (+${pct}%)`;
  }
  return `↓ ${diff.toLocaleString("es-ES")} (${pct}%)`;
}
