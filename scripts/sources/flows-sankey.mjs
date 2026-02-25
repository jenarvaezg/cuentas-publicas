import fs from "fs/promises";
import path from "path";

// File paths
const DATA_DIR = path.join(process.cwd(), "src", "data");
const REVENUE_FILE = path.join(DATA_DIR, "revenue.json");
const TAX_REVENUE_FILE = path.join(DATA_DIR, "tax-revenue.json");
const PENSIONS_FILE = path.join(DATA_DIR, "pensions.json");
const BUDGET_FILE = path.join(DATA_DIR, "budget.json");
const OUT_FILE = path.join(DATA_DIR, "flows.json");

const MIN_YEAR = 2012;

/**
 * Builds the Sankey DAG (nodes + links) for a single year.
 * Returns { nodes, links } with perfect mass balance.
 */
function buildYearGraph(yearRevenue, yearBudget, taxNational, pensionPayroll) {
  const nodes = [];
  const links = [];
  let linkIdCounter = 0;

  const addNode = (id, label, group, amount, metadata = {}) => {
    nodes.push({ id, label, group, amount, format: "currency", ...metadata });
  };

  const addLink = (source, target, amount, label = "", metadata = {}) => {
    links.push({
      id: `l_${linkIdCounter++}`,
      source,
      target,
      amount: Math.round(amount),
      label,
      ...metadata,
    });
  };

  // -------------------------------------------------------------
  // MACRO AGGREGATES
  // -------------------------------------------------------------
  const totalRevenue = yearRevenue.totalRevenue;
  const totalExpenditure = yearRevenue.totalExpenditure;
  const deficit = yearRevenue.balance < 0 ? Math.abs(yearRevenue.balance) : 0;
  const budgetTotal = yearBudget.total;

  // Scale IGAE values to match Eurostat's totalExpenditure (golden truth)
  const cofogScale = totalExpenditure / budgetTotal;

  // -------------------------------------------------------------
  // NODE DEFINITIONS - INPUTS
  // -------------------------------------------------------------
  addNode("CONSOLIDADO", "Presupuesto Consolidado", "core", totalExpenditure, {
    note: "Total de cuentas públicas",
  });

  // 1. Deficit (Deuda)
  if (deficit > 0) {
    addNode("DEFICIT", "Déficit (Nueva Deuda)", "income", deficit);
    addLink("DEFICIT", "CONSOLIDADO", deficit, "Financiación Vía Deuda");
  }

  // 2. Ingresos
  addNode("INGRESOS_TOTALES", "Ingresos Públicos", "income_agg", totalRevenue);
  addLink("INGRESOS_TOTALES", "CONSOLIDADO", totalRevenue, "Recaudación");

  // 2.1 Cotizaciones Sociales
  addNode(
    "COTIZACIONES",
    "Cotizaciones Sociales",
    "income_type",
    yearRevenue.socialContributions,
  );
  addLink("COTIZACIONES", "INGRESOS_TOTALES", yearRevenue.socialContributions);

  // 2.2 Impuestos Directos (IRPF, Sociedades, etc)
  addNode(
    "IMPUESTOS_DIRECTOS",
    "Impuestos Directos",
    "income_type",
    yearRevenue.taxesDirect,
  );
  addLink("IMPUESTOS_DIRECTOS", "INGRESOS_TOTALES", yearRevenue.taxesDirect);

  if (taxNational) {
    const totalAeatDirect =
      taxNational.irpf + taxNational.sociedades + (taxNational.irnr || 0);
    if (totalAeatDirect > 0) {
      const irpfRatio = taxNational.irpf / totalAeatDirect;
      const socRatio = taxNational.sociedades / totalAeatDirect;

      const eqIrpf = Math.round(yearRevenue.taxesDirect * irpfRatio);
      const eqSociedades = Math.round(yearRevenue.taxesDirect * socRatio);
      const eqIrnr = yearRevenue.taxesDirect - eqIrpf - eqSociedades;

      addNode("IRPF", "IRPF", "tax_detail", eqIrpf);
      addLink("IRPF", "IMPUESTOS_DIRECTOS", eqIrpf);

      addNode("IS", "Impuesto Sociedades", "tax_detail", eqSociedades);
      addLink("IS", "IMPUESTOS_DIRECTOS", eqSociedades);

      if (eqIrnr > 0) {
        addNode(
          "IRNR",
          "Impuesto Renta No Residentes",
          "tax_detail",
          eqIrnr,
        );
        addLink("IRNR", "IMPUESTOS_DIRECTOS", eqIrnr);
      }
    }
  }

  // 2.3 Impuestos Indirectos (IVA, Especiales)
  addNode(
    "IMPUESTOS_INDIRECTOS",
    "Impuestos Indirectos",
    "income_type",
    yearRevenue.taxesIndirect,
  );
  addLink(
    "IMPUESTOS_INDIRECTOS",
    "INGRESOS_TOTALES",
    yearRevenue.taxesIndirect,
  );

  if (taxNational) {
    const totalAeatIndirect = taxNational.iva + taxNational.iiee;
    if (totalAeatIndirect > 0) {
      const ivaRatio = taxNational.iva / totalAeatIndirect;
      const eqIva = Math.round(yearRevenue.taxesIndirect * ivaRatio);
      const eqIiee = yearRevenue.taxesIndirect - eqIva;

      addNode("IVA", "IVA", "tax_detail", eqIva);
      addLink("IVA", "IMPUESTOS_INDIRECTOS", eqIva);

      addNode("IIEE", "Impuestos Especiales", "tax_detail", eqIiee);
      addLink("IIEE", "IMPUESTOS_INDIRECTOS", eqIiee);
    }
  }

  // 2.4 Otros Ingresos
  addNode(
    "OTROS_INGRESOS",
    "Otros Ingresos",
    "income_type",
    yearRevenue.otherRevenue,
  );
  addLink("OTROS_INGRESOS", "INGRESOS_TOTALES", yearRevenue.otherRevenue);

  // -------------------------------------------------------------
  // NODE DEFINITIONS - OUTPUTS
  // -------------------------------------------------------------
  for (const cat of yearBudget.categories) {
    let isSpecificExtracted = false;
    const catCode = cat.code;
    const catName = cat.name;
    const catAmount = Math.round(cat.amount * cofogScale);

    // Extract Pensions
    if (catCode === "10" && pensionPayroll > 0) {
      const scaledPension = Math.round(pensionPayroll * cofogScale);
      const remainder = Math.max(0, catAmount - scaledPension);

      addNode(
        "GASTO_PENSIONES",
        "Pensiones",
        "expense_specific",
        scaledPension,
      );
      addLink("CONSOLIDADO", "GASTO_PENSIONES", scaledPension);

      if (remainder > 0) {
        addNode(
          "COFOG_10_RESTO",
          "Resto Protección Social",
          "expense_cofog",
          remainder,
        );
        addLink("CONSOLIDADO", "COFOG_10_RESTO", remainder);
      }
      isSpecificExtracted = true;
    }

    // Extract Interest Payments
    if (catCode === "01") {
      const debtOp = cat.children?.find((c) => c.code === "01.7");
      if (debtOp && debtOp.amount > 0) {
        const scaledInterests = Math.round(debtOp.amount * cofogScale);
        const remainder = Math.max(0, catAmount - scaledInterests);

        addNode(
          "GASTO_INTERESES",
          "Intereses Deuda Pública",
          "expense_specific",
          scaledInterests,
        );
        addLink("CONSOLIDADO", "GASTO_INTERESES", scaledInterests);

        if (remainder > 0) {
          addNode(
            "COFOG_01_RESTO",
            "Servicios Públicos Generales (Resto)",
            "expense_cofog",
            remainder,
          );
          addLink("CONSOLIDADO", "COFOG_01_RESTO", remainder);
        }
        isSpecificExtracted = true;
      }
    }

    if (!isSpecificExtracted) {
      addNode(`COFOG_${catCode}`, catName, "expense_cofog", catAmount);
      addLink("CONSOLIDADO", `COFOG_${catCode}`, catAmount);
    }
  }

  // Fix rounding to guarantee perfect mass balance
  const linkOutputs = links.filter((l) => l.source === "CONSOLIDADO");
  const totalLinkedOutputs = linkOutputs.reduce(
    (sum, l) => sum + l.amount,
    0,
  );
  const roundingDiff = totalExpenditure - totalLinkedOutputs;

  if (roundingDiff !== 0) {
    const largestLink = [...linkOutputs].sort(
      (a, b) => b.amount - a.amount,
    )[0];
    const targetNode = nodes.find((n) => n.id === largestLink.target);
    if (targetNode) {
      targetNode.amount += roundingDiff;
      largestLink.amount += roundingDiff;
    }
  }

  return { nodes, links };
}

