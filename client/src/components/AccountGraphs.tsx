// ============================================================
// PFFT Cashflow Tool — Account Graphs Tab
// Katie, 16 Oct 2026: built off the CASH FLOW TABLE - the same weekly
// numbers (bank balances now, income estimates, wages, ATO, Wise, BAS),
// run out to 52 weeks and shown weekly / monthly / 2-monthly / 3-monthly.
//   1. "All Accounts" combined total at the top
//   2. One chart per account, plus Wise
//   3. Balance dots turn RED below $0
//   4. BAS due date markers on the BAS chart
//   5. Minimum balance dashed reference line per account
// ============================================================

import { useState } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  ACCOUNT_CONFIGS,
  AccountKey,
  ProjectionSettings,
  formatCurrency,
  ACCOUNT_KEYS,
} from "@/lib/cashflow";
import { AlertTriangle } from "lucide-react";
import { useBasPayments } from "@/hooks/useBasPayments";
import {
  WeeklyData,
  AccountWeekRow,
  buildAccountWeeks,
  buildWiseWeeks,
  isoLocal,
  weekCommencing,
  LICENCE_KEY,
} from "@/lib/weekly";
import { useIncomeEstimates, useActualTransfers, useMonthlyBills } from "@/components/WeeklyTable";
import { Period, PERIODS, GraphPoint, groupWeeks, groupRows } from "@/lib/graphPeriods";

const GRAPH_WEEKS = 52;
const WISE_CFG = {
  key: "wise",
  label: "Wise",
  colorHex: "#1a6f77",
  description: "Topped up from OpEx each week; pays the monthly subscriptions",
};
type ChartAccount = { key: string; label: string; colorHex: string; description: string };

interface AccountGraphsProps {
  settings: ProjectionSettings;
  weekly: WeeklyData;
}

