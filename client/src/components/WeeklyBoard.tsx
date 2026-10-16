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
  lowestPoint,
  daysOverdue,
} from "@/lib/weekly";
import { formatCurrency, parseCurrencyInput } from "@/lib/cashflow";
import {
  Plus,
  X,
  GripVertical,
  TriangleAlert,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";
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
  moveItem: (id: string, week: number) => void;
  addItem: (item: Omit<WeeklyItem, "id" | "source">) => void;
  updateItem: (id: string, patch: Partial<WeeklyItem>) => void;
  deleteItem: (id: string) => void;
  setStartingCash: (amount: number) => void;
}

export default function WeeklyBoard({
  weekly,
  moveItem,
  addItem,
  updateItem,
  deleteItem,
  setStartingCash,
}: Props) {
  const [numWeeks, setNumWeeks] = useState(13);
  const [adding, setAdding] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [view, setView] = useState<"both" | "in" | "out">("both");

  const showIn = view !== "out";
  const showOut = view !== "in";

  const rows = buildWeeks(weekly, numWeeks);
  const low = lowestPoint(rows);
  const hasItems = weekly.items.length > 0;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* ── Control bar ── */}
      <div className="flex items-center gap-4 px-4 py-2.5 bg-white border-b border-border flex-wrap shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Cash in bank now:</span>
          <EditableCash value={weekly.startingCash} onChange={setStartingCash} />
        </div>

        {low && (
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-muted-foreground">Lowest point:</span>
            <span
              className="font-semibold"
              style={{ color: low.closing < 0 ? OUT : "inherit" }}
            >
              {formatCurrency(low.closing)}
            </span>
            <span className="text-muted-foreground">
              ({low.week === 0 ? "now" : `wk ${low.week}`})
            </span>
            {low.closing < 0 && <TriangleAlert className="h-3.5 w-3.5" style={{ color: OUT }} />}
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* In / Out / Both filter */}
          <div className="inline-flex rounded-lg border border-border overflow-hidden">
            {([
              ["both", "Both"],
              ["in", "Money in"],
              ["out", "Money out"],
            ] as const).map(([v, label]) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-2.5 py-1 text-xs font-medium border-r border-border last:border-r-0 ${
                  view === v ? "text-white" : "bg-white text-muted-foreground hover:bg-muted"
                }`}
                style={
                  view === v
                    ? { backgroundColor: v === "in" ? IN : v === "out" ? OUT : "#1F3D6E" }
                    : {}
                }
              >
                {label}
              </button>
            ))}
          </div>

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
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setAdding((a) => !a)}>
            <Plus className="h-3.5 w-3.5" />
            Add invoice / bill
          </Button>
        </div>
      </div>

      {adding && (
        <AddForm
          numWeeks={numWeeks}
          onAdd={(item) => {
            addItem(item);
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      )}

      {!hasItems && (
        <div className="p-8 text-center text-sm text-muted-foreground">
          No invoices or bills yet. Use <strong>Import Xero</strong> to pull a
          client's real invoices &amp; bills, or <strong>Add invoice / bill</strong>{" "}
          to play with hypotheticals.
        </div>
      )}

      {/* ── The board ── */}
      <div className="flex-1 overflow-auto">
        <div className="flex gap-3 p-4 min-w-max items-start">
          {rows.map((row) => (
            <div
              key={row.week}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain");
                if (id) moveItem(id, row.week);
                setDragId(null);
              }}
              className="w-56 shrink-0 rounded-xl border border-border bg-white flex flex-col"
            >
              {/* Week header */}
              <div className="px-3 py-2 border-b border-border">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-bold text-foreground">
                    {row.week === 0 ? "Now / Overdue" : `Week ${row.week}`}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {row.weekCommencing.toLocaleDateString("en-AU", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </div>
              </div>

              {/* Cards */}
              <div className="p-2 space-y-1.5 min-h-24 flex-1">
                {showIn &&
                  row.inItems.map((it) => (
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
                {showOut &&
                  row.outItems.map((it) => (
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

              {/* Week footer — adapts to the In / Out / Both filter */}
              <div className="px-3 py-2 border-t border-border text-xs space-y-0.5">
                {view === "in" ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">In this week</span>
                      <span style={{ color: IN }}>{formatCurrency(row.moneyIn)}</span>
                    </div>
                    <div className="flex justify-between font-bold pt-0.5 border-t border-border/60">
                      <span>Total in</span>
                      <span style={{ color: IN }}>{formatCurrency(row.cumulativeIn)}</span>
                    </div>
                  </>
                ) : view === "out" ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Out this week</span>
                      <span style={{ color: OUT }}>{formatCurrency(row.moneyOut)}</span>
                    </div>
                    <div className="flex justify-between font-bold pt-0.5 border-t border-border/60">
                      <span>Total out</span>
                      <span style={{ color: OUT }}>{formatCurrency(row.cumulativeOut)}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">In</span>
                      <span style={{ color: IN }}>{formatCurrency(row.moneyIn)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Out</span>
                      <span style={{ color: OUT }}>{formatCurrency(row.moneyOut)}</span>
                    </div>
                    <div className="flex justify-between font-bold pt-0.5 border-t border-border/60">
                      <span>Balance</span>
                      <span style={{ color: row.closing < 0 ? OUT : "#1F3D6E" }}>
                        {formatCurrency(row.closing)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
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
