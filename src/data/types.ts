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

export interface MetaData {
  lastDownload: string;
  duration: number;
  status: {
    debt: boolean;
    demographics: boolean;
    pensions: boolean;
    budget: boolean;
  };
  sources: {
    debt: {
      success: boolean;
      lastUpdated: string;
      dataPoints: number;
    };
    demographics: {
      success: boolean;
      lastUpdated: string;
    };
    pensions: {
      success: boolean;
      lastUpdated: string;
      dataPoints: number;
    };
    budget: {
      success: boolean;
      lastUpdated: string;
      years: number;
    };
  };
}
