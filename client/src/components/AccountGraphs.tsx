// ============================================================
// PFFT Cashflow Tool — Account Graphs Tab
// Features:
//   1. "All Accounts" combined total chart at the top
//   2. One chart per account (7 total)
//   3. Balance line turns RED when it dips below zero
//   4. BAS due date vertical markers on BAS chart
//   5. Minimum balance dashed reference line per account
// ============================================================

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
  MonthResult,
  ProjectionSettings,
  getMonthLabel,
  formatCurrency,
  totalBalance,
  ACCOUNT_KEYS,
} from "@/lib/cashflow";
import { AlertTriangle } from "lucide-react";

interface AccountGraphsProps {
  settings: ProjectionSettings;
  results: MonthResult[];
}

export default function AccountGraphs({ settings, results }: AccountGraphsProps) {
  return (
    <div className="overflow-auto h-full bg-background px-6 py-6 space-y-6">
      {/* All Accounts combined chart */}
      <AllAccountsChart settings={settings} results={results} />

      {/* Individual account charts */}
      {ACCOUNT_CONFIGS.map((account) => (
        <AccountChart
          key={account.key}
          accountKey={account.key}
          settings={settings}
          results={results}
        />
      ))}
    </div>
  );
}

// ── All Accounts Combined Chart ───────────────────────────────

