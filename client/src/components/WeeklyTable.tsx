// ============================================================
// 13-Week Cash Flow Table — same look & feel as the monthly
// Profit First table: collapsible account groups, colour chips,
// account-coloured closing balances. Built from live invoices
// & bills (per-account money-out categorised from Xero).
// ============================================================

import { Fragment, useEffect, useState } from "react";
import {
  WeeklyData,
  WeekRow,
  AccountWeekRow,
  RecurringLine,
  ActualTransfer,
  buildWeeks,
  buildAccountWeeks,
} from "@/lib/weekly";
import {
  formatCurrency,
  ACCOUNT_CONFIGS,
  AccountKey,
  AccountBalances,
} from "@/lib/cashflow";
import { ChevronDown, ChevronUp } from "lucide-react";
import { parseCurrencyInput, formatCurrencyInput } from "@/lib/cashflow";

const IN = "#2d7a4f";
const OUT = "#b04040";
const NAVY = "#1F3D6E";
const GREY = "#9ca3af"; // accounts the client hasn't opened yet

interface Props {
  weekly: WeeklyData;
  allocations: AccountBalances;
  onSetIncome: (amount: number) => void;
  onSetRecurring: (id: string, amount: number) => void;
}

/** The Allocation Calculator's actual transfers for the business on screen.
 *  Re-read when the calculator (same page, an iframe) saves new ones. */
