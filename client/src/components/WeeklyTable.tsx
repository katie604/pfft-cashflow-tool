// ============================================================
// 13-Week Cash Flow Table — same look & feel as the monthly
// Profit First table: collapsible account groups, colour chips,
// account-coloured closing balances. Built from live invoices
// & bills (per-account money-out categorised from Xero).
// ============================================================

import { Fragment, createContext, useContext, useEffect, useRef, useState } from "react";
import {
  WeeklyData,
  WeekRow,
  AccountWeekRow,
  RecurringLine,
  ActualTransfer,
  MonthlyBill,
  WiseWeekRow,
  buildWiseWeeks,
  isoLocal,
  weekCommencing,
  NowBalances,
  BasPayment,
  buildWeeks,
  buildAccountWeeks,
  WeeklyItem,
  shareOfIncome,
  incomeNeeded,
} from "@/lib/weekly";
import {
  formatCurrency,
  ACCOUNT_CONFIGS,
  ACCOUNT_KEYS,
  AccountKey,
  AccountBalances,
} from "@/lib/cashflow";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useBasPayments } from "@/hooks/useBasPayments";
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
  /** Weekly What-If (Katie, 16 Oct 2026): this same table, with play percentages,
   *  expenses you add, and how much more income stops an account going red. */
  whatIf?: {
    addItem: (item: Omit<WeeklyItem, "id" | "source">) => void;
    deleteItem: (id: string) => void;
  };
}

/** True on the What-If: the real entries (income estimates, wages, BAS) show but
 *  cannot be changed there, so a play never writes to the real files. */
const ReadOnlyCtx = createContext(false);

/** The accounts the Profit First % split Real Revenue between - must total 100%. */
const REAL_REV_KEYS: AccountKey[] = ["profit", "ownersPay", "tax", "opex"];
const SHORT: Partial<Record<AccountKey, string>> = {
  bas: "BAS", materials: "Materials", profit: "Profit", ownersPay: "Owner's Pay", tax: "Tax", opex: "OpEx",
};

/** Income in - type an estimate into any week that has no actual yet
 *  (Katie, 16 Oct 2026). Saved per business, by the week's Monday. */
function IncomeInRow({
  account,
  rows,
  onSet,
}: {
  account: (typeof ACCOUNT_CONFIGS)[number];
  rows: AccountWeekRow[];
  onSet: (weekIso: string, amount: number) => void;
}) {
  return (
    <tr className="bg-white hover:bg-muted/40 transition-colors">
      <td className="sticky-col px-4 py-2 border-b border-border/50 bg-white" style={{ borderLeftColor: account.colorHex + "60" }}>
        <span className="text-xs pl-5 text-muted-foreground">Income in</span>
        <div className="text-[10px] pl-5 text-muted-foreground/60">click a week to type the estimate</div>
      </td>
      {rows.map((r) =>
        r.actual ? (
          <td key={r.week} className="px-2 py-2 text-right border-b border-border/50 font-semibold" title="Actual">
            {cell(r.moneyIn)}
          </td>
        ) : (
          <RecurringCell
            key={r.week}
            value={r.moneyIn}
            color={IN}
            onSet={(v) => onSet(isoLocal(r.weekCommencing), v)}
          />
        )
      )}
    </tr>
  );
}

/** Katie's per-week income estimates, from the helper's file. */
export function useIncomeEstimates(): [
  Record<string, number>,
  (weekIso: string, amount: number) => void,
  number,
  NowBalances | null,
] {
  const [est, setEst] = useState<Record<string, number>>({});
  const [feePct, setFeePct] = useState(0);
  const [nowBal, setNowBal] = useState<NowBalances | null>(null);
  const tenant = () => {
    try {
      return localStorage.getItem("kcc-tenant") || localStorage.getItem("pfft-pf-alloc-xero-tenant") || "";
    } catch {
      return "";
    }
  };
  useEffect(() => {
    const t = tenant();
    if (!t) return;
    fetch(`http://127.0.0.1:8765/api/income?tenant=${encodeURIComponent(t)}`)
      .then((r) => r.json())
      .then((d) => {
        setEst(d?.income ?? {});
        setFeePct(Number(d?.feePct ?? 0));
        setNowBal((d?.now ?? null) as NowBalances | null);
      })
      .catch(() => {
        /* helper not running */
      });
  }, []);
  const save = (weekIso: string, amount: number) => {
    setEst((prev) => {
      const next = { ...prev };
      if (amount > 0) next[weekIso] = amount;
      else delete next[weekIso];
      return next;
    });
    const t = tenant();
    if (t)
      fetch("http://127.0.0.1:8765/api/income", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ tenant: t, week: weekIso, amount }),
      }).catch(() => {
        /* helper not running */
      });
  };
  return [est, save, feePct, nowBal];
}

