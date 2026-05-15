// ============================================================
// PFFT Cashflow Tool — Core Data Types & Calculation Engine
// Design: "Profit First Dashboard"
//
// PF for Tradies calculation flow:
//   1. Gross Income received → Income account
//   2. BAS/GST = 10% of Gross Income (swept from Income)
//   3. Materials & Subs = X% of Gross Income (swept from Income)
//   4. Real Revenue = Gross Income − BAS − Materials & Subs
//   5. Profit, Owner's Pay, Tax, OpEx = % of Real Revenue
// ============================================================

export const ACCOUNT_KEYS = [
  "income",
  "bas",
  "materials",
  "profit",
  "ownersPay",
  "tax",
  "opex",
] as const;

export type AccountKey = (typeof ACCOUNT_KEYS)[number];

export interface AccountConfig {
  key: AccountKey;
  label: string;
  shortLabel: string;
  colorVar: string;
  colorHex: string;
  description: string;
  /** Default Profit First allocation % */
  defaultPct: number;
  /** Whether this account's % is based on Gross Income (true) or Real Revenue (false) */
  basedOnGross: boolean;
}

export const ACCOUNT_CONFIGS: AccountConfig[] = [
  {
    key: "income",
    label: "Income",
    shortLabel: "INC",
    colorVar: "--account-income",
    colorHex: "#2d7a4f",
    description: "All gross revenue received into the business",
    defaultPct: 100,
    basedOnGross: true,
  },
  {
    key: "bas",
    label: "BAS (GST + PAYG + PAYG I)",
    shortLabel: "BAS",
    colorVar: "--account-bas",
    colorHex: "#c47f17",
    description: "GST collected + PAYG withholding + PAYG instalments — held for ATO",
    defaultPct: 10,
    basedOnGross: true,
  },
  {
    key: "materials",
    label: "Materials & Subcontractors",
    shortLabel: "MAT",
    colorVar: "--account-materials",
    colorHex: "#3a5fa0",
    description: "Direct job costs swept from gross income",
    defaultPct: 30,
    basedOnGross: true,
  },
  {
    key: "profit",
    label: "Profit",
    shortLabel: "PRF",
    colorVar: "--account-profit",
    colorHex: "#b08d2a",
    description: "% of Real Revenue — your profit allocation",
    defaultPct: 5,
    basedOnGross: false,
  },
  {
    key: "ownersPay",
    label: "Owner's Pay",
    shortLabel: "OWN",
    colorVar: "--account-owners-pay",
    colorHex: "#2a8a8a",
    description: "% of Real Revenue — owner's salary / drawings",
    defaultPct: 50,
    basedOnGross: false,
  },
  {
    key: "tax",
    label: "Tax",
    shortLabel: "TAX",
    colorVar: "--account-tax",
    colorHex: "#b04040",
    description: "% of Real Revenue — income tax provision",
    defaultPct: 15,
    basedOnGross: false,
  },
  {
    key: "opex",
    label: "Operating Expenses (OpEx)",
    shortLabel: "OPX",
    colorVar: "--account-opex",
    colorHex: "#5a3d9a",
    description: "% of Real Revenue — overheads and running costs",
    defaultPct: 30,
    basedOnGross: false,
  },
];

export type AccountBalances = Record<AccountKey, number>;

export interface MonthData {
  /** Gross income received this month */
  incomeIn: number;
  /** Withdrawals / payments out from each account */
  withdrawals: Partial<Record<AccountKey, number>>;
}

