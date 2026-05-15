// ============================================================
// PFFT Cashflow Tool — Settings Panel
// Left panel: Opening Balances + PF Allocations + Min Balances + BAS Settings
// Design: "Profit First Dashboard"
// ============================================================

import { useState } from "react";
import {
  ACCOUNT_CONFIGS,
  AccountKey,
  ProjectionSettings,
  parseCurrencyInput,
  formatCurrencyInput,
} from "@/lib/cashflow";
import { ChevronLeft, ChevronRight, RotateCcw, Settings2, Zap, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

interface SettingsPanelProps {
  settings: ProjectionSettings;
  onUpdateOpeningBalance: (key: AccountKey, value: number) => void;
  onDistributeIncomeOpening: (grossAmount: number) => void;
  onUpdateAllocation: (key: AccountKey, value: number) => void;
  onUpdateStartDate: (month: number, year: number) => void;
  onUpdateMinBalance: (key: AccountKey, value: number) => void;
  onUpdateBasLodgement: (months: number[], day: number) => void;
  onUpdateProfitDistribution: (months: number[], day: number) => void;
  onReset: () => void;
}

export default function SettingsPanel({
  settings,
  onUpdateOpeningBalance,
  onDistributeIncomeOpening,
  onUpdateAllocation,
  onUpdateStartDate,
  onUpdateMinBalance,
  onUpdateBasLodgement,
  onUpdateProfitDistribution,
  onReset,
}: SettingsPanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  const realRevenueAccounts = ACCOUNT_CONFIGS.filter((a) => !a.basedOnGross && a.key !== "income");
  const grossAccounts = ACCOUNT_CONFIGS.filter((a) => a.basedOnGross && a.key !== "income");
  const nonIncomeAccounts = ACCOUNT_CONFIGS.filter((a) => a.key !== "income");

  const totalRealRevAlloc = realRevenueAccounts.reduce(
    (s, a) => s + settings.allocations[a.key],
    0
  );

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 1 + i);

  const basLodgementMonths = settings.basLodgementMonths ?? [0, 3, 6, 9];
  const basLodgementDay = settings.basLodgementDay ?? 28;
  const profitDistMonths = settings.profitDistributionMonths ?? [0, 3, 6, 9];
  const profitDistDay = settings.profitDistributionDay ?? 1;

  const toggleProfitDistMonth = (monthIndex: number) => {
    const current = [...profitDistMonths];
    const idx = current.indexOf(monthIndex);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current.push(monthIndex);
      current.sort((a, b) => a - b);
    }
    onUpdateProfitDistribution(current, profitDistDay);
  };

  const toggleBasMonth = (monthIndex: number) => {
    const current = [...basLodgementMonths];
    const idx = current.indexOf(monthIndex);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current.push(monthIndex);
      current.sort((a, b) => a - b);
    }
    onUpdateBasLodgement(current, basLodgementDay);
  };

  return (
    <aside
      className={`relative flex flex-col bg-sidebar text-sidebar-foreground transition-all duration-300 ease-in-out shrink-0 ${
        collapsed ? "w-12" : "w-80"
      }`}
      style={{ minHeight: "100vh" }}
    >
      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-6 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-sidebar border border-sidebar-border text-sidebar-foreground shadow-sm hover:bg-sidebar-accent transition-colors"
        aria-label={collapsed ? "Expand settings" : "Collapse settings"}
      >
        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </button>

      {/* Collapsed state */}
      {collapsed && (
        <div className="flex flex-col items-center pt-6 gap-4">
          <Settings2 className="h-5 w-5 text-sidebar-foreground/60" />
          <div className="flex flex-col gap-2 mt-4">
            {ACCOUNT_CONFIGS.map((a) => (
              <Tooltip key={a.key}>
                <TooltipTrigger asChild>
                  <div className="h-3 w-3 rounded-full mx-auto" style={{ backgroundColor: a.colorHex }} />
                </TooltipTrigger>
                <TooltipContent side="right"><p>{a.label}</p></TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>
      )}

      {/* Expanded state */}
      {!collapsed && (
        <div className="flex flex-col h-full overflow-y-auto">
          {/* Header */}
          <div className="px-5 py-5 border-b border-sidebar-border">
            <div className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-sidebar-foreground/60" />
              <h2 className="text-sm font-semibold tracking-wide uppercase text-sidebar-foreground/80">Settings</h2>
            </div>
          </div>

          <div className="flex-1 px-5 py-5 space-y-7 overflow-y-auto">

            {/* ── Projection Start ── */}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-sidebar-foreground/50 mb-3">
                Projection Start
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-sidebar-foreground/70 mb-1 block">Month</Label>
                  <select
                    value={settings.startMonth}
                    onChange={(e) => onUpdateStartDate(parseInt(e.target.value), settings.startYear)}
                    className="w-full rounded-md border border-sidebar-border bg-sidebar-accent text-sidebar-foreground text-sm px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-sidebar-ring"
                  >
                    {MONTH_NAMES.map((m, i) => <option key={m} value={i}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-xs text-sidebar-foreground/70 mb-1 block">Year</Label>
                  <select
                    value={settings.startYear}
                    onChange={(e) => onUpdateStartDate(settings.startMonth, parseInt(e.target.value))}
                    className="w-full rounded-md border border-sidebar-border bg-sidebar-accent text-sidebar-foreground text-sm px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-sidebar-ring"
                  >
                    {years.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
            </section>

            <Separator className="bg-sidebar-border" />

            {/* ── Opening Balances ── */}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-sidebar-foreground/50 mb-1">
                Opening Balances
              </h3>
              <p className="text-xs text-sidebar-foreground/40 mb-3 leading-relaxed">
                Enter the <span className="text-amber-400 font-medium">Income</span> balance to auto-distribute across all accounts using your PF percentages. Or set each account manually.
              </p>

              {/* Income row — triggers auto-distribute */}
              <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: "#2d7a4f" }} />
                  <span className="text-xs font-semibold text-sidebar-foreground/90">Income (Gross)</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Zap className="h-3 w-3 text-amber-400 ml-auto shrink-0" />
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-48">
                      <p>Entering this amount will auto-calculate and fill all account balances using your PF percentages.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <DistributeIncomeInput value={settings.openingBalances.income} onDistribute={onDistributeIncomeOpening} />
                <p className="text-[10px] text-amber-400/80 mt-1.5">⚡ Auto-distributes to all accounts below</p>
              </div>

              {/* All other accounts — manual override */}
              <div className="space-y-2.5">
                {ACCOUNT_CONFIGS.filter((a) => a.key !== "income").map((account) => (
                  <OpeningBalanceRow
                    key={account.key}
                    account={account}
                    value={settings.openingBalances[account.key]}
                    onChange={(v) => onUpdateOpeningBalance(account.key, v)}
                  />
                ))}
              </div>
            </section>

            <Separator className="bg-sidebar-border" />

            {/* ── PF Allocations ── */}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-sidebar-foreground/50 mb-2">
                % of Gross Income
              </h3>
              <p className="text-xs text-sidebar-foreground/40 mb-3">Swept directly from gross income first.</p>
              <div className="space-y-2.5 mb-5">
                {grossAccounts.map((account) => (
                  <AllocationRow key={account.key} account={account} value={settings.allocations[account.key]} onChange={(v) => onUpdateAllocation(account.key, v)} />
                ))}
              </div>

              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-sidebar-foreground/50">% of Real Revenue</h3>
                <span className={`text-xs font-semibold ${Math.abs(totalRealRevAlloc - 100) < 0.01 ? "text-green-400" : "text-amber-400"}`}>
                  {totalRealRevAlloc.toFixed(0)}% / 100%
                </span>
              </div>
              <p className="text-xs text-sidebar-foreground/40 mb-3">Allocated after BAS &amp; Materials are swept.</p>
              <div className="space-y-2.5">
                {realRevenueAccounts.map((account) => (
                  <AllocationRow key={account.key} account={account} value={settings.allocations[account.key]} onChange={(v) => onUpdateAllocation(account.key, v)} />
                ))}
              </div>
            </section>

            <Separator className="bg-sidebar-border" />

            {/* ── Minimum Balances ── */}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-sidebar-foreground/50 mb-1">
                Minimum Balance Targets
              </h3>
              <p className="text-xs text-sidebar-foreground/40 mb-3 leading-relaxed">
                Set a floor for each account. A dashed line will appear on the graph and an amber warning shows when the balance dips below this target.
              </p>
              <div className="space-y-2.5">
                {nonIncomeAccounts.map((account) => (
                  <MinBalanceRow
                    key={account.key}
                    account={account}
                    value={settings.minBalances?.[account.key] ?? 0}
                    onChange={(v) => onUpdateMinBalance(account.key, v)}
                  />
                ))}
              </div>
            </section>

            <Separator className="bg-sidebar-border" />

            {/* ── BAS Lodgement Settings ── */}
            <section>
              <div className="flex items-center gap-2 mb-1">
                <CalendarClock className="h-3.5 w-3.5 text-orange-400" />
                <h3 className="text-xs font-semibold uppercase tracking-widest text-sidebar-foreground/50">
                  BAS Due Date Settings
                </h3>
              </div>
              <p className="text-xs text-sidebar-foreground/40 mb-3 leading-relaxed">
                Select the months when BAS is due and the day of month. Shown as orange markers on the BAS chart.
              </p>

              {/* Day of month */}
              <div className="mb-4">
                <Label className="text-xs text-sidebar-foreground/70 mb-1.5 block">Day of Month Due</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    value={basLodgementDay}
                    onChange={(e) => {
                      const d = parseInt(e.target.value);
                      if (!isNaN(d) && d >= 1 && d <= 31) {
                        onUpdateBasLodgement(basLodgementMonths, d);
                      }
                    }}
                    className="h-7 w-16 text-xs text-center bg-sidebar-accent border-sidebar-border text-sidebar-foreground"
                  />
                  <span className="text-xs text-sidebar-foreground/50">of the month</span>
                </div>
              </div>

              {/* Month toggles */}
              <Label className="text-xs text-sidebar-foreground/70 mb-2 block">BAS Due Months</Label>
              <div className="grid grid-cols-3 gap-1.5">
                {MONTH_NAMES.map((name, i) => {
                  const isSelected = basLodgementMonths.includes(i);
                  return (
                    <button
                      key={name}
                      onClick={() => toggleBasMonth(i)}
                      className={`text-[10px] font-medium rounded-md px-2 py-1.5 border transition-colors ${
                        isSelected
                          ? "bg-orange-500/20 border-orange-500/50 text-orange-300"
                          : "bg-sidebar-accent border-sidebar-border text-sidebar-foreground/50 hover:text-sidebar-foreground hover:border-sidebar-foreground/30"
                      }`}
                    >
                      {name.slice(0, 3)}
                    </button>
                  );
                })}
              </div>
              {basLodgementMonths.length > 0 && (
                <p className="text-[10px] text-orange-400/70 mt-2">
                  BAS due: {basLodgementMonths.map((m) => MONTH_NAMES[m].slice(0, 3)).join(", ")} (day {basLodgementDay})
                </p>
              )}
            </section>

            <Separator className="bg-sidebar-border" />

            {/* ── Profit Distribution Settings ── */}
            <section>
              <div className="flex items-center gap-2 mb-1">
                <div className="h-3.5 w-3.5 rounded-full bg-yellow-500" />
                <h3 className="text-xs font-semibold uppercase tracking-widest text-sidebar-foreground/50">
                  Profit Distribution
                </h3>
              </div>
              <p className="text-xs text-sidebar-foreground/40 mb-3 leading-relaxed">
                Select the months when profit is distributed and the day. Shown as gold dashed markers on the Profit chart.
              </p>

              {/* Day of month */}
              <div className="mb-4">
                <Label className="text-xs text-sidebar-foreground/70 mb-1.5 block">Day of Month</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    value={profitDistDay}
                    onChange={(e) => {
                      const d = parseInt(e.target.value);
                      if (!isNaN(d) && d >= 1 && d <= 31) {
                        onUpdateProfitDistribution(profitDistMonths, d);
                      }
                    }}
                    className="h-7 w-16 text-xs text-center bg-sidebar-accent border-sidebar-border text-sidebar-foreground"
                  />
                  <span className="text-xs text-sidebar-foreground/50">of the month</span>
                </div>
              </div>

              {/* Month toggles */}
              <Label className="text-xs text-sidebar-foreground/70 mb-2 block">Distribution Months</Label>
              <div className="grid grid-cols-3 gap-1.5">
                {MONTH_NAMES.map((name, i) => {
                  const isSelected = profitDistMonths.includes(i);
                  return (
                    <button
                      key={name}
                      onClick={() => toggleProfitDistMonth(i)}
                      className={`text-[10px] font-medium rounded-md px-2 py-1.5 border transition-colors ${
                        isSelected
                          ? "bg-yellow-500/20 border-yellow-500/50 text-yellow-300"
                          : "bg-sidebar-accent border-sidebar-border text-sidebar-foreground/50 hover:text-sidebar-foreground hover:border-sidebar-foreground/30"
                      }`}
                    >
                      {name.slice(0, 3)}
                    </button>
                  );
                })}
              </div>
              {profitDistMonths.length > 0 && (
                <p className="text-[10px] text-yellow-400/70 mt-2">
                  Profit dist: {profitDistMonths.map((m) => MONTH_NAMES[m].slice(0, 3)).join(", ")} (day {profitDistDay})
                </p>
              )}
            </section>

          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-sidebar-border">
            <Button
              variant="ghost"
              size="sm"
              onClick={onReset}
              className="w-full text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent gap-2"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset All Data
            </Button>
          </div>
        </div>
      )}
    </aside>
  );
}

// ── Distribute Income Input ───────────────────────────────────

function DistributeIncomeInput({ value, onDistribute }: { value: number; onDistribute: (v: number) => void }) {
  const [localValue, setLocalValue] = useState(value === 0 ? "" : formatCurrencyInput(value));
  const handleBlur = () => {
    const parsed = parseCurrencyInput(localValue);
    onDistribute(parsed);
    setLocalValue(parsed === 0 ? "" : formatCurrencyInput(parsed));
  };
  return (
    <div className="relative">
      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-sidebar-foreground/50 pointer-events-none">$</span>
      <Input
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={(e) => e.key === "Enter" && handleBlur()}
        placeholder="Enter gross income amount"
        className="h-8 text-xs text-right bg-sidebar-accent border-amber-500/40 text-sidebar-foreground placeholder:text-sidebar-foreground/30 pl-5 pr-2 focus-visible:ring-amber-500/40"
        style={{ fontVariantNumeric: "tabular-nums" }}
      />
    </div>
  );
}

// ── Opening Balance Row ───────────────────────────────────────

function OpeningBalanceRow({ account, value, onChange }: { account: (typeof ACCOUNT_CONFIGS)[0]; value: number; onChange: (v: number) => void }) {
  const [localValue, setLocalValue] = useState(value === 0 ? "" : formatCurrencyInput(value));
  const [focused, setFocused] = useState(false);
  const displayValue = focused ? localValue : (value === 0 ? "" : formatCurrencyInput(value));
  const handleBlur = () => {
    setFocused(false);
    const parsed = parseCurrencyInput(localValue);
    onChange(parsed);
    setLocalValue(parsed === 0 ? "" : formatCurrencyInput(parsed));
  };
  const handleFocus = () => {
    setFocused(true);
    setLocalValue(value === 0 ? "" : formatCurrencyInput(value));
  };
  return (
    <div className="flex items-center gap-2">
      <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: account.colorHex }} />
      <span className="text-xs text-sidebar-foreground/80 flex-1 truncate">{account.shortLabel}</span>
      <div className="relative w-28">
        {!focused && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-sidebar-foreground/50 pointer-events-none">$</span>}
        <Input
          value={displayValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder="0"
          className="h-7 text-xs text-right bg-sidebar-accent border-sidebar-border text-sidebar-foreground placeholder:text-sidebar-foreground/30 pl-5 pr-2"
          style={{ fontVariantNumeric: "tabular-nums" }}
        />
      </div>
    </div>
  );
}

// ── Min Balance Row ───────────────────────────────────────────

function MinBalanceRow({ account, value, onChange }: { account: (typeof ACCOUNT_CONFIGS)[0]; value: number; onChange: (v: number) => void }) {
  const [localValue, setLocalValue] = useState(value === 0 ? "" : formatCurrencyInput(value));
  const [focused, setFocused] = useState(false);
  const displayValue = focused ? localValue : (value === 0 ? "" : formatCurrencyInput(value));
  const handleBlur = () => {
    setFocused(false);
    const parsed = parseCurrencyInput(localValue);
    onChange(parsed);
    setLocalValue(parsed === 0 ? "" : formatCurrencyInput(parsed));
  };
  const handleFocus = () => {
    setFocused(true);
    setLocalValue(value === 0 ? "" : formatCurrencyInput(value));
  };
  return (
    <div className="flex items-center gap-2">
      <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: account.colorHex }} />
      <span className="text-xs text-sidebar-foreground/80 flex-1 truncate">{account.shortLabel}</span>
      <div className="relative w-28">
        {!focused && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-sidebar-foreground/50 pointer-events-none">$</span>}
        <Input
          value={displayValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder="0"
          className="h-7 text-xs text-right bg-sidebar-accent border-sidebar-border text-sidebar-foreground placeholder:text-sidebar-foreground/30 pl-5 pr-2"
          style={{ fontVariantNumeric: "tabular-nums" }}
        />
      </div>
    </div>
  );
}

// ── Allocation Row ────────────────────────────────────────────

function AllocationRow({ account, value, onChange }: { account: (typeof ACCOUNT_CONFIGS)[0]; value: number; onChange: (v: number) => void }) {
  const [localValue, setLocalValue] = useState(value.toString());
  const handleBlur = () => {
    const parsed = parseFloat(localValue);
    const clamped = isNaN(parsed) ? 0 : Math.max(0, Math.min(100, parsed));
    onChange(clamped);
    setLocalValue(clamped.toString());
  };
  return (
    <div className="flex items-center gap-2">
      <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: account.colorHex }} />
      <span className="text-xs text-sidebar-foreground/80 flex-1 truncate">{account.shortLabel}</span>
      <div className="relative w-20">
        <Input
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={(e) => e.key === "Enter" && handleBlur()}
          placeholder="0"
          className="h-7 text-xs text-right bg-sidebar-accent border-sidebar-border text-sidebar-foreground placeholder:text-sidebar-foreground/30 pr-5"
          style={{ fontVariantNumeric: "tabular-nums" }}
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-sidebar-foreground/50 pointer-events-none">%</span>
      </div>
    </div>
  );
}