/** The Team heading: a dropdown showing the weekly team total, click to open. */
function TeamHeaderRow({
  numWeeks,
  color,
  open,
  onToggle,
  totalFor,
}: {
  numWeeks: number;
  color: string;
  open: boolean;
  onToggle: () => void;
  totalFor: (week: number) => number;
}) {
  return (
    <tr className="bg-white hover:bg-muted/40 cursor-pointer" onClick={onToggle}>
      <td className="sticky-col px-4 py-2 border-b border-border/50 bg-white" style={{ borderLeftColor: color + "60" }}>
        <span className="flex items-center gap-1 pl-5 text-[11px] font-bold uppercase tracking-wide" style={{ color }}>
          Team
          {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </span>
      </td>
      {Array.from({ length: numWeeks }, (_, w) => (
        <td key={w} className="px-2 py-2 text-right border-b border-border/50 font-semibold" style={{ color: OUT }}>
          {cell(totalFor(w))}
        </td>
      ))}
    </tr>
  );
}

/** A heading row inside an account (e.g. "Team", "Bills"). */
function SectionRow({ label, numWeeks, color }: { label: string; numWeeks: number; color: string }) {
  return (
    <tr className="bg-white">
      <td
        className="sticky-col px-4 pt-3 pb-1 border-b border-border/50 bg-white"
        style={{ borderLeftColor: color + "60" }}
      >
        <span className="text-[11px] font-bold uppercase tracking-wide pl-5" style={{ color }}>
          {label}
        </span>
      </td>
      <td colSpan={numWeeks} className="border-b border-border/50" />
    </tr>
  );
}

/** Wise - its own account under OpEx (Katie, 16 Oct 2026). OpEx transfers in;
 *  the regular monthly subscriptions go out, each on its usual day. */
function WiseBlock({
  account,
  rows,
  bills,
  open,
  onToggle,
  numWeeks,
}: {
  account: (typeof ACCOUNT_CONFIGS)[number];
  rows: WiseWeekRow[];
  bills: MonthlyBill[];
  open: boolean;
  onToggle: () => void;
  numWeeks: number;
}) {
  const wise = { ...account, label: "Wise" };
  return (
    <>
      <tr className="hover:bg-muted/30 transition-colors" style={{ backgroundColor: account.colorHex + "05" }}>
        <td
          className="sticky-col px-4 py-2.5 border-b border-border bg-white cursor-pointer select-none"
          style={{ borderLeft: `3px dashed ${account.colorHex}` }}
          onClick={onToggle}
        >
          <div className="flex items-center gap-2 pl-4">
            <span className="font-semibold text-sm truncate">Wise</span>
            {open ? (
              <ChevronUp className="h-3.5 w-3.5 text-muted-foreground ml-auto shrink-0" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-auto shrink-0" />
            )}
          </div>
          <div className="text-xs text-muted-foreground/60 mt-0.5 pl-4">under OpEx - pays the subscriptions</div>
        </td>
        {rows.map((r) => (
          <td
            key={r.week}
            className="px-3 py-2.5 text-right border-b border-border font-semibold"
            style={{ color: r.closing < 0 ? OUT : account.colorHex }}
          >
            {formatCurrency(r.closing)}
          </td>
        ))}
      </tr>
      {open && (
        <>
          <DetailRow account={wise} label="Opening" rows={rows} pick={(r) => r.opening} rowType="opening" />
          <DetailRow account={wise} label="Moved in: OpEx" rows={rows} pick={(r) => r.transfersIn} rowType="allocation" />
          <SectionRow label="Bills" numWeeks={numWeeks} color={account.colorHex} />
          {bills.map((b) => (
            <DetailRow
              key={b.id}
              account={wise}
              label={b.name}
              rows={rows}
              pick={(r) => (r as WiseWeekRow).billLines[b.id] ?? 0}
              rowType="withdrawal"
            />
          ))}
          {!bills.length && (
            <tr>
              <td className="sticky-col px-4 py-2 text-xs text-muted-foreground pl-9 bg-white">No regular bills set</td>
              <td colSpan={numWeeks} />
            </tr>
          )}
          <DetailRow account={wise} label="Net movement" rows={rows} pick={(r) => r.net} rowType="allocation" />
          <DetailRow account={wise} label="Closing balance" rows={rows} pick={(r) => r.closing} rowType="closing" isBold />
        </>
      )}
    </>
  );
}

/** This business's regular monthly bills, from the helper's file. */
export function useMonthlyBills(): MonthlyBill[] {
  const [bills, setBills] = useState<MonthlyBill[]>([]);
  useEffect(() => {
    let t = "";
    try {
      t = localStorage.getItem("kcc-tenant") || localStorage.getItem("pfft-pf-alloc-xero-tenant") || "";
    } catch {
      /* ignore */
    }
    if (!t) return;
    fetch(`http://127.0.0.1:8765/api/bills?tenant=${encodeURIComponent(t)}`)
      .then((r) => r.json())
      .then((d) => setBills((d?.bills ?? []) as MonthlyBill[]))
      .catch(() => {
        /* helper not running */
      });
  }, []);
  return bills;
}

/** The actual transfers for the business on screen, from the file the helper keeps
 *  (~/.config/cash-compass/actual_transfers.json) so the dev page and the double-click
 *  file agree. Re-read when the Allocation Calculator saves new ones, and on focus. */
export function useActualTransfers(): ActualTransfer[] {
  const [list, setList] = useState<ActualTransfer[]>([]);
  useEffect(() => {
    const refresh = () => {
      let t = "";
      try {
        t = localStorage.getItem("kcc-tenant") || localStorage.getItem("pfft-pf-alloc-xero-tenant") || "";
      } catch {
        /* ignore */
      }
      fetch(`http://127.0.0.1:8765/api/actuals?tenant=${encodeURIComponent(t)}`)
        .then((r) => r.json())
        .then((d) => setList((d?.actuals ?? []) as ActualTransfer[]))
        .catch(() => {
          /* helper not running - leave the forecast showing */
        });
    };
    refresh();
    window.addEventListener("storage", refresh); // the calculator pings kcc-actuals-saved
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  return list;
}

/** BAS due dates and amounts - Katie types both (16 Oct 2026). Saved per business. */
function BasDueEditor({
  numWeeks,
  color,
  payments,
  onSave,
}: {
  numWeeks: number;
  color: string;
  payments: BasPayment[];
  onSave: (next: BasPayment[]) => void;
}) {
  // Katie, 16 Oct 2026: an amount typed and then Enter / a tab switch never saved,
  // because it only saved when the box lost focus. Now it saves as you type.
  const latest = useRef(payments);
  latest.current = payments;
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const setOne = (id: string, patch: Partial<BasPayment>) =>
    onSave(latest.current.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const soon = (id: string, patch: Partial<BasPayment>) => {
    clearTimeout(timers.current[id]);
    timers.current[id] = setTimeout(() => setOne(id, patch), 500);
  };
  const enterSaves = (e: React.KeyboardEvent<HTMLInputElement>) =>
    e.key === "Enter" && (e.target as HTMLInputElement).blur();
  return (
    <tr className="bg-white">
      <td colSpan={numWeeks + 1} className="px-4 py-2 border-b border-border/50" style={{ borderLeft: `3px solid ${color}60` }}>
        <div className="pl-5 text-[11px] text-muted-foreground mb-1.5">
          BAS due dates and amounts - type the amount once you know it
        </div>
        <div className="pl-5 flex flex-wrap gap-3">
          {payments.map((p) => (
            <div key={p.id} className="bas-due flex items-center gap-1.5 text-xs border border-border rounded-md px-2 py-1">
              {p.label && <span className="font-medium" style={{ color }}>{p.label}</span>}
              <input
                type="date"
                defaultValue={p.due}
                onChange={(e) => e.target.value && e.target.value !== p.due && soon(p.id + "-due", { due: e.target.value })}
                onBlur={(e) => e.target.value && e.target.value !== p.due && setOne(p.id, { due: e.target.value })}
                onKeyDown={enterSaves}
                className="h-6 text-xs border border-border rounded px-1"
              />
              <span className="text-muted-foreground">$</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="amount"
                defaultValue={p.amount ? formatCurrencyInput(p.amount) : ""}
                onChange={(e) => {
                  const v = Math.round(parseCurrencyInput(e.target.value) * 100) / 100;
                  if (v >= 0) soon(p.id, { amount: v });
                }}
                onBlur={(e) => {
                  const v = Math.round(parseCurrencyInput(e.target.value) * 100) / 100;
                  clearTimeout(timers.current[p.id]);
                  if (v >= 0 && v !== p.amount) setOne(p.id, { amount: v });
                }}
                onKeyDown={enterSaves}
                className="h-6 w-24 text-xs text-right border border-border rounded px-1"
              />
              <button
                onClick={() => onSave(payments.filter((x) => x.id !== p.id))}
                className="text-muted-foreground hover:text-red-600 px-0.5"
                title="Remove this BAS payment"
              >
                ×
              </button>
            </div>
          ))}
          <button
            onClick={() => {
              const d = new Date();
              onSave([...payments, { id: `bas-${Date.now()}`, label: "", due: isoLocal(d), amount: 0 }]);
            }}
            className="text-xs text-primary hover:underline"
          >
            + add a BAS payment
          </button>
        </div>
      </td>
    </tr>
  );
}

function cell(v: number) {
  return v === 0 ? "–" : formatCurrency(v);
}

export default function WeeklyTable({
  weekly,
  allocations: realAllocations,
  onSetIncome,
  onSetRecurring,
  whatIf,
}: Props) {
  const isWhatIf = !!whatIf;
  // What-If percentages: start from the real ones, never saved anywhere.
  const [playAlloc, setPlayAlloc] = useState<AccountBalances | null>(null);
  const allocations = isWhatIf && playAlloc ? playAlloc : realAllocations;
  const whatIfItems = isWhatIf
    ? weekly.items.filter((it) => it.type === "out" && it.source === "manual" && !!it.account)
    : [];
  // What-If income (Katie, 16 Oct 2026): an increase on top of every week from
  // week 1 ("what if we increase income by 500 from now on"), and one-offs.
  const [playWeekly, setPlayWeekly] = useState<number | null>(null);
  const whatIfIncome = isWhatIf
    ? weekly.items.filter((it) => it.type === "in" && it.source === "manual" && it.account === "income")
    : [];
  const [numWeeks, setNumWeeks] = useState(13);
  const [mode, setMode] = useState<"accounts" | "total">("accounts");
  const [expanded, setExpanded] = useState<Set<AccountKey>>(
    () => new Set<AccountKey>(["income"])
  );

  const override = weekly.incomeOverride ?? 0;
  const recurringLines = weekly.recurringLines ?? [];
  const [realEstimates, setEstimate, feePct, nowBal] = useIncomeEstimates();
  // On the What-If, the week's income = the play weekly figure (or the real
  // estimate, or the invoices) plus any one-off income added there.
  let estimates = realEstimates;
  if (isWhatIf && (playWeekly !== null || whatIfIncome.length)) {
    estimates = { ...realEstimates };
    for (let w = 0; w < numWeeks; w++) {
      const iso = isoLocal(weekCommencing(weekly.weekStart, w));
      const invoices = weekly.items
        .filter((it) => it.type === "in" && !it.account && it.week === w)
        .reduce((t, it) => t + it.amount, 0);
      const base =
        (realEstimates[iso] ?? (override > 0 ? override : invoices)) + (playWeekly !== null && w >= 1 ? playWeekly : 0);
      const extra = whatIfIncome.filter((it) => it.week === w).reduce((t, it) => t + it.amount, 0);
      estimates[iso] = Math.round((base + extra) * 100) / 100;
    }
  }
  const toOpen = new Set([...(weekly.accountsToOpen ?? []), ...(nowBal?.toOpen ?? [])]);
  const rows = buildWeeks(weekly, numWeeks, override);
  const actuals = useActualTransfers();
  // In the "still to go" week a line shows what is left to pay, or "paid".
  const paidWeeks = (ar: AccountWeekRow[], acctKey: string, lineId: string) => {
    const w0 = ar.find((r) => r.stillToGo);
    if (!w0 || !nowBal) return undefined;
    const rem = nowBal.remaining[acctKey] ?? {};
    return { [w0.week]: rem[lineId] !== undefined ? Number(rem[lineId]) : null } as Record<number, number | null>;
  };
  const monthlyBills = useMonthlyBills();
  const [basPayments, saveBasPayments] = useBasPayments();
  const wiseRows = buildWiseWeeks(weekly, numWeeks, recurringLines, monthlyBills, nowBal);
  const [wiseOpen, setWiseOpen] = useState(true);
  const [teamOpen, setTeamOpen] = useState(false); // Team is a dropdown (Katie, 16 Oct 2026)
  const accountRows = buildAccountWeeks(
    weekly,
    numWeeks,
    allocations,
    override,
    recurringLines,
    actuals,
    estimates,
    feePct,
    nowBal,
    basPayments,
    whatIfItems
  );
  const share = shareOfIncome(allocations, feePct);
  const hasItems = weekly.items.length > 0 || override > 0;
  // Katie, 16 Oct 2026: balances and running totals all calculate off the accounts
  // (and Wise). Money in = new income; money out = what actually leaves the
  // business. Moves between her own accounts (PAYG, super, Wise) net to zero.
  let cumIn = 0;
  let cumOut = 0;
  const totals: WeekRow[] = rows.map((base, w) => {
    const all = ACCOUNT_KEYS.map((k) => accountRows[k][w]);
    const wr = wiseRows[w];
    const opening = Math.round((all.reduce((t, r) => t + r.opening, 0) + (wr?.opening ?? 0)) * 100) / 100;
    const closing = Math.round((all.reduce((t, r) => t + r.closing, 0) + (wr?.closing ?? 0)) * 100) / 100;
    const net = Math.round((closing - opening) * 100) / 100;
    // In the "still to go" week the income is already inside the bank balances.
    const moneyIn = all.some((r) => r.stillToGo) ? 0 : accountRows.income[w].moneyIn;
    const moneyOut = Math.round((moneyIn - net) * 100) / 100;
    cumIn += moneyIn;
    cumOut += moneyOut;
    return { ...base, opening, closing, net, moneyIn, moneyOut, cumulativeIn: cumIn, cumulativeOut: cumOut };
  });

  const toggle = (k: AccountKey) =>
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  const expandAll = () => setExpanded(new Set(ACCOUNT_CONFIGS.map((a) => a.key)));
  const collapseAll = () => setExpanded(new Set());

  const realRevTotal = Math.round(REAL_REV_KEYS.reduce((t, k) => t + Number(allocations[k] || 0), 0) * 100) / 100;

  return (
    <ReadOnlyCtx.Provider value={isWhatIf}>
    <div className="flex flex-col h-full bg-background">
      {isWhatIf && (
        <WhatIfBar
          allocations={allocations}
          realAllocations={realAllocations}
          changed={!!playAlloc || playWeekly !== null}
          playWeekly={playWeekly}
          onSetWeekly={setPlayWeekly}
          total={realRevTotal}
          onSet={(k, v) => setPlayAlloc({ ...allocations, [k]: v })}
          onReset={() => {
            setPlayAlloc(null);
            setPlayWeekly(null);
          }}
          numWeeks={numWeeks}
          weekLabel={(w) => (w === 0 ? "This week" : `Wk ${w} - ` + rows[w]?.weekCommencing.toLocaleDateString("en-AU", { day: "numeric", month: "short" }))}
          onAdd={(name, amount, week, account) => {
            whatIf!.addItem({ type: account === "income" ? "in" : "out", name, amount, week, account });
            setExpanded((prev) => new Set(prev).add(account as AccountKey));
          }}
        />
      )}
      {/* Control bar */}
      <div className="flex items-center gap-4 px-4 py-2.5 bg-white border-b border-border flex-wrap shrink-0">
        <span className="text-sm font-semibold" style={{ color: NAVY }}>
          {numWeeks}-Week {isWhatIf ? "What-If" : "Cash Flow"}
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

        {!isWhatIf && <div className="flex items-center gap-2">
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
        </div>}

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
                        {isWhatIf && !isIncome && !isToOpen && ar.some((r) => r.closing < 0) && (() => {
                          const n = incomeNeeded(ar, share[account.key] ?? 0);
                          return (
                            <div className="wi-need text-[11px] font-semibold mt-0.5 pl-5" style={{ color: OUT }}>
                              {n === null ? "more income won't fix this" : n > 0 ? `needs ${formatCurrency(n)} more income a week` : "red this week only"}
                            </div>
                          );
                        })()}
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
                        {isIncome ? (
                          <>
                            <IncomeInRow account={acct} rows={ar} onSet={setEstimate} />
                            {whatIfIncome.map((it) => (
                              <WhatIfRow key={it.id} account={acct} item={it} numWeeks={numWeeks} onDelete={() => whatIf!.deleteItem(it.id)} />
                            ))}
                            {ar.some((r) => (r.fee ?? 0) > 0) && (
                              <DetailRow
                                account={acct}
                                label={`Stripe fee (${feePct}%)`}
                                rows={ar}
                                pick={(r) => r.fee ?? 0}
                                rowType="withdrawal"
                              />
                            )}
                          </>
                        ) : (
                          <DetailRow
                            account={acct}
                            label="Allocation in"
                            rows={ar}
                            pick={(r) => r.moneyIn}
                            rowType="allocation"
                            compare
                          />
                        )}
                        {isIncome && ar.some((r) => r.allocOut > 0) && (
                          <DetailRow account={acct} label="Allocated out" rows={ar} pick={(r) => r.allocOut} rowType="withdrawal" compare />
                        )}
                        {/* One row per line moved in (e.g. PAYG-Katie, Team PAYG into BAS). */}
                        {recurringLines
                          .filter((l) => (l.toAccount ?? "") === account.key && l.weeklyAmount > 0)
                          .map((l) => (
                            <Fragment key={"in-" + l.id}>
                              <DetailRow
                                account={acct}
                                label={l.inLabel ?? `Moved in: ${l.label}`}
                                rows={ar}
                                pick={(r) => (r.stillToGo ? 0 : l.weeklyAmount)}
                                rowType="allocation"
                              />
                              {recurringLines
                                .filter((o) => o.afterId === l.id && o.account === account.key)
                                .map((o) => (
                                  <RecurringRow key={o.id} account={acct} line={o} numWeeks={numWeeks} onSet={onSetRecurring}
                                    paid={paidWeeks(ar, account.key, o.id)} />
                                ))}
                            </Fragment>
                          ))}
                        {ar.some((r) => r.bills > 0) && (
                          <DetailRow account={acct} label="Bills (Xero)" rows={ar} pick={(r) => r.bills} rowType="withdrawal" />
                        )}
                        {account.key === "bas" && (
                          <>
                            <DetailRow account={acct} label="Paid to ATO (BAS)" rows={ar} pick={(r) => r.basPaid ?? 0} rowType="withdrawal" />
                            {!isWhatIf && (
                              <BasDueEditor numWeeks={numWeeks} color={acct.colorHex} payments={basPayments} onSave={saveBasPayments} />
                            )}
                          </>
                        )}
                        {/* Katie, 16 Oct 2026: team wages, PAYG and super under their own heading. */}
                        {recurringLines.some((l) => l.account === account.key && l.id.startsWith("team-")) && (
                          <TeamHeaderRow
                            numWeeks={numWeeks}
                            color={acct.colorHex}
                            open={teamOpen}
                            onToggle={() => setTeamOpen(!teamOpen)}
                            totalFor={(w) => {
                              const team = recurringLines.filter((l) => l.account === account.key && l.id.startsWith("team-"));
                              const r = ar[w];
                              if (r?.stillToGo && nowBal) {
                                const rem = nowBal.remaining[account.key] ?? {};
                                return team.reduce((t, l) => t + Number(rem[l.id] ?? 0), 0);
                              }
                              return team.reduce((t, l) => t + l.weeklyAmount, 0);
                            }}
                          />
                        )}
                        {[
                          ...(teamOpen
                            ? [
                                ...recurringLines.filter((l) => l.account === account.key && l.id.startsWith("team-wage")),
                                ...recurringLines.filter(
                                  (l) => l.account === account.key && l.id.startsWith("team-") && !l.id.startsWith("team-wage")
                                ),
                              ]
                            : []),
                          ...recurringLines.filter((l) => l.account === account.key && !l.id.startsWith("team-") && !l.afterId),
                        ].map((line) => (
                            <RecurringRow
                              key={line.id}
                              account={acct}
                              line={line}
                              numWeeks={numWeeks}
                              onSet={onSetRecurring}
                              paid={paidWeeks(ar, account.key, line.id)}
                            />
                          ))}
                        {whatIfItems
                          .filter((it) => it.account === account.key)
                          .map((it) => (
                            <WhatIfRow key={it.id} account={acct} item={it} numWeeks={numWeeks} onDelete={() => whatIf!.deleteItem(it.id)} />
                          ))}
                        <DetailRow account={acct} label="Net movement" rows={ar} pick={(r) => r.net} rowType="allocation" />
                        <DetailRow account={acct} label="Closing balance" rows={ar} pick={(r) => r.closing} rowType="closing" isBold />
                      </>
                    )}
                    {account.key === "opex" && (
                      <WiseBlock
                        account={acct}
                        rows={wiseRows}
                        bills={monthlyBills}
                        open={wiseOpen}
                        onToggle={() => setWiseOpen(!wiseOpen)}
                        numWeeks={numWeeks}
                      />
                    )}
                  </Fragment>
                );
              })}
              <TotalRow
                label="Total Cash"
                rows={totals}
                pick={(r) => r.closing}
                color={NAVY}
                bold
                dangerNegative
              />
              </>
            ) : (
              <>
                <TotalRow label="Opening" rows={totals} pick={(r) => r.opening} color={NAVY} />
                <TotalRow label="Money in" rows={totals} pick={(r) => r.moneyIn} color={IN} />
                <TotalRow label="Money out" rows={totals} pick={(r) => r.moneyOut} color={OUT} />
                <TotalRow label="Net movement" rows={totals} pick={(r) => r.net} color={NAVY} signed />
                <TotalRow label="Closing balance" rows={totals} pick={(r) => r.closing} color={NAVY} bold dangerNegative />
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
    </ReadOnlyCtx.Provider>
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
  paid,
}: {
  account: (typeof ACCOUNT_CONFIGS)[number];
  line: RecurringLine;
  numWeeks: number;
  onSet: (id: string, amount: number) => void;
  /** week -> amount still to go, or null = already paid that week. */
  paid?: Record<number, number | null>;
}) {
  return (
    <tr className="bg-white hover:bg-muted/40 transition-colors">
      <td
        className="sticky-col px-4 py-2 border-b border-border/50 bg-white"
        style={{ borderLeftColor: account.colorHex + "60" }}
      >
        <span className="text-xs pl-5 text-muted-foreground italic">
          {line.label}
          {line.toAccount && !(line.toAccount === "wise" && /wise/i.test(line.label)) && (
            <span className="not-italic"> &rarr; {ACCOUNT_CONFIGS.find((a) => a.key === line.toAccount)?.label ?? (line.toAccount === "wise" ? "Wise" : line.toAccount)}</span>
          )}
        </span>
      </td>
      {Array.from({ length: numWeeks }, (_, w) =>
        paid && w in paid ? (
          <td key={w} className="px-2 py-2 text-right border-b border-border/50 text-xs"
              style={{ color: paid[w] === null ? GREY : OUT }}
              title={paid[w] === null ? "Already gone out this week" : "Still to go this week"}>
            {paid[w] === null ? "paid" : cell(paid[w] as number)}
          </td>
        ) : (
          <RecurringCell key={w} value={line.weeklyAmount} onSet={(v) => onSet(line.id, v)} />
        )
      )}
    </tr>
  );
}

