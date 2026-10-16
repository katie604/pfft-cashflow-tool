// ============================================================
// Weekly What-If Board
// Each invoice (money in) and bill (money out) sits in the week
// it's due. Drag a card to another week to see the cash impact
// of getting paid sooner / paying bills later. Add hypotheticals.
// ============================================================

import { useState } from "react";
import {
  WeeklyData,
  WeeklyItem,
  buildWeeks,
  daysOverdue,
  buildAccountWeeks,
  buildWiseWeeks,
  shareOfIncome,
  incomeNeeded, lineInWeek
} from "@/lib/weekly";
import {
  formatCurrency,
  parseCurrencyInput,
  ACCOUNT_CONFIGS,
  AccountKey,
  AccountBalances,
} from "@/lib/cashflow";
import {
  Plus,
  X,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useIncomeEstimates, useActualTransfers, useMonthlyBills } from "@/components/WeeklyTable";
import { useBasPayments } from "@/hooks/useBasPayments";
import { Button } from "@/components/ui/button";

const IN = "#2d7a4f";
const OUT = "#b04040";

// Traffic light by due status (same for money in and money out).
const STATUS = { green: "#2d7a4f", orange: "#d97706", red: "#c0392b" };

function statusOf(item: WeeklyItem): { color: string; text: string } {
  const d = daysOverdue(item.dueDate);
  const dateStr = item.dueDate
    ? new Date(item.dueDate + "T00:00:00").toLocaleDateString("en-AU", {
        day: "numeric",
        month: "short",
      })
    : null;
  if (d === null) {
    return item.overdue
      ? { color: STATUS.red, text: "overdue" }
      : { color: STATUS.green, text: dateStr ? `due ${dateStr}` : "" };
  }
  if (d <= 0) {
    return { color: STATUS.green, text: d === 0 ? "due today" : `due ${dateStr}` };
  }
  if (d <= 7) {
    return { color: STATUS.orange, text: `overdue · ${dateStr} (${d}d)` };
  }
  return { color: STATUS.red, text: `overdue · ${dateStr} (${d}d)` };
}

interface Props {
  weekly: WeeklyData;
  allocations: AccountBalances;
  moveItem: (id: string, week: number) => void;
  addItem: (item: Omit<WeeklyItem, "id" | "source">) => void;
  updateItem: (id: string, patch: Partial<WeeklyItem>) => void;
  deleteItem: (id: string) => void;
  setStartingCash: (amount: number) => void;
}

const NAVY = "#1F3D6E";
const GREY = "#9ca3af";
const WISE = { key: "wise", label: "Wise", colorHex: "#1a6f77" };

/**
 * Katie, 16 Oct 2026: the Weekly What-If works per BANK ACCOUNT. Income sits
 * collapsed (the week's total, click for the invoices); each account shows its
 * money in, money out and balance - green when fine, red below $0 - with where
 * the money goes underneath; add an expense to any week and pick the account
 * it is paid from; a red account says how much more income a week stops it.
 * Same starting point and estimates as the cash flow table. What-if expenses
 * only show here - they never change the cash flow table.
 */
