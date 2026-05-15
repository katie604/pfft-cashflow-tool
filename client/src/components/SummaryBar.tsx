// ============================================================
// PFFT Cashflow Tool — Summary Bar
// Top bar showing current total balance per account
// Design: "Profit First Dashboard" — account colour chips
// ============================================================

import { ACCOUNT_CONFIGS, MonthResult, formatCurrency, totalBalance } from "@/lib/cashflow";

interface SummaryBarProps {
  latestResult: MonthResult | null;
  year1Result: MonthResult | null;
  year2Result: MonthResult | null;
}

export default function SummaryBar({ latestResult, year1Result, year2Result }: SummaryBarProps) {
  const endOfYear1 = year1Result?.closingBalances;
  const endOfYear2 = year2Result?.closingBalances;

  return (
    <div className="bg-white border-b border-border px-6 py-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">
          Projected Closing Balances
        </h2>
        <div className="flex gap-6 text-xs text-muted-foreground">
          {endOfYear1 && (
            <span>
              End Year 1:{" "}
              <span className="font-semibold text-foreground">
                {formatCurrency(totalBalance(endOfYear1))}
              </span>
            </span>
          )}
          {endOfYear2 && (
            <span>
              End Year 2:{" "}
              <span className="font-semibold text-foreground">
                {formatCurrency(totalBalance(endOfYear2))}
              </span>
            </span>
          )}
        </div>
      </div>
      <div className="grid grid-cols-7 gap-3">
        {ACCOUNT_CONFIGS.map((account) => {
          const balance = endOfYear2?.[account.key] ?? 0;
          const isNeg = balance < 0;
          return (
            <div
              key={account.key}
              className="rounded-lg p-3 border"
              style={{
                borderColor: account.colorHex + "40",
                backgroundColor: account.colorHex + "0d",
              }}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <div
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: account.colorHex }}
                />
                <span className="text-xs font-semibold text-muted-foreground truncate">
                  {account.shortLabel}
                </span>
              </div>
              <p
                className="text-sm font-bold truncate"
                style={{ color: isNeg ? "#b04040" : account.colorHex }}
              >
                {formatCurrency(balance)}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-0.5 truncate" title={account.label}>
                {account.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
