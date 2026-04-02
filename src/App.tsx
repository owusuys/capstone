import { useState, useEffect, useCallback } from "react";
import type { Node, Edge } from "reactflow";
import GraphView from "./components/GraphView";
import FocusGraphView from "./components/FocusGraphView";
import PathwayView from "./components/PathwayView";
import ExploreGraphView from "./components/ExploreGraphView";
import InfoPanel from "./components/InfoPanel";
import ModeToggle from "./components/ModeToggle";
import ViewModeToggle from "./components/ViewModeToggle";
import SearchBox from "./components/SearchBox";
import type { ViewMode } from "./components/ViewModeToggle";
import type { Course, PrereqEdge, HighlightMode } from "./types/course";
import { computeElkLayout } from "./utils/elkLayout";
import "./App.css";

function App() {
  const [mode, setMode] = useState<HighlightMode | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("overview");
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [highlightedNodes, setHighlightedNodes] = useState<Set<string>>(
    new Set()
  );
  const [elkNodes, setElkNodes] = useState<Node[] | null>(null);
  const [elkEdges, setElkEdges] = useState<Edge[] | null>(null);
  const [elkLoading, setElkLoading] = useState(true);
  const [searchCourseId, setSearchCourseId] = useState<string | null>(null);
  const [prereqDepth, setPrereqDepth] = useState<number>(Infinity);
  const [unlockedDepth, setUnlockedDepth] = useState<number>(Infinity);
  const [pinnedCourseIds, setPinnedCourseIds] = useState<Set<string>>(new Set());

  const [courses, setCourses] = useState<Course[]>([]);
  const [prereqEdges, setPrereqEdges] = useState<PrereqEdge[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  // Fetch course data from the API on mount
  useEffect(() => {
    Promise.all([
      fetch("/api/courses").then((r) => r.json()),
      fetch("/api/edges").then((r) => r.json()),
    ])
      .then(([coursesData, edgesData]) => {
        setCourses(coursesData as Course[]);
        setPrereqEdges(edgesData as PrereqEdge[]);
        return computeElkLayout(coursesData as Course[], edgesData as PrereqEdge[]);
      })
      .then(({ nodes, edges }) => {
        setElkNodes(nodes);
        setElkEdges(edges);
      })
      .catch((err) => {
        console.error("Failed to load course data:", err);
        setDataError("Could not connect to the API. Make sure the server is running on port 3001.");
      })
      .finally(() => {
        setDataLoading(false);
        setElkLoading(false);
      });
  }, []);

  const handleViewModeChange = (newMode: ViewMode) => {
    setViewMode(newMode);
    setSelectedCourse(null);
    setHighlightedNodes(new Set());
    if (newMode !== "explore") setPinnedCourseIds(new Set());
  };

  const handlePinCourse = useCallback((courseId: string) => {
    setPinnedCourseIds((prev) => new Set([...prev, courseId]));
  }, []);

  const handleUnpinCourse = useCallback((courseId: string) => {
    setPinnedCourseIds((prev) => {
      const next = new Set(prev);
      next.delete(courseId);
      return next;
    });
  }, []);

  const handleSearch = useCallback((courseId: string) => {
    setSearchCourseId(courseId);
    setTimeout(() => setSearchCourseId(null), 100);
  }, []);

  if (dataLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", flexDirection: "column", gap: 12, color: "#6b7280" }}>
        <div style={{ fontSize: 24 }}>Loading course data…</div>
        <div style={{ fontSize: 13 }}>Connecting to API server</div>
      </div>
    );
  }

  if (dataError) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", flexDirection: "column", gap: 12, color: "#dc2626" }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>Connection Error</div>
        <div style={{ fontSize: 14, maxWidth: 420, textAlign: "center", color: "#374151" }}>{dataError}</div>
        <button
          style={{ marginTop: 8, padding: "8px 20px", borderRadius: 6, border: "1px solid #d1d5db", cursor: "pointer", fontSize: 14 }}
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <h1>VT CS Prerequisite Map</h1>
          <span className="subtitle">Virginia Tech Computer Science</span>
        </div>
        <div className="header-center">
          <SearchBox courses={courses} onSearch={handleSearch} />
        </div>
        <div className="header-right">
          <ViewModeToggle
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
          />
          <div className="header-divider" />
          <ModeToggle mode={mode} onModeChange={setMode} />
          <div className="header-divider" />
          <a href="/pathways" style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, textDecoration: "none", fontWeight: 500, whiteSpace: "nowrap" }}>
            Pathways
          </a>
        </div>
      </header>
      <div className="main">
        {viewMode === "overview" && (
          <GraphView
            courses={courses}
            prereqEdges={prereqEdges}
            mode={mode}
            onSelectCourse={setSelectedCourse}
            onHighlight={setHighlightedNodes}
            elkNodes={elkNodes}
            elkEdges={elkEdges}
            elkLoading={elkLoading}
            searchCourseId={searchCourseId}
            prereqDepth={prereqDepth}
            unlockedDepth={unlockedDepth}
            onPrereqDepthChange={setPrereqDepth}
            onUnlockedDepthChange={setUnlockedDepth}
          />
        )}
        {viewMode === "focus" && (
          <FocusGraphView
            courses={courses}
            prereqEdges={prereqEdges}
            mode={mode}
            onSelectCourse={setSelectedCourse}
            onHighlight={setHighlightedNodes}
            searchCourseId={searchCourseId}
          />
        )}
        {viewMode === "pathway" && (
          <PathwayView
            courses={courses}
            prereqEdges={prereqEdges}
            onSelectCourse={setSelectedCourse}
            onHighlight={setHighlightedNodes}
            searchCourseId={searchCourseId}
          />
        )}
        {viewMode === "explore" && (
          <ExploreGraphView
            courses={courses}
            prereqEdges={prereqEdges}
            mode={mode}
            onSelectCourse={setSelectedCourse}
            onHighlight={setHighlightedNodes}
            searchCourseId={searchCourseId}
            prereqDepth={prereqDepth}
            unlockedDepth={unlockedDepth}
            onPrereqDepthChange={setPrereqDepth}
            onUnlockedDepthChange={setUnlockedDepth}
            pinnedCourseIds={pinnedCourseIds}
          />
        )}
        <InfoPanel
          course={selectedCourse}
          mode={mode}
          highlightedNodes={highlightedNodes}
          allCourses={courses}
          isPinned={viewMode === "explore" && selectedCourse !== null ? pinnedCourseIds.has(selectedCourse.id) : undefined}
          onPin={viewMode === "explore" && selectedCourse !== null ? () => handlePinCourse(selectedCourse.id) : undefined}
          onUnpin={viewMode === "explore" && selectedCourse !== null ? () => handleUnpinCourse(selectedCourse.id) : undefined}
        />
      </div>
    </div>
  );
}

export default App;
