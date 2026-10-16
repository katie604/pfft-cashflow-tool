// ============================================================
// Weekly what-if board — individual invoices & bills you can
// drag between weeks to see the cash impact of getting paid
// sooner / paying bills later.
// ============================================================

import { ACCOUNT_KEYS, AccountKey, AccountBalances } from "@/lib/cashflow";

export interface WeeklyItem {
  id: string;
  type: "in" | "out"; // money in (invoice) | money out (bill)
  name: string;
  amount: number;
  week: number; // 0-based from weekStart Monday
  overdue?: boolean;
  /** Original Xero due date (ISO yyyy-mm-dd), if known. */
  dueDate?: string | null;
  source: "xero" | "manual";
}

/** Whole days an item is past its due date (null if no due date). */
export function daysOverdue(dueDate?: string | null): number | null {
  if (!dueDate) return null;
  const due = new Date(dueDate + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - due.getTime()) / 86400000);
}

export interface AccountWeekOut {
  week: number;
  account: string; // PF account key
  amount: number;
}

/** A manual recurring weekly money-out line on an account (e.g. payroll). */
export interface RecurringLine {
  id: string;
  account: string; // PF account key
  label: string;
  weeklyAmount: number;
  /** Set when the money MOVES into another PF account instead of leaving the
   *  business - Katie, 16 Oct 2026: owner's PAYG -> BAS, owner's super -> OpEx. */
  toAccount?: string;
  /** What it is called in the account it lands in (per business, from the helper). */
  inLabel?: string;
  /** Show this out-line straight under the moved-in row of that line (Katie,
   *  16 Oct 2026: her super comes into OpEx and goes straight back out). */
  afterId?: string;
}

/** Where a seeded line moves its money to. Also applied to lines saved before
 *  routing existed, so an existing board picks it up. */
export const RECURRING_ROUTES: Record<string, string> = {
  "own-payg": "bas",
  "own-super": "opex",
  "team-payg": "bas", // Katie, 16 Oct 2026: team PAYG moves into BAS too
  "opex-wise": "wise",
};

/** Seeded payroll lines — owner's pay + team, ready to fill in. */
export const DEFAULT_RECURRING: RecurringLine[] = [
  { id: "own-net", account: "ownersPay", label: "Net wage", weeklyAmount: 0 },
  { id: "own-payg", account: "ownersPay", label: "PAYG", weeklyAmount: 0, toAccount: "bas" },
  { id: "own-super", account: "ownersPay", label: "Super", weeklyAmount: 0, toAccount: "opex" },
  { id: "team-wage", account: "opex", label: "Team wages", weeklyAmount: 0 },
  { id: "team-payg", account: "opex", label: "Team PAYG", weeklyAmount: 0, toAccount: "bas" },
  { id: "team-super", account: "opex", label: "Team Super", weeklyAmount: 0 },
  // Katie, 16 Oct 2026: a weekly ATO payment (EBS: $1,004.25 every Friday, from OpEx).
  { id: "opex-ato", account: "opex", label: "ATO payment", weeklyAmount: 0 },
  // Katie, 16 Oct 2026: OpEx tops up the Wise account, which pays the subscriptions.
  { id: "opex-wise", account: "opex", label: "Transfer to Wise", weeklyAmount: 0, toAccount: "wise" },
];

export interface WeeklyData {
  /** Cash in the bank at week 0 (transaction accounts, cards excluded). */
  startingCash: number;
  /** ISO date (Monday) of week 0. */
  weekStart: string;
  items: WeeklyItem[];
  /** Categorised money-out per (week, PF account) — from bill account codes. */
  outByAccount?: AccountWeekOut[];
  /** Opening balance per PF account at week 0. */
  openingByAccount?: Record<string, number>;
  /** Wise balance(s) at week 0 - Wise sits under OpEx, its own account. */
  openingWise?: number;
  /** Manual recurring weekly money-out lines (payroll etc.). */
  recurringLines?: RecurringLine[];
  /** PF accounts the client hasn't opened yet (greyed + flagged in the table). */
  accountsToOpen?: string[];
  /**
   * Assumed flat income per week (the 13-week equivalent of the monthly
   * "set all income months"). When > 0 it drives the table's money-in instead
   * of the real invoices — useful for clients who don't run Profit First yet.
   * Affects the 13-week table only, not the What-If board.
   */
  incomeOverride?: number;
}

