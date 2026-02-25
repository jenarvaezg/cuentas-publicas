/**
 * Spanish personal tax calculator (2024 rates).
 * Estimates IRPF, Social Security, and IVA for a salaried worker.
 */

// ── IRPF 2024 combined brackets (state + CCAA general) ────────────────
const IRPF_BRACKETS = [
  { from: 0, to: 12_450, rate: 0.19 },
  { from: 12_450, to: 20_200, rate: 0.24 },
  { from: 20_200, to: 35_200, rate: 0.3 },
  { from: 35_200, to: 60_000, rate: 0.37 },
  { from: 60_000, to: 300_000, rate: 0.45 },
  { from: 300_000, to: Number.POSITIVE_INFINITY, rate: 0.47 },
];

// State-only brackets (for splitting state vs CCAA portion)
const IRPF_STATE_BRACKETS = [
  { from: 0, to: 12_450, rate: 0.095 },
  { from: 12_450, to: 20_200, rate: 0.12 },
  { from: 20_200, to: 35_200, rate: 0.15 },
  { from: 35_200, to: 60_000, rate: 0.185 },
  { from: 60_000, to: 300_000, rate: 0.225 },
  { from: 300_000, to: Number.POSITIVE_INFINITY, rate: 0.245 },
];

const MINIMO_PERSONAL = 5_550;
const GASTOS_DEDUCIBLES = 2_000;

/** Reducción por rendimientos del trabajo (art. 20 LIRPF) */
function workIncomeReduction(netWorkIncome: number): number {
  if (netWorkIncome <= 14_047.5) return 6_498;
  if (netWorkIncome <= 19_747.5) return Math.max(0, 6_498 - 1.14 * (netWorkIncome - 14_047.5));
  return 0;
}

// ── Social Security 2024 ──────────────────────────────────────────────
const SS_WORKER_RATE = 0.0647; // CC 4.70 + Desempleo 1.55 + FP 0.10 + MEI 0.12
const SS_EMPLOYER_RATE = 0.3048; // CC 23.60 + Desempleo 5.50 + FOGASA 0.20 + FP 0.60 + MEI 0.58
const SS_MAX_BASE_ANNUAL = 56_646; // 4,720.50 €/month × 12

// ── IVA ───────────────────────────────────────────────────────────────
// Weighted average IVA on household consumption (mix of 4%, 10%, 21% + exemptions)
const IVA_EFFECTIVE_RATE = 0.15;
const DEFAULT_SPENDING_RATIO = 0.7;

// ── Helpers ───────────────────────────────────────────────────────────
type Bracket = { from: number; to: number; rate: number };

function applyBrackets(amount: number, brackets: readonly Bracket[]): number {
  let tax = 0;
  for (const { from, to, rate } of brackets) {
    if (amount <= from) break;
    tax += (Math.min(amount, to) - from) * rate;
  }
  return tax;
}

// ── Types ─────────────────────────────────────────────────────────────
export interface PersonalTaxInput {
  grossSalary: number;
  monthlySpending?: number;
}

export interface IrpfBracketResult {
  from: number;
  to: number;
  rate: number;
  taxableAmount: number;
  tax: number;
}

export interface PersonalTaxResult {
  irpf: {
    total: number;
    statePortion: number;
    ccaaPortion: number;
    effectiveRate: number;
    baseLiquidable: number;
    brackets: IrpfBracketResult[];
  };
  ss: {
    worker: number;
    employer: number;
    base: number;
  };
  iva: {
    estimated: number;
    monthlySpending: number;
  };
  netSalary: number;
  totalPersonalTax: number;
  totalWithEmployer: number;
}

// ── Main calculator ───────────────────────────────────────────────────
export function calculatePersonalTax(input: PersonalTaxInput): PersonalTaxResult {
  const { grossSalary } = input;

  // SS
  const ssBase = Math.min(grossSalary, SS_MAX_BASE_ANNUAL);
  const ssWorker = ssBase * SS_WORKER_RATE;
  const ssEmployer = ssBase * SS_EMPLOYER_RATE;

  // IRPF base liquidable
  const netWorkIncome = Math.max(0, grossSalary - ssWorker - GASTOS_DEDUCIBLES);
  const reduction = workIncomeReduction(netWorkIncome);
  const baseLiquidable = Math.max(0, netWorkIncome - reduction);

  // IRPF = tax(base) - tax(mínimo personal)
  const taxOnBase = applyBrackets(baseLiquidable, IRPF_BRACKETS);
  const taxOnMinimo = applyBrackets(MINIMO_PERSONAL, IRPF_BRACKETS);
  const irpfTotal = Math.max(0, taxOnBase - taxOnMinimo);

  // State vs CCAA split
  const stateOnBase = applyBrackets(baseLiquidable, IRPF_STATE_BRACKETS);
  const stateOnMinimo = applyBrackets(MINIMO_PERSONAL, IRPF_STATE_BRACKETS);
  const irpfState = Math.max(0, stateOnBase - stateOnMinimo);
  const irpfCcaa = Math.max(0, irpfTotal - irpfState);

  // Bracket breakdown (for display)
  const brackets: IrpfBracketResult[] = [];
  for (const { from, to, rate } of IRPF_BRACKETS) {
    if (baseLiquidable <= from) break;
    const taxableAmount = Math.min(baseLiquidable, to) - from;
    brackets.push({
      from,
      to: Math.min(baseLiquidable, to),
      rate,
      taxableAmount,
      tax: taxableAmount * rate,
    });
  }

  // Net salary (after IRPF + SS worker, before spending)
  const netSalary = grossSalary - irpfTotal - ssWorker;

  // IVA estimation
  const monthlySpending = input.monthlySpending ?? (netSalary * DEFAULT_SPENDING_RATIO) / 12;
  const annualSpending = monthlySpending * 12;
  const ivaEstimated = annualSpending * (IVA_EFFECTIVE_RATE / (1 + IVA_EFFECTIVE_RATE));

  return {
    irpf: {
      total: irpfTotal,
      statePortion: irpfState,
      ccaaPortion: irpfCcaa,
      effectiveRate: grossSalary > 0 ? irpfTotal / grossSalary : 0,
      baseLiquidable,
      brackets,
    },
    ss: { worker: ssWorker, employer: ssEmployer, base: ssBase },
    iva: { estimated: ivaEstimated, monthlySpending },
    netSalary,
    totalPersonalTax: irpfTotal + ssWorker + ivaEstimated,
    totalWithEmployer: irpfTotal + ssWorker + ivaEstimated + ssEmployer,
  };
}
