import { useState, useEffect } from "react";
import CourseTable from "../components/admin/CourseTable";
import PrereqEditor from "../components/admin/PrereqEditor";
import CoreqEditor from "../components/admin/CoreqEditor";
import type { Course } from "../types/course";

type Tab = "courses" | "prereqs" | "coreqs";

const SESSION_KEY = "vtcs_admin_pw";

export default function AdminPage() {
  const [password, setPassword] = useState<string>(() => sessionStorage.getItem(SESSION_KEY) ?? "");
  const [authed, setAuthed] = useState(false);
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState(false);
  const [tab, setTab] = useState<Tab>("courses");
  const [courses, setCourses] = useState<Course[]>([]);

  // Verify stored password on load
  useEffect(() => {
    if (!password) return;
    fetch("/api/courses", { headers: { Authorization: `Bearer ${password}` } })
      .then((r) => {
        if (r.ok) setAuthed(true);
        else { sessionStorage.removeItem(SESSION_KEY); setPassword(""); }
      })
      .catch(() => {});
  }, []);

  const loadCourses = () => {
    fetch("/api/courses")
      .then((r) => r.json())
      .then(setCourses)
      .catch(console.error);
  };

  useEffect(() => {
    if (authed) loadCourses();
  }, [authed]);

  const handleLogin = async () => {
    const r = await fetch("/api/health", { headers: { Authorization: `Bearer ${pwInput}` } });
    // We use a protected write endpoint to verify — try creating nothing
    // Instead verify by attempting a known-safe endpoint with auth header
    // Since /api/health has no auth, let's verify by checking a write response style:
    // We'll post to /api/courses with empty body — we want 400 (bad request) not 401
    const verify = await fetch("/api/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${pwInput}` },
      body: JSON.stringify({}),
    });
    if (verify.status === 401) {
      setPwError(true);
      return;
    }
    // 400 means auth passed but bad body — that's fine
    sessionStorage.setItem(SESSION_KEY, pwInput);
    setPassword(pwInput);
    setAuthed(true);
    setPwError(false);
  };

  const handleLogout = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setPassword("");
    setAuthed(false);
    setPwInput("");
  };

  if (!authed) {
    return (
      <div style={styles.loginWrap}>
        <div style={styles.loginCard}>
          <div style={styles.loginTitle}>Admin Access</div>
          <div style={styles.loginSub}>VT CS Prerequisite Map</div>
          <input
            style={{ ...styles.input, borderColor: pwError ? "#dc2626" : "#d1d5db" }}
            type="password"
            placeholder="Enter admin password"
            value={pwInput}
            onChange={(e) => { setPwInput(e.target.value); setPwError(false); }}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            autoFocus
          />
          {pwError && <div style={{ color: "#dc2626", fontSize: 13, marginTop: 4 }}>Incorrect password</div>}
          <button style={styles.btn} onClick={handleLogin}>Sign in</button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <div style={styles.headerTitle}>Admin Panel</div>
          <div style={styles.headerSub}>VT CS Prerequisite Map</div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <a href="/" style={styles.link}>← Back to map</a>
          <button style={styles.logoutBtn} onClick={handleLogout}>Sign out</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={styles.tabBar}>
        {(["courses", "prereqs", "coreqs"] as Tab[]).map((t) => (
          <button
            key={t}
            style={{ ...styles.tabBtn, ...(tab === t ? styles.tabActive : {}) }}
            onClick={() => setTab(t)}
          >
            {t === "courses" ? "Courses" : t === "prereqs" ? "Prerequisites" : "Corequisites"}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={styles.content}>
        {tab === "courses" && (
          <CourseTable courses={courses} password={password} onRefresh={loadCourses} />
        )}
        {tab === "prereqs" && (
          <PrereqEditor courses={courses} password={password} />
        )}
        {tab === "coreqs" && (
          <CoreqEditor courses={courses} password={password} onRefresh={loadCourses} />
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  loginWrap: { display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#f9fafb" },
  loginCard: { background: "#fff", borderRadius: 12, padding: "40px 36px", boxShadow: "0 4px 24px rgba(0,0,0,0.10)", display: "flex", flexDirection: "column", gap: 12, minWidth: 320 },
  loginTitle: { fontSize: 22, fontWeight: 700, color: "#111827" },
  loginSub: { fontSize: 13, color: "#6b7280", marginTop: -6 },
  input: { padding: "10px 12px", borderRadius: 8, border: "1.5px solid #d1d5db", fontSize: 14, outline: "none" },
  btn: { padding: "10px 0", borderRadius: 8, background: "#7b2d2d", color: "#fff", border: "none", fontWeight: 600, fontSize: 14, cursor: "pointer" },
  page: { minHeight: "100vh", background: "#f9fafb", display: "flex", flexDirection: "column" },
  header: { background: "#7b2d2d", color: "#fff", padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" },
  headerTitle: { fontSize: 20, fontWeight: 700 },
  headerSub: { fontSize: 13, opacity: 0.75, marginTop: 2 },
  link: { color: "rgba(255,255,255,0.85)", fontSize: 14, textDecoration: "none" },
  logoutBtn: { padding: "6px 14px", borderRadius: 6, background: "rgba(255,255,255,0.15)", color: "#fff", border: "1px solid rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 13 },
  tabBar: { display: "flex", gap: 0, borderBottom: "1px solid #e5e7eb", background: "#fff", paddingLeft: 32 },
  tabBtn: { padding: "12px 24px", border: "none", background: "none", fontSize: 14, color: "#6b7280", cursor: "pointer", borderBottom: "2px solid transparent", fontWeight: 500 },
  tabActive: { color: "#7b2d2d", borderBottom: "2px solid #7b2d2d", fontWeight: 600 },
  content: { flex: 1, padding: 32 },
};
