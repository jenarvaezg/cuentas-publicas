export interface SourceDetail {
  name: string;
  url?: string;
  date?: string;
  realDataDate?: string;
  note?: string;
}

export interface DataSourceAttribution {
  source: string;
  type: "api" | "csv" | "xlsx" | "fallback" | "derived" | "cross-reference";
  url?: string;
  date?: string;
  note?: string;
}

export interface DebtData {
  lastUpdated: string;
  current: {
    totalDebt: number;
    debtBySubsector: { estado: number; ccaa: number; ccll: number; ss: number };
    debtToGDP: number;
    yearOverYearChange: number;
    interestExpense: number;
  };
  historical: Array<{ date: string; totalDebt: number; debtToGDP?: number }>;
  regression: {
    slope: number;
    intercept: number;
    lastDataTimestamp: number;
    debtPerSecond: number;
  };
  sourceAttribution?: Record<string, DataSourceAttribution>;
}

export interface SankeyNode {
  id: string;
  label: string;
  group: string;
  amount: number;
  format: "currency" | "percentage" | "none" | string;
  note?: string;
  whatIfAttribution?: {
    originalAmount: number;
    directSubtracted: number;
    proportionalSubtracted: number;
  };
}

export interface SankeyLink {
  id: string;
  source: string;
  target: string;
  amount: number;
  label: string;
  note?: string;
}

export interface FlowsYearData {
  nodes: SankeyNode[];
  links: SankeyLink[];
}

export interface FlowsData {
  lastUpdated: string;
  latestYear: number;
  years: number[];
  byYear: Record<string, FlowsYearData>;
  sourceAttribution?: Record<string, DataSourceAttribution>;
}

export interface PensionData {
  lastUpdated: string;
  pipeline?: {
    liveDataUsed: boolean;
    criticalFallback: boolean;
    fallbackReason: string | null;
  };
  current: {
    monthlyPayroll: number;
    monthlyPayrollSS: number;
    monthlyPayrollClasesPasivas: number;
    monthlyPayrollPNC: number;
    annualExpense: number;
    totalPensions: number;
    averagePensionRetirement: number;
    affiliates: number;
    pensioners: number;
    contributorsPerPensioner: number;
    expensePerSecond: number;
    socialContributions: number;
    contributoryDeficit: number;
    reserveFund: number;
    cumulativeDeficit?: {
      base: number;
      baseDate: string;
      source?: string;
      startYear?: number;
    } | null;
  };
  historical: Array<{
    date: string;
    monthlyPayroll: number;
    totalPensions?: number;
  }>;
  regression: {
    slope: number;
    intercept: number;
    lastDataTimestamp: number;
    expensePerSecond: number;
  };
  sourceAttribution?: Record<string, DataSourceAttribution>;
}

export interface DemographicsData {
  lastUpdated: string;
  population: number;
  activePopulation: number;
  gdp: number;
  averageSalary: number;
  smi: number;
  cpi?: {
    baseYear: number;
    byYear: Record<string, number>;
  };
  vitalStats?: VitalStatsData;
  lifeExpectancy?: LifeExpectancyData;
  pyramid?: PopulationPyramidData;
  dependencyRatio?: DependencyRatioData;
  immigrationShare?: ImmigrationShareData;
  sourceAttribution?: Record<string, DataSourceAttribution>;
}

export interface BudgetCategory {
  code: string;
  name: string;
  amount: number;
  percentage: number;
  children?: BudgetCategory[];
}

export interface BudgetYearData {
  total: number;
  categories: BudgetCategory[];
}

export interface BudgetData {
  lastUpdated: string;
  years: number[];
  latestYear: number;
  byYear: Record<string, BudgetYearData>;
  sourceAttribution?: Record<string, DataSourceAttribution>;
}

