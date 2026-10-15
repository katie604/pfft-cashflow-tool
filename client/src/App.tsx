import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";

// One page, two tools, chosen from the rail down the left (Katie, 16 Oct 2026).
// The Allocation Calculator is NOT a copy: client/public/allocation-calculator.html is a
// symlink to my-powerhouse/calculators/pfft-profit-first-allocation-calculator.html, so
// there is still one canonical build (.claude/rules/base-level-tools.md).
// The Profit First Assessment sits under Cashflow Creation the same way - a symlink to
// my-powerhouse/calculators/pfft-profit-first-assessment.html (Katie, 16 Oct 2026).
type View = "cashflow" | "allocation" | "assessment";

const VIEWS: { id: View; label: string }[] = [
  { id: "allocation", label: "Allocation Calculator" },
  { id: "cashflow", label: "Cashflow Creation" },
  { id: "assessment", label: "Profit First Assessment" },
];

const STORE_KEY = "kcc-view";

// Single-file build (scripts/build_single.py, Katie 16 Oct 2026): the embedded pages travel
// inside the file as window.__EMBED, so a frame loads from there with no server. Otherwise
// the frame loads the page that sits next to the app, exactly as before.
const EMBED = (window as unknown as { __EMBED?: Record<string, string> }).__EMBED;
function frame(file: string, search = ""): { src?: string; srcDoc?: string } {
  if (EMBED && EMBED[file]) {
    // An embedded page cannot see this address, so hand it the query to read instead.
    (window as unknown as { __frameQS?: string }).__frameQS = search;
    return { srcDoc: EMBED[file] };
  }
  return { src: import.meta.env.BASE_URL + file + search };
}

function initialView(): View {
  const hash = window.location.hash.replace("#", "");
  if (hash === "allocation" || hash === "cashflow" || hash === "assessment") return hash;
  try {
    const saved = localStorage.getItem(STORE_KEY);
    if (saved === "allocation" || saved === "cashflow" || saved === "assessment") return saved;
  } catch {
    /* storage blocked - fall through to the default */
  }
  return "allocation"; // first tab is the default (Katie, 16 Oct 2026)
}

function App() {
  const [view, setView] = useState<View>(initialView);

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, view);
    } catch {
      /* storage blocked - the tab just will not be remembered */
    }
    history.replaceState(null, "", "#" + view);
  }, [view]);

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <div className="flex h-screen overflow-hidden">
            <nav
              className="flex flex-col shrink-0 w-44 py-4 gap-1"
              style={{ background: "#1F3D6E" }}
              aria-label="Tools"
            >
              <div
                className="px-4 pb-3 text-[10px] font-bold uppercase tracking-widest"
                style={{ color: "#a8c6ea" }}
              >
                Tools
              </div>
              {VIEWS.map(v => {
                const active = v.id === view;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setView(v.id)}
                    aria-current={active ? "page" : undefined}
                    className="text-left px-4 py-2.5 text-sm font-semibold text-white border-l-4 transition-colors"
                    style={{
                      background: active ? "#2c5290" : "transparent",
                      borderLeftColor: active ? "#a8c6ea" : "transparent",
                    }}
                  >
                    {v.label}
                  </button>
                );
              })}
            </nav>

            {/* Cashflow stays mounted while hidden, so nothing typed is lost on a switch. */}
            <div className={view === "cashflow" ? "flex-1 min-w-0" : "hidden"}>
              <Home />
            </div>

            {view === "allocation" && (
              <iframe
                title="Allocation Calculator"
                // Pass ?income= (and any other query) through - the calculator pre-fills from it.
                {...frame("allocation-calculator.html", window.location.search)}
                className="flex-1 min-w-0 h-full border-0 bg-white"
              />
            )}
            {view === "assessment" && (
              <iframe
                title="Profit First Assessment"
                {...frame("profit-first-assessment.html")}
                className="flex-1 min-w-0 h-full border-0 bg-white"
              />
            )}
          </div>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
