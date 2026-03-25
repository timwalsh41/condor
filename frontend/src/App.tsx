import { useState } from "react";
import { DualVideoSynchronizer } from "./components/DualVideoSynchronizer";
import { LibraryView } from "./components/LibraryView";
import { SessionsView } from "./components/SessionsView";
import { AddToLibraryPanel } from "./components/AddToLibraryPanel";
import { SaveSessionPanel } from "./components/SaveSessionPanel";
import { useVideoStore } from "./store/videoStore";
import { useLibraryStore } from "./store/libraryStore";
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
  
  // Check if videos need saving to library (for session save validation)
  const { videoA, videoB } = useVideoStore();
  const { isVideoInLibrary } = useLibraryStore();
  
  const hasVideoA = !!videoA?.metadata;
  const hasVideoB = !!videoB?.metadata;
  const videoAInLibrary = hasVideoA && videoA?.metadata?.video_id ? isVideoInLibrary(videoA.metadata.video_id) : false;
  const videoBInLibrary = hasVideoB && videoB?.metadata?.video_id ? isVideoInLibrary(videoB.metadata.video_id) : false;
  const videosNeedSaving = (hasVideoA && !videoAInLibrary) || (hasVideoB && !videoBInLibrary);

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

      {/* Analyze view is always mounted to preserve decoder/annotation state
          across navigation; display:none hides it when another view is active. */}
      <div style={{ display: view === "analyze" ? "block" : "none" }}>
        <AddToLibraryPanel highlightUnsaved={videosNeedSaving}>
          <SaveSessionPanel videosNeedSaving={videosNeedSaving} />
        </AddToLibraryPanel>
        <DualVideoSynchronizer />
      </div>

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
