// ============================================================
// PFFT Cashflow Tool — Cashflow Projection Table
// 24-month scrollable table with frozen first column
// Design: "Profit First Dashboard"
// ============================================================

import { useState, useRef, Fragment } from "react";
import {
  ACCOUNT_CONFIGS,
  AccountKey,
  MonthResult,
  ProjectionSettings,
  formatCurrency,
  formatCurrencyInput,
  parseCurrencyInput,
  getMonthLabel,
  totalBalance,
} from "@/lib/cashflow";
import { ChevronDown, ChevronUp } from "lucide-react";

interface CashflowTableProps {
  settings: ProjectionSettings;
  results: MonthResult[];
  onUpdateIncome: (monthIndex: number, value: number) => void;
  onUpdateWithdrawal: (monthIndex: number, key: AccountKey, value: number) => void;
  onBulkIncomeSet: (value: number) => void;
}

type RowType = "opening" | "allocation" | "withdrawal" | "closing";

interface RowConfig {
  id: string;
  label: string;
  type: RowType;
  accountKey: AccountKey;
  editable: boolean;
}

export default function CashflowTable({
  settings,
  results,
  onUpdateIncome,
  onUpdateWithdrawal,
  onBulkIncomeSet,
}: CashflowTableProps) {
  const [expandedAccounts, setExpandedAccounts] = useState<Set<AccountKey>>(
    () => new Set<AccountKey>(["income"])
  );
  const tableRef = useRef<HTMLDivElement>(null);

  const toggleAccount = (key: AccountKey) => {
    setExpandedAccounts((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const expandAll = () => setExpandedAccounts(new Set<AccountKey>(ACCOUNT_CONFIGS.map((a) => a.key)));
  const collapseAll = () => setExpandedAccounts(new Set<AccountKey>());

  return (
    <div className="flex flex-col h-full">
      {/* Table controls */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-white border-b border-border flex-wrap">
        <span className="text-xs text-muted-foreground">Rows:</span>
        <button
          onClick={expandAll}
          className="text-xs text-primary hover:underline"
        >
          Expand all
        </button>
        <span className="text-xs text-muted-foreground">/</span>
        <button
          onClick={collapseAll}
          className="text-xs text-primary hover:underline"
        >
          Collapse all
        </button>
        <div className="flex items-center gap-2 ml-4">
          <span className="text-xs text-muted-foreground">Set all income months:</span>
          <BulkIncomeInput onBulkSet={onBulkIncomeSet} />
        </div>
        <span className="ml-auto text-xs text-muted-foreground hidden lg:block">
          Click account name to expand · Edit income &amp; withdrawal cells directly
        </span>
      </div>

      {/* Scrollable table wrapper */}
      <div ref={tableRef} className="flex-1 overflow-auto">
        <table className="cf-table w-full text-sm">
          <thead>
            <tr className="bg-muted/50">
              {/* Frozen label column */}
              <th
                className="sticky-col text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border z-20 bg-muted/50"
                style={{ minWidth: 200, width: 200 }}
              >
                Account / Row
              </th>

              {/* Month columns */}
              {Array.from({ length: 24 }, (_, i) => {
                const isYear2Start = i === 12;
                const label = getMonthLabel(settings.startMonth, settings.startYear, i);
                const year = i < 12 ? "Year 1" : "Year 2";
                return (
                  <th
                    key={i}
                    className={`text-right px-3 py-3 text-xs font-600 text-muted-foreground border-b border-border ${
                      isYear2Start ? "year-divider border-l-2" : ""
                    }`}
                    style={{ minWidth: 100 }}
                  >
                    <div className="text-muted-foreground/50 text-[10px] font-400 mb-0.5">
                      {year}
                    </div>
                    {label}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {ACCOUNT_CONFIGS.map((account) => {
              const isExpanded = expandedAccounts.has(account.key);
              const isIncome = account.key === "income";

              return (
                <Fragment key={account.key}>
                  {/* Account header row */}
                  <AccountHeaderRow
                    key={`header-${account.key}`}
                    account={account}
                    isExpanded={isExpanded}
                    onToggle={() => toggleAccount(account.key)}
                    results={results}
                    settings={settings}
                    onUpdateIncome={onUpdateIncome}
                    isIncome={isIncome}
                  />

                  {/* Detail rows when expanded */}
                  {isExpanded && (
                    <Fragment>
                      {/* Opening Balance row */}
                      <DetailRow
                        key={`opening-${account.key}`}
                        label="Opening Balance"
                        account={account}
                        values={results.map((r) => r.openingBalances[account.key])}
                        editable={false}
                        isSubRow
                        rowType="opening"
                      />

                      {/* Allocation / Income In row */}
                      <DetailRow
                        key={`alloc-${account.key}`}
                        label={isIncome ? "Income In" : "Allocation In"}
                        account={account}
                        values={results.map((r) => r.allocations[account.key])}
                        editable={isIncome}
                        isSubRow
                        rowType="allocation"
                        onEdit={
                          isIncome
                            ? (monthIdx, val) => onUpdateIncome(monthIdx, val)
                            : undefined
                        }
                        editValues={
                          isIncome
                            ? settings.months.map((m) => m.incomeIn)
                            : undefined
                        }
                      />

                      {/* Withdrawal row */}
                      {!isIncome && (
                        <DetailRow
                          key={`withdrawal-${account.key}`}
                          label="Withdrawals"
                          account={account}
                          values={results.map((r) => r.withdrawals[account.key])}
                          editable={true}
                          isSubRow
                          rowType="withdrawal"
                          onEdit={(monthIdx, val) =>
                            onUpdateWithdrawal(monthIdx, account.key, val)
                          }
                          editValues={settings.months.map(
                            (m) => m.withdrawals[account.key] ?? 0
                          )}
                        />
                      )}

                      {/* Closing Balance row */}
                      <DetailRow
                        key={`closing-${account.key}`}
                        label="Closing Balance"
                        account={account}
                        values={results.map((r) => r.closingBalances[account.key])}
                        editable={false}
                        isSubRow
                        rowType="closing"
                        isBold
                      />
                    </Fragment>
                  )}
                </Fragment>
              );
            })}

            {/* Total row */}
            <TotalRow results={results} settings={settings} />
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Account Header Row ────────────────────────────────────────

function AccountHeaderRow({
  account,
  isExpanded,
  onToggle,
  results,
  settings,
  onUpdateIncome,
  isIncome,
}: {
  account: (typeof ACCOUNT_CONFIGS)[0];
  isExpanded: boolean;
  onToggle: () => void;
  results: MonthResult[];
  settings: ProjectionSettings;
  onUpdateIncome: (monthIndex: number, value: number) => void;
  isIncome: boolean;
}) {
  return (
    <tr
      className={`row-${account.key} hover:bg-muted/30 transition-colors`}
      style={{ backgroundColor: account.colorHex + "08" }}
    >
      {/* Frozen label */}
      <td
        className="sticky-col px-4 py-2.5 border-b border-border bg-white cursor-pointer select-none"
        style={{ backgroundColor: account.colorHex + "0d" }}
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          <div
            className="h-3 w-3 rounded-full shrink-0"
            style={{ backgroundColor: account.colorHex }}
          />
          <span className="font-semibold text-sm text-foreground truncate">
            {account.label}
          </span>
          {isExpanded ? (
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground ml-auto shrink-0" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-auto shrink-0" />
          )}
        </div>
        <div className="text-xs text-muted-foreground/60 mt-0.5 pl-5">
          {isIncome
            ? "Closing balance"
            : `${settings.allocations[account.key]}% of income`}
        </div>
      </td>

      {/* Month cells — show closing balance */}
      {results.map((r, i) => {
        const val = r.closingBalances[account.key];
        const isNeg = val < 0;
        const isYear2Start = i === 12;
        return (
          <td
            key={i}
            className={`px-3 py-2.5 text-right border-b border-border font-semibold ${
              isYear2Start ? "year-divider border-l-2" : ""
            }`}
            style={{
              color: isNeg ? "#b04040" : account.colorHex,
            }}
          >
            {formatCurrency(val)}
          </td>
        );
      })}
    </tr>
  );
}

// ── Detail Row ────────────────────────────────────────────────

function DetailRow({
  label,
  account,
  values,
  editable,
  isSubRow,
  rowType,
  isBold,
  onEdit,
  editValues,
}: {
  label: string;
  account: (typeof ACCOUNT_CONFIGS)[0];
  values: number[];
  editable: boolean;
  isSubRow: boolean;
  rowType: RowType;
  isBold?: boolean;
  onEdit?: (monthIndex: number, value: number) => void;
  editValues?: number[];
}) {
  const bgMap: Record<RowType, string> = {
    opening: "bg-muted/20",
    allocation: "bg-white",
    withdrawal: "bg-white",
    closing: "bg-muted/30",
  };

  return (
    <tr className={`${bgMap[rowType]} hover:bg-muted/40 transition-colors`}>
      {/* Frozen label */}
      <td
        className={`sticky-col px-4 py-2 border-b border-border/50 ${bgMap[rowType]}`}
        style={{ borderLeftColor: account.colorHex + "60" }}
      >
        <span
          className={`text-xs pl-5 ${
            isBold
              ? "font-semibold text-foreground"
              : "text-muted-foreground"
          }`}
        >
          {label}
        </span>
      </td>

      {/* Month cells */}
      {values.map((val, i) => {
        const isNeg = val < 0;
        const isYear2Start = i === 12;
        const textColor =
          rowType === "withdrawal"
            ? "#b04040"
            : isNeg
            ? "#b04040"
            : rowType === "closing"
            ? account.colorHex
            : "inherit";

        return (
          <td
            key={i}
            className={`px-2 py-2 text-right border-b border-border/50 ${
              isYear2Start ? "year-divider border-l-2" : ""
            }`}
            style={{ color: textColor }}
          >
            {editable && onEdit ? (
              <EditableCell
                value={editValues?.[i] ?? val}
                displayValue={val}
                onChange={(v) => onEdit(i, v)}
                isWithdrawal={rowType === "withdrawal"}
              />
            ) : (
              <span
                className={`text-xs ${isBold ? "font-semibold" : "font-normal"}`}
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {rowType === "withdrawal" && val !== 0
                  ? `(${formatCurrency(val).replace(/^\(|\)$/g, "")})`
                  : formatCurrency(val)}
              </span>
            )}
          </td>
        );
      })}
    </tr>
  );
}

// ── Editable Cell ─────────────────────────────────────────────

function EditableCell({
  value,
  displayValue,
  onChange,
  isWithdrawal,
}: {
  value: number;
  displayValue: number;
  onChange: (v: number) => void;
  isWithdrawal: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState("");

  const handleClick = () => {
    setEditing(true);
    setLocalValue(value === 0 ? "" : formatCurrencyInput(value));
  };

  const handleBlur = () => {
    setEditing(false);
    const parsed = parseCurrencyInput(localValue);
    onChange(parsed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      handleBlur();
    }
    if (e.key === "Escape") {
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="w-full text-right text-xs bg-primary/10 border border-primary/30 rounded px-1 py-0.5 outline-none"
        style={{ fontVariantNumeric: "tabular-nums", minWidth: 70 }}
        placeholder="0"
      />
    );
  }

  return (
    <button
      onClick={handleClick}
      className="w-full text-right text-xs hover:bg-primary/10 rounded px-1 py-0.5 transition-colors group"
      style={{ fontVariantNumeric: "tabular-nums" }}
    >
      <span className={value === 0 ? "text-muted-foreground/40" : ""}>
        {value === 0
          ? "—"
          : isWithdrawal
          ? `(${formatCurrency(value).replace(/^\(|\)$/g, "")})`
          : formatCurrency(value)}
      </span>
      <span className="text-primary/0 group-hover:text-primary/40 text-[10px] ml-0.5">✎</span>
    </button>
  );
}

// ── Total Row ─────────────────────────────────────────────────

function TotalRow({
  results,
  settings,
}: {
  results: MonthResult[];
  settings: ProjectionSettings;
}) {
  return (
    <tr className="bg-foreground/5 border-t-2 border-foreground/20">
      <td
        className="sticky-col px-4 py-3 border-b border-border font-bold text-sm bg-foreground/5"
        style={{ borderLeft: "3px solid #1C1C1E" }}
      >
        Total Cash
      </td>
      {results.map((r, i) => {
        const total = totalBalance(r.closingBalances);
        const isNeg = total < 0;
        const isYear2Start = i === 12;
        return (
          <td
            key={i}
            className={`px-3 py-3 text-right border-b border-border font-bold text-sm ${
              isYear2Start ? "year-divider border-l-2" : ""
            }`}
            style={{
              color: isNeg ? "#b04040" : "#1C1C1E",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {formatCurrency(total)}
          </td>
        );
      })}
    </tr>
  );
}

// ── Bulk Income Input ─────────────────────────────────────────

function BulkIncomeInput({ onBulkSet }: { onBulkSet: (v: number) => void }) {
  const [value, setValue] = useState("");

  const handleApply = () => {
    const parsed = parseCurrencyInput(value);
    if (parsed > 0) {
      onBulkSet(parsed);
      setValue("");
    }
  };

  return (
    <div className="flex items-center gap-1">
      <div className="relative">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">$</span>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleApply()}
          placeholder="e.g. 50000"
          className="h-7 text-xs pl-5 pr-2 w-32 border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary/40"
          style={{ fontVariantNumeric: "tabular-nums" }}
        />
      </div>
      <button
        onClick={handleApply}
        className="h-7 px-2.5 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
      >
        Apply
      </button>
    </div>
  );
}