function useActualTransfers(): ActualTransfer[] {
  const read = (): ActualTransfer[] => {
    try {
      const all = JSON.parse(localStorage.getItem("kcc-actual-transfers") || "[]") as ActualTransfer[];
      const t = localStorage.getItem("kcc-tenant") || localStorage.getItem("pfft-pf-alloc-xero-tenant") || "";
      return all.filter((a) => !t || !a.tenant || a.tenant === t);
    } catch {
      return [];
    }
  };
  const [list, setList] = useState<ActualTransfer[]>(read);
  useEffect(() => {
    const refresh = () => setList(read());
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  return list;
}

function cell(v: number) {
  return v === 0 ? "–" : formatCurrency(v);
}

export default function WeeklyTable({
  weekly,
  allocations,
  onSetIncome,
  onSetRecurring,
}: Props) {
  const [numWeeks, setNumWeeks] = useState(13);
  const [mode, setMode] = useState<"accounts" | "total">("accounts");
  const [expanded, setExpanded] = useState<Set<AccountKey>>(
    () => new Set<AccountKey>(["income"])
  );

  const override = weekly.incomeOverride ?? 0;
  const recurringLines = weekly.recurringLines ?? [];
  const toOpen = new Set(weekly.accountsToOpen ?? []);
  const rows = buildWeeks(weekly, numWeeks, override);
  const actuals = useActualTransfers();
  const accountRows = buildAccountWeeks(
    weekly,
    numWeeks,
    allocations,
    override,
    recurringLines,
    actuals
  );
  const hasItems = weekly.items.length > 0 || override > 0;

  const toggle = (k: AccountKey) =>
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  const expandAll = () => setExpanded(new Set(ACCOUNT_CONFIGS.map((a) => a.key)));
  const collapseAll = () => setExpanded(new Set());

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Control bar */}
      <div className="flex items-center gap-4 px-4 py-2.5 bg-white border-b border-border flex-wrap shrink-0">
        <span className="text-sm font-semibold" style={{ color: NAVY }}>
          {numWeeks}-Week Cash Flow
        </span>
        <span className="text-xs text-muted-foreground">
          Cash now: <strong>{formatCurrency(weekly.startingCash)}</strong>
        </span>

        {/* By account / Total */}
        <div className="inline-flex rounded-lg border border-border overflow-hidden">
          {([
            ["accounts", "By account"],
            ["total", "Total"],
          ] as const).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setMode(v)}
              className={`px-2.5 py-1 text-xs font-medium border-r border-border last:border-r-0 ${
                mode === v
                  ? "bg-primary text-primary-foreground"
                  : "bg-white text-muted-foreground hover:bg-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === "accounts" && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Rows:</span>
            <button onClick={expandAll} className="text-primary hover:underline">
              Expand all
            </button>
            <span className="text-muted-foreground">/</span>
            <button onClick={collapseAll} className="text-primary hover:underline">
              Collapse all
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Set all weeks income:</span>
          <BulkIncomeInput value={override} onSet={onSetIncome} />
          {override > 0 && (
            <button
              onClick={() => onSetIncome(0)}
              className="text-xs text-primary hover:underline"
              title="Go back to the real invoice income"
            >
              use invoices
            </button>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground hidden sm:inline">Weeks:</span>
          <div className="inline-flex rounded-lg border border-border overflow-hidden">
            {[8, 13, 26].map((n) => (
              <button
                key={n}
                onClick={() => setNumWeeks(n)}
                className={`px-2.5 py-1 text-xs font-medium border-r border-border last:border-r-0 ${
                  numWeeks === n
                    ? "bg-primary text-primary-foreground"
                    : "bg-white text-muted-foreground hover:bg-muted"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      {mode === "accounts" && (
        <div className="px-4 py-1.5 bg-muted/30 border-b border-border text-[11px] text-muted-foreground shrink-0">
          Click an account to expand · Money in = income split by your PF % ·
          Money out = real bills, categorised from Xero
          {override > 0 && (
            <span style={{ color: NAVY }}> · modelling {formatCurrency(override)}/week assumed income</span>
          )}{" "}
          · edit the actual invoices &amp; bills on the <strong>Weekly What-If</strong> tab
        </div>
      )}

      {!hasItems && (
        <div className="p-8 text-center text-sm text-muted-foreground">
          No invoices or bills yet. Use <strong>Connect Xero</strong> to pull a
          client's data, or set an assumed weekly income above.
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="cf-table w-full text-sm">
          <thead>
            <tr className="bg-muted/50">
              <th
                className="sticky-col text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border z-20 bg-muted/50"
                style={{ minWidth: 200, width: 200 }}
              >
                {mode === "accounts" ? "Account / Row" : "Week"}
              </th>
              {rows.map((r) => (
                <th
                  key={r.week}
                  className="text-right px-3 py-3 text-xs font-600 text-muted-foreground border-b border-border whitespace-nowrap"
                  style={{ minWidth: 100, color: NAVY }}
                >
                  {r.week === 0 ? "Now" : `Wk ${r.week}`}
                  <div className="font-normal text-[10px] text-muted-foreground">
                    {r.weekCommencing.toLocaleDateString("en-AU", {
                      day: "numeric",
                      month: "short",
                    })}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {mode === "accounts" ? (
              <>
              {ACCOUNT_CONFIGS.map((account) => {
                const isExpanded = expanded.has(account.key);
                const ar = accountRows[account.key];
                const isIncome = account.key === "income";
                const isToOpen = toOpen.has(account.key);
                // Grey everything for an account the client hasn't opened yet.
                const acct = isToOpen ? { ...account, colorHex: GREY } : account;
                return (
                  <Fragment key={account.key}>
                    {/* Account header row */}
                    <tr
                      className={`row-${account.key} hover:bg-muted/30 transition-colors`}
                      style={{ backgroundColor: acct.colorHex + "08" }}
                    >
                      <td
                        className="sticky-col px-4 py-2.5 border-b border-border bg-white cursor-pointer select-none"
                        style={{
                          backgroundColor: acct.colorHex + "0d",
                          borderLeft: `3px solid ${acct.colorHex}`,
                        }}
                        onClick={() => toggle(account.key)}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="h-3 w-3 rounded-full shrink-0"
                            style={{ backgroundColor: acct.colorHex }}
                          />
                          <span
                            className="font-semibold text-sm truncate"
                            style={{ color: isToOpen ? GREY : undefined }}
                          >
                            {account.label}
                            {isToOpen && " *"}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground ml-auto shrink-0" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-auto shrink-0" />
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground/60 mt-0.5 pl-5">
                          {isToOpen
                            ? "to open"
                            : isIncome
                            ? "Closing balance"
                            : `${allocations[account.key]}% of income`}
                        </div>
                      </td>
                      {ar.map((r) => {
                        const val = r.closing;
                        return (
                          <td
                            key={r.week}
                            className="px-3 py-2.5 text-right border-b border-border font-semibold"
                            style={{ color: isToOpen ? GREY : val < 0 ? OUT : acct.colorHex }}
                          >
                            {formatCurrency(val)}
                          </td>
                        );
                      })}
                    </tr>

                    {isExpanded && (
                      <>
                        <DetailRow account={acct} label="Opening" rows={ar} pick={(r) => r.opening} rowType="opening" />
                        <DetailRow
                          account={acct}
                          label={isIncome ? "Income in" : "Allocation in"}
                          rows={ar}
                          pick={(r) => r.moneyIn}
                          rowType="allocation"
                          compare={!isIncome}
                        />
                        {isIncome && ar.some((r) => r.allocOut > 0) && (
                          <DetailRow account={acct} label="Allocated out" rows={ar} pick={(r) => r.allocOut} rowType="withdrawal" compare />
                        )}
                        {ar.some((r) => r.bills > 0) && (
                          <DetailRow account={acct} label="Bills (Xero)" rows={ar} pick={(r) => r.bills} rowType="withdrawal" />
                        )}
                        {recurringLines
                          .filter((l) => l.account === account.key)
                          .map((line) => (
                            <RecurringRow
                              key={line.id}
                              account={acct}
                              line={line}
                              numWeeks={numWeeks}
                              onSet={onSetRecurring}
                            />
                          ))}
                        <DetailRow account={acct} label="Net movement" rows={ar} pick={(r) => r.net} rowType="allocation" />
                        <DetailRow account={acct} label="Closing balance" rows={ar} pick={(r) => r.closing} rowType="closing" isBold />
                      </>
                    )}
                  </Fragment>
                );
              })}
              <TotalRow
                label="Total Cash"
                rows={rows}
                pick={(r) => r.closing}
                color={NAVY}
                bold
                dangerNegative
              />
              </>
            ) : (
              <>
                <TotalRow label="Opening" rows={rows} pick={(r) => r.opening} color={NAVY} />
                <TotalRow label="Money in" rows={rows} pick={(r) => r.moneyIn} color={IN} />
                <TotalRow label="Money out" rows={rows} pick={(r) => r.moneyOut} color={OUT} />
                <TotalRow label="Net movement" rows={rows} pick={(r) => r.net} color={NAVY} signed />
                <TotalRow label="Closing balance" rows={rows} pick={(r) => r.closing} color={NAVY} bold dangerNegative />
              </>
            )}
          </tbody>
        </table>
      </div>

      {mode === "accounts" && toOpen.size > 0 && (
        <div
          className="px-4 py-2 border-t border-border text-xs shrink-0"
          style={{ color: GREY }}
        >
          * Bank accounts to open
        </div>
      )}
    </div>
  );
}

type RowType = "opening" | "allocation" | "withdrawal" | "closing";

// Per-account detail row — mirrors the monthly table's DetailRow.
function DetailRow({
  account,
  label,
  rows,
  pick,
  rowType,
  isBold,
  compare,
}: {
  account: (typeof ACCOUNT_CONFIGS)[number];
  label: string;
  rows: AccountWeekRow[];
  pick: (r: AccountWeekRow) => number;
  rowType: RowType;
  isBold?: boolean;
  /** Colour actual weeks green (more than expected) or red (less), click for detail. */
  compare?: boolean;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const bgMap: Record<RowType, string> = {
    opening: "bg-muted/20",
    allocation: "bg-white",
    withdrawal: "bg-white",
    closing: "bg-muted/30",
  };
  return (
    <tr className={`${bgMap[rowType]} hover:bg-muted/40 transition-colors`}>
      <td
        className={`sticky-col px-4 py-2 border-b border-border/50 ${bgMap[rowType]}`}
        style={{ borderLeftColor: account.colorHex + "60" }}
      >
        <span
          className={`text-xs pl-5 ${
            isBold ? "font-semibold text-foreground" : "text-muted-foreground"
          }`}
        >
          {label}
        </span>
      </td>
      {rows.map((r) => {
        const val = pick(r);
        const isNeg = val < 0;
        const textColor =
          rowType === "withdrawal"
            ? OUT
            : isNeg
            ? OUT
            : rowType === "closing"
            ? account.colorHex
            : "inherit";
        if (compare && r.actual) {
          const exp = r.expected ?? 0;
          const diff = Math.round((val - exp) * 100) / 100;
          const good = diff >= 0; // more came in than expected = green; less = red
          return (
            <td
              key={r.week}
              className="px-2 py-2 text-right border-b border-border/50 cursor-pointer relative font-semibold"
              style={{ color: "#fff", background: good ? IN : OUT }}
              title="Actual transfer - click to compare with what was expected"
              onClick={() => setOpen(open === r.week ? null : r.week)}
            >
              {cell(val)}
              {open === r.week && (
                <div
                  className="absolute right-0 top-full z-20 mt-1 w-56 rounded-md border border-border bg-white p-2 text-left text-xs font-normal shadow-lg"
                  style={{ color: "#22303b" }}
                >
                  <div className="font-semibold mb-1">Actual transfer</div>
                  <div>Expected: {formatCurrencyInput(exp) ? "$" + formatCurrencyInput(exp) : "$0"}</div>
                  <div>Actual: ${formatCurrencyInput(val) || "0"}</div>
                  <div className="font-semibold" style={{ color: good ? IN : OUT }}>
                    {good ? "Over" : "Under"} by ${formatCurrencyInput(Math.abs(diff)) || "0"}
                  </div>
                </div>
              )}
            </td>
          );
        }
        return (
          <td
            key={r.week}
            className="px-2 py-2 text-right border-b border-border/50"
            style={{ color: textColor }}
          >
            {cell(val)}
          </td>
        );
      })}
    </tr>
  );
}

// Editable recurring money-out line (payroll). Same amount every week.
function RecurringRow({
  account,
  line,
  numWeeks,
  onSet,
}: {
  account: (typeof ACCOUNT_CONFIGS)[number];
  line: RecurringLine;
  numWeeks: number;
  onSet: (id: string, amount: number) => void;
}) {
  return (
    <tr className="bg-white hover:bg-muted/40 transition-colors">
      <td
        className="sticky-col px-4 py-2 border-b border-border/50 bg-white"
        style={{ borderLeftColor: account.colorHex + "60" }}
      >
        <span className="text-xs pl-5 text-muted-foreground italic">{line.label}</span>
      </td>
      {Array.from({ length: numWeeks }, (_, w) => (
        <RecurringCell
          key={w}
          value={line.weeklyAmount}
          onSet={(v) => onSet(line.id, v)}
        />
      ))}
    </tr>
  );
}

function RecurringCell({
  value,
  onSet,
}: {
  value: number;
  onSet: (v: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <td className="px-1 py-1 border-b border-border/50">
        <input
          autoFocus
          defaultValue={value ? String(Math.round(value)) : ""}
          onBlur={(e) => {
            onSet(parseCurrencyInput(e.target.value));
            setEditing(false);
          }}
          onKeyDown={(e) =>
            e.key === "Enter" && (e.target as HTMLInputElement).blur()
          }
          className="w-full text-xs text-right bg-white border border-border rounded px-1"
        />
      </td>
    );
  }
  return (
    <td
      className="px-2 py-2 text-right border-b border-border/50 cursor-pointer hover:bg-muted/40"
      style={{ color: value ? OUT : undefined }}
      onClick={() => setEditing(true)}
      title="Click to edit"
    >
      {value ? formatCurrency(value) : "–"}
    </td>
  );
}

// Set-all-weeks income (the weekly equivalent of "set all income months").
function BulkIncomeInput({
  value,
  onSet,
}: {
  value: number;
  onSet: (n: number) => void;
}) {
  return (
    <input
      key={value}
      defaultValue={value ? formatCurrencyInput(value) : ""}
      onKeyDown={(e) =>
        e.key === "Enter" && (e.target as HTMLInputElement).blur()
      }
      onBlur={(e) => onSet(parseCurrencyInput(e.target.value))}
      placeholder="$ / week"
      className="text-sm bg-white border border-border rounded px-2 py-1 w-24"
    />
  );
}

// Aggregate (Total) row.
function TotalRow({
  label,
  rows,
  pick,
  color,
  bold,
  signed,
  dangerNegative,
}: {
  label: string;
  rows: WeekRow[];
  pick: (r: WeekRow) => number;
  color: string;
  bold?: boolean;
  signed?: boolean;
  dangerNegative?: boolean;
}) {
  return (
    <tr className={bold ? "bg-muted/30" : "hover:bg-muted/20"}>
      <td
        className={`sticky-col px-4 py-2.5 border-b border-border bg-white ${
          bold ? "font-bold" : "text-muted-foreground"
        }`}
      >
        {label}
      </td>
      {rows.map((r) => {
        const v = pick(r);
        const c = dangerNegative && v < 0 ? OUT : color;
        return (
          <td
            key={r.week}
            className={`px-3 py-2.5 text-right border-b border-border ${bold ? "font-bold" : ""}`}
            style={{ color: c }}
          >
            {signed && v > 0 ? "+" : ""}
            {cell(v)}
          </td>
        );
      })}
    </tr>
  );
}