export interface ProjectionSettings {
  /** Opening balance for each account */
  openingBalances: AccountBalances;
  /** Profit First allocation percentages */
  allocations: AccountBalances;
  /** Monthly data for 24 months */
  months: MonthData[];
  /** Start month (0 = Jan, 11 = Dec) */
  startMonth: number;
  /** Start year */
  startYear: number;
  /**
   * Minimum target balance per account (all except income).
   * Shown as a dashed reference line on each account graph.
   */
  minBalances: Partial<Record<AccountKey, number>>;
  /**
   * BAS lodgement months (0-indexed, e.g. [0,3,6,9] = Jan/Apr/Jul/Oct).
   * These are the months when BAS is due — shown as vertical markers on the BAS chart.
   * Default: Australian quarterly BAS due months (Jan=0, Apr=3, Jul=6, Oct=9 — 28 days after quarter end).
   */
  basLodgementMonths: number[];
  /** Day of month BAS is due (default 28) */
  basLodgementDay: number;
  /**
   * Profit distribution months (0-indexed). Shown as dashed markers on the Profit chart.
   * Default: quarterly on 1st of Jan, Apr, Jul, Oct.
   */
  profitDistributionMonths: number[];
  /** Day of month profit is distributed (default 1) */
  profitDistributionDay: number;
}

export interface MonthResult {
  /** Gross income for this month */
  grossIncome: number;
  /** Real Revenue = Gross − BAS − Materials */
  realRevenue: number;
  /** Inflow allocated to each account this month */
  allocations: AccountBalances;
  /** Withdrawals from each account this month */
  withdrawals: AccountBalances;
  /** Closing balance for each account */
  closingBalances: AccountBalances;
  /** Opening balance for each account (= prior month closing) */
  openingBalances: AccountBalances;
  /** Net movement per account */
  netMovement: AccountBalances;
}

export function emptyBalances(): AccountBalances {
  return {
    income: 0,
    bas: 0,
    materials: 0,
    profit: 0,
    ownersPay: 0,
    tax: 0,
    opex: 0,
  };
}

export function defaultMonthData(): MonthData {
  return {
    incomeIn: 0,
    withdrawals: {},
  };
}

export function defaultSettings(): ProjectionSettings {
  const now = new Date();
  return {
    openingBalances: emptyBalances(),
    allocations: {
      income: 100,
      bas: 10,
      materials: 30,
      profit: 5,
      ownersPay: 50,
      tax: 15,
      opex: 30,
    },
    months: Array.from({ length: 24 }, defaultMonthData),
    startMonth: now.getMonth(),
    startYear: now.getFullYear(),
    minBalances: {},
    // Australian quarterly BAS: due 28 Jan, 28 Apr, 28 Jul, 28 Oct
    basLodgementMonths: [0, 3, 6, 9],
    basLodgementDay: 28,
    // Quarterly profit distribution: 1st of Jan, Apr, Jul, Oct
    profitDistributionMonths: [0, 3, 6, 9],
    profitDistributionDay: 1,
  };
}

/**
 * Calculate the full 24-month projection from settings.
 *
 * PF for Tradies flow:
 *   BAS       = basPct% × grossIncome
 *   Materials = matPct% × grossIncome
 *   RealRev   = grossIncome − BAS − Materials
 *   Profit    = profitPct% × RealRev
 *   OwnersPay = ownersPct% × RealRev
 *   Tax       = taxPct% × RealRev
 *   OpEx      = opexPct% × RealRev
 *
 * Income account balance:
 *   Opening + grossIncome − BAS − Materials − Profit − OwnersPay − Tax − OpEx
 *   (i.e. any unallocated remainder stays in Income)
 */