export interface CcaaDebtEntry {
  code: string; // "CA01"..."CA17"
  name: string; // "Andalucía"
  debtAbsolute: number; // euros (converted from thousands in CSV)
  debtToGDP: number; // percentage
  debtYoYChangeAbsolute?: number | null; // euros (proxy: Δ debt vs same quarter previous year)
  debtYoYChangePct?: number | null; // percentage
}

export interface CcaaDeficitData {
  lastUpdated: string;
  source: string;
  note: string;
  latestYear: number;
  data: Record<string, number>; // code -> deficit in millions (negative means deficit, positive means surplus)
}

export interface CcaaDebtData {
  lastUpdated: string;
  quarter: string; // "2025-Q3"
  ccaa: CcaaDebtEntry[];
  total: {
    debtAbsolute: number;
    debtToGDP: number;
    debtYoYChangeAbsolute?: number | null;
    debtYoYChangePct?: number | null;
  };
  sourceAttribution: Record<string, DataSourceAttribution>;
}

export interface RevenueYearData {
  totalRevenue: number; // M€
  totalExpenditure: number; // M€
  balance: number; // M€ (negative = deficit)
  taxesIndirect: number; // M€ — D2REC (IVA, IIEE)
  taxesDirect: number; // M€ — D5REC (IRPF, IS)
  socialContributions: number; // M€ — D61REC
  otherRevenue: number; // M€ — derived
}

export interface RevenueData {
  lastUpdated: string;
  latestYear: number;
  years: number[];
  byYear: Record<string, RevenueYearData>;
  indicatorMeta?: Record<string, { label: string; unit: string }>;
  sourceAttribution?: Record<string, DataSourceAttribution>;
}

export interface EurostatData {
  lastUpdated: string;
  year: number;
  countries: string[];
  countryNames: Record<string, string>;
  indicators: Record<string, Record<string, number>>;
  indicatorMeta?: Record<string, { label: string; unit: string }>;
  sourceAttribution: {
    eurostat: DataSourceAttribution;
  };
}

// ── Tax Revenue (AEAT) ──────────────────────────────────────────────

export interface TaxBreakdown {
  total: number;
  irpf: number;
  iva: number;
  sociedades: number;
  irnr: number;
  iiee: number;
  resto: number;
}

export interface IIEEBreakdown {
  alcohol: number;
  cerveza: number;
  productosIntermedios: number;
  hidrocarburos: number;
  tabaco: number;
  electricidad: number;
  envasesPlastico: number;
  carbon: number;
  mediosTransporte: number;
}

export interface RestoBreakdown {
  medioambientales: number;
  traficoExterior: number;
  primasSeguros: number;
  transaccionesFinancieras: number;
  serviciosDigitales: number;
  juego: number;
  tasas: number;
}

export interface TaxRevenueYearNational extends TaxBreakdown {
  iieeBreakdown?: IIEEBreakdown;
  restoBreakdown?: RestoBreakdown;
}

export interface TaxRevenueCcaaEntry {
  code: string; // "CA01"..."CA17"
  name: string; // "Andalucía"
  total: number;
  irpf: number;
  iva: number;
  sociedades: number;
  iiee: number;
  irnr: number;
}

export interface TaxRevenueData {
  lastUpdated: string;
  years: number[];
  latestYear: number;
  national: Record<string, TaxRevenueYearNational>;
  ccaa: Record<string, { entries: TaxRevenueCcaaEntry[] }>;
  sourceAttribution?: Record<string, DataSourceAttribution>;
}

// ── CCAA Fiscal Balance (Hacienda) ─────────────────────────────────

export interface CcaaFiscalBalanceEntry {
  code: string; // CCAA code aligned with other datasets
  name: string;
  cededTaxes: number; // M€ (IRPF + IVA + IIEE)
  transfers: number; // M€ (Fondo Garantía + Suficiencia + Competitividad + Cooperación)
  netBalance: number; // M€ (transfers - cededTaxes)
  transferToTaxRatio: number | null;
  cededTaxesBreakdown: {
    irpf: number;
    iva: number;
    iiee: number;
  };
  transfersBreakdown: {
    fondoGarantia: number;
    fondoSuficiencia: number;
    fondoCompetitividad: number;
    fondoCooperacion: number;
  };
}

