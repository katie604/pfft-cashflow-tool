// ============================================================
// Connect Xero — pull a client's live data straight from the
// local Cash Compass API (no file step).
// ============================================================

import { useEffect, useState } from "react";
import { X, RefreshCw, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

interface XeroClient {
  slug: string;
  name: string;
}

interface Props {
  apiBase: string;
  onLoad: (data: unknown) => void;
  onClose: () => void;
}

export default function ConnectXeroDialog({ apiBase, onLoad, onClose }: Props) {
  const [clients, setClients] = useState<XeroClient[] | null>(null);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pulling, setPulling] = useState(false);

  const loadClients = () => {
    setError(null);
    setClients(null);
    fetch(`${apiBase}/api/clients`)
      .then((r) => r.json())
      .then((d) => {
        const list: XeroClient[] = d.clients ?? [];
        setClients(list);
        if (list.length) setSelected(list[0].slug);
      })
      .catch(() => {
        setError(
          "Can't reach the Cash Compass server. Start it on your Mac:\n" +
            "python3 api_server.py"
        );
      });
  };

  useEffect(loadClients, [apiBase]);

  const pull = () => {
    if (!selected) return;
    setPulling(true);
    setError(null);
    fetch(`${apiBase}/api/cashflow?tenant=${encodeURIComponent(selected)}`)
      .then((r) => r.json())
      .then((data) => {
        if ((data as { error?: string })?.error) {
          setError((data as { error: string }).error);
          setPulling(false);
          return;
        }
        // Remember which business this is, so its Profit First Assessment
        // percentages can be loaded into the panel (Katie, 16 Oct 2026).
        try {
          localStorage.setItem("kcc-tenant", selected);
        } catch {
          /* ignore */
        }
        onLoad(data);
        onClose();
      })
      .catch(() => {
        setError("Pull failed — is the Cash Compass server still running?");
        setPulling(false);
      });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Connect Xero
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Pull a client's live Xero data straight into the tool.
        </p>

        {error && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 mb-3 whitespace-pre-line">
            {error}
            <button onClick={loadClients} className="mt-2 flex items-center gap-1 text-primary hover:underline">
              <RefreshCw className="h-3 w-3" /> Try again
            </button>
          </div>
        )}

        {!error && clients === null && (
          <div className="text-sm text-muted-foreground py-4 text-center">Loading clients…</div>
        )}

        {clients && clients.length > 0 && (
          <>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Client ({clients.length} connected)
            </label>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="w-full mt-1 mb-4 text-sm bg-white border border-border rounded-lg px-3 py-2"
            >
              {clients.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
              <Button size="sm" onClick={pull} disabled={pulling} className="gap-1.5">
                {pulling ? (
                  <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Pulling…</>
                ) : (
                  <><Zap className="h-3.5 w-3.5" /> Pull live data</>
                )}
              </Button>
            </div>
          </>
        )}

        {clients && clients.length === 0 && (
          <div className="text-sm text-muted-foreground py-3">
            No Xero clients connected yet.
          </div>
        )}
      </div>
    </div>
  );
}
