export interface DataSourceAttribution {
  source: string;
  type: "api" | "csv" | "fallback" | "derived";
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
    };
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
}

export interface CcaaDebtData {
  lastUpdated: string;
  quarter: string; // "2025-Q3"
  ccaa: CcaaDebtEntry[];
  total: { debtAbsolute: number; debtToGDP: number };
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
  };
  sources: {
    debt: {
      success: boolean;
      lastUpdated: string;
      lastFetchAt?: string;
      lastRealDataDate?: string;
      dataPoints: number;
    };
    demographics: {
      success: boolean;
      lastUpdated: string;
      lastFetchAt?: string;
      lastRealDataDate?: string;
    };
    pensions: {
      success: boolean;
      lastUpdated: string;
      lastFetchAt?: string;
      criticalFallback?: boolean;
      criticalFallbackReason?: string | null;
      lastRealDataDate?: string;
      dataPoints: number;
    };
    budget: {
      success: boolean;
      lastUpdated: string;
      lastFetchAt?: string;
      lastRealDataDate?: string;
      years: number;
    };
    eurostat?: {
      success: boolean;
      lastUpdated: string;
      lastFetchAt?: string;
      lastRealDataDate?: string;
      year: number;
    };
    ccaaDebt?: {
      success: boolean;
      lastUpdated: string;
      lastFetchAt?: string;
      lastRealDataDate?: string;
      quarter: string;
    };
    revenue?: {
      success: boolean;
      lastUpdated: string;
      lastFetchAt?: string;
      lastRealDataDate?: string;
      latestYear: number;
    };
  };
}