/**
 * Resolves pension payroll in M€ for a given year from historical or current data.
 * Returns 0 if no data is available (pensions fold into COFOG_10 naturally).
 */
function resolvePensionPayroll(pensionsData, year, latestYear) {
  // For the latest year, use current data if available
  if (year === latestYear && pensionsData?.current?.annualExpense) {
    return Math.round(pensionsData.current.annualExpense / 1_000_000);
  }

  // For historical years, find entries matching the year
  if (pensionsData?.historical) {
    const yearEntries = pensionsData.historical.filter((h) => {
      const entryYear = new Date(h.date).getFullYear();
      return entryYear === year;
    });

    if (yearEntries.length > 0) {
      // Use the last entry of the year (closest to December)
      const best = yearEntries[yearEntries.length - 1];
      return Math.round((best.monthlyPayroll * 12) / 1_000_000);
    }
  }

  return 0;
}

/**
 * Generates a unified Sankey DAG for every year where both revenue and budget data exist.
 * Reads from previously generated JSONs to ensure a perfect mass balance per year.
 */
export async function downloadFlowsSankeyData(readFile = fs.readFile) {
  console.log(
    "Generando dataset consolidado de Flujos Fiscales (Sankey)...",
  );

  try {
    // 1. Read all required datasets
    const revenueData = JSON.parse(
      await readFile(REVENUE_FILE, "utf-8"),
    );
    const taxRevenueData = JSON.parse(
      await readFile(TAX_REVENUE_FILE, "utf-8"),
    );
    const pensionsData = JSON.parse(
      await readFile(PENSIONS_FILE, "utf-8"),
    );
    const budgetData = JSON.parse(await readFile(BUDGET_FILE, "utf-8"));

    // 2. Determine the latest year and all available years
    const latestRevenueYear = revenueData.latestYear;
    const latestBudgetYear = budgetData.latestYear;
    const latestYear = Math.min(latestRevenueYear, latestBudgetYear);

    const revenueYears = new Set(
      Object.keys(revenueData.byYear).map(Number),
    );
    const budgetYears = new Set(
      Object.keys(budgetData.byYear).map(Number),
    );
    const availableYears = [...revenueYears]
      .filter((y) => budgetYears.has(y) && y >= MIN_YEAR)
      .sort((a, b) => a - b);

    console.log(
      `  > Años disponibles: ${availableYears[0]}-${availableYears[availableYears.length - 1]} (${availableYears.length} años)`,
    );

    // 3. Build graph for each year
    const byYear = {};

    for (const year of availableYears) {
      const yearRevenue = revenueData.byYear[year];
      const yearBudget = budgetData.byYear[year];
      const taxNational =
        taxRevenueData.national[year] ||
        taxRevenueData.national[taxRevenueData.latestYear];
      const pensionPayroll = resolvePensionPayroll(
        pensionsData,
        year,
        latestYear,
      );

      byYear[year] = buildYearGraph(
        yearRevenue,
        yearBudget,
        taxNational,
        pensionPayroll,
      );
    }

    const flowsData = {
      lastUpdated: new Date().toISOString(),
      latestYear,
      years: availableYears,
      byYear,
      sourceAttribution: {
        consolidated: {
          source:
            "Pipeline Interno (Consolidación Eurostat, AEAT, IGAE, SS, BdE)",
          type: "derived",
          note: "Grafo Dirigido Acíclico (DAG) balanceado para visualización Sankey.",
        },
      },
    };

    console.log(`  ✓ Grafo generado para ${availableYears.length} años.`);
    return flowsData;
  } catch (error) {
    console.error(
      `  Error generando dataset de flujos Sankey: ${error.message}`,
    );
    throw error;
  }
}
