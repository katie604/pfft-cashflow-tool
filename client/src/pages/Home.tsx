// ============================================================
// PFFT Cashflow Tool — Home Page
// Tabs: Cashflow Table | Account Graphs
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { useCashflowStore } from "@/hooks/useCashflowStore";
import { useWeeklyBoard } from "@/hooks/useWeeklyBoard";
import SettingsPanel from "@/components/SettingsPanel";
import SummaryBar from "@/components/SummaryBar";
import CashflowTable from "@/components/CashflowTable";
import AccountGraphs from "@/components/AccountGraphs";
import WeeklyBoard from "@/components/WeeklyBoard";
import WeeklyTable from "@/components/WeeklyTable";
import ConnectXeroDialog from "@/components/ConnectXeroDialog";
import { AccountKey, exportToCSV, HORIZON_OPTIONS } from "@/lib/cashflow";
import { BRAND } from "@/lib/brand";
import { Download, Table2, BarChart2, Upload, CalendarRange, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type TabId = "table" | "graphs" | "weekly";

// Local Cash Compass API (python3 api_server.py). Override via ?api= or
// localStorage for a cloud endpoint later.
const CASH_COMPASS_API =
  localStorage.getItem("cc-api-base") ||
  new URLSearchParams(location.search).get("api") ||
  "http://127.0.0.1:8765";

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
    setHorizon,
    importSettings,
  } = useCashflowStore();

  const weeklyBoard = useWeeklyBoard();

  const [activeTab, setActiveTab] = useState<TabId>("table");
  // Always opens on the 13-week weekly view (Katie, 16 Oct 2026).
  const [tableView, setTableView] = useState<"monthly" | "weekly">("weekly");
  const [connectOpen, setConnectOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // The monthly summary cards + month selector only apply to the monthly views.
  const showMonthlyChrome =
    activeTab === "graphs" || (activeTab === "table" && tableView === "monthly");

  // Only show the chosen number of months; data is always held for 24.
  const horizon = settings.horizonMonths ?? 24;
  const viewResults = results.slice(0, horizon);

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

  // ── Profit First Assessment percentages ───────────────────
  // Katie, 16 Oct 2026: the percentages her last Profit First Assessment sent
  // (Approve and send) sit in the % panels here, so they are easy to see. Same
  // store the Allocation Calculator reads; they stay until a new assessment
  // sends new ones. BAS is not part of the assessment, so it is left alone.
  const [pfNote, setPfNote] = useState("");
  const loadAssessmentPcts = useCallback(() => {
    let tenant = "";
    try {
      tenant =
        localStorage.getItem("kcc-tenant") ||
        localStorage.getItem("pfft-pf-alloc-xero-tenant") ||
        "";
    } catch {
      /* ignore */
    }
    if (!tenant) return;
    fetch(`http://127.0.0.1:8766/api/store?tenant=${encodeURIComponent(tenant)}`)
      .then((r) => r.json())
      .then((d) => {
        const p = d?.pcts;
        if (!p) {
          setPfNote("No Profit First Assessment percentages sent for this business yet.");
          return;
        }
        const map: [string, AccountKey][] = [
          ["matsubs", "materials"],
          ["profit", "profit"],
          ["ownerspay", "ownersPay"],
          ["tax", "tax"],
          ["opex", "opex"],
        ];
        updateSettings((prev) => {
          const allocations = { ...prev.allocations };
          map.forEach(([from, to]) => {
            if (p[from] !== undefined && p[from] !== null && p[from] !== "")
              allocations[to] = Number(p[from]);
          });
          return { ...prev, allocations };
        });
        const when = p.updated_at
          ? new Date(p.updated_at).toLocaleDateString("en-AU", {
              day: "numeric",
              month: "long",
              year: "numeric",
              timeZone: "Australia/Sydney",
            })
          : "";
        setPfNote(`From the Profit First Assessment${when ? `, sent ${when}` : ""}.`);
      })
      .catch(() => setPfNote("Could not reach the assessment store - percentages not loaded."));
  }, [updateSettings]);
  useEffect(loadAssessmentPcts, [loadAssessmentPcts]);

  const handleUpdateStartDate = useCallback(
    (month: number, year: number) => {
      updateSettings((prev) => ({ ...prev, startMonth: month, startYear: year }));
    },
    [updateSettings]
  );

  // ── Export ────────────────────────────────────────────────

  const handleExportCSV = () => {
    const csv = exportToCSV(settings, viewResults);
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

  // ── Apply imported/pulled Cash Compass data (shared by file + live) ───

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const applyImportedData = useCallback(
    (data: any, opts?: { confirm?: boolean }): boolean => {
      const incoming = data?.settings ?? data; // {meta,settings,weekly} or bare
      const ok =
        incoming &&
        incoming.openingBalances &&
        incoming.allocations &&
        Array.isArray(incoming.months);
      if (!ok) {
        toast.error("That isn't Cash Compass data.");
        return false;
      }
      if (
        opts?.confirm &&
        !window.confirm(
          "Load this Xero data? It replaces the current opening balances, " +
            "percentages and monthly income."
        )
      ) {
        return false;
      }
      // Keep the user's current view horizon on import.
      importSettings({ ...incoming, horizonMonths: horizon });
      if (data?.weekly?.items) weeklyBoard.setWeekly(data.weekly);
      loadAssessmentPcts(); // an import replaces the % - put the assessment's back
      const meta = data?.meta;
      if (meta) {
        toast.success(
          `Loaded ${meta.client ?? "Xero data"} — opening cash $${(
            meta.startingCash ?? 0
          ).toLocaleString("en-AU")}`
        );
        (meta.warnings ?? []).forEach((w: string) => toast.warning(w));
      } else {
        toast.success("Xero data loaded");
      }
      return true;
    },
    [horizon, importSettings, weeklyBoard, loadAssessmentPcts]
  );
  /* eslint-enable @typescript-eslint/no-explicit-any */

  // ── Import from a file (fallback) ───

  const handleImportClick = () => fileInputRef.current?.click();

  const handleXeroFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-importing the same filename
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        applyImportedData(JSON.parse(reader.result as string), { confirm: true });
      } catch {
        toast.error("Couldn't read that file.");
      }
    };
    reader.readAsText(file);
  };

  const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "table", label: "Cashflow Table", icon: <Table2 className="h-3.5 w-3.5" /> },
    { id: "graphs", label: "Account Graphs", icon: <BarChart2 className="h-3.5 w-3.5" /> },
    { id: "weekly", label: "Weekly What-If", icon: <CalendarRange className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Left: Settings panel */}
      <SettingsPanel
        settings={settings}
        onUpdateOpeningBalance={setAccountOpeningBalance}
        onDistributeIncomeOpening={setIncomeOpeningAndDistribute}
        onUpdateAllocation={handleUpdateAllocation}
        pfNote={pfNote}
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
              src={import.meta.env.BASE_URL + BRAND.logoSrc}
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
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleXeroFile}
              className="hidden"
            />
            <Button
              size="sm"
              onClick={() => setConnectOpen(true)}
              className="gap-2 text-sm"
            >
              <Zap className="h-4 w-4" />
              Connect Xero
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleImportClick}
              className="gap-2 text-sm"
              title="Load a Cash Compass export file"
            >
              <Upload className="h-4 w-4" />
              From file
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-2 text-sm">
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </header>

        {connectOpen && (
          <ConnectXeroDialog
            apiBase={CASH_COMPASS_API}
            onLoad={(data) => applyImportedData(data)}
            onClose={() => setConnectOpen(false)}
          />
        )}

        {/* ── Summary balance cards (monthly views only) ── */}
        {showMonthlyChrome && (
          <SummaryBar results={viewResults} horizonMonths={horizon} />
        )}

        {/* ── Tab bar + horizon selector ── */}
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

          {/* Forecast horizon selector (monthly views only) */}
          {showMonthlyChrome && (
          <div className="ml-auto flex items-center gap-2 py-2">
            <span className="text-xs text-muted-foreground hidden sm:inline">Show:</span>
            <div className="inline-flex rounded-lg border border-border overflow-hidden">
              {HORIZON_OPTIONS.map((m) => (
                <button
                  key={m}
                  onClick={() => setHorizon(m)}
                  className={`px-2.5 py-1 text-xs font-medium transition-colors border-r border-border last:border-r-0 ${
                    horizon === m
                      ? "bg-primary text-primary-foreground"
                      : "bg-white text-muted-foreground hover:bg-muted"
                  }`}
                  title={`${m} month${m === 1 ? "" : "s"}`}
                >
                  {m === 12 ? "1yr" : m === 24 ? "2yr" : `${m}mo`}
                </button>
              ))}
            </div>
          </div>
          )}
        </div>

        {/* ── Tab content ── */}
        <div className="flex-1 overflow-hidden">
          {activeTab === "table" && (
            <div className="flex flex-col h-full">
              {/* Monthly ↔ weekly toggle */}
              <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-border shrink-0">
                <span className="text-xs text-muted-foreground">View:</span>
                <div className="inline-flex rounded-lg border border-border overflow-hidden">
                  {([
                    ["monthly", "Monthly (Profit First)"],
                    ["weekly", "Weekly (13-week)"],
                  ] as const).map(([v, label]) => (
                    <button
                      key={v}
                      onClick={() => setTableView(v)}
                      className={`px-3 py-1 text-xs font-medium border-r border-border last:border-r-0 ${
                        tableView === v
                          ? "bg-primary text-primary-foreground"
                          : "bg-white text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 min-h-0">
                {tableView === "monthly" ? (
                  <CashflowTable
                    settings={settings}
                    results={viewResults}
                    onUpdateIncome={handleUpdateIncome}
                    onUpdateWithdrawal={handleUpdateWithdrawal}
                    onBulkIncomeSet={handleBulkIncomeSet}
                  />
                ) : (
                  <WeeklyTable
                    weekly={weeklyBoard.weekly}
                    allocations={settings.allocations}
                    onSetIncome={weeklyBoard.setIncomeOverride}
                    onSetRecurring={weeklyBoard.setRecurringAmount}
                  />
                )}
              </div>
            </div>
          )}
          {activeTab === "graphs" && (
            <AccountGraphs settings={settings} results={viewResults} />
          )}
          {activeTab === "weekly" && (
            // Katie, 16 Oct 2026: the What-If is the cash flow table again, with
            // play percentages, expenses she adds and "needs $X more income".
            <WeeklyTable
              weekly={weeklyBoard.weekly}
              allocations={settings.allocations}
              onSetIncome={weeklyBoard.setIncomeOverride}
              onSetRecurring={weeklyBoard.setRecurringAmount}
              whatIf={{ addItem: weeklyBoard.addItem, deleteItem: weeklyBoard.deleteItem }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
