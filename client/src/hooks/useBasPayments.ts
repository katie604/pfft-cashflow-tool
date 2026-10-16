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

export function useBasPayments(): [BasPayment[], (next: BasPayment[]) => void, string] {
  const [payments, setPayments] = useState<BasPayment[]>([]);
  // Katie, 16 Oct 2026: a save that failed looked exactly like one that worked.
  // Now every save says what happened.
  const [status, setStatus] = useState("");

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
    if (!t) {
      setStatus("NOT saved: no business picked on this page");
      return;
    }
    setStatus("Saving...");
    fetch(`${HELPER}/api/bas`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ tenant: t, payments: sorted }),
    })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok || !d?.ok) throw new Error(d?.error || `helper said ${r.status}`);
        const q = sorted.map((p) => p.amount);
        const back = (d.payments as BasPayment[]).map((p) => p.amount);
        if (JSON.stringify(q) !== JSON.stringify(back)) throw new Error("saved, but it read back different");
        setStatus(`Saved ✓ ${new Date().toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", second: "2-digit" })}`);
      })
      .catch((e) => setStatus(`NOT saved: ${e?.message || e}`));
  }, []);

  return [payments, save, status];
}