export interface CcaaFiscalBalanceYearData {
  entries: CcaaFiscalBalanceEntry[];
  totals: {
    cededTaxes: number;
    transfers: number;
    netBalance: number;
  };
}

export interface CcaaFiscalBalanceData {
  lastUpdated: string;
  years: number[];
  latestYear: number;
  byYear: Record<string, CcaaFiscalBalanceYearData>;
  coverage: {
    regime: "common";
    includesCeutaMelilla: boolean;
    excludesForal: boolean;
    notes: string;
  };
  sourceAttribution?: Record<string, DataSourceAttribution>;
}

// ── CCAA Spending (IGAE COFOG detalle) ─────────────────────────────

export interface CcaaSpendingEntry {
  code: string; // "CA01"..."CA17"
  name: string;
  total: number; // M€
  divisions: Record<string, number>; // COFOG division code -> M€
  topDivisionCode: string; // "01"..."10"
  topDivisionName: string;
  topDivisionAmount: number; // M€
  topDivisionPct: number; // %
}

export interface CcaaSpendingYearData {
  entries: CcaaSpendingEntry[];
  totals: {
    total: number;
    divisions: Record<string, number>;
  };
}

export interface CcaaSpendingData {
  lastUpdated: string;
  years: number[];
  latestYear: number;
  byYear: Record<string, CcaaSpendingYearData>;
  sourceAttribution?: Record<string, DataSourceAttribution>;
}

// ── CCAA Foral Flows (Navarra + País Vasco) ───────────────────────

export interface CcaaForalFlowEntry {
  code: string; // CA15, CA16
  name: string;
  regime: "foral";
  paymentToState: number; // M€
  adjustmentsWithState: number | null; // M€
  netFlowToState: number | null; // M€ (payment - adjustments)
  taxRevenue?: number; // M€
  detail: {
    paymentLabel: string;
    adjustmentsLabel: string | null;
    unit: string;
  };
}

export interface CcaaForalFlowYearData {
  entries: CcaaForalFlowEntry[];
}

export interface CcaaForalFlowsData {
  lastUpdated: string;
  years: number[];
  latestYear: number;
  byYear: Record<string, CcaaForalFlowYearData>;
  coverage: {
    regime: "foral";
    notes: string;
  };
  sourceAttribution?: Record<string, DataSourceAttribution>;
}

// ── Demographics (detailed) ──────────────────────────────────────────

export interface TimeSeriesPoint {
  year: number;
  value: number;
}

export interface VitalStatsData {
  birthRate: TimeSeriesPoint[];
  deathRate: TimeSeriesPoint[];
  fertilityRate: TimeSeriesPoint[];
  naturalGrowth: TimeSeriesPoint[];
}

export interface LifeExpectancyData {
  both: TimeSeriesPoint[];
  male: TimeSeriesPoint[];
  female: TimeSeriesPoint[];
}

export interface PyramidRegionData {
  spain: number[];
  eu: number[];
  restEurope: number[];
  africa: number[];
  americas: number[];
  asiaOceania: number[];
}

export interface PyramidYearData {
  male: PyramidRegionData;
  female: PyramidRegionData;
}

export interface PopulationPyramidData {
  years: number[];
  ageGroups: string[];
  regions: string[];
  byYear: Record<string, PyramidYearData>;
}

export interface DependencyRatioData {
  oldAge: number;
  youth: number;
  total: number;
}

export interface ImmigrationShareData {
  total: number;
  byRegion: Record<string, number>;
  historical: TimeSeriesPoint[];
}

// ── SS Sustainability ────────────────────────────────────────────────

