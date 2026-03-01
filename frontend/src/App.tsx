import { useState } from "react";
import { DualVideoSynchronizer } from "./components/DualVideoSynchronizer";
import { LibraryView } from "./components/LibraryView";
import { SessionsView } from "./components/SessionsView";
import { AddToLibraryPanel } from "./components/AddToLibraryPanel";
import { SaveSessionPanel } from "./components/SaveSessionPanel";
import "./App.css";

/**
 * Top-level app shell with view navigation.
 *
 * Views:
 *   - "analyze"  → DualVideoSynchronizer with Add-to-Library and Save-Session panels
 *   - "library"  → LibraryView (browse / edit / load)
 *   - "sessions" → SessionsView (list / load / delete saved sessions)
 *
 * Phase 2, Task 2.9 (Session Persistence Frontend Workflows)
 */
type View = "analyze" | "library" | "sessions";

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
          <button
            className={`app-nav__tab ${view === "sessions" ? "app-nav__tab--active" : ""}`}
            onClick={() => setView("sessions")}
          >
            Sessions
          </button>
        </div>
      </nav>

      {/* ── Page content ────────────────────────────────────────────────── */}
      {view === "analyze" && (
        <>
          <AddToLibraryPanel>
            <SaveSessionPanel />
          </AddToLibraryPanel>
          <DualVideoSynchronizer />
        </>
      )}

      {view === "library" && (
        <LibraryView onNavigateToAnalyze={() => setView("analyze")} />
      )}

      {view === "sessions" && (
        <SessionsView onNavigateToAnalyze={() => setView("analyze")} />
      )}
    </div>
  );
}

export default App;
