import { mkdirSync, writeFileSync } from "fs";
import { dirname } from "path";
import { downloadDebtData, downloadCcaaDebtData } from "./sources/bde.mjs";
import { downloadDemographics } from "./sources/ine.mjs";
import {
  downloadPensionData,
  enrichPensionWithSustainability,
} from "./sources/seguridad-social.mjs";
import { downloadBudgetData } from "./sources/igae.mjs";
import {
  downloadEurostatData,
  downloadRevenueData,
} from "./sources/eurostat.mjs";
import { downloadTaxRevenueData } from "./sources/aeat.mjs";
import { downloadCcaaFiscalBalanceData } from "./sources/hacienda-fiscal-balance.mjs";
import { downloadCcaaSpendingData } from "./sources/ccaa-spending.mjs";
import { downloadCcaaForalFlowsData } from "./sources/ccaa-foral-flows.mjs";
import downloadCcaaDeficitData from "./sources/ccaa-deficit.mjs";
import { downloadRegionalPensionsData } from "./sources/pensions-regional.mjs";
import { downloadRegionalAccountsData } from "./sources/regional-accounts.mjs";
import { downloadUnemploymentRegionalData } from "./sources/unemployment-regional.mjs";
import { downloadFlowsSankeyData } from "./sources/flows-sankey.mjs";
import { downloadSSSustainability } from "./sources/ss-sustainability.mjs";
import {
  buildSeoSnapshotHtml,
  buildSectionSnapshotPages,
  buildSitemapXml,
  buildRssFeed,
} from "./lib/seo-generators.mjs";
import {
  readExistingData,
  displayExistingDataStatus,
  displayDataComparison,
  displayFreshnessWarnings,
} from "./lib/reporting.mjs";
import { VALIDATORS, validateDelta } from "./lib/validators.mjs";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toIsoDateString(value) {
  if (value == null) return null;

  if (typeof value === "number" && Number.isFinite(value)) {
    return `${Math.trunc(value)}-12-31`;
  }

  const valueStr = String(value).trim();
  if (!valueStr) return null;

  const yearMatch = valueStr.match(/^(\d{4})$/);
  if (yearMatch) return `${yearMatch[1]}-12-31`;

  const quarterMatch = valueStr.match(/^(\d{4})-Q([1-4])$/i);
  if (quarterMatch) {
    const [_, year, quarter] = quarterMatch;
    const quarterEndMonth = { 1: "03", 2: "06", 3: "09", 4: "12" }[quarter];
    const quarterEndDay =
      quarter === "1"
        ? "31"
        : quarter === "2"
          ? "30"
          : quarter === "3"
            ? "30"
            : "31";
    return `${year}-${quarterEndMonth}-${quarterEndDay}`;
  }

  const parsed = new Date(valueStr);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function pickLatestDate(values) {
  const normalized = values
    .map(toIsoDateString)
    .filter(Boolean)
    .map((v) => ({ raw: v, ts: new Date(v).getTime() }))
    .filter((v) => !Number.isNaN(v.ts));

  if (normalized.length === 0) return null;
  normalized.sort((a, b) => b.ts - a.ts);
  return normalized[0].raw;
}

function getAttributionDates(sourceAttribution) {
  if (!sourceAttribution || typeof sourceAttribution !== "object") return [];
  return Object.values(sourceAttribution)
    .map((attr) => attr?.date)
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Fallback detection
// ---------------------------------------------------------------------------

const FALLBACK_GUARD_KEYS = {
  debt: ["totalDebt", "debtBySubsector", "debtToGDP"],
  demographics: [
    "population",
    "activePopulation",
    "gdp",
    "averageSalary",
    "cpi",
    "vitalStats",
    "lifeExpectancy",
    "pyramid",
  ],
  // socialContributions, reserveFund, affiliates intentionally excluded:
  // they are enriched via cross-reference from ssSustainability after both pipelines complete
  pensions: [
    "monthlyPayroll",
    "monthlyPayrollSS",
    "totalPensions",
    "averagePensionRetirement",
  ],
  budget: ["budget"],
  eurostat: ["eurostat"],
  ccaaDebt: ["be1309", "be1310"],
  revenue: ["revenue"],
  taxRevenue: ["series", "delegaciones"],
  ccaaFiscalBalance: ["balances"],
  ccaaSpending: ["spending"],
  ccaaForalFlows: ["foral"],
  ccaaDeficit: ["igae-cn-regional"],
  regionalAccounts: ["regionalAccounts"],
  unemploymentRegional: ["unemployment"],
  pensionsRegional: ["byYear"],
  flowsSankey: ["sankey"],
  ssSustainability: ["ssSustainability"],
};

function getFallbackKeys(sourceName, payload) {
  const sourceAttribution = payload?.sourceAttribution;
  if (!sourceAttribution || typeof sourceAttribution !== "object") return [];

  const guardKeys = FALLBACK_GUARD_KEYS[sourceName];
  const entries = guardKeys
    ? guardKeys.map((key) => [key, sourceAttribution[key]])
    : Object.entries(sourceAttribution);

  return entries
    .filter(([, attr]) => String(attr?.type || "").toLowerCase() === "fallback")
    .map(([key]) => key);
}

function getSourceFailureReason(result, fbKeys) {
  if (result?.status !== "fulfilled") {
    return result?.reason?.message || "Error desconocido";
  }

  if (fbKeys.length > 0) {
    return `Fallback detectado en: ${fbKeys.join(", ")}`;
  }

  return "Fuente inválida";
}

// ---------------------------------------------------------------------------
// Source registry
// ---------------------------------------------------------------------------

const SOURCE_REGISTRY = [
  {
    name: "debt",
    fileName: "debt.json",
    download: downloadDebtData,
    metaExtractor: (r) => ({
      lastRealDataDate: pickLatestDate([
        r.historical?.[r.historical.length - 1]?.date,
        ...getAttributionDates(r.sourceAttribution),
      ]),
      dataPoints: r.historical?.length || 0,
    }),
  },
  {
    name: "demographics",
    fileName: "demographics.json",
    download: downloadDemographics,
    metaExtractor: (r) => ({
      lastRealDataDate: pickLatestDate([
        ...getAttributionDates(r.sourceAttribution),
      ]),
    }),
  },
  {
    name: "pensions",
    fileName: "pensions.json",
    download: downloadPensionData,
    metaExtractor: (r) => ({
      criticalFallback: Boolean(r.pipeline?.criticalFallback),
      criticalFallbackReason: r.pipeline?.fallbackReason || null,
      lastRealDataDate: pickLatestDate([
        r.historical?.[r.historical.length - 1]?.date,
        ...getAttributionDates(r.sourceAttribution),
      ]),
      dataPoints: r.historical?.length || 0,
    }),
  },
  {
    name: "budget",
    fileName: "budget.json",
    download: downloadBudgetData,
    metaExtractor: (r) => ({
      lastRealDataDate: pickLatestDate([
        r.latestYear,
        ...getAttributionDates(r.sourceAttribution),
      ]),
      years: r.years?.length || 0,
    }),
  },
  {
    name: "eurostat",
    fileName: "eurostat.json",
    download: downloadEurostatData,
    metaExtractor: (r) => ({
      lastRealDataDate: pickLatestDate([
        r.year,
        ...getAttributionDates(r.sourceAttribution),
      ]),
      year: r.year || null,
    }),
  },
  {
    name: "ccaaDebt",
    fileName: "ccaa-debt.json",
    download: downloadCcaaDebtData,
    metaExtractor: (r) => ({
      lastRealDataDate: pickLatestDate([
        r.quarter,
        ...getAttributionDates(r.sourceAttribution),
      ]),
      quarter: r.quarter || null,
    }),
  },
  {
    name: "revenue",
    fileName: "revenue.json",
    download: downloadRevenueData,
    metaExtractor: (r) => ({
      lastRealDataDate: pickLatestDate([
        r.latestYear,
        ...getAttributionDates(r.sourceAttribution),
      ]),
      latestYear: r.latestYear || null,
    }),
  },
  {
    name: "taxRevenue",
    fileName: "tax-revenue.json",
    download: downloadTaxRevenueData,
    metaExtractor: (r) => ({
      lastRealDataDate: pickLatestDate([
        r.latestYear,
        ...getAttributionDates(r.sourceAttribution),
      ]),
      latestYear: r.latestYear || null,
      years: r.years?.length || 0,
    }),
  },
  {
    name: "ccaaFiscalBalance",
    fileName: "ccaa-fiscal-balance.json",
    download: downloadCcaaFiscalBalanceData,
    metaExtractor: (r) => ({
      lastRealDataDate: pickLatestDate([
        r.latestYear,
        ...getAttributionDates(r.sourceAttribution),
      ]),
      latestYear: r.latestYear || null,
      years: r.years?.length || 0,
    }),
  },
  {
    name: "ccaaSpending",
    fileName: "ccaa-spending.json",
    download: downloadCcaaSpendingData,
    metaExtractor: (r) => ({
      lastRealDataDate: pickLatestDate([
        r.latestYear,
        ...getAttributionDates(r.sourceAttribution),
      ]),
      latestYear: r.latestYear || null,
      years: r.years?.length || 0,
    }),
  },
  {
    name: "ccaaDeficit",
    fileName: "ccaa-deficit.json",
    download: downloadCcaaDeficitData,
    metaExtractor: (r) => ({
      lastRealDataDate: pickLatestDate([
        r.latestYear,
        ...getAttributionDates(r.sourceAttribution),
      ]),
      latestYear: r.latestYear || null,
    }),
  },
  {
    name: "ccaaForalFlows",
    fileName: "ccaa-foral-flows.json",
    download: downloadCcaaForalFlowsData,
    metaExtractor: (r) => ({
      lastRealDataDate: pickLatestDate([
        r.latestYear,
        ...getAttributionDates(r.sourceAttribution),
      ]),
      latestYear: r.latestYear || null,
      communities: r.byYear?.[String(r.latestYear)]?.entries?.length || 0,
    }),
  },
  {
    name: "regionalAccounts",
    fileName: "regional-accounts.json",
    download: downloadRegionalAccountsData,
    metaExtractor: (r) => ({
      lastRealDataDate: pickLatestDate([
        r.latestYear,
        ...getAttributionDates(r.sourceAttribution),
      ]),
      latestYear: r.latestYear || null,
      communities: r.byYear?.[String(r.latestYear)]?.entries?.length || 0,
    }),
  },
  {
    name: "pensionsRegional",
    fileName: "pensions-regional.json",
    download: downloadRegionalPensionsData,
    metaExtractor: (r) => ({
      lastRealDataDate: pickLatestDate([
        r.latestYear,
        ...getAttributionDates(r.sourceAttribution),
      ]),
      latestYear: r.latestYear || null,
      communities: r.byYear?.[String(r.latestYear)]?.entries?.length || 0,
    }),
  },
  {
    name: "unemploymentRegional",
    fileName: "unemployment-regional.json",
    download: downloadUnemploymentRegionalData,
    metaExtractor: (r) => ({
      lastRealDataDate: pickLatestDate([
        r.latestYear,
        ...getAttributionDates(r.sourceAttribution),
      ]),
      latestYear: r.latestYear || null,
      communities: r.byYear?.[String(r.latestYear)]?.entries?.length || 0,
    }),
  },
  {
    name: "flowsSankey",
    fileName: "flows.json",
    download: downloadFlowsSankeyData,
    metaExtractor: (r) => ({
      lastRealDataDate: pickLatestDate([
        r.latestYear,
        ...getAttributionDates(r.sourceAttribution),
      ]),
      latestYear: r.latestYear || null,
      nodes: r.nodes?.length || 0,
      links: r.links?.length || 0,
    }),
  },
  {
    name: "ssSustainability",
    fileName: "ss-sustainability.json",
    download: downloadSSSustainability,
    metaExtractor: (r) => ({
      lastRealDataDate: pickLatestDate([
        r.latestYear,
        ...getAttributionDates(r.sourceAttribution),
      ]),
      latestYear: r.latestYear || null,
      years: r.years?.length || 0,
    }),
  },
];

// ---------------------------------------------------------------------------
// Post-process hooks (cross-references between sources)
// ---------------------------------------------------------------------------

const POST_PROCESS_HOOKS = [
  {
    name: "pension-enrichment",
    requires: ["pensions", "ssSustainability"],
    apply: (values) => {
      if (values.pensions && values.ssSustainability) {
        return {
          pensions: enrichPensionWithSustainability(
            values.pensions,
            values.ssSustainability,
          ),
        };
      }
      return {};
    },
  },
];

// ---------------------------------------------------------------------------
// File writers
// ---------------------------------------------------------------------------

function writeDataFile(path, data) {
  try {
    const json = JSON.stringify(data, null, 2);
    writeFileSync(path, json, "utf-8");
  } catch (error) {
    console.error(`Error escribiendo ${path}:`, error.message);
    throw error;
  }
}

function writeMirroredDataFile(fileName, data) {
  writeDataFile(`src/data/${fileName}`, data);
  writeDataFile(`public/api/v1/${fileName}`, data);
}

function writeTextFile(path, text) {
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text, "utf-8");
  } catch (error) {
    console.error(`Error escribiendo ${path}:`, error.message);
    throw error;
  }
}