export interface SSSustainabilityYearData {
  socialContributions: number; // M€
  pensionExpenditure: number; // M€ (gasto contributivo en efectivo)
  ssBalance: number; // M€ (contributions - pension expenditure)
  pensionToGDP: number; // %
}

export interface SSSustainabilityProjectionPoint {
  year: number;
  pensionToGDP: number;
}

export interface SSSustainabilityData {
  lastUpdated: string;
  latestYear: number;
  years: number[];
  byYear: Record<string, SSSustainabilityYearData>;
  pensionToGDP: {
    spain: { byYear: Record<string, number>; years: number[] };
    eu27: { byYear: Record<string, number>; years: number[] };
  };
  reserveFund: Array<{ year: number; balance: number }>;
  contributorsPerPensioner: Array<{ year: number; ratio: number }>;
  projections: {
    source: string;
    url: string;
    spain: SSSustainabilityProjectionPoint[];
    eu27: SSSustainabilityProjectionPoint[];
  };
  sourceAttribution: Record<string, DataSourceAttribution>;
}

export interface PensionsRegionalEntry {
  code: string;
  name: string;
  annualAmount: number;
  monthlyAmount?: number;
  pensionsCount?: number;
}

export interface PensionsRegionalYearData {
  year: number;
  date: string;
  dateLabel: string;
  entries: PensionsRegionalEntry[];
}

export interface PensionsRegionalData {
  latestYear: number;
  byYear: Record<string, PensionsRegionalYearData>;
  source: string;
  url: string;
}

// ── Unemployment (SEPE) ─────────────────────────────────────────────

export interface UnemploymentRegionalEntry {
  code: string;
  name: string;
  amount: number;
}

export interface UnemploymentRegionalYearData {
  total: number;
  entries: UnemploymentRegionalEntry[];
}

export interface UnemploymentRegionalData {
  lastUpdated: string;
  latestYear: number;
  byYear: Record<string, UnemploymentRegionalYearData>;
  sourceAttribution: Record<string, DataSourceAttribution>;
}

// ── Regional Accounts (Eurostat NUTS2) ──────────────────────────────

export interface RegionalAccountsEntry {
  code: string; // "CA01"..."CA17"
  name: string;
  gdp: number; // M€
  socialContributions: number; // M€
}

export interface RegionalAccountsYearData {
  entries: RegionalAccountsEntry[];
  totals: {
    gdp: number;
    socialContributions: number;
  };
}

export interface RegionalAccountsData {
  lastUpdated: string;
  latestYear: number;
  years: number[];
  byYear: Record<string, RegionalAccountsYearData>;
  sourceAttribution?: Record<string, DataSourceAttribution>;
}

// ── Metadata ────────────────────────────────────────────────────────

export interface MetaSourceEntry {
  success: boolean;
  fallbackDetected?: boolean;
  fallbackKeys?: string[];
  lastUpdated: string | null;
  lastFetchAt?: string | null;
  lastRealDataDate?: string | null;
  dataPoints?: number;
  criticalFallback?: boolean;
  criticalFallbackReason?: string | null;
  years?: number;
  year?: number;
  quarter?: string;
  latestYear?: number;
  communities?: number;
  nodes?: number;
  links?: number;
}

export interface MetaData {
  lastDownload: string;
  duration: number;
  status: {
    debt: boolean;
    demographics: boolean;
    pensions: boolean;
    budget: boolean;
    eurostat?: boolean;
    ccaaDebt?: boolean;
    revenue?: boolean;
    taxRevenue?: boolean;
    ccaaFiscalBalance?: boolean;
    ccaaSpending?: boolean;
    ccaaForalFlows?: boolean;
    pensionsRegional?: boolean;
    unemploymentRegional?: boolean;
    flowsSankey?: boolean;
    ssSustainability?: boolean;
  };
  sources: Record<string, MetaSourceEntry>;
}