export function calculateProjection(settings: ProjectionSettings): MonthResult[] {
  const results: MonthResult[] = [];
  let runningBalances: AccountBalances = { ...settings.openingBalances };

  for (let i = 0; i < 24; i++) {
    const month = settings.months[i] ?? defaultMonthData();
    const openingBalances = { ...runningBalances };

    const gross = month.incomeIn;

    // Step 1: Gross-income-based sweeps
    const basAlloc = gross * (settings.allocations.bas / 100);
    const matAlloc = gross * (settings.allocations.materials / 100);

    // Step 2: Real Revenue
    const realRevenue = Math.max(0, gross - basAlloc - matAlloc);

    // Step 3: Real-revenue-based allocations
    const profitAlloc = realRevenue * (settings.allocations.profit / 100);
    const ownersPayAlloc = realRevenue * (settings.allocations.ownersPay / 100);
    const taxAlloc = realRevenue * (settings.allocations.tax / 100);
    const opexAlloc = realRevenue * (settings.allocations.opex / 100);

    // Step 4: Income account receives gross, then sweeps out all allocations
    // Whatever is left stays in Income (unallocated buffer)
    const totalSweptFromIncome = basAlloc + matAlloc + profitAlloc + ownersPayAlloc + taxAlloc + opexAlloc;
    const incomeNetIn = gross - totalSweptFromIncome;

    const allocations: AccountBalances = {
      income: incomeNetIn,
      bas: basAlloc,
      materials: matAlloc,
      profit: profitAlloc,
      ownersPay: ownersPayAlloc,
      tax: taxAlloc,
      opex: opexAlloc,
    };

    // Withdrawals
    const withdrawals = emptyBalances();
    for (const key of ACCOUNT_KEYS) {
      withdrawals[key] = month.withdrawals[key] ?? 0;
    }

    // Closing balances
    const closingBalances = emptyBalances();
    const netMovement = emptyBalances();
    for (const key of ACCOUNT_KEYS) {
      const net = allocations[key] - withdrawals[key];
      netMovement[key] = net;
      closingBalances[key] = openingBalances[key] + net;
    }

    results.push({
      grossIncome: gross,
      realRevenue,
      allocations,
      withdrawals,
      closingBalances,
      openingBalances,
      netMovement,
    });

    runningBalances = { ...closingBalances };
  }

  return results;
}

export function getMonthLabel(startMonth: number, startYear: number, index: number): string {
  const date = new Date(startYear, startMonth + index, 1);
  return date.toLocaleDateString("en-AU", { month: "short", year: "2-digit" });
}

export function getMonthLabelLong(startMonth: number, startYear: number, index: number): string {
  const date = new Date(startYear, startMonth + index, 1);
  return date.toLocaleDateString("en-AU", { month: "long", year: "numeric" });
}

export function formatCurrency(value: number): string {
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString("en-AU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return value < 0 ? `($${formatted})` : `$${formatted}`;
}

export function formatCurrencyInput(value: number): string {
  if (value === 0) return "";
  return value.toLocaleString("en-AU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function parseCurrencyInput(raw: string): number {
  const cleaned = raw.replace(/[^0-9.-]/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/** Sum all account balances */
export function totalBalance(balances: AccountBalances): number {
  return ACCOUNT_KEYS.reduce((sum, k) => sum + balances[k], 0);
}

/** Export projection data to CSV */
export function exportToCSV(settings: ProjectionSettings, results: MonthResult[]): string {
  const headers = [
    "Month",
    "Gross Income",
    "Real Revenue",
    ...ACCOUNT_CONFIGS.map((a) => `${a.label} - Allocation In`),
    ...ACCOUNT_CONFIGS.map((a) => `${a.label} - Withdrawals`),
    ...ACCOUNT_CONFIGS.map((a) => `${a.label} - Closing Balance`),
    "Total Balance",
  ];

  const rows = results.map((r, i) => {
    const label = getMonthLabelLong(settings.startMonth, settings.startYear, i);
    const allocs = ACCOUNT_CONFIGS.map((a) => r.allocations[a.key].toFixed(2));
    const withs = ACCOUNT_CONFIGS.map((a) => r.withdrawals[a.key].toFixed(2));
    const closing = ACCOUNT_CONFIGS.map((a) => r.closingBalances[a.key].toFixed(2));
    const total = totalBalance(r.closingBalances).toFixed(2);
    return [label, r.grossIncome.toFixed(2), r.realRevenue.toFixed(2), ...allocs, ...withs, ...closing, total].join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}