export default function WeeklyBoard({
  weekly,
  allocations,
  moveItem,
  addItem,
  updateItem,
  deleteItem,
}: Props) {
  const [numWeeks, setNumWeeks] = useState(13);
  const [dragId, setDragId] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [addingWeek, setAddingWeek] = useState<number | null>(null);
  const toggle = (id: string) =>
    setOpen((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const recurringLines = weekly.recurringLines ?? [];
  const [estimates, , feePct, nowBal] = useIncomeEstimates();
  const actuals = useActualTransfers();
  const monthlyBills = useMonthlyBills();
  const [basPayments] = useBasPayments();
  const whatIf = weekly.items.filter((it) => it.type === "out" && it.source === "manual" && !!it.account);

  const rows = buildWeeks(weekly, numWeeks);
  const acct = buildAccountWeeks(
    weekly, numWeeks, allocations, weekly.incomeOverride ?? 0, recurringLines,
    actuals, estimates, feePct, nowBal, basPayments, whatIf
  );
  const wise = buildWiseWeeks(weekly, numWeeks, recurringLines, monthlyBills, nowBal, whatIf);
  const share = shareOfIncome(allocations, feePct);
  const toOpen = new Set([...(weekly.accountsToOpen ?? []), ...(nowBal?.toOpen ?? [])]);

  // Accounts with nothing in them all period (EBS: Materials at 0%) are left off.
  const shown = ACCOUNT_CONFIGS.filter(
    (a) => a.key !== "income" && acct[a.key].some((r) => r.closing !== 0 || r.moneyIn !== 0 || r.moneyOut !== 0)
  );
  const hasWise = wise.some((r) => r.closing !== 0 || r.moneyOut !== 0 || r.transfersIn !== 0);
  const need: Record<string, number | null> = {};
  for (const a of shown) need[a.key] = incomeNeeded(acct[a.key], share[a.key] ?? 0);
  if (hasWise) need.wise = incomeNeeded(wise, 0);

  const totalAt = (w: number) =>
    Math.round(
      (shown.reduce((t, a) => t + acct[a.key][w].closing, 0) + (hasWise ? wise[w].closing : 0)) * 100
    ) / 100;
  const accountOptions = [...shown.map((a) => ({ key: a.key, label: a.label })), ...(hasWise ? [WISE] : [])];

  /** Where the money goes out of an account in week w. */
  const outLines = (key: string, w: number): { label: string; amount: number | null }[] => {
    const lines: { label: string; amount: number | null }[] = [];
    if (key === "wise") {
      for (const b of monthlyBills) {
        const a = wise[w].billLines[b.id] ?? 0;
        if (a > 0) lines.push({ label: b.name, amount: a });
      }
      return lines;
    }
    const r = acct[key as AccountKey][w];
    for (const l of recurringLines.filter((x) => x.account === key)) {
      if (r.stillToGo && nowBal) {
        const rem = nowBal.remaining[key]?.[l.id];
        if (l.weeklyAmount > 0) lines.push({ label: l.label, amount: rem !== undefined ? Number(rem) : null });
      } else {
        const amt = lineInWeek(l, r.weekCommencing); // a monthly line only lands in its own week
        if (amt > 0) lines.push({ label: l.label, amount: amt });
      }
    }
    if (r.bills > 0) lines.push({ label: "Bills (Xero)", amount: r.bills });
    if ((r.basPaid ?? 0) > 0) lines.push({ label: "Paid to ATO (BAS)", amount: r.basPaid! });
    return lines;
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* ── Control bar ── */}
      <div className="flex items-center gap-4 px-4 py-2.5 bg-white border-b border-border flex-wrap shrink-0">
        <span className="text-sm font-semibold" style={{ color: NAVY }}>Weekly What-If</span>
        <span className="text-xs text-muted-foreground">
          Same starting balances and income estimates as the cash flow table. Expenses you add here stay here.
        </span>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground hidden sm:inline">Weeks:</span>
          <div className="inline-flex rounded-lg border border-border overflow-hidden">
            {[8, 13, 26].map((n) => (
              <button
                key={n}
                onClick={() => setNumWeeks(n)}
                className={`px-2.5 py-1 text-xs font-medium border-r border-border last:border-r-0 ${
                  numWeeks === n ? "bg-primary text-primary-foreground" : "bg-white text-muted-foreground hover:bg-muted"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── The board ── */}
      <div className="flex-1 overflow-auto">
        <div className="flex gap-3 p-4 min-w-max items-start">
          {rows.map((row) => {
            const w = row.week;
            const inc = acct.income[w];
            const incOpen = open.has(`inc-${w}`);
            const total = totalAt(w);
            return (
              <div
                key={w}
                data-week={w}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData("text/plain");
                  if (id) moveItem(id, w);
                  setDragId(null);
                }}
                className="wk-col w-60 shrink-0 rounded-xl border border-border bg-white flex flex-col"
              >
                {/* Week header */}
                <div className="px-3 py-2 border-b border-border flex items-baseline justify-between">
                  <span className="text-sm font-bold text-foreground">{w === 0 ? "This week" : `Week ${w}`}</span>
                  <span className="text-xs text-muted-foreground">
                    {row.weekCommencing.toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                  </span>
                </div>

                {/* Income - collapsed to the week's total */}
                <div className="px-3 py-2 border-b border-border">
                  <button onClick={() => toggle(`inc-${w}`)} className="wk-income w-full flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 font-semibold" style={{ color: NAVY }}>
                      {incOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      Income{inc.actual ? " (actual)" : ""}
                    </span>
                    <span className="font-bold" style={{ color: IN }}>{formatCurrency(inc.moneyIn)}</span>
                  </button>
                  {incOpen && (
                    <div className="mt-1.5 space-y-1">
                      {(inc.fee ?? 0) > 0 && (
                        <Line label={`Stripe fee (${feePct}%)`} amount={inc.fee!} color={OUT} />
                      )}
                      <Line label="Split to the accounts" amount={inc.allocOut} color={OUT} />
                      {row.inItems.map((it) => (
                        <Card
                          key={it.id}
                          item={it}
                          color={IN}
                          onDragStart={() => setDragId(it.id)}
                          dragging={dragId === it.id}
                          onAmount={(v) => updateItem(it.id, { amount: v })}
                          onName={(v) => updateItem(it.id, { name: v })}
                          onDelete={() => deleteItem(it.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* One box per bank account */}
                <div className="p-2 space-y-1.5 flex-1">
                  {[...shown.map((a) => ({ key: a.key as string, label: a.label, colorHex: a.colorHex })), ...(hasWise ? [WISE] : [])].map((a) => {
                    const r = a.key === "wise" ? wise[w] : acct[a.key as AccountKey][w];
                    const grey = toOpen.has(a.key);
                    const red = r.closing < 0;
                    const id = `${a.key}-${w}`;
                    const isOpen = open.has(id);
                    const lines = outLines(a.key, w);
                    const mine = whatIf.filter((it) => it.account === a.key && it.week === w);
                    const n = need[a.key];
                    return (
                      <div
                        key={a.key}
                        data-acct={a.key}
                        className="wk-acct rounded-lg border px-2 py-1.5 text-xs"
                        style={{
                          borderColor: grey ? GREY + "66" : red ? OUT + "88" : IN + "55",
                          borderLeft: `3px solid ${grey ? GREY : a.colorHex}`,
                          backgroundColor: red && !grey ? "#fdecec" : "#ffffff",
                        }}
                      >
                        <button onClick={() => toggle(id)} className="w-full text-left">
                          <div className="flex items-center justify-between gap-1">
                            <span className="truncate font-semibold" style={{ color: grey ? GREY : NAVY }} title={a.label}>
                              {isOpen ? <ChevronDown className="inline h-3 w-3" /> : <ChevronRight className="inline h-3 w-3" />}
                              {a.label}{grey ? " (to open)" : ""}
                            </span>
                            <span className="wk-bal font-bold shrink-0" style={{ color: grey ? GREY : red ? OUT : IN }}>
                              {formatCurrency(r.closing)}
                            </span>
                          </div>
                          <div className="flex justify-between text-[10px] mt-0.5">
                            <span className="wk-in" style={{ color: grey ? GREY : IN }}>
                              in {formatCurrency(Math.round((r.moneyIn + r.transfersIn) * 100) / 100)}
                            </span>
                            <span className="wk-out" style={{ color: grey ? GREY : OUT }}>
                              out {formatCurrency(Math.round(r.moneyOut * 100) / 100)}
                            </span>
                          </div>
                        </button>
                        {red && !grey && (
                          <div className="wk-need text-[10px] font-semibold mt-0.5" style={{ color: OUT }}>
                            {n === null
                              ? "more income won't fix this - it gets no share of income"
                              : n > 0
                              ? `needs ${formatCurrency(n)} more income a week`
                              : "already red this week"}
                          </div>
                        )}
                        {isOpen && (
                          <div className="mt-1 pt-1 border-t border-border/60 space-y-0.5">
                            {lines.length === 0 && mine.length === 0 && (
                              <div className="text-[10px] text-muted-foreground">nothing going out</div>
                            )}
                            {lines.map((l, i) => (
                              <Line key={i} label={l.label} amount={l.amount} color={OUT} />
                            ))}
                            {mine.map((it) => (
                              <Card
                                key={it.id}
                                item={it}
                                color={OUT}
                                onDragStart={() => setDragId(it.id)}
                                dragging={dragId === it.id}
                                onAmount={(v) => updateItem(it.id, { amount: v })}
                                onName={(v) => updateItem(it.id, { name: v })}
                                onDelete={() => deleteItem(it.id)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {addingWeek === w ? (
                    <AddExpense
                      accounts={accountOptions}
                      onAdd={(name, amount, account) => {
                        addItem({ type: "out", name, amount, week: w, account });
                        setOpen((prev) => new Set(prev).add(`${account}-${w}`));
                        setAddingWeek(null);
                      }}
                      onCancel={() => setAddingWeek(null)}
                    />
                  ) : (
                    <button onClick={() => setAddingWeek(w)} className="wk-add text-[11px] text-primary hover:underline flex items-center gap-1">
                      <Plus className="h-3 w-3" /> add expense
                    </button>
                  )}
                </div>

                {/* Week footer - the total across the bank accounts */}
                <div className="px-3 py-2 border-t border-border text-xs flex justify-between font-bold">
                  <span>Total cash</span>
                  <span className="wk-total" style={{ color: total < 0 ? OUT : IN }}>{formatCurrency(total)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Line({ label, amount, color }: { label: string; amount: number | null; color: string }) {
  return (
    <div className="flex justify-between text-[10px]">
      <span className="text-muted-foreground truncate pr-1" title={label}>{label}</span>
      <span style={{ color }}>{amount === null ? "paid" : formatCurrency(amount)}</span>
    </div>
  );
}

/** Add a what-if expense to a week, paid from the account Katie picks. */
function AddExpense({
  accounts,
  onAdd,
  onCancel,
}: {
  accounts: { key: string; label: string }[];
  onAdd: (name: string, amount: number, account: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [account, setAccount] = useState(accounts.find((a) => a.key === "opex")?.key ?? accounts[0]?.key ?? "");
  const submit = () => {
    const amt = Math.round(parseCurrencyInput(amount) * 100) / 100;
    if (!amt || amt < 0 || !account) return;
    onAdd(name.trim() || "Expense", amt, account);
  };
  return (
    <div className="wk-addform rounded-lg border border-border p-1.5 space-y-1 text-xs bg-muted/30">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="What is it"
        className="w-full bg-white border border-border rounded px-1.5 py-0.5" />
      <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" inputMode="decimal"
        onKeyDown={(e) => e.key === "Enter" && submit()}
        className="w-full bg-white border border-border rounded px-1.5 py-0.5" />
      <select value={account} onChange={(e) => setAccount(e.target.value)}
        className="w-full bg-white border border-border rounded px-1 py-0.5">
        {accounts.map((a) => <option key={a.key} value={a.key}>Paid from {a.label}</option>)}
      </select>
      <div className="flex gap-1">
        <Button size="sm" onClick={submit} className="h-6 text-xs">Add</Button>
        <Button size="sm" variant="ghost" onClick={onCancel} className="h-6 text-xs">Cancel</Button>
      </div>
    </div>
  );
}

// ── A draggable invoice / bill card ──

function Card({
  item,
  color,
  dragging,
  onDragStart,
  onAmount,
  onName,
  onDelete,
}: {
  item: WeeklyItem;
  color: string;
  dragging: boolean;
  onDragStart: () => void;
  onAmount: (v: number) => void;
  onName: (v: string) => void;
  onDelete: () => void;
}) {
  const [editingAmt, setEditingAmt] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const status = statusOf(item); // green / orange / red by how overdue
  const Arrow = item.type === "in" ? ArrowDownLeft : ArrowUpRight;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", item.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      className={`group rounded-lg border px-2 py-1.5 text-xs cursor-grab active:cursor-grabbing ${
        dragging ? "opacity-40" : ""
      }`}
      style={{
        borderColor: status.color + "66",
        borderLeft: `3px solid ${status.color}`,
        backgroundColor: status.color + "0d",
      }}
    >
      <div className="flex items-start gap-1">
        <Arrow className="h-3 w-3 mt-0.5 shrink-0" style={{ color }} aria-label={item.type === "in" ? "money in" : "money out"} />
        <div className="flex-1 min-w-0">
          {editingName ? (
            <input
              autoFocus
              defaultValue={item.name}
              onBlur={(e) => {
                onName(e.target.value || item.name);
                setEditingName(false);
              }}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              className="w-full text-xs bg-white border border-border rounded px-1"
            />
          ) : (
            <div
              className="truncate font-medium text-foreground"
              title={item.name}
              onClick={() => setEditingName(true)}
            >
              {item.name}
            </div>
          )}
          {editingAmt ? (
            <input
              autoFocus
              type="text"
              defaultValue={String(Math.round(item.amount * 100) / 100)}
              onBlur={(e) => {
                onAmount(parseCurrencyInput(e.target.value));
                setEditingAmt(false);
              }}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              className="w-full text-xs bg-white border border-border rounded px-1 mt-0.5"
            />
          ) : (
            <div
              className="font-bold mt-0.5"
              style={{ color: status.color }}
              onClick={() => setEditingAmt(true)}
            >
              {item.type === "in" ? "+" : ""}
              {formatCurrency(item.amount).replace(/^[($]+|\)$/g, "$")}
            </div>
          )}
          {status.text && (
            <div
              className="text-[10px] font-medium mt-0.5"
              style={{ color: status.color }}
            >
              {status.text}
            </div>
          )}
        </div>
        <button
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground shrink-0"
          title="Remove"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// ── Add a hypothetical invoice / bill ──

function AddForm({
  numWeeks,
  onAdd,
  onCancel,
}: {
  numWeeks: number;
  onAdd: (item: Omit<WeeklyItem, "id" | "source">) => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState<"in" | "out">("in");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [week, setWeek] = useState(1);

  const submit = () => {
    const amt = parseCurrencyInput(amount);
    if (!amt) return;
    onAdd({
      type,
      name: name.trim() || (type === "in" ? "New invoice" : "New bill"),
      amount: amt,
      week,
    });
  };

  return (
    <div className="flex items-end gap-3 px-4 py-3 bg-muted/40 border-b border-border flex-wrap">
      <div className="inline-flex rounded-lg border border-border overflow-hidden">
        <button
          onClick={() => setType("in")}
          className={`px-3 py-1.5 text-xs font-medium ${type === "in" ? "text-white" : "bg-white text-muted-foreground"}`}
          style={type === "in" ? { backgroundColor: IN } : {}}
        >
          Money in
        </button>
        <button
          onClick={() => setType("out")}
          className={`px-3 py-1.5 text-xs font-medium border-l border-border ${type === "out" ? "text-white" : "bg-white text-muted-foreground"}`}
          style={type === "out" ? { backgroundColor: OUT } : {}}
        >
          Money out
        </button>
      </div>
      <div className="flex flex-col gap-0.5">
        <label className="text-[10px] text-muted-foreground uppercase">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={type === "in" ? "Who's paying you" : "Who you're paying"}
          className="text-sm bg-white border border-border rounded px-2 py-1 w-44"
        />
      </div>
      <div className="flex flex-col gap-0.5">
        <label className="text-[10px] text-muted-foreground uppercase">Amount</label>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0"
          className="text-sm bg-white border border-border rounded px-2 py-1 w-28"
        />
      </div>
      <div className="flex flex-col gap-0.5">
        <label className="text-[10px] text-muted-foreground uppercase">Week</label>
        <select
          value={week}
          onChange={(e) => setWeek(Number(e.target.value))}
          className="text-sm bg-white border border-border rounded px-2 py-1"
        >
          {Array.from({ length: numWeeks }, (_, i) => (
            <option key={i} value={i}>
              {i === 0 ? "Now" : `Week ${i}`}
            </option>
          ))}
        </select>
      </div>
      <Button size="sm" onClick={submit} className="text-xs">Add</Button>
      <Button size="sm" variant="ghost" onClick={onCancel} className="text-xs">Cancel</Button>
    </div>
  );
}

// ── Editable starting-cash field ──

function EditableCash({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <input
        autoFocus
        type="text"
        defaultValue={String(Math.round(value * 100) / 100)}
        onBlur={(e) => {
          onChange(parseCurrencyInput(e.target.value));
          setEditing(false);
        }}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className="text-sm font-semibold bg-white border border-border rounded px-2 py-0.5 w-28"
      />
    );
  }
  return (
    <button
      onClick={() => setEditing(true)}
      className="text-sm font-semibold text-foreground hover:underline"
      title="Click to edit"
    >
      {formatCurrency(value)}
    </button>
  );
}
