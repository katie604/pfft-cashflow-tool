// ============================================================
// Account Graphs off the cash flow table (Katie, 16 Oct 2026).
// The same weekly ledger the 13-week table uses, run out to 52
// weeks and grouped into weekly / monthly / 2-monthly / 3-monthly.
// ============================================================

import { AccountWeekRow, BasPayment, weekCommencing } from "@/lib/weekly";

export type Period = "weekly" | "monthly" | "2-monthly" | "3-monthly";

export const PERIODS: { key: Period; label: string; months: number }[] = [
  { key: "weekly", label: "Weekly", months: 0 },
  { key: "monthly", label: "Monthly", months: 1 },
  { key: "2-monthly", label: "2-monthly", months: 2 },
  { key: "3-monthly", label: "3-monthly", months: 3 },
];

export interface GraphPoint {
  label: string;
  inflow: number;
  outflow: number;
  balance: number;
  start: Date; // first day of the period
  end: Date; // the day after the period
  isBasDue?: boolean;
  basDueLabel?: string;
}

const r2 = (v: number) => Math.round(v * 100) / 100;
const mon = (d: Date) => d.toLocaleDateString("en-AU", { month: "short" });

/** Which group each week falls in, and the group labels. A week belongs to the
 *  month its Monday is in. */
export function groupWeeks(weekStart: string, numWeeks: number, period: Period) {
  const months = PERIODS.find((p) => p.key === period)!.months;
  const first = weekCommencing(weekStart, 0);
  const firstIdx = first.getFullYear() * 12 + first.getMonth();
  const groupOf: number[] = [];
  const labels: string[] = [];
  for (let w = 0; w < numWeeks; w++) {
    const wc = weekCommencing(weekStart, w);
    let g: number;
    if (!months) g = w;
    else g = Math.floor((wc.getFullYear() * 12 + wc.getMonth() - firstIdx) / months);
    groupOf.push(g);
    if (labels[g] === undefined) {
      if (!months) labels[g] = wc.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
      else {
        const a = new Date(first.getFullYear(), first.getMonth() + g * months, 1);
        const b = new Date(first.getFullYear(), first.getMonth() + g * months + months - 1, 1);
        const yy = String(b.getFullYear()).slice(2);
        labels[g] = months === 1 ? `${mon(a)} ${yy}` : `${mon(a)}-${mon(b)} ${yy}`;
      }
    }
  }
  return { groupOf, labels };
}

/** Group one account's weekly rows. In = money in + moved in; out = money out;
 *  balance = the closing balance at the end of the period. */
export function groupRows(
  rows: AccountWeekRow[],
  groupOf: number[],
  labels: string[],
  basPayments: BasPayment[] = []
): GraphPoint[] {
  const pts: GraphPoint[] = [];
  rows.forEach((r, w) => {
    const g = groupOf[w];
    const start = new Date(r.weekCommencing);
    const end = new Date(r.weekCommencing);
    end.setDate(end.getDate() + 7);
    const p = (pts[g] ??= { label: labels[g], inflow: 0, outflow: 0, balance: 0, start, end });
    p.inflow = r2(p.inflow + r.moneyIn + r.transfersIn);
    p.outflow = r2(p.outflow + r.moneyOut);
    p.balance = r.closing;
    p.end = end;
  });
  for (const p of pts) {
    const due = basPayments.filter((b) => {
      const [y, m, d] = b.due.split("-").map(Number);
      const dt = new Date(y, m - 1, d);
      return dt >= p.start && dt < p.end;
    });
    if (due.length) {
      p.isBasDue = true;
      p.basDueLabel = "Due " + due.map((b) => {
        const [y, m, d] = b.due.split("-").map(Number);
        return new Date(y, m - 1, d).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
      }).join(", ");
    }
  }
  return pts;
}
