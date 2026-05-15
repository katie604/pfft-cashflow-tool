// ============================================================
// PFFT Cashflow Tool — Persistence Hook
// Saves/loads all settings to localStorage
// ============================================================

import { useState, useCallback, useEffect } from "react";
import {
  ProjectionSettings,
  AccountKey,
  AccountBalances,
  defaultSettings,
  calculateProjection,
  MonthResult,
  ACCOUNT_KEYS,
} from "@/lib/cashflow";

const STORAGE_KEY = "pfft-cashflow-v2";

function loadSettings(): ProjectionSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ProjectionSettings;
      // Ensure months array is always 24 entries
      while (parsed.months.length < 24) {
        parsed.months.push({ incomeIn: 0, withdrawals: {} });
      }
      // Strip legacy overrides field if present
      parsed.months = parsed.months.map((m) => ({
        incomeIn: m.incomeIn ?? 0,
        withdrawals: m.withdrawals ?? {},
      }));
      // Migrate: add new fields if missing
      if (!parsed.minBalances) parsed.minBalances = {};
      if (!parsed.basLodgementMonths) parsed.basLodgementMonths = [0, 3, 6, 9];
      if (parsed.basLodgementDay === undefined) parsed.basLodgementDay = 28;
      if (!parsed.profitDistributionMonths) parsed.profitDistributionMonths = [0, 3, 6, 9];
      if (parsed.profitDistributionDay === undefined) parsed.profitDistributionDay = 1;
      return parsed;
    }
  } catch {
    // ignore
  }
  return defaultSettings();
}

function saveSettings(settings: ProjectionSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

/**
 * Distribute a gross income amount across all PF accounts using the
 * PF for Tradies rules:
 *   BAS       = basPct% × gross
 *   Materials = matPct% × gross
 *   RealRev   = gross − BAS − Materials
 *   Profit/OwnersPay/Tax/OpEx = their % × RealRev
 *   Income    = gross − all swept amounts (remainder)
 */
export function distributeIncomeToAccounts(
  gross: number,
  allocations: AccountBalances
): AccountBalances {
  const bas = gross * (allocations.bas / 100);
  const materials = gross * (allocations.materials / 100);
  const realRevenue = Math.max(0, gross - bas - materials);
  const profit = realRevenue * (allocations.profit / 100);
  const ownersPay = realRevenue * (allocations.ownersPay / 100);
  const tax = realRevenue * (allocations.tax / 100);
  const opex = realRevenue * (allocations.opex / 100);
  const totalSwept = bas + materials + profit + ownersPay + tax + opex;
  const income = gross - totalSwept;

  return { income, bas, materials, profit, ownersPay, tax, opex };
}

export function useCashflowStore() {
  const [settings, setSettingsState] = useState<ProjectionSettings>(loadSettings);
  const [results, setResults] = useState<MonthResult[]>(() =>
    calculateProjection(loadSettings())
  );

  const updateSettings = useCallback((updater: (prev: ProjectionSettings) => ProjectionSettings) => {
    setSettingsState((prev) => {
      const next = updater(prev);
      saveSettings(next);
      setResults(calculateProjection(next));
      return next;
    });
  }, []);

  useEffect(() => {
    setResults(calculateProjection(settings));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const resetAll = useCallback(() => {
    const fresh = defaultSettings();
    saveSettings(fresh);
    setSettingsState(fresh);
    setResults(calculateProjection(fresh));
  }, []);

  /**
   * When the Income opening balance is set, auto-distribute it across all
   * other accounts using PF percentages. Individual accounts can still be
   * manually overridden afterwards.
   */
  const setIncomeOpeningAndDistribute = useCallback(
    (grossAmount: number) => {
      updateSettings((prev) => {
        const distributed = distributeIncomeToAccounts(grossAmount, prev.allocations);
        return {
          ...prev,
          openingBalances: distributed,
        };
      });
    },
    [updateSettings]
  );

  /**
   * Manually override a single account's opening balance without
   * redistributing the others.
   */
  const setAccountOpeningBalance = useCallback(
    (key: AccountKey, value: number) => {
      updateSettings((prev) => ({
        ...prev,
        openingBalances: { ...prev.openingBalances, [key]: value },
      }));
    },
    [updateSettings]
  );

  const setMinBalance = useCallback(
    (key: AccountKey, value: number) => {
      updateSettings((prev) => ({
        ...prev,
        minBalances: { ...prev.minBalances, [key]: value },
      }));
    },
    [updateSettings]
  );

  const setBasLodgement = useCallback(
    (months: number[], day: number) => {
      updateSettings((prev) => ({
        ...prev,
        basLodgementMonths: months,
        basLodgementDay: day,
      }));
    },
    [updateSettings]
  );

  const setProfitDistribution = useCallback(
    (months: number[], day: number) => {
      updateSettings((prev) => ({
        ...prev,
        profitDistributionMonths: months,
        profitDistributionDay: day,
      }));
    },
    [updateSettings]
  );

  return {
    settings,
    results,
    updateSettings,
    resetAll,
    setIncomeOpeningAndDistribute,
    setAccountOpeningBalance,
    setMinBalance,
    setBasLodgement,
    setProfitDistribution,
  };
}
