// ============================================================
// Weekly what-if board store — persisted to localStorage,
// independent of the monthly PF projection.
// ============================================================

import { useCallback, useState } from "react";
import {
  WeeklyData,
  WeeklyItem,
  emptyWeekly,
  DEFAULT_RECURRING,
} from "@/lib/weekly";

const STORAGE_KEY = "pfft-weekly-v1";

function withDefaults(d: WeeklyData): WeeklyData {
  // Seed the payroll lines if this data doesn't have them yet.
  if (!d.recurringLines || d.recurringLines.length === 0) {
    return { ...d, recurringLines: DEFAULT_RECURRING.map((r) => ({ ...r })) };
  }
  return d;
}

function load(): WeeklyData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as WeeklyData;
      if (parsed && Array.isArray(parsed.items)) return withDefaults(parsed);
    }
  } catch {
    // ignore
  }
  return withDefaults(emptyWeekly());
}

function save(data: WeeklyData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

let manualCounter = 0;

export function useWeeklyBoard() {
  const [weekly, setWeeklyState] = useState<WeeklyData>(load);

  const update = useCallback((next: WeeklyData) => {
    save(next);
    setWeeklyState(next);
  }, []);

  /** Replace the board from a fresh Xero pull, but KEEP the payroll lines
   *  (they're your assumptions, not Xero data). */
  const setWeekly = useCallback((data: WeeklyData) => {
    setWeeklyState((prev) => {
      const next: WeeklyData = {
        ...emptyWeekly(),
        ...data,
        recurringLines:
          data.recurringLines ?? prev.recurringLines ?? DEFAULT_RECURRING.map((r) => ({ ...r })),
      };
      save(next);
      return next;
    });
  }, []);

  /** Move an item to a different week (drag-drop / reschedule). */
  const moveItem = useCallback(
    (id: string, week: number) => {
      setWeeklyState((prev) => {
        const next = {
          ...prev,
          items: prev.items.map((i) =>
            i.id === id ? { ...i, week: Math.max(0, week) } : i
          ),
        };
        save(next);
        return next;
      });
    },
    []
  );

  const addItem = useCallback((partial: Omit<WeeklyItem, "id" | "source">) => {
    setWeeklyState((prev) => {
      const item: WeeklyItem = {
        ...partial,
        id: `manual-${manualCounter++}-${prev.items.length}`,
        source: "manual",
      };
      const next = { ...prev, items: [...prev.items, item] };
      save(next);
      return next;
    });
  }, []);

  const updateItem = useCallback(
    (id: string, patch: Partial<WeeklyItem>) => {
      setWeeklyState((prev) => {
        const next = {
          ...prev,
          items: prev.items.map((i) => (i.id === id ? { ...i, ...patch } : i)),
        };
        save(next);
        return next;
      });
    },
    []
  );

  const deleteItem = useCallback((id: string) => {
    setWeeklyState((prev) => {
      const next = { ...prev, items: prev.items.filter((i) => i.id !== id) };
      save(next);
      return next;
    });
  }, []);

  const setStartingCash = useCallback((amount: number) => {
    setWeeklyState((prev) => {
      const next = { ...prev, startingCash: amount };
      save(next);
      return next;
    });
  }, []);

  const setIncomeOverride = useCallback((amount: number) => {
    setWeeklyState((prev) => {
      const next = { ...prev, incomeOverride: amount };
      save(next);
      return next;
    });
  }, []);

  const setRecurringAmount = useCallback((id: string, amount: number) => {
    setWeeklyState((prev) => {
      const lines = (prev.recurringLines ?? []).map((r) =>
        r.id === id ? { ...r, weeklyAmount: amount } : r
      );
      const next = { ...prev, recurringLines: lines };
      save(next);
      return next;
    });
  }, []);

  const resetWeekly = useCallback(() => update(emptyWeekly()), [update]);

  return {
    weekly,
    setWeekly,
    moveItem,
    addItem,
    updateItem,
    deleteItem,
    setStartingCash,
    setIncomeOverride,
    setRecurringAmount,
    resetWeekly,
  };
}
