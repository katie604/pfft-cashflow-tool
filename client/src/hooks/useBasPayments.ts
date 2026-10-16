// ============================================================
// BAS payments to the ATO - due date + amount, typed in by Katie
// (16 Oct 2026). Kept per business in a file on her Mac via the
// cash-compass helper, so the dev page, the double-click file and
// every Chrome profile agree. The weekly table pays them out of BAS;
// the Account Graphs draw their BAS due markers from the same list.
// ============================================================

import { useCallback, useEffect, useState } from "react";
import type { BasPayment } from "@/lib/weekly";

const HELPER = "http://127.0.0.1:8765";

function currentTenant(): string {
  try {
    return localStorage.getItem("kcc-tenant") || localStorage.getItem("pfft-pf-alloc-xero-tenant") || "";
  } catch {
    return "";
  }
}

export function useBasPayments(): [BasPayment[], (next: BasPayment[]) => void] {
  const [payments, setPayments] = useState<BasPayment[]>([]);

  useEffect(() => {
    const t = currentTenant();
    if (!t) return;
    fetch(`${HELPER}/api/bas?tenant=${encodeURIComponent(t)}`)
      .then((r) => r.json())
      .then((d) => setPayments((d?.payments ?? []) as BasPayment[]))
      .catch(() => {
        /* helper not running */
      });
  }, []);

  const save = useCallback((next: BasPayment[]) => {
    const sorted = [...next].sort((a, b) => a.due.localeCompare(b.due));
    setPayments(sorted);
    const t = currentTenant();
    if (t)
      fetch(`${HELPER}/api/bas`, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ tenant: t, payments: sorted }),
      }).catch(() => {
        /* helper not running */
      });
  }, []);

  return [payments, save];
}