export interface WeekRow {
  week: number;
  weekCommencing: Date;
  inItems: WeeklyItem[];
  outItems: WeeklyItem[];
  moneyIn: number;
  moneyOut: number;
  net: number;
  opening: number;
  closing: number;
  /** Running total of all money in / out up to and including this week. */
  cumulativeIn: number;
  cumulativeOut: number;
}

function mondayOf(d: Date): Date {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // 0 = Monday
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** yyyy-mm-dd from a local date (never toISOString - see thisMondayISO). */
export function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function thisMondayISO(): string {
  // Local date, not toISOString(): in Sydney, Monday midnight is still Sunday in UTC,
  // which started every week on the Sunday (found 16 Oct 2026).
  const m = mondayOf(new Date());
  return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}-${String(m.getDate()).padStart(2, "0")}`;
}

export function emptyWeekly(): WeeklyData {
  return { startingCash: 0, weekStart: thisMondayISO(), items: [] };
}

export function weekCommencing(weekStart: string, week: number): Date {
  const d = new Date(weekStart + "T00:00:00");
  d.setDate(d.getDate() + week * 7);
  return d;
}

/** Build the running week-by-week ledger from the items.
 *  incomeOverride > 0 replaces the invoice income with a flat weekly assumption
 *  (used by the 13-week table; the board passes 0 to keep real invoices). */
export function buildWeeks(
  data: WeeklyData,
  numWeeks: number,
  incomeOverride = 0
): WeekRow[] {
  const rows: WeekRow[] = [];
  let opening = data.startingCash;
  let cumulativeIn = 0;
  let cumulativeOut = 0;
  for (let w = 0; w < numWeeks; w++) {
    // Group same name together (supplier for out / client for in), then
    // largest first within a name.
    const byNameThenAmount = (a: WeeklyItem, b: WeeklyItem) =>
      a.name.localeCompare(b.name) || b.amount - a.amount;
    const inItems = data.items
      .filter((i) => i.type === "in" && i.week === w)
      .sort(byNameThenAmount);
    const outItems = data.items
      .filter((i) => i.type === "out" && i.week === w)
      .sort(byNameThenAmount);
    const moneyIn =
      incomeOverride > 0 ? incomeOverride : inItems.reduce((s, i) => s + i.amount, 0);
    const moneyOut = outItems.reduce((s, i) => s + i.amount, 0);
    const net = moneyIn - moneyOut;
    const closing = opening + net;
    cumulativeIn += moneyIn;
    cumulativeOut += moneyOut;
    rows.push({
      week: w,
      weekCommencing: weekCommencing(data.weekStart, w),
      inItems,
      outItems,
      moneyIn,
      moneyOut,
      net,
      opening,
      closing,
      cumulativeIn,
      cumulativeOut,
    });
    opening = closing;
  }
  return rows;
}

/** Lowest closing balance across the window (the danger point). */
export function lowestPoint(rows: WeekRow[]): WeekRow | null {
  if (!rows.length) return null;
  return rows.reduce((lo, r) => (r.closing < lo.closing ? r : lo), rows[0]);
}

// ── Per-account weekly ledger ──

/** Split gross income across PF accounts (same rules as the monthly engine). */
function allocateIncome(gross: number, alloc: AccountBalances): AccountBalances {
  const bas = gross * (alloc.bas / 100);
  const materials = gross * (alloc.materials / 100);
  const realRev = Math.max(0, gross - bas - materials);
  const profit = realRev * (alloc.profit / 100);
  const ownersPay = realRev * (alloc.ownersPay / 100);
  const tax = realRev * (alloc.tax / 100);
  const opex = realRev * (alloc.opex / 100);
  const income = gross - (bas + materials + profit + ownersPay + tax + opex);
  return { income, bas, materials, profit, ownersPay, tax, opex };
}

/** Transfers actually made out of Income, saved by the Allocation Calculator's
 *  "transfers completed" button (Katie, 16 Oct 2026). Keyed by PF account. */
export interface ActualTransfer {
  date: string; // yyyy-mm-dd, Sydney
  tenant: string;
  income: number;
  transfers: Partial<Record<AccountKey, number>>;
}

/** Which week of the window an ISO date falls in (-1 if outside it). */
export function weekIndexOf(weekStart: string, iso: string, numWeeks: number): number {
  const a = new Date(weekStart + "T00:00:00").getTime();
  const b = new Date(iso + "T00:00:00").getTime();
  const w = Math.floor((b - a) / (7 * 86400000));
  return w >= 0 && w < numWeeks ? w : -1;
}

/** Split a week's income when a fee comes off first (Katie, 16 Oct 2026):
 *  GST (BAS %) is worked out on the FULL income, the fee comes off, and only
 *  what is left is split into Real Revenue accounts. */
function allocateAfterFee(gross: number, fee: number, alloc: AccountBalances): AccountBalances {
  if (fee <= 0) return allocateIncome(gross, alloc);
  const bas = gross * (alloc.bas / 100);
  const afterFee = gross - fee;
  const materials = afterFee * (alloc.materials / 100);
  const realRev = Math.max(0, afterFee - bas - materials);
  const profit = realRev * (alloc.profit / 100);
  const ownersPay = realRev * (alloc.ownersPay / 100);
  const tax = realRev * (alloc.tax / 100);
  const opex = realRev * (alloc.opex / 100);
  const income = afterFee - (bas + materials + profit + ownersPay + tax + opex);
  return { income, bas, materials, profit, ownersPay, tax, opex };
}

/** This week's real starting point (Katie, 16 Oct 2026): the bank balance right
 *  now, and only the payments still to go. Everything else this week already
 *  happened and is inside that balance. */
export interface NowBalances {
  week: string; // the Monday this applies to
  balances: Record<string, number>;
  remaining: Record<string, Record<string, number>>; // account -> line id -> amount still to go
  toOpen?: string[]; // PF accounts the business does not have yet (EBS: no Tax account)
}

export interface AccountWeekRow {
  week: number;
  weekCommencing: Date;
  opening: number;
  moneyIn: number; // allocation in (Income: gross invoices)
  moneyOut: number; // total out: bills + recurring + (Income) allocations swept
  allocOut: number; // Income only: amount swept out to other accounts
  bills: number; // categorised Xero bills out
  recurring: number; // manual recurring lines out
  transfersIn: number; // recurring lines moved IN from another account (PAYG, super)
  fee?: number; // Income only: payment fee taken off before the split (Stripe)
  net: number;
  closing: number;
  /** This week, started from the bank balance now with only what is still to go. */
  stillToGo?: boolean;
  /** True when this week's allocation is the ACTUAL transfer, not the forecast. */
  actual?: boolean;
  /** What the forecast said would come in (or, for Income, be swept out). */
  expected?: number;
}

/**
 * Per-account weekly ledger — full Profit First flow:
 *   Income   IN = the week's invoice income (all of it), OUT = allocations swept
 *            to the other accounts by the PF %.
 *   Others   IN = their PF allocation, OUT = categorised bills + recurring lines.
 */
export function buildAccountWeeks(
  data: WeeklyData,
  numWeeks: number,
  allocations: AccountBalances,
  incomeOverride = 0,
  recurringLines: RecurringLine[] = [],
  actuals: ActualTransfer[] = [],
  /** Katie's typed estimate of income per week, keyed by the week's Monday. */
  estimates: Record<string, number> = {},
  /** % of income a payment provider keeps before the split (EBS: Stripe 25%). */
  feePct = 0,
  now: NowBalances | null = null
): Record<AccountKey, AccountWeekRow[]> {
  // Actual transfers per week; the week's real dollars REPLACE its forecast
  // allocation (Katie, 16 Oct 2026). Two in one week add together.
  const actualByWeek: Record<number, Partial<Record<string, number>>> = {};
  for (const a of actuals) {
    const w = weekIndexOf(data.weekStart, a.date, numWeeks);
    if (w < 0) continue;
    const wk = (actualByWeek[w] ??= {});
    for (const [k, v] of Object.entries(a.transfers)) wk[k] = (wk[k] ?? 0) + Number(v || 0);
    // What actually came into Income that week (Katie, 16 Oct 2026: it was all swept
    // out, so Income's net movement for the week is zero).
    wk.__income = (wk.__income ?? 0) + Number(a.income || 0);
  }
  const outMap: Record<number, Partial<Record<string, number>>> = {};
  for (const o of data.outByAccount ?? []) {
    const wk = (outMap[o.week] ??= {});
    wk[o.account] = (wk[o.account] ?? 0) + o.amount;
  }
  const recByAccount: Record<string, number> = {};
  const recInByAccount: Record<string, number> = {};
  for (const r of recurringLines) {
    recByAccount[r.account] = (recByAccount[r.account] ?? 0) + r.weeklyAmount;
    const to = r.toAccount ?? RECURRING_ROUTES[r.id];
    if (to) recInByAccount[to] = (recInByAccount[to] ?? 0) + r.weeklyAmount;
  }

  const grossByWeek: Record<number, number> = {};
  if (incomeOverride > 0) {
    for (let w = 0; w < numWeeks; w++) grossByWeek[w] = incomeOverride;
  } else {
    for (const it of data.items) {
      if (it.type === "in") grossByWeek[it.week] = (grossByWeek[it.week] ?? 0) + it.amount;
    }
  }

  const running: Record<string, number> = {};
  for (const k of ACCOUNT_KEYS) running[k] = data.openingByAccount?.[k] ?? 0;
  // Income always opens at $0 - it is swept to zero every week (Katie, 16 Oct 2026),
  // whatever Xero's book balance says.
  running.income = 0;

  const out = {} as Record<AccountKey, AccountWeekRow[]>;
  for (const k of ACCOUNT_KEYS) out[k] = [];

  for (let w = 0; w < numWeeks; w++) {
    // A typed estimate for the week wins over invoices / the flat assumption
    // (Katie, 16 Oct 2026). An actual week still uses what actually came in.
    const est = estimates[isoLocal(weekCommencing(data.weekStart, w))];
    const gross = est !== undefined ? est : grossByWeek[w] ?? 0;
    const act = actualByWeek[w];
    // Katie, 16 Oct 2026: the Stripe fee comes off first and only what is left is
    // split. Not on an actual week - that payout already had the fee taken.
    const fee = act ? 0 : Math.round(gross * (feePct / 100) * 100) / 100;
    const alloc = allocateAfterFee(gross, fee, allocations); // per-account inflow (forecast)
    const sumOut = (src: Partial<Record<string, number>>) =>
      ACCOUNT_KEYS.reduce((s, k) => (k === "income" ? s : s + (src[k] ?? 0)), 0);
    const expectedOut = sumOut(alloc);
    // Total swept out of Income = everything allocated to the other accounts.
    const allocOutTotal = act ? sumOut(act) : expectedOut;
    const isNowWeek = !!now && now.week === isoLocal(weekCommencing(data.weekStart, w));
    for (const k of ACCOUNT_KEYS) {
      if (isNowWeek && now!.balances[k] !== undefined) {
        const opening = now!.balances[k];
        const togo = Object.values(now!.remaining[k] ?? {}).reduce((s2, v) => s2 + Number(v || 0), 0);
        const closing = Math.round((opening - togo) * 100) / 100;
        out[k].push({
          week: w,
          weekCommencing: weekCommencing(data.weekStart, w),
          opening,
          moneyIn: 0,
          moneyOut: togo,
          allocOut: 0,
          bills: 0,
          recurring: togo,
          transfersIn: 0,
          net: Math.round(-togo * 100) / 100,
          closing,
          stillToGo: true,
          fee: 0,
        });
        running[k] = closing;
        continue;
      }
      const opening = running[k];
      const moneyIn =
        k === "income"
          ? act && act.__income
            ? act.__income
            : gross
          : act
          ? act[k] ?? 0
          : alloc[k];
      const bills = outMap[w]?.[k] ?? 0;
      const recurring = recByAccount[k] ?? 0;
      const allocOut = k === "income" ? allocOutTotal : 0;
      const feeOut = k === "income" ? fee : 0;
      const moneyOut = bills + recurring + allocOut + feeOut;
      // Round to the cent so a fully swept week shows $0, not "($0)" from float dust.
      const transfersIn = recInByAccount[k] ?? 0;
      const closing = Math.round((opening + moneyIn + transfersIn - moneyOut) * 100) / 100;
      out[k].push({
        week: w,
        weekCommencing: weekCommencing(data.weekStart, w),
        opening,
        moneyIn,
        moneyOut,
        allocOut,
        bills,
        recurring,
        transfersIn,
        net: Math.round((moneyIn + transfersIn - moneyOut) * 100) / 100,
        closing,
        actual: !!act,
        fee: feeOut,
        expected: k === "income" ? expectedOut : alloc[k],
      });
      running[k] = closing;
    }
  }
  return out;
}


// ── Wise (under OpEx) ──
// Katie, 16 Oct 2026: OpEx transfers money into Wise, and the regular monthly
// subscriptions are paid out of Wise. Its own ledger, shown under OpEx.

/** A regular monthly bill paid from Wise, on its usual day of the month. */
export interface MonthlyBill {
  id: string;
  name: string;
  amount: number;
  day: number; // day of month; a 31 lands on the last day of shorter months
}

export interface WiseWeekRow extends AccountWeekRow {
  billLines: Record<string, number>;
}

/** Amount of a monthly bill falling in the 7 days from weekStart. */
function billInWeek(b: MonthlyBill, wkStart: Date): number {
  let total = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < 7; i++) {
    const d = new Date(wkStart);
    d.setDate(d.getDate() + i);
    if (d < today) continue; // already gone out this week - not still to pay (16 Oct 2026)
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    if (d.getDate() === Math.min(b.day, last)) total += b.amount;
  }
  return total;
}

export function buildWiseWeeks(
  data: WeeklyData,
  numWeeks: number,
  recurringLines: RecurringLine[],
  bills: MonthlyBill[],
  now: NowBalances | null = null
): WiseWeekRow[] {
  const transferIn = recurringLines
    .filter((r) => (r.toAccount ?? RECURRING_ROUTES[r.id]) === "wise")
    .reduce((s, r) => s + r.weeklyAmount, 0);
  const rows: WiseWeekRow[] = [];
  let running = data.openingWise ?? 0;
  for (let w = 0; w < numWeeks; w++) {
    const wc = weekCommencing(data.weekStart, w);
    const billLines: Record<string, number> = {};
    let out = 0;
    for (const b of bills) {
      const a = billInWeek(b, wc);
      billLines[b.id] = a;
      out += a;
    }
    // This week starts from the Wise bank balance now, if Katie has given it, and
    // only a transfer still to go is added (one already made is in the balance).
    const isNow = !!now && now.balances.wise !== undefined && now.week === isoLocal(wc);
    const opening = isNow ? now!.balances.wise : running;
    const tin = isNow
      ? recurringLines
          .filter((r) => (r.toAccount ?? RECURRING_ROUTES[r.id]) === "wise")
          .reduce((s2, r) => s2 + Number(now!.remaining[r.account]?.[r.id] ?? 0), 0)
      : transferIn;
    const closing = Math.round((opening + tin - out) * 100) / 100;
    rows.push({
      week: w,
      weekCommencing: wc,
      opening,
      moneyIn: 0,
      moneyOut: out,
      allocOut: 0,
      bills: out,
      recurring: 0,
      transfersIn: tin,
      net: Math.round((tin - out) * 100) / 100,
      closing,
      billLines,
    });
    running = closing;
  }
  return rows;
}