function RecurringCell({
  value,
  onSet,
  color = OUT,
}: {
  value: number;
  onSet: (v: number) => void;
  color?: string;
}) {
  const [editing, setEditing] = useState(false);
  const readOnly = useContext(ReadOnlyCtx);
  if (readOnly) {
    return (
      <td className="px-2 py-2 text-right border-b border-border/50" style={{ color: value ? color : undefined }}
          title="Change this on the cash flow table">
        {value ? formatCurrency(value) : "–"}
      </td>
    );
  }
  if (editing) {
    return (
      <td className="px-1 py-1 border-b border-border/50">
        <input
          autoFocus
          defaultValue={value ? String(Math.round(value * 100) / 100) : ""}
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
      style={{ color: value ? color : undefined }}
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


// ── Weekly What-If pieces (Katie, 16 Oct 2026) ──

/** Play percentages, Reset, and add an expense. Nothing here is saved. */
function WhatIfBar({
  allocations,
  realAllocations,
  changed,
  playWeekly,
  onSetWeekly,
  total,
  onSet,
  onReset,
  numWeeks,
  weekLabel,
  onAdd,
}: {
  allocations: AccountBalances;
  realAllocations: AccountBalances;
  changed: boolean;
  playWeekly: number | null;
  onSetWeekly: (v: number | null) => void;
  total: number;
  onSet: (k: AccountKey, v: number) => void;
  onReset: () => void;
  numWeeks: number;
  weekLabel: (w: number) => string;
  onAdd: (name: string, amount: number, week: number, account: string) => void;
}) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [week, setWeek] = useState(1);
  const [account, setAccount] = useState<string>("opex");
  const [kind, setKind] = useState<"out" | "in">("out");
  const add = () => {
    const amt = Math.round(parseCurrencyInput(amount) * 100) / 100;
    if (!amt || amt < 0) return;
    onAdd(name.trim() || (kind === "in" ? "Income" : "Expense"), amt, week, kind === "in" ? "income" : account);
    setName("");
    setAmount("");
  };
  const keys: AccountKey[] = ["bas", "materials", ...REAL_REV_KEYS];
  return (
    <div className="wi-bar px-4 py-2 bg-[#E9EEF6] border-b border-border text-xs space-y-2 shrink-0">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="font-semibold" style={{ color: NAVY }}>Play with the %</span>
        {keys.map((k) => {
          const cfg = ACCOUNT_CONFIGS.find((a) => a.key === k)!;
          const moved = Number(allocations[k]) !== Number(realAllocations[k]);
          return (
            <label key={k} className="flex items-center gap-1">
              <span className="text-muted-foreground">{SHORT[k] ?? cfg.label}</span>
              <input
                key={`${k}-${realAllocations[k]}-${changed}`}
                data-pct={k}
                defaultValue={String(allocations[k])}
                inputMode="decimal"
                onBlur={(e) => {
                  const v = parseFloat(e.target.value);
                  if (!isNaN(v) && v >= 0 && v <= 100 && v !== Number(allocations[k])) onSet(k, v);
                }}
                onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                className="w-12 text-right bg-white border rounded px-1 py-0.5"
                style={{ borderColor: moved ? NAVY : undefined, fontWeight: moved ? 700 : 400 }}
              />
              <span className="text-muted-foreground">%</span>
            </label>
          );
        })}
        <span className="wi-total font-semibold" style={{ color: Math.abs(total - 100) < 0.001 ? IN : OUT }}>
          Profit + Owner's Pay + Tax + OpEx = {total}%{Math.abs(total - 100) < 0.001 ? "" : " - needs to be 100%"}
        </span>
        {/* Katie, 16 Oct 2026: a proper button so it is easy to see. Always there;
            greyed until something has been changed. */}
        <button
          onClick={onReset}
          disabled={!changed}
          className="wi-reset px-3 py-1 rounded-md font-semibold text-white shadow-sm"
          style={{ backgroundColor: changed ? NAVY : GREY, cursor: changed ? "pointer" : "default" }}
          title={changed ? "Put back your real % and take off the income increase" : "Nothing changed yet"}
        >
          Reset to my real %
        </button>
        <span className="text-muted-foreground ml-auto">A play only - nothing here is saved or changes the cash flow table.</span>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-semibold" style={{ color: NAVY }}>Increase income by</span>
        <input
          key={`wk-${playWeekly}`}
          data-weekly
          defaultValue={playWeekly !== null ? formatCurrencyInput(playWeekly) : ""}
          placeholder="0.00"
          inputMode="decimal"
          onBlur={(e) => {
            const raw = e.target.value.trim();
            if (!raw) return onSetWeekly(null);
            const v = Math.round(parseCurrencyInput(raw) * 100) / 100;
            if (v >= 0) onSetWeekly(v);
          }}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          className="w-28 text-right bg-white border rounded px-1.5 py-0.5"
          style={{ borderColor: playWeekly !== null ? NAVY : undefined, fontWeight: playWeekly !== null ? 700 : 400 }}
        />
        <span className="text-muted-foreground">a week from week 1, on top of your estimates (inc GST)</span>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-semibold" style={{ color: NAVY }}>Add</span>
        <div className="inline-flex rounded border border-border overflow-hidden">
          {([["in", "Income"], ["out", "Expense"]] as const).map(([v, label]) => (
            <button key={v} onClick={() => setKind(v)} data-kind={v}
              className="px-2 py-0.5 border-r border-border last:border-r-0"
              style={kind === v ? { backgroundColor: v === "in" ? IN : OUT, color: "#fff" } : { backgroundColor: "#fff" }}>
              {label}
            </button>
          ))}
        </div>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="What is it"
          className="w-40 bg-white border border-border rounded px-1.5 py-0.5" />
        <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" inputMode="decimal"
          onKeyDown={(e) => e.key === "Enter" && add()}
          className="w-24 text-right bg-white border border-border rounded px-1.5 py-0.5" />
        <select value={week} onChange={(e) => setWeek(Number(e.target.value))}
          className="bg-white border border-border rounded px-1 py-0.5">
          {Array.from({ length: numWeeks }, (_, w) => (
            <option key={w} value={w}>{weekLabel(w)}</option>
          ))}
        </select>
        {kind === "out" ? (
          <select value={account} onChange={(e) => setAccount(e.target.value)}
            className="bg-white border border-border rounded px-1 py-0.5">
            {ACCOUNT_CONFIGS.filter((a) => a.key !== "income").map((a) => (
              <option key={a.key} value={a.key}>Paid from {a.label}</option>
            ))}
          </select>
        ) : (
          <span className="text-muted-foreground">into Income, split by the %</span>
        )}
        <button onClick={add} className="wi-add px-2 py-0.5 rounded text-white" style={{ backgroundColor: NAVY }}>Add</button>
      </div>
    </div>
  );
}

/** One what-if expense, in its week, under the account that pays it. */
function WhatIfRow({
  account,
  item,
  numWeeks,
  onDelete,
}: {
  account: (typeof ACCOUNT_CONFIGS)[number];
  item: WeeklyItem;
  numWeeks: number;
  onDelete: () => void;
}) {
  return (
    <tr className="bg-white hover:bg-muted/40 transition-colors">
      <td className="sticky-col px-4 py-2 border-b border-border/50 bg-white" style={{ borderLeftColor: account.colorHex + "60" }}>
        <span className="text-xs pl-5 italic" style={{ color: item.type === "in" ? IN : OUT }}>What-if: {item.name}</span>
        <button onClick={onDelete} className="ml-2 text-muted-foreground hover:text-red-600" title="Remove this expense">×</button>
      </td>
      {Array.from({ length: numWeeks }, (_, w) => (
        <td key={w} className="px-2 py-2 text-right border-b border-border/50 text-xs" style={{ color: item.type === "in" ? IN : OUT }}>
          {w === item.week ? formatCurrency(item.amount) : "–"}
        </td>
      ))}
    </tr>
  );
}
