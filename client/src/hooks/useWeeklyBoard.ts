// ============================================================
// Weekly what-if board store — persisted to localStorage,
// independent of the monthly PF projection.
// ============================================================

import { useCallback, useEffect, useState } from "react";
import {
  WeeklyData,
  WeeklyItem,
  emptyWeekly,
  DEFAULT_RECURRING,
  RECURRING_ROUTES,
  RecurringLine,
} from "@/lib/weekly";

// Weekly amounts for the recurring lines live in a file on Katie's Mac via the
// cash-compass helper (per business), so the dev page and the double-click file agree
// and Claude can enter them (Katie, 16 Oct 2026). Browser storage is the fallback.
const HELPER = "http://127.0.0.1:8765";
function currentTenant(): string {
  try {
    return localStorage.getItem("kcc-tenant") || localStorage.getItem("pfft-pf-alloc-xero-tenant") || "";
  } catch {
    return "";
  }
}

const STORAGE_KEY = "pfft-weekly-v1";

function withDefaults(d: WeeklyData): WeeklyData {
  // Seed the payroll lines if this data doesn't have them yet.
  if (!d.recurringLines || d.recurringLines.length === 0) {
    return { ...d, recurringLines: DEFAULT_RECURRING.map((r) => ({ ...r })) };
  }
  // Lines saved before routing existed pick up where PAYG / super move to,
  // and any seeded line added since (e.g. Transfer to Wise) is appended.
  const have = new Set(d.recurringLines.map((r) => r.id));
  return {
    ...d,
    recurringLines: [
      ...d.recurringLines.map((r) =>
        r.toAccount || !RECURRING_ROUTES[r.id] ? r : { ...r, toAccount: RECURRING_ROUTES[r.id] }
      ),
      ...DEFAULT_RECURRING.filter((r) => !have.has(r.id)).map((r) => ({ ...r })),
    ],
  };
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

  // Pull this business's recurring amounts from the helper's file.
  useEffect(() => {
    const t = currentTenant();
    if (!t) return;
    fetch(`${HELPER}/api/recurring?tenant=${encodeURIComponent(t)}`)
      .then((r) => r.json())
      .then((d) => {
        const amounts: Record<string, number> = d?.amounts ?? {};
        const labels: Record<string, string> = d?.labels ?? {};
        // Business-specific lines (e.g. one wage line per team member) and the
        // seeded lines they replace.
        const extra: RecurringLine[] = d?.lines ?? [];
        const hide = new Set<string>(d?.hide ?? []);
        if (!Object.keys(amounts).length && !Object.keys(labels).length && !extra.length) return;
        setWeeklyState((prev) => {
          const next = {
            ...prev,
            recurringLines: [
              ...(prev.recurringLines ?? []).filter((r) => !hide.has(r.id)),
              ...extra
                .filter((x) => !(prev.recurringLines ?? []).some((r) => r.id === x.id))
                .map((x) => ({ ...x, weeklyAmount: 0 })),
            ].map((r) =>
              ({
                ...r,
                ...(amounts[r.id] !== undefined ? { weeklyAmount: Number(amounts[r.id]) } : {}),
                ...(labels[r.id] ? { inLabel: labels[r.id] } : {}),
              })
            ),
          };
          save(next);
          return next;
        });
      })
      .catch(() => {
        /* helper not running - keep what the browser has */
      });
  }, []);

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
    const t = currentTenant();
    if (t)
      fetch(`${HELPER}/api/recurring`, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ tenant: t, id, amount }),
      }).catch(() => {
        /* helper not running - the browser copy still holds it */
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
