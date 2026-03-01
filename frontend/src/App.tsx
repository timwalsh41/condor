import { useState } from "react";
import { DualVideoSynchronizer } from "./components/DualVideoSynchronizer";
import { LibraryView } from "./components/LibraryView";
import { AddToLibraryPanel } from "./components/AddToLibraryPanel";
import "./App.css";

/**
 * Top-level app shell with view navigation.
 *
 * Views:
 *   - "analyze"  → DualVideoSynchronizer with Add-to-Library panel
 *   - "library"  → LibraryView (browse / edit / load)
 *
 * Phase 2, Task 2.7 (Video Library Frontend Workflows)
 */
type View = "analyze" | "library";

function App() {
  const [view, setView] = useState<View>("analyze");

  return (
    <div className="app">
      {/* ── Navigation bar ──────────────────────────────────────────────── */}
      <nav className="app-nav">
        <span className="app-nav__brand">🏌️ Condor</span>
        <div className="app-nav__tabs">
          <button
            className={`app-nav__tab ${view === "analyze" ? "app-nav__tab--active" : ""}`}
            onClick={() => setView("analyze")}
          >
            Analyze
          </button>
          <button
            className={`app-nav__tab ${view === "library" ? "app-nav__tab--active" : ""}`}
            onClick={() => setView("library")}
          >
            Library
          </button>
        </div>
      </nav>

      {/* ── Page content ────────────────────────────────────────────────── */}
      {view === "analyze" && (
        <>
          <AddToLibraryPanel />
          <DualVideoSynchronizer />
        </>
      )}

      {view === "library" && (
        <LibraryView onNavigateToAnalyze={() => setView("analyze")} />
      )}
    </div>
  );
}

export default App;
