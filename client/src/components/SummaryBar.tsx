// ============================================================
// PFFT Cashflow Tool — Summary Bar
// Top bar showing current total balance per account
// Design: "Profit First Dashboard" — account colour chips
// ============================================================

import { ACCOUNT_CONFIGS, MonthResult, formatCurrency, totalBalance } from "@/lib/cashflow";

interface SummaryBarProps {
  /** Results already sliced to the chosen horizon. */
  results: MonthResult[];
  horizonMonths: number;
}

function horizonLabel(months: number): string {
  if (months === 12) return "End of Year 1";
  if (months === 24) return "End of Year 2";
  return `End of ${months} month${months === 1 ? "" : "s"}`;
}

export default function SummaryBar({ results, horizonMonths }: SummaryBarProps) {
  const finalResult = results[results.length - 1] ?? null;
  const endBalances = finalResult?.closingBalances;

  // Show a 12-month milestone too, only when looking out the full 2 years.
  const milestone =
    horizonMonths === 24 && results.length >= 12 ? results[11] : null;

  return (
    <div className="bg-white border-b border-border px-6 py-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">
          Projected Closing Balances
        </h2>
        <div className="flex gap-6 text-xs text-muted-foreground">
          {milestone && (
            <span>
              End Year 1:{" "}
              <span className="font-semibold text-foreground">
                {formatCurrency(totalBalance(milestone.closingBalances))}
              </span>
            </span>
          )}
          {endBalances && (
            <span>
              {horizonLabel(horizonMonths)}:{" "}
              <span className="font-semibold text-foreground">
                {formatCurrency(totalBalance(endBalances))}
              </span>
            </span>
          )}
        </div>
      </div>
      <div className="grid grid-cols-7 gap-3">
        {ACCOUNT_CONFIGS.map((account) => {
          const balance = endBalances?.[account.key] ?? 0;
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