export default function AccountGraphs({ settings, weekly }: AccountGraphsProps) {
  const [period, setPeriod] = useState<Period>("fortnightly"); // Katie, 16 Oct 2026
  const [basPayments] = useBasPayments();
  const [estimates, , feePct, nowBal, , opexFeePct, , wf] = useIncomeEstimates();
  const actuals = useActualTransfers();
  const bills = useMonthlyBills();
  const recurring = weekly.recurringLines ?? [];

  // Past the last income estimate, carry the last one forward so the year has income.
  const est = { ...estimates };
  const keys = Object.keys(estimates).sort();
  const lastIso = keys[keys.length - 1];
  if (lastIso) {
    for (let w = 0; w < GRAPH_WEEKS; w++) {
      const iso = isoLocal(weekCommencing(weekly.weekStart, w));
      if (iso > lastIso && est[iso] === undefined) est[iso] = estimates[lastIso];
    }
  }
  const lastEstDate = lastIso
    ? new Date(lastIso + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })
    : "";

  const acct = buildAccountWeeks(
    weekly, GRAPH_WEEKS, settings.allocations, weekly.incomeOverride ?? 0,
    recurring, actuals, est, feePct, nowBal, basPayments, [], opexFeePct, wf
  );
  const wise = buildWiseWeeks(weekly, GRAPH_WEEKS, recurring, bills, nowBal);
  const { groupOf, labels } = groupWeeks(weekly.weekStart, GRAPH_WEEKS, period);

  // The total, the way the table's Total view works: money in = new income,
  // money out = what actually leaves; moves between accounts net to zero.
  const totalRows: AccountWeekRow[] = acct.income.map((inc, w) => {
    const all = ACCOUNT_KEYS.map((k) => acct[k][w]).concat(acct.licence ? [acct.licence[w]] : []);
    const opening = all.reduce((t, r) => t + r.opening, 0) + wise[w].opening;
    const closing = Math.round((all.reduce((t, r) => t + r.closing, 0) + wise[w].closing) * 100) / 100;
    const moneyIn = all.some((r) => r.stillToGo) ? 0 : inc.moneyIn;
    const net = closing - opening;
    return { ...inc, opening, closing, moneyIn, transfersIn: 0, moneyOut: Math.round((moneyIn - net) * 100) / 100 };
  });

  const charts: ChartAccount[] = [
    ...ACCOUNT_CONFIGS.map((a) => ({ key: a.key, label: a.label, colorHex: a.colorHex, description: a.description })),
  ];
  // The licence fee's own graph, after BAS - only for a business that has one (PFANZ).
  if (wf?.licenceFee)
    charts.splice(charts.findIndex((c) => c.key === "bas") + 1, 0, {
      key: LICENCE_KEY as AccountKey,
      label: wf.licenceFee.label,
      colorHex: "#7a4fa8",
      description: `${wf.licenceFee.pct}% of what is left after BAS`,
    });
  const opexAt = charts.findIndex((c) => c.key === "opex");
  charts.splice(opexAt + 1, 0, WISE_CFG);

  return (
    <div className="overflow-auto h-full bg-background px-6 py-6 space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm font-semibold text-foreground">Show by</span>
        <div className="inline-flex rounded-lg border border-border overflow-hidden">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              data-period={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 text-xs font-medium border-r border-border last:border-r-0 ${
                period === p.key ? "bg-primary text-primary-foreground" : "bg-white text-muted-foreground hover:bg-muted"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">
          Same numbers as the cash flow table, 52 weeks out from this week.
          {lastEstDate && ` After ${lastEstDate} your last income estimate is carried forward.`}
        </span>
      </div>

      <AllAccountsChart points={groupRows(totalRows, groupOf, labels)} />

      {charts.map((c) => (
        <AccountChart
          key={c.key}
          account={c}
          settings={settings}
          points={groupRows(
            c.key === "wise" ? wise : acct[c.key as AccountKey],
            groupOf,
            labels,
            c.key === "bas" ? basPayments : []
          )}
        />
      ))}
    </div>
  );
}

// ── All Accounts Combined Chart ───────────────────────────────

function AllAccountsChart({ points }: { points: GraphPoint[] }) {
  const data = points.map((p) => ({ month: p.label, totalIn: p.inflow, totalOut: p.outflow, balance: p.balance }));
  const hasNegative = data.some((d) => d.balance < 0);
  const endBal = data[data.length - 1]?.balance ?? 0;
  const lowest = data.reduce((lo, d) => Math.min(lo, d.balance), data[0]?.balance ?? 0);
  const totalIn = data.reduce((s, d) => s + d.totalIn, 0);
  const totalOut = data.reduce((s, d) => s + d.totalOut, 0);

  return (
    <div className="bg-white rounded-xl border-2 border-primary/20 shadow-sm overflow-hidden" data-chart="total">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-primary/5">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center">
            <div className="grid grid-cols-2 gap-0.5">
              {["#2d7a4f","#c47f17","#3a5fa0","#b08d2a"].map((c) => (
                <div key={c} className="h-1.5 w-1.5 rounded-sm" style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">All Accounts - Combined Total</h3>
            <p className="text-xs text-muted-foreground">Every bank account together, including Wise</p>
          </div>
        </div>
        <div className="flex items-center gap-6 text-right shrink-0">
          <StatPill label="End balance" value={endBal} colorHex="#2d7a4f" />
          <StatPill label="Lowest" value={lowest} colorHex="#2d7a4f" />
          <StatPill label="Total In" value={totalIn} colorHex="#2d7a4f" />
          <StatPill label="Total Out" value={totalOut} colorHex="#b04040" negative />
          {hasNegative && (
            <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1">
              <AlertTriangle className="h-3 w-3 text-red-500" />
              <span className="text-xs font-semibold text-red-600">Total dips below $0</span>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 pt-4 pb-3">
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0ede8" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#999" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10, fill: "#999" }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} width={52} />
            <Tooltip content={<AllAccountsTooltip />} />
            <ReferenceLine y={0} stroke={hasNegative ? "#ef4444" : "#e5e7eb"} strokeWidth={hasNegative ? 1.5 : 1} strokeDasharray="4 3" />
            <Bar dataKey="totalIn" name="Total In" fill="#2d7a4f" fillOpacity={0.5} radius={[2,2,0,0]} maxBarSize={20} />
            <Bar dataKey="totalOut" name="Total Out" fill="#b04040" fillOpacity={0.5} radius={[2,2,0,0]} maxBarSize={20} />
            <Line type="monotone" dataKey="balance" name="Balance" strokeWidth={0} dot={false} activeDot={false} />
          </ComposedChart>
        </ResponsiveContainer>
        <div style={{ marginTop: -220, pointerEvents: "none" }}>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <XAxis dataKey="month" tick={false} tickLine={false} axisLine={false} />
              <YAxis tick={false} tickLine={false} axisLine={false} width={52} />
              <Line
                type="monotone"
                dataKey="balance"
                strokeWidth={2.5}
                stroke="#2d7a4f"
                dot={(props: any) => {
                  const { cx, cy, payload } = props;
                  const isNeg = payload.balance < 0;
                  return <circle key={`dot-all-${payload.month}`} cx={cx} cy={cy} r={3} fill={isNeg ? "#ef4444" : "#2d7a4f"} stroke="white" strokeWidth={1} />;
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="flex items-center gap-5 px-5 pb-4">
        <LegendItem color="#2d7a4f" label="Total In" opacity={0.5} />
        <LegendItem color="#b04040" label="Total Out" opacity={0.5} />
        <LegendItem color="#2d7a4f" label="Total Balance (positive)" />
        <LegendItem color="#ef4444" label="Total Balance (below $0)" />
      </div>
    </div>
  );
}

// ── Per-account chart ─────────────────────────────────────────

function AccountChart({
  account,
  settings,
  points,
}: {
  account: ChartAccount;
  settings: ProjectionSettings;
  points: GraphPoint[];
}) {
  const accountKey = account.key;
  const minBalance = (settings.minBalances as Record<string, number> | undefined)?.[accountKey] ?? 0;
  const hasMinBalance = minBalance > 0;
  const isBas = accountKey === "bas";
  const isProfit = accountKey === "profit";
  const profitDistributionMonths = settings.profitDistributionMonths ?? [0, 3, 6, 9];
  const profitDistributionDay = settings.profitDistributionDay ?? 1;

  const data = points.map((p) => {
    // A profit distribution date (day of the month, in the chosen months) inside the period.
    let isProfitDist = false;
    if (isProfit) {
      for (let d = new Date(p.start.getFullYear(), p.start.getMonth(), 1); d < p.end; d.setMonth(d.getMonth() + 1)) {
        const day = new Date(d.getFullYear(), d.getMonth(), profitDistributionDay);
        if (profitDistributionMonths.includes(d.getMonth()) && day >= p.start && day < p.end) isProfitDist = true;
      }
    }
    return {
      month: p.label,
      inflow: p.inflow,
      outflow: p.outflow,
      balance: p.balance,
      isBasDue: isBas && !!p.isBasDue,
      basDueLabel: p.basDueLabel ?? "",
      isProfitDist,
    };
  });

  const hasNegative = data.some((d) => d.balance < 0);
  const belowMinBalance = hasMinBalance && data.some((d) => d.balance < minBalance && d.balance >= 0);
  const endBalance = data[data.length - 1]?.balance ?? 0;
  const lowest = data.reduce((lo, d) => Math.min(lo, d.balance), data[0]?.balance ?? 0);
  const totalIn = data.reduce((s, d) => s + d.inflow, 0);
  const totalOut = data.reduce((s, d) => s + d.outflow, 0);

  const basMarkerLabels = data.filter((d) => d.isBasDue).map((d) => d.month);
  const basMarkerText: Record<string, string> = Object.fromEntries(
    data.filter((d) => d.isBasDue).map((d) => [d.month, d.basDueLabel])
  );
  const profitDistMarkerLabels = data.filter((d) => d.isProfitDist).map((d) => d.month);

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden" data-chart={accountKey}>
      {/* Card header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div
            className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: account.colorHex + "18" }}
          >
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: account.colorHex }} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">{account.label}</h3>
            <p className="text-xs text-muted-foreground">{account.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-6 text-right shrink-0 flex-wrap justify-end">
          <StatPill label="End balance" value={endBalance} colorHex={account.colorHex} />
          <StatPill label="Lowest" value={lowest} colorHex={account.colorHex} />
          <StatPill label="Total In" value={totalIn} colorHex={account.colorHex} />
          <StatPill label="Total Out" value={totalOut} colorHex="#b04040" negative />
          {hasNegative && (
            <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1">
              <AlertTriangle className="h-3 w-3 text-red-500" />
              <span className="text-xs font-semibold text-red-600">Dips below $0</span>
            </div>
          )}
          {!hasNegative && belowMinBalance && (
            <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1">
              <AlertTriangle className="h-3 w-3 text-amber-500" />
              <span className="text-xs font-semibold text-amber-600">Below min target</span>
            </div>
          )}
          {isBas && basMarkerLabels.length > 0 && (
            <div className="flex items-center gap-1.5 bg-orange-50 border border-orange-200 rounded-lg px-2.5 py-1">
              <div className="h-2 w-2 rounded-full bg-orange-500" />
              <span className="text-xs font-semibold text-orange-600">
                BAS {Object.values(basMarkerText).join(", ").replace(/Due /g, "due ")}
              </span>
            </div>
          )}
          {isProfit && profitDistMarkerLabels.length > 0 && (
            <div className="flex items-center gap-1.5 bg-yellow-50 border border-yellow-300 rounded-lg px-2.5 py-1">
              <div className="h-2 w-2 rounded-full bg-yellow-500" />
              <span className="text-xs font-semibold text-yellow-700">
                Profit dist. {profitDistributionDay === 1 ? "1st" : `${profitDistributionDay}th`} of quarter
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="px-4 pt-4 pb-3">
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0ede8" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#999" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10, fill: "#999" }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} width={52} />
            <Tooltip content={<AccountTooltip account={account} minBalance={minBalance} />} />
            <ReferenceLine y={0} stroke={hasNegative ? "#ef4444" : "#e5e7eb"} strokeWidth={hasNegative ? 1.5 : 1} strokeDasharray={hasNegative ? "4 3" : "3 3"} label={hasNegative ? { value: "$0", position: "right", fontSize: 10, fill: "#ef4444" } : undefined} />
            {hasMinBalance && (
              <ReferenceLine
                y={minBalance}
                stroke={account.colorHex}
                strokeWidth={1.5}
                strokeDasharray="6 3"
                label={{ value: `Min ${formatCurrency(minBalance)}`, position: "right", fontSize: 9, fill: account.colorHex }}
              />
            )}
            {isBas && basMarkerLabels.map((label) => (
              <ReferenceLine
                key={`bas-due-${label}`}
                x={label}
                stroke="#f97316"
                strokeWidth={1.5}
                strokeDasharray="3 2"
                label={{ value: basMarkerText[label], position: "insideTopLeft", fontSize: 8, fill: "#f97316" }}
              />
            ))}
            {isProfit && profitDistMarkerLabels.map((label) => (
              <ReferenceLine
                key={`profit-dist-${label}`}
                x={label}
                stroke="#ca8a04"
                strokeWidth={2}
                strokeDasharray="5 3"
                label={{ value: `Profit Dist. ${profitDistributionDay === 1 ? "1st" : `${profitDistributionDay}th`}`, position: "insideTopLeft", fontSize: 8, fill: "#ca8a04" }}
              />
            ))}
            <Bar dataKey="inflow" name="Money In" fill={account.colorHex} fillOpacity={0.55} radius={[2,2,0,0]} maxBarSize={20} />
            <Bar dataKey="outflow" name="Money Out" fill="#b04040" fillOpacity={0.5} radius={[2,2,0,0]} maxBarSize={20} />
            <Line type="monotone" dataKey="balance" name="Balance" strokeWidth={0} dot={false} activeDot={false} />
          </ComposedChart>
        </ResponsiveContainer>

        <div style={{ marginTop: -220, pointerEvents: "none" }}>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <XAxis dataKey="month" tick={false} tickLine={false} axisLine={false} />
              <YAxis tick={false} tickLine={false} axisLine={false} width={52} />
              <Line
                type="monotone"
                dataKey="balance"
                strokeWidth={2.5}
                stroke={account.colorHex}
                dot={(props: any) => {
                  const { cx, cy, payload } = props;
                  const isNeg = payload.balance < 0;
                  const isBelowMin = hasMinBalance && payload.balance < minBalance && payload.balance >= 0;
                  const dotColor = isNeg ? "#ef4444" : isBelowMin ? "#f59e0b" : account.colorHex;
                  return <circle key={`dot-${accountKey}-${payload.month}`} cx={cx} cy={cy} r={3} fill={dotColor} stroke="white" strokeWidth={1} />;
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="flex items-center gap-5 px-5 pb-4 flex-wrap">
        <LegendItem color={account.colorHex} label="Money In" opacity={0.55} />
        <LegendItem color="#b04040" label="Money Out" opacity={0.5} />
        <LegendItem color={account.colorHex} label="Balance (positive)" />
        {hasMinBalance && <LegendItem color="#f59e0b" label="Balance (below min target)" />}
        <LegendItem color="#ef4444" label="Balance (below $0)" />
        {isBas && <LegendItem color="#f97316" label="BAS due date" dashed />}
        {isProfit && profitDistMarkerLabels.length > 0 && <LegendItem color="#ca8a04" label="Profit distribution" dashed />}
      </div>
    </div>
  );
}

// ── Stat Pill ─────────────────────────────────────────────────

function StatPill({ label, value, colorHex, negative }: { label: string; value: number; colorHex: string; negative?: boolean }) {
  const isNeg = value < 0;
  const displayColor = isNeg ? "#ef4444" : colorHex;
  return (
    <div>
      <p className="text-[10px] text-muted-foreground mb-0.5">{label}</p>
      <p className="text-sm font-bold" style={{ color: displayColor }}>{formatCurrency(value)}</p>
    </div>
  );
}

// ── Legend Item ───────────────────────────────────────────────

function LegendItem({ color, label, opacity = 1, dashed }: { color: string; label: string; opacity?: number; dashed?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      {dashed ? (
        <div className="h-0.5 w-4 shrink-0" style={{ borderTop: `2px dashed ${color}`, opacity }} />
      ) : (
        <div className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: color, opacity }} />
      )}
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

// ── Account Tooltip ───────────────────────────────────────────

function AccountTooltip({ active, payload, label, account, minBalance }: any) {
  if (!active || !payload?.length) return null;
  const balance = payload.find((p: any) => p.name === "Balance")?.value ?? 0;
  const inflow = payload.find((p: any) => p.name === "Money In")?.value ?? 0;
  const outflow = payload.find((p: any) => p.name === "Money Out")?.value ?? 0;
  const isNeg = balance < 0;
  const isBelowMin = minBalance > 0 && balance < minBalance && balance >= 0;

  return (
    <div className="bg-white border border-border rounded-lg shadow-lg px-3.5 py-3 text-xs min-w-36">
      <p className="font-semibold text-foreground mb-2">{label}</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Money In</span>
          <span className="font-semibold" style={{ color: account?.colorHex }}>{formatCurrency(inflow)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Money Out</span>
          <span className="font-semibold text-red-600">{formatCurrency(outflow)}</span>
        </div>
        <div className="border-t border-border pt-1 mt-1 flex justify-between gap-4">
          <span className="text-muted-foreground font-medium">Balance</span>
          <span className="font-bold" style={{ color: isNeg ? "#ef4444" : isBelowMin ? "#f59e0b" : account?.colorHex }}>
            {formatCurrency(balance)}
          </span>
        </div>
        {isBelowMin && (
          <div className="flex justify-between gap-4 text-amber-600">
            <span>Below min</span>
            <span className="font-semibold">{formatCurrency(minBalance - balance)} short</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── All Accounts Tooltip ──────────────────────────────────────

function AllAccountsTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const balance = payload.find((p: any) => p.name === "Balance")?.value ?? 0;
  const totalIn = payload.find((p: any) => p.name === "Total In")?.value ?? 0;
  const totalOut = payload.find((p: any) => p.name === "Total Out")?.value ?? 0;
  const isNeg = balance < 0;

  return (
    <div className="bg-white border border-border rounded-lg shadow-lg px-3.5 py-3 text-xs min-w-40">
      <p className="font-semibold text-foreground mb-2">{label}</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Total In</span>
          <span className="font-semibold text-green-700">{formatCurrency(totalIn)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Total Out</span>
          <span className="font-semibold text-red-600">{formatCurrency(totalOut)}</span>
        </div>
        <div className="border-t border-border pt-1 mt-1 flex justify-between gap-4">
          <span className="text-muted-foreground font-medium">Total Balance</span>
          <span className="font-bold" style={{ color: isNeg ? "#ef4444" : "#2d7a4f" }}>
            {formatCurrency(balance)}
          </span>
        </div>
      </div>
    </div>
  );
}