function AllAccountsChart({
  settings,
  results,
}: {
  settings: ProjectionSettings;
  results: MonthResult[];
}) {
  const data = results.map((r, i) => {
    const totalIn = ACCOUNT_KEYS.reduce((s, k) => s + r.allocations[k], 0);
    const totalOut = ACCOUNT_KEYS.reduce((s, k) => s + r.withdrawals[k], 0);
    const balance = totalBalance(r.closingBalances);
    return {
      month: getMonthLabel(settings.startMonth, settings.startYear, i),
      totalIn,
      totalOut,
      balance,
    };
  });

  const hasNegative = data.some((d) => d.balance < 0);
  const endY1 = totalBalance(results[11]?.closingBalances ?? {} as any);
  const endY2 = totalBalance(results[23]?.closingBalances ?? {} as any);
  const totalIn = data.reduce((s, d) => s + d.totalIn, 0);
  const totalOut = data.reduce((s, d) => s + d.totalOut, 0);
  const year1EndLabel = getMonthLabel(settings.startMonth, settings.startYear, 11);

  return (
    <div className="bg-white rounded-xl border-2 border-primary/20 shadow-sm overflow-hidden">
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
            <h3 className="text-sm font-bold text-foreground">All Accounts — Combined Total</h3>
            <p className="text-xs text-muted-foreground">Sum of all 7 Profit First accounts over 24 months</p>
          </div>
        </div>
        <div className="flex items-center gap-6 text-right shrink-0">
          <StatPill label="End Yr 1" value={endY1} colorHex="#2d7a4f" />
          <StatPill label="End Yr 2" value={endY2} colorHex="#2d7a4f" />
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
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#999" }} tickLine={false} axisLine={false} interval={1} />
            <YAxis tick={{ fontSize: 10, fill: "#999" }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} width={52} />
            <Tooltip content={<AllAccountsTooltip />} />
            <ReferenceLine y={0} stroke={hasNegative ? "#ef4444" : "#e5e7eb"} strokeWidth={hasNegative ? 1.5 : 1} strokeDasharray="4 3" />
            <ReferenceLine x={year1EndLabel} stroke="#d1d5db" strokeDasharray="4 3" label={{ value: "Y2 →", position: "insideTopRight", fontSize: 9, fill: "#aaa" }} />
            <Bar dataKey="totalIn" name="Total In" fill="#2d7a4f" fillOpacity={0.5} radius={[2,2,0,0]} maxBarSize={20} />
            <Bar dataKey="totalOut" name="Total Out" fill="#b04040" fillOpacity={0.5} radius={[2,2,0,0]} maxBarSize={20} />
          </ComposedChart>
        </ResponsiveContainer>
        {/* Balance line overlay */}
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
                activeDot={(props: any) => {
                  const { cx, cy, payload } = props;
                  const isNeg = payload.balance < 0;
                  return <circle key={`adot-all-${payload.month}`} cx={cx} cy={cy} r={5} fill={isNeg ? "#ef4444" : "#2d7a4f"} stroke="white" strokeWidth={1.5} />;
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
  accountKey,
  settings,
  results,
}: {
  accountKey: AccountKey;
  settings: ProjectionSettings;
  results: MonthResult[];
}) {
  const account = ACCOUNT_CONFIGS.find((a) => a.key === accountKey)!;
  const minBalance = settings.minBalances?.[accountKey] ?? 0;
  const hasMinBalance = minBalance > 0;

  // BAS lodgement markers — only for BAS account
  const isBas = accountKey === "bas";
  const basLodgementMonths = settings.basLodgementMonths ?? [0, 3, 6, 9];
  const basLodgementDay = settings.basLodgementDay ?? 28;

  // Profit distribution markers — only for Profit account
  const isProfit = accountKey === "profit";
  const profitDistributionMonths = settings.profitDistributionMonths ?? [0, 3, 6, 9];
  const profitDistributionDay = settings.profitDistributionDay ?? 1;

  // Build chart data
  const data = results.map((r, i) => {
    const actualMonth = (settings.startMonth + i) % 12;
    const isBasDue = isBas && basLodgementMonths.includes(actualMonth);
    const isProfitDist = isProfit && profitDistributionMonths.includes(actualMonth);
    return {
      month: getMonthLabel(settings.startMonth, settings.startYear, i),
      inflow: r.allocations[accountKey],
      outflow: r.withdrawals[accountKey],
      balance: r.closingBalances[accountKey],
      isBasDue,
      isProfitDist,
    };
  });

  const hasNegative = data.some((d) => d.balance < 0);
  const belowMinBalance = hasMinBalance && data.some((d) => d.balance < minBalance && d.balance >= 0);
  const endY1Balance = results[11]?.closingBalances[accountKey] ?? 0;
  const endY2Balance = results[23]?.closingBalances[accountKey] ?? 0;
  const totalIn = results.reduce((s, r) => s + r.allocations[accountKey], 0);
  const totalOut = results.reduce((s, r) => s + r.withdrawals[accountKey], 0);
  const year1EndLabel = getMonthLabel(settings.startMonth, settings.startYear, 11);

  // BAS due date labels for reference lines
  const basMarkerLabels = data
    .filter((d) => d.isBasDue)
    .map((d) => d.month);

  // Profit distribution labels for reference lines
  const profitDistMarkerLabels = data
    .filter((d) => d.isProfitDist)
    .map((d) => d.month);

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
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
          <StatPill label="End Yr 1" value={endY1Balance} colorHex={account.colorHex} />
          <StatPill label="End Yr 2" value={endY2Balance} colorHex={account.colorHex} />
          <StatPill label="Total In" value={totalIn} colorHex={account.colorHex} />
          <StatPill label="Total Out" value={totalOut} colorHex="#b04040" negative />
          {hasMinBalance && (
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground mb-0.5">Min Target</p>
              <p className="text-sm font-bold" style={{ color: account.colorHex }}>
                {formatCurrency(minBalance)}
              </p>
            </div>
          )}
          {hasNegative && (
            <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1">
              <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-semibold text-red-600">Goes below $0</span>
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
                BAS due {basLodgementDay}th
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
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#999" }} tickLine={false} axisLine={false} interval={1} />
            <YAxis tick={{ fontSize: 10, fill: "#999" }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} width={52} />
            <Tooltip content={<AccountTooltip account={account} minBalance={minBalance} />} />

            {/* Zero line */}
            <ReferenceLine y={0} stroke={hasNegative ? "#ef4444" : "#e5e7eb"} strokeWidth={hasNegative ? 1.5 : 1} strokeDasharray={hasNegative ? "4 3" : "3 3"} label={hasNegative ? { value: "$0", position: "right", fontSize: 10, fill: "#ef4444" } : undefined} />

            {/* Minimum balance target line */}
            {hasMinBalance && (
              <ReferenceLine
                y={minBalance}
                stroke={account.colorHex}
                strokeWidth={1.5}
                strokeDasharray="6 3"
                label={{ value: `Min ${formatCurrency(minBalance)}`, position: "right", fontSize: 9, fill: account.colorHex }}
              />
            )}

            {/* Year divider */}
            <ReferenceLine x={year1EndLabel} stroke="#d1d5db" strokeDasharray="4 3" label={{ value: "Y2 →", position: "insideTopRight", fontSize: 9, fill: "#aaa" }} />

            {/* BAS due date markers */}
            {isBas && basMarkerLabels.map((label) => (
              <ReferenceLine
                key={`bas-due-${label}`}
                x={label}
                stroke="#f97316"
                strokeWidth={1.5}
                strokeDasharray="3 2"
                label={{ value: `Due ${basLodgementDay}th`, position: "insideTopLeft", fontSize: 8, fill: "#f97316" }}
              />
            ))}

            {/* Profit distribution markers */}
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

            {/* Money In bars */}
            <Bar dataKey="inflow" name="Money In" fill={account.colorHex} fillOpacity={0.55} radius={[2,2,0,0]} maxBarSize={20} />

            {/* Money Out bars */}
            <Bar dataKey="outflow" name="Money Out" fill="#b04040" fillOpacity={0.5} radius={[2,2,0,0]} maxBarSize={20} />

            {/* Invisible line for tooltip data */}
            <Line type="monotone" dataKey="balance" name="Balance" strokeWidth={0} dot={false} activeDot={false} />
          </ComposedChart>
        </ResponsiveContainer>

        {/* Balance line overlay with red-below-zero dots */}
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
                activeDot={(props: any) => {
                  const { cx, cy, payload } = props;
                  const isNeg = payload.balance < 0;
                  const isBelowMin = hasMinBalance && payload.balance < minBalance && payload.balance >= 0;
                  const dotColor = isNeg ? "#ef4444" : isBelowMin ? "#f59e0b" : account.colorHex;
                  return <circle key={`adot-${accountKey}-${payload.month}`} cx={cx} cy={cy} r={5} fill={dotColor} stroke="white" strokeWidth={1.5} />;
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Legend */}
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