function buildPublicApiIndex(meta) {
  return {
    apiVersion: "v1",
    generatedAt: meta.lastDownload,
    basePath: "/api/v1",
    endpoints: [
      {
        path: "/api/v1/debt.json",
        source: "Banco de España",
        description: "Deuda pública PDE y series históricas",
      },
      {
        path: "/api/v1/pensions.json",
        source: "Seguridad Social",
        description: "Nómina, pensiones y métricas derivadas",
      },
      {
        path: "/api/v1/demographics.json",
        source: "INE",
        description: "Población, EPA, PIB, salario e IPC",
      },
      {
        path: "/api/v1/budget.json",
        source: "IGAE",
        description: "Gasto COFOG por año y categoría",
      },
      {
        path: "/api/v1/revenue.json",
        source: "Eurostat",
        description: "Ingresos y gastos públicos de España",
      },
      {
        path: "/api/v1/eurostat.json",
        source: "Eurostat",
        description: "Comparativa UE por indicadores fiscales",
      },
      {
        path: "/api/v1/ccaa-debt.json",
        source: "Banco de España",
        description: "Deuda de CCAA por comunidad",
      },
      {
        path: "/api/v1/tax-revenue.json",
        source: "AEAT",
        description: "Recaudación tributaria por impuesto y CCAA",
      },
      {
        path: "/api/v1/ccaa-fiscal-balance.json",
        source: "Ministerio de Hacienda",
        description:
          "Impuestos cedidos vs transferencias por CCAA (régimen común)",
      },
      {
        path: "/api/v1/ccaa-spending.json",
        source: "IGAE",
        description: "Gasto funcional COFOG por CCAA (administración regional)",
      },
      {
        path: "/api/v1/ccaa-foral-flows.json",
        source: "Gobierno de Navarra + Gobierno Vasco",
        description: "Flujos forales de Navarra y País Vasco (aportación/cupo)",
      },
      {
        path: "/api/v1/regional-accounts.json",
        source: "Eurostat",
        description: "PIB regional y cotizaciones sociales por CCAA",
      },
      {
        path: "/api/v1/pensions-regional.json",
        source: "Seguridad Social (EST24)",
        description: "Gasto anual en pensiones desglosado por CCAA",
      },
      {
        path: "/api/v1/unemployment-regional.json",
        source: "Eurostat (lfst_r_lfu3pers + gov_10a_exp)",
        description:
          "Gasto en prestaciones por desempleo por CCAA (distribución proporcional)",
      },
      {
        path: "/api/v1/ss-sustainability.json",
        source: "Eurostat + Ageing Report",
        description:
          "Sostenibilidad de la Seguridad Social: cotizaciones, gasto contributivo, Fondo de Reserva y proyecciones",
      },
      {
        path: "/api/v1/meta.json",
        source: "Pipeline",
        description: "Estado de actualización y frescura de fuentes",
      },
    ],
    freshness: meta.sources,
  };
}

