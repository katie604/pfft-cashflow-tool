// ============================================================
// PFFT Cashflow Tool — Home Page
// Tabs: Cashflow Table | Account Graphs
// ============================================================

import { useCallback, useState } from "react";
import { useCashflowStore } from "@/hooks/useCashflowStore";
import SettingsPanel from "@/components/SettingsPanel";
import SummaryBar from "@/components/SummaryBar";
import CashflowTable from "@/components/CashflowTable";
import AccountGraphs from "@/components/AccountGraphs";
import { AccountKey, exportToCSV } from "@/lib/cashflow";
import { BRAND } from "@/lib/brand";
import { Download, Table2, BarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type TabId = "table" | "graphs";

export default function Home() {
  const {
    settings,
    results,
    updateSettings,
    resetAll,
    setIncomeOpeningAndDistribute,
    setAccountOpeningBalance,
    setMinBalance,
    setBasLodgement,
    setProfitDistribution,
  } = useCashflowStore();

  const [activeTab, setActiveTab] = useState<TabId>("table");

  // ── Table handlers ────────────────────────────────────────

  const handleUpdateIncome = useCallback(
    (monthIndex: number, value: number) => {
      updateSettings((prev) => {
        const months = [...prev.months];
        months[monthIndex] = { ...months[monthIndex], incomeIn: value };
        return { ...prev, months };
      });
    },
    [updateSettings]
  );

  const handleUpdateWithdrawal = useCallback(
    (monthIndex: number, key: AccountKey, value: number) => {
      updateSettings((prev) => {
        const months = [...prev.months];
        months[monthIndex] = {
          ...months[monthIndex],
          withdrawals: { ...months[monthIndex].withdrawals, [key]: value },
        };
        return { ...prev, months };
      });
    },
    [updateSettings]
  );

  const handleBulkIncomeSet = useCallback(
    (value: number) => {
      updateSettings((prev) => {
        const months = prev.months.map((m) => ({ ...m, incomeIn: value }));
        return { ...prev, months };
      });
    },
    [updateSettings]
  );

  const handleUpdateAllocation = useCallback(
    (key: AccountKey, value: number) => {
      updateSettings((prev) => ({
        ...prev,
        allocations: { ...prev.allocations, [key]: value },
      }));
    },
    [updateSettings]
  );

  const handleUpdateStartDate = useCallback(
    (month: number, year: number) => {
      updateSettings((prev) => ({ ...prev, startMonth: month, startYear: year }));
    },
    [updateSettings]
  );

  // ── Export ────────────────────────────────────────────────

  const handleExportCSV = () => {
    const csv = exportToCSV(settings, results);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pfft-cashflow-${settings.startYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Cashflow exported to CSV");
  };

  const handleReset = () => {
    if (window.confirm("Reset all cashflow data? This cannot be undone.")) {
      resetAll();
      toast.success("Cashflow data reset");
    }
  };

  const year1Result = results[11] ?? null;
  const year2Result = results[23] ?? null;

  const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "table", label: "Cashflow Table", icon: <Table2 className="h-3.5 w-3.5" /> },
    { id: "graphs", label: "Account Graphs", icon: <BarChart2 className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Left: Settings panel */}
      <SettingsPanel
        settings={settings}
        onUpdateOpeningBalance={setAccountOpeningBalance}
        onDistributeIncomeOpening={setIncomeOpeningAndDistribute}
        onUpdateAllocation={handleUpdateAllocation}
        onUpdateStartDate={handleUpdateStartDate}
        onUpdateMinBalance={setMinBalance}
        onUpdateBasLodgement={setBasLodgement}
        onUpdateProfitDistribution={setProfitDistribution}
        onReset={handleReset}
      />

      {/* Right: Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* ── Top header ── */}
        <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <img
              src={BRAND.logoSrc}
              alt={BRAND.productName}
              className="h-10 w-10 object-contain rounded-lg shrink-0"
            />
            <div>
              <h1 className="text-lg font-bold text-foreground leading-tight">
                {BRAND.productName}
              </h1>
              <p className="text-xs text-muted-foreground">{BRAND.tagline}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-2 text-sm">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </header>

        {/* ── Summary balance cards — always visible ── */}
        <SummaryBar
          latestResult={results[results.length - 1] ?? null}
          year1Result={year1Result}
          year2Result={year2Result}
        />

        {/* ── Tab bar ── */}
        <div className="flex items-center gap-0 px-6 bg-white border-b border-border shrink-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Tab content ── */}
        <div className="flex-1 overflow-hidden">
          {activeTab === "table" && (
            <CashflowTable
              settings={settings}
              results={results}
              onUpdateIncome={handleUpdateIncome}
              onUpdateWithdrawal={handleUpdateWithdrawal}
              onBulkIncomeSet={handleBulkIncomeSet}
            />
          )}
          {activeTab === "graphs" && (
            <AccountGraphs settings={settings} results={results} />
          )}
        </div>
      </div>
    </div>
  );
}
