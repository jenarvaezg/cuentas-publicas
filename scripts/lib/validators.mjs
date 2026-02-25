/**
 * Lightweight data validators for each JSON data type.
 * Each validator returns an array of error strings (empty = valid).
 * No external dependencies — pure structural checks.
 */

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function isObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function isNonEmptyObject(v) {
  return isObject(v) && Object.keys(v).length > 0;
}

function isNonEmptyArray(v) {
  return Array.isArray(v) && v.length > 0;
}

// ---------------------------------------------------------------------------
// Generic validator
// ---------------------------------------------------------------------------

/**
 * Validates that a set of required top-level keys exist on the data object.
 * @param {unknown} data
 * @param {string[]} requiredKeys
 * @returns {string[]}
 */
export function validateGenericData(data, requiredKeys) {
  const errors = [];
  if (!isObject(data)) {
    errors.push("data is not an object");
    return errors;
  }
  for (const key of requiredKeys) {
    if (!(key in data)) {
      errors.push(`missing required key: ${key}`);
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// DebtData
// ---------------------------------------------------------------------------

export function validateDebtData(data) {
  const errors = [];
  if (!isObject(data)) {
    errors.push("data is not an object");
    return errors;
  }

  if (!isObject(data.current)) errors.push("missing current");

  if (typeof data.current?.totalDebt !== "number")
    errors.push("missing current.totalDebt (expected number)");
  else if (data.current.totalDebt <= 0)
    errors.push("current.totalDebt must be positive");
  else if (data.current.totalDebt < 500_000_000_000)
    errors.push(`current.totalDebt suspiciously small: ${data.current.totalDebt}`);

  if (typeof data.current?.debtToGDP !== "number")
    errors.push("missing current.debtToGDP (expected number)");
  else if (data.current.debtToGDP <= 0 || data.current.debtToGDP > 300)
    errors.push(`current.debtToGDP out of range [0,300]: ${data.current.debtToGDP}`);

  if (!isObject(data.regression))
    errors.push("missing regression object");
  else {
    if (typeof data.regression.slope !== "number")
      errors.push("missing regression.slope");
    if (typeof data.regression.intercept !== "number")
      errors.push("missing regression.intercept");
    if (typeof data.regression.lastDataTimestamp !== "number")
      errors.push("missing regression.lastDataTimestamp");
    if (typeof data.regression.debtPerSecond !== "number")
      errors.push("missing regression.debtPerSecond");
  }

  if (!isNonEmptyArray(data.historical))
    errors.push("historical must be a non-empty array");

  return errors;
}

// ---------------------------------------------------------------------------
// DemographicsData
// ---------------------------------------------------------------------------

export function validateDemographicsData(data) {
  const errors = [];
  if (!isObject(data)) {
    errors.push("data is not an object");
    return errors;
  }

  if (typeof data.population !== "number")
    errors.push("missing population (expected number)");
  else if (data.population < 30_000_000 || data.population > 60_000_000)
    errors.push(`population out of range [30M, 60M]: ${data.population}`);

  if (typeof data.gdp !== "number")
    errors.push("missing gdp (expected number)");
  else if (data.gdp <= 0)
    errors.push("gdp must be positive");

  if (typeof data.activePopulation !== "number")
    errors.push("missing activePopulation (expected number)");
  else if (data.activePopulation <= 0)
    errors.push("activePopulation must be positive");

  if (typeof data.averageSalary !== "number")
    errors.push("missing averageSalary (expected number)");
  else if (data.averageSalary <= 0)
    errors.push("averageSalary must be positive");

  return errors;
}

// ---------------------------------------------------------------------------
// PensionData
// ---------------------------------------------------------------------------

export function validatePensionData(data) {
  const errors = [];
  if (!isObject(data)) {
    errors.push("data is not an object");
    return errors;
  }

  if (!isObject(data.current)) errors.push("missing current");

  if (typeof data.current?.totalPensions !== "number")
    errors.push("missing current.totalPensions (expected number)");
  else if (data.current.totalPensions <= 0)
    errors.push("current.totalPensions must be positive");

  if (typeof data.current?.monthlyPayroll !== "number")
    errors.push("missing current.monthlyPayroll (expected number)");
  else if (data.current.monthlyPayroll <= 0)
    errors.push("current.monthlyPayroll must be positive");

  if (!isObject(data.regression))
    errors.push("missing regression object");
  else {
    if (typeof data.regression.slope !== "number")
      errors.push("missing regression.slope");
    if (typeof data.regression.expensePerSecond !== "number")
      errors.push("missing regression.expensePerSecond");
  }

  if (!isNonEmptyArray(data.historical))
    errors.push("historical must be a non-empty array");

  return errors;
}

// ---------------------------------------------------------------------------
// BudgetData
// ---------------------------------------------------------------------------

export function validateBudgetData(data) {
  const errors = [];
  if (!isObject(data)) {
    errors.push("data is not an object");
    return errors;
  }

  if (typeof data.latestYear !== "number")
    errors.push("missing latestYear (expected number)");
  else if (data.latestYear < 2000 || data.latestYear > 2100)
    errors.push(`latestYear out of plausible range: ${data.latestYear}`);

  if (!isNonEmptyObject(data.byYear))
    errors.push("byYear must be a non-empty object");

  if (!isNonEmptyArray(data.years))
    errors.push("years must be a non-empty array");

  return errors;
}

// ---------------------------------------------------------------------------
// EurostatData
// ---------------------------------------------------------------------------

export function validateEurostatData(data) {
  const errors = [];
  if (!isObject(data)) {
    errors.push("data is not an object");
    return errors;
  }

  if (!isNonEmptyObject(data.indicators))
    errors.push("indicators must be a non-empty object");

  if (!isNonEmptyArray(data.countries))
    errors.push("countries must be a non-empty array");

  if (typeof data.year !== "number")
    errors.push("missing year (expected number)");
  else if (data.year < 2000 || data.year > 2100)
    errors.push(`year out of plausible range: ${data.year}`);

  return errors;
}

// ---------------------------------------------------------------------------
// TaxRevenueData
// ---------------------------------------------------------------------------

export function validateTaxRevenueData(data) {
  const errors = [];
  if (!isObject(data)) {
    errors.push("data is not an object");
    return errors;
  }

  if (!isNonEmptyObject(data.national))
    errors.push("national must be a non-empty object");

  if (typeof data.latestYear !== "number")
    errors.push("missing latestYear (expected number)");

  if (!isNonEmptyArray(data.years))
    errors.push("years must be a non-empty array");

  return errors;
}

// ---------------------------------------------------------------------------
// FlowsData
// ---------------------------------------------------------------------------

export function validateFlowsData(data) {
  const errors = [];
  if (!isObject(data)) {
    errors.push("data is not an object");
    return errors;
  }

  if (!isNonEmptyObject(data.byYear))
    errors.push("byYear must be a non-empty object");

  if (typeof data.latestYear !== "number")
    errors.push("missing latestYear (expected number)");

  // Validate at least the latest year has nodes and links
  if (isObject(data.byYear) && typeof data.latestYear === "number") {
    const latestYearData = data.byYear[String(data.latestYear)];
    if (!isObject(latestYearData)) {
      errors.push(`byYear[${data.latestYear}] is missing`);
    } else {
      if (!isNonEmptyArray(latestYearData.nodes))
        errors.push(`byYear[${data.latestYear}].nodes must be a non-empty array`);
      if (!isNonEmptyArray(latestYearData.links))
        errors.push(`byYear[${data.latestYear}].links must be a non-empty array`);
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// RevenueData
// ---------------------------------------------------------------------------

export function validateRevenueData(data) {
  const errors = [];
  if (!isObject(data)) {
    errors.push("data is not an object");
    return errors;
  }

  if (typeof data.latestYear !== "number")
    errors.push("missing latestYear (expected number)");

  if (!isNonEmptyObject(data.byYear))
    errors.push("byYear must be a non-empty object");

  if (!isNonEmptyArray(data.years))
    errors.push("years must be a non-empty array");

  return errors;
}

// ---------------------------------------------------------------------------
// CcaaDebtData
// ---------------------------------------------------------------------------

export function validateCcaaDebtData(data) {
  const errors = [];
  if (!isObject(data)) {
    errors.push("data is not an object");
    return errors;
  }

  if (!isNonEmptyArray(data.ccaa))
    errors.push("ccaa must be a non-empty array");

  if (!isObject(data.total))
    errors.push("missing total object");

  if (typeof data.quarter !== "string" || !data.quarter)
    errors.push("missing quarter (expected non-empty string)");

  return errors;
}

// ---------------------------------------------------------------------------
// SSSustainabilityData
// ---------------------------------------------------------------------------

export function validateSSSustainabilityData(data) {
  const errors = [];
  if (!isObject(data)) {
    errors.push("data is not an object");
    return errors;
  }

  if (typeof data.latestYear !== "number")
    errors.push("missing latestYear (expected number)");

  if (!isNonEmptyObject(data.byYear))
    errors.push("byYear must be a non-empty object");

  if (!isNonEmptyArray(data.years))
    errors.push("years must be a non-empty array");

  return errors;
}

// ---------------------------------------------------------------------------
// Delta validation — warns if a critical numeric value changed > threshold
// ---------------------------------------------------------------------------

/**
 * Compare a numeric field between old and new data.
 * Returns a warning string if the relative change exceeds the threshold, else null.
 * @param {string} label  Human-readable field name
 * @param {number} oldVal
 * @param {number} newVal
 * @param {number} [threshold=0.5]  Fraction (0.5 = 50%)
 * @returns {string|null}
 */
function checkDelta(label, oldVal, newVal, threshold = 0.5) {
  if (typeof oldVal !== "number" || typeof newVal !== "number") return null;
  if (oldVal === 0) return null;
  const change = Math.abs((newVal - oldVal) / oldVal);
  if (change > threshold) {
    const pct = (change * 100).toFixed(1);
    return `${label} changed by ${pct}% (${oldVal} -> ${newVal})`;
  }
  return null;
}

/**
 * Run delta checks between previous and new data for critical sources.
 * Returns an array of warning strings.
 * @param {string} sourceName
 * @param {unknown} prevData  Previously written data (may be null/undefined)
 * @param {unknown} newData
 * @returns {string[]}
 */
export function validateDelta(sourceName, prevData, newData) {
  if (!isObject(prevData) || !isObject(newData)) return [];

  const warnings = [];

  const addIfWarn = (w) => { if (w) warnings.push(w); };

  switch (sourceName) {
    case "debt":
      addIfWarn(checkDelta("debt.current.totalDebt", prevData.current?.totalDebt, newData.current?.totalDebt));
      addIfWarn(checkDelta("debt.current.debtToGDP", prevData.current?.debtToGDP, newData.current?.debtToGDP));
      addIfWarn(checkDelta("debt.regression.debtPerSecond", prevData.regression?.debtPerSecond, newData.regression?.debtPerSecond));
      break;

    case "demographics":
      addIfWarn(checkDelta("demographics.population", prevData.population, newData.population));
      addIfWarn(checkDelta("demographics.gdp", prevData.gdp, newData.gdp));
      addIfWarn(checkDelta("demographics.averageSalary", prevData.averageSalary, newData.averageSalary));
      break;

    case "pensions":
      addIfWarn(checkDelta("pensions.current.totalPensions", prevData.current?.totalPensions, newData.current?.totalPensions));
      addIfWarn(checkDelta("pensions.current.monthlyPayroll", prevData.current?.monthlyPayroll, newData.current?.monthlyPayroll));
      break;

    case "budget":
      addIfWarn(checkDelta("budget.latestYear", prevData.latestYear, newData.latestYear));
      if (isObject(prevData.byYear) && isObject(newData.byYear)) {
        const prevLatest = prevData.byYear[String(prevData.latestYear)]?.total;
        const newLatest = newData.byYear[String(newData.latestYear)]?.total;
        addIfWarn(checkDelta("budget.byYear[latestYear].total", prevLatest, newLatest));
      }
      break;

    case "eurostat":
      addIfWarn(checkDelta("eurostat.year", prevData.year, newData.year));
      break;

    case "taxRevenue":
      addIfWarn(checkDelta("taxRevenue.latestYear", prevData.latestYear, newData.latestYear));
      break;

    case "revenue":
      addIfWarn(checkDelta("revenue.latestYear", prevData.latestYear, newData.latestYear));
      break;

    default:
      // No specific delta checks for other types
      break;
  }

  return warnings;
}

// ---------------------------------------------------------------------------
// Validator map — maps source name to its validator function
// ---------------------------------------------------------------------------

export const VALIDATORS = {
  debt: validateDebtData,
  demographics: validateDemographicsData,
  pensions: validatePensionData,
  budget: validateBudgetData,
  eurostat: validateEurostatData,
  taxRevenue: validateTaxRevenueData,
  flowsSankey: validateFlowsData,
  revenue: validateRevenueData,
  ccaaDebt: validateCcaaDebtData,
  ssSustainability: validateSSSustainabilityData,
  ccaaFiscalBalance: (data) => validateGenericData(data, ["lastUpdated", "latestYear", "byYear", "years"]),
  ccaaSpending: (data) => validateGenericData(data, ["lastUpdated", "latestYear", "byYear", "years"]),
  ccaaForalFlows: (data) => validateGenericData(data, ["lastUpdated", "latestYear", "byYear", "years"]),
  ccaaDeficit: (data) => validateGenericData(data, ["lastUpdated", "latestYear", "data"]),
  regionalAccounts: (data) => validateGenericData(data, ["lastUpdated", "latestYear", "byYear", "years"]),
  pensionsRegional: (data) => validateGenericData(data, ["latestYear", "byYear"]),
  unemploymentRegional: (data) => validateGenericData(data, ["lastUpdated", "latestYear", "byYear"]),
};