// ---------------------------------------------------------------------------
// Summary display (source-specific formatting, kept inline for now)
// ---------------------------------------------------------------------------

function displaySourceSummary(status, sourceResults) {
  console.log("=== Resumen de fuentes ===");

  if (status.debt && sourceResults.debt.value) {
    const d = sourceResults.debt.value;
    const debtAttr = d.sourceAttribution?.totalDebt;
    const latestDebt = d.current?.totalDebt;
    const latestDebtBillions = latestDebt
      ? (latestDebt / 1_000_000_000).toFixed(0)
      : "N/A";
    const debtDate = debtAttr?.date || "N/A";
    const isLive = debtAttr && debtAttr.type !== "fallback";
    console.log(
      `Deuda (BdE): ${isLive ? "✅" : "⚠️"} ${debtAttr?.type?.toUpperCase() || "N/A"} (${latestDebtBillions}B€, ${debtDate})`,
    );
  } else {
    console.log("Deuda (BdE): ❌ Error");
  }

  if (status.demographics && sourceResults.demographics.value) {
    const d = sourceResults.demographics.value;
    const popAttr = d.sourceAttribution?.population;
    const population = d.population;
    const popDate = popAttr?.date || "N/A";
    const isLive = popAttr && popAttr.type !== "fallback";
    console.log(
      `Población: ${isLive ? "✅" : "⚠️"} ${popAttr?.type?.toUpperCase() || "N/A"} (${(population / 1_000_000).toFixed(1)}M, ${popDate})`,
    );

    const activeAttr = d.sourceAttribution?.activePopulation;
    const activePop = d.activePopulation;
    const activeDate = activeAttr?.date || "N/A";
    const isActiveLive = activeAttr && activeAttr.type !== "fallback";
    console.log(
      `Población activa: ${isActiveLive ? "✅" : "⚠️"} ${activeAttr?.type?.toUpperCase() || "N/A"} (${(activePop / 1_000_000).toFixed(1)}M, ${activeDate})`,
    );

    const gdpAttr = d.sourceAttribution?.gdp;
    const gdp = d.gdp;
    const gdpDate = gdpAttr?.date || "N/A";
    const isGdpLive = gdpAttr && gdpAttr.type !== "fallback";
    console.log(
      `PIB: ${isGdpLive ? "✅" : "⚠️"} ${gdpAttr?.type?.toUpperCase() || "N/A"} (${(gdp / 1_000_000_000_000).toFixed(2)}T€, ${gdpDate})`,
    );

    const salaryAttr = d.sourceAttribution?.averageSalary;
    const salary = d.averageSalary;
    const salaryDate = salaryAttr?.date || "N/A";
    const isSalaryLive = salaryAttr && salaryAttr.type !== "fallback";
    console.log(
      `Salario medio: ${isSalaryLive ? "✅" : "⚠️"} ${salaryAttr?.type?.toUpperCase() || "N/A"} (${salary.toLocaleString("es-ES")}€, ${salaryDate})`,
    );
  } else {
    console.log("Demografía: ❌ Error");
  }

  if (status.pensions && sourceResults.pensions.value) {
    const d = sourceResults.pensions.value;
    const pensionAttr = d.sourceAttribution?.monthlyPayroll;
    const monthlyPayroll = d.current?.monthlyPayroll;
    const isLive = pensionAttr && pensionAttr.type !== "fallback";
    console.log(
      `Pensiones: ${isLive ? "✅" : "⚠️"} ${pensionAttr?.type?.toUpperCase() || "N/A"} (${(monthlyPayroll / 1_000_000_000).toFixed(2)}B€/mes)`,
    );
  } else {
    console.log("Pensiones: ❌ Error");
  }

  if (status.budget && sourceResults.budget.value) {
    const d = sourceResults.budget.value;
    const budgetAttr = d.sourceAttribution?.budget;
    const latestYear = d.latestYear;
    const latestTotal = d.byYear?.[String(latestYear)]?.total;
    const isLive = budgetAttr && budgetAttr.type !== "fallback";
    console.log(
      `Presupuestos: ${isLive ? "✅" : "⚠️"} ${budgetAttr?.type?.toUpperCase() || "N/A"} (${latestTotal?.toLocaleString("es-ES") || "N/A"} M€, ${latestYear})`,
    );
  } else {
    console.log("Presupuestos: ❌ Error");
  }

  if (status.eurostat && sourceResults.eurostat.value) {
    const d = sourceResults.eurostat.value;
    const eurostatAttr = d.sourceAttribution?.eurostat;
    const indicatorCount = Object.keys(d.indicators || {}).length;
    const isLive = eurostatAttr && eurostatAttr.type !== "fallback";
    console.log(
      `Eurostat: ${isLive ? "✅" : "⚠️"} ${eurostatAttr?.type?.toUpperCase() || "N/A"} (${indicatorCount} indicadores, año ${d.year})`,
    );
  } else {
    console.log("Eurostat: ❌ Error");
  }

  if (status.ccaaDebt && sourceResults.ccaaDebt.value) {
    const d = sourceResults.ccaaDebt.value;
    const ccaaAttr = d.sourceAttribution?.be1310;
    const ccaaCount = d.ccaa?.length || 0;
    const isLive = ccaaAttr && ccaaAttr.type !== "fallback";
    console.log(
      `Deuda CCAA: ${isLive ? "✅" : "⚠️"} ${ccaaAttr?.type?.toUpperCase() || "N/A"} (${ccaaCount} comunidades, ${d.quarter})`,
    );
  } else {
    console.log("Deuda CCAA: ❌ Error");
  }

  if (status.revenue && sourceResults.revenue.value) {
    const d = sourceResults.revenue.value;
    const revenueAttr = d.sourceAttribution?.revenue;
    const yearCount = d.years?.length || 0;
    const isLive = revenueAttr && revenueAttr.type !== "fallback";
    console.log(
      `Revenue: ${isLive ? "✅" : "⚠️"} ${revenueAttr?.type?.toUpperCase() || "N/A"} (${yearCount} años, último ${d.latestYear})`,
    );
  } else {
    console.log("Revenue: ❌ Error");
  }

  if (status.taxRevenue && sourceResults.taxRevenue.value) {
    const d = sourceResults.taxRevenue.value;
    const taxRevAttr = d.sourceAttribution?.series;
    const yearCount = d.years?.length || 0;
    const isLive = taxRevAttr && taxRevAttr.type !== "fallback";
    console.log(
      `Tax Revenue: ${isLive ? "✅" : "⚠️"} ${taxRevAttr?.type?.toUpperCase() || "N/A"} (${yearCount} años, último ${d.latestYear})`,
    );
  } else {
    console.log("Tax Revenue: ❌ Error");
  }

  if (status.ccaaFiscalBalance && sourceResults.ccaaFiscalBalance.value) {
    const d = sourceResults.ccaaFiscalBalance.value;
    const balanceAttr = d.sourceAttribution?.balances;
    const yearCount = d.years?.length || 0;
    const latestYear = d.latestYear;
    const latestEntries = d.byYear?.[String(latestYear)]?.entries?.length || 0;
    const isLive = balanceAttr && balanceAttr.type !== "fallback";
    console.log(
      `Balanzas CCAA: ${isLive ? "✅" : "⚠️"} ${balanceAttr?.type?.toUpperCase() || "N/A"} (${yearCount} años, ${latestEntries} CCAA en ${latestYear})`,
    );
  } else {
    console.log("Balanzas CCAA: ❌ Error");
  }

  if (status.ccaaSpending && sourceResults.ccaaSpending.value) {
    const d = sourceResults.ccaaSpending.value;
    const spendingAttr = d.sourceAttribution?.spending;
    const yearCount = d.years?.length || 0;
    const latestYear = d.latestYear;
    const latestEntries = d.byYear?.[String(latestYear)]?.entries?.length || 0;
    const isLive = spendingAttr && spendingAttr.type !== "fallback";
    console.log(
      `Gasto CCAA: ${isLive ? "✅" : "⚠️"} ${spendingAttr?.type?.toUpperCase() || "N/A"} (${yearCount} años, ${latestEntries} CCAA en ${latestYear})`,
    );
  } else {
    console.log("Gasto CCAA: ❌ Error");
  }

  if (status.ccaaForalFlows && sourceResults.ccaaForalFlows.value) {
    const d = sourceResults.ccaaForalFlows.value;
    const foralAttr = d.sourceAttribution?.foral;
    const latestYear = d.latestYear;
    const latestEntries = d.byYear?.[String(latestYear)]?.entries?.length || 0;
    const isLive = foralAttr && foralAttr.type !== "fallback";
    console.log(
      `Flujos forales: ${isLive ? "✅" : "⚠️"} ${foralAttr?.type?.toUpperCase() || "N/A"} (${latestEntries} CCAA en ${latestYear})`,
    );
  } else {
    console.log("Flujos forales: ❌ Error");
  }
  console.log();
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

async function main() {
  console.log("╔═══════════════════════════════════════════════════════╗");
  console.log("║  Descargador de Datos - Dashboard Fiscal España      ║");
  console.log("╚═══════════════════════════════════════════════════════╝");
  console.log();
  console.log(`Inicio: ${new Date().toLocaleString("es-ES")}`);

  // Ensure output directories exist
  mkdirSync("src/data", { recursive: true });
  mkdirSync("public/api/v1", { recursive: true });

  // Read existing data before downloading
  const existingData = readExistingData();
  displayExistingDataStatus(existingData);

  // Download all sources in parallel
  const startTime = Date.now();
  const rawResults = await Promise.allSettled(
    SOURCE_REGISTRY.map((s) => s.download()),
  );

  // Build results map
  const sourceResults = Object.fromEntries(
    SOURCE_REGISTRY.map((source, i) => [source.name, rawResults[i]]),
  );

  // Analyze source status
  const fulfilled = Object.fromEntries(
    Object.entries(sourceResults).map(([name, result]) => [
      name,
      result.status === "fulfilled",
    ]),
  );

  const fallbackKeys = Object.fromEntries(
    Object.entries(sourceResults).map(([name, result]) => [
      name,
      fulfilled[name] ? getFallbackKeys(name, result.value) : [],
    ]),
  );

  const status = Object.fromEntries(
    Object.keys(sourceResults).map((name) => [
      name,
      fulfilled[name] && fallbackKeys[name].length === 0,
    ]),
  );

  const fallbackSources = Object.entries(fallbackKeys)
    .filter(([, keys]) => keys.length > 0)
    .map(([name]) => name);

  // Apply post-process hooks (cross-references between sources)
  const resolvedValues = Object.fromEntries(
    Object.entries(sourceResults)
      .filter(([name]) => fulfilled[name])
      .map(([name, result]) => [name, result.value]),
  );

  for (const hook of POST_PROCESS_HOOKS) {
    const allPresent = hook.requires.every((name) => resolvedValues[name]);
    if (allPresent) {
      const overrides = hook.apply(resolvedValues);
      Object.assign(resolvedValues, overrides);
      console.log(`🔗 Post-process: ${hook.name}`);
    }
  }

  // Write individual data files
  console.log("\n=== Escribiendo archivos JSON ===");

  const validationSummary = [];

  for (const source of SOURCE_REGISTRY) {
    if (status[source.name]) {
      const data = resolvedValues[source.name];

      // Shape validation
      const validator = VALIDATORS[source.name];
      const validationErrors = validator ? validator(data) : [];
      if (validationErrors.length > 0) {
        console.warn(`⚠️  ${source.fileName} - Validación:`);
        for (const err of validationErrors) {
          console.warn(`     • ${err}`);
        }
        validationSummary.push({ name: source.name, errors: validationErrors, deltaWarnings: [] });
      }

      // Delta validation against previously written data
      const prevData = existingData[source.name];
      const deltaWarnings = validateDelta(source.name, prevData, data);
      if (deltaWarnings.length > 0) {
        console.warn(`⚠️  ${source.fileName} - Cambios grandes:`);
        for (const w of deltaWarnings) {
          console.warn(`     • ${w}`);
        }
        const existing = validationSummary.find((e) => e.name === source.name);
        if (existing) {
          existing.deltaWarnings = deltaWarnings;
        } else {
          validationSummary.push({ name: source.name, errors: [], deltaWarnings });
        }
      }

      writeMirroredDataFile(source.fileName, data);
      const validStatus = validationErrors.length === 0 ? "✅" : "⚠️ ";
      console.log(`${validStatus} ${source.fileName}`);
    } else {
      console.error(
        `❌ ${source.fileName} - Error:`,
        getSourceFailureReason(
          sourceResults[source.name],
          fallbackKeys[source.name],
        ),
      );
    }
  }

  // Validation summary
  if (validationSummary.length > 0) {
    console.warn(`\n⚠️  Resumen de validación: ${validationSummary.length} fuente(s) con advertencias`);
    for (const entry of validationSummary) {
      const total = entry.errors.length + entry.deltaWarnings.length;
      console.warn(`   ${entry.name}: ${total} advertencia(s)`);
    }
  }

  // Build and write metadata
  const nowIso = new Date().toISOString();
  const meta = {
    lastDownload: nowIso,
    duration: Date.now() - startTime,
    status,
    sources: Object.fromEntries(
      SOURCE_REGISTRY.map((source) => {
        const isFulfilled = fulfilled[source.name];
        const result = isFulfilled ? sourceResults[source.name].value : null;
        const base = {
          success: status[source.name],
          fallbackDetected: fallbackKeys[source.name].length > 0,
          fallbackKeys: fallbackKeys[source.name],
          lastUpdated: isFulfilled ? result.lastUpdated : null,
          lastFetchAt: isFulfilled ? nowIso : null,
        };
        const extra =
          isFulfilled && source.metaExtractor
            ? source.metaExtractor(result)
            : {};
        return [source.name, { ...base, ...extra }];
      }),
    ),
  };

  writeMirroredDataFile("meta.json", meta);
  writeDataFile("public/api/v1/index.json", buildPublicApiIndex(meta));
  console.log("✅ meta.json");
  console.log("✅ public/api/v1/index.json");

  // Generate SEO static artifacts
  const seoData = {
    meta,
    debt: status.debt ? resolvedValues.debt : existingData.debt,
    pensions: status.pensions ? resolvedValues.pensions : existingData.pensions,
    budget: status.budget ? resolvedValues.budget : existingData.budget,
    revenue: status.revenue ? resolvedValues.revenue : null,
  };

  writeTextFile("public/seo-snapshot.html", buildSeoSnapshotHtml(seoData));
  const sectionPages = buildSectionSnapshotPages(seoData);
  for (const [path, html] of Object.entries(sectionPages)) {
    writeTextFile(path, html);
  }
  writeTextFile("public/sitemap.xml", buildSitemapXml(meta.lastDownload));
  writeTextFile("public/feed.xml", buildRssFeed(meta));
  console.log("✅ public/seo-snapshot.html");
  console.log("✅ public/sitemap.xml");
  console.log(`✅ ${Object.keys(sectionPages).length} páginas SSG de sección`);
  console.log("✅ public/feed.xml");

  // Compare old vs new data
  if (existingData.debt || existingData.demographics || existingData.pensions) {
    displayDataComparison(existingData, {
      debt: status.debt ? sourceResults.debt.value : null,
      demographics: status.demographics
        ? sourceResults.demographics.value
        : null,
      pensions: status.pensions ? sourceResults.pensions.value : null,
      budget: status.budget ? sourceResults.budget.value : null,
    });
  }

  // Display freshness warnings
  displayFreshnessWarnings({
    debt: status.debt ? sourceResults.debt.value : null,
    demographics: status.demographics ? sourceResults.demographics.value : null,
    pensions: status.pensions ? sourceResults.pensions.value : null,
    budget: status.budget ? sourceResults.budget.value : null,
  });

  // Summary
  console.log("\n╔═══════════════════════════════════════════════════════╗");
  console.log("║  Resumen                                              ║");
  console.log("╚═══════════════════════════════════════════════════════╝");
  console.log();

  const successCount = Object.values(status).filter(Boolean).length;
  const totalCount = Object.keys(status).length;

  console.log(`Fuentes exitosas: ${successCount}/${totalCount}`);
  console.log(`Duración: ${(meta.duration / 1000).toFixed(1)}s`);
  console.log(`Archivos generados: ${successCount + 1}`); // +1 for meta.json
  console.log();

  // Detailed source attribution summary
  displaySourceSummary(status, sourceResults);

  // Fallbacks are treated as errors (potential endpoint/schema mismatch).
  if (fallbackSources.length > 0) {
    console.error("❌ Error: se detectó fallback en fuentes:");
    for (const sourceName of fallbackSources) {
      console.error(
        `  - ${sourceName}: ${fallbackKeys[sourceName].join(", ")}`,
      );
    }
    process.exit(1);
  }

  // B3: Éxito parcial. Definir fuentes críticas.
  const CRITICAL_SOURCES = ["debt", "demographics", "pensions", "budget"];
  const failedCritical = CRITICAL_SOURCES.filter((source) => !status[source]);

  if (failedCritical.length === 0) {
    if (successCount === totalCount) {
      console.log("✅ Descarga completada exitosamente");
    } else {
      console.warn(
        "⚠️  Descarga completada con errores en fuentes no críticas:",
        Object.keys(status)
          .filter((s) => !status[s])
          .join(", "),
      );
    }
    process.exit(0);
  } else {
    console.error(
      "❌ Error: Fallaron fuentes críticas:",
      failedCritical.join(", "),
    );
    process.exit(1);
  }
}

// Run main
main().catch((error) => {
  console.error("\n❌ Error fatal:", error);
  process.exit(1);
});
