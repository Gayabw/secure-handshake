import "./AuditorDashboard.css";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  FaSun,
  FaMoon,
  FaClipboardCheck,
  FaFileAlt,
  FaListAlt,
  FaShieldAlt,
  FaHistory,
  FaSignOutAlt,
} from "react-icons/fa";
import { MdDashboard, MdOutlineVerifiedUser } from "react-icons/md";
import logo from "../../../assets/logo.png";
import { useNavigate, Link } from "react-router-dom";
import {
  fetchMetricsOverview,
  fetchEventLogs,
  fetchAnomalies,
} from "../../../services/dashboardService";
import { clearLoggedInUser } from "../../../services/authService";

type AuditorDashboardProps = {
  theme: "light" | "dark";
  toggleTheme: () => void;
};

type AuditStatus = "passed" | "review" | "flagged";

type AuditEntry = {
  id: number;
  message: string;
  status: AuditStatus;
  time: string;
};

type SidebarItem = {
  label: string;
  icon: ReactNode;
};

const sidebarItems: SidebarItem[] = [
  { label: "Overview", icon: <MdDashboard /> },
  { label: "Audit Trails", icon: <FaHistory /> },
  { label: "Compliance Checks", icon: <FaClipboardCheck /> },
  { label: "Verification Logs", icon: <MdOutlineVerifiedUser /> },
  { label: "Security Findings", icon: <FaShieldAlt /> },
  { label: "Reports", icon: <FaFileAlt /> },
  { label: "Event Records", icon: <FaListAlt /> },
];

function formatRelativeTime(value: string | null | undefined): string {
  if (!value) return "Recently";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Recently";
  }

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes} mins ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hrs ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} days ago`;
}

function mapAuditStatus(value: string | null | undefined): AuditStatus {
  const normalized = String(value || "").toLowerCase();

  if (normalized === "resolved" || normalized === "closed" || normalized === "passed") {
    return "passed";
  }

  if (normalized === "open" || normalized === "high" || normalized === "critical") {
    return "flagged";
  }

  return "review";
}

function AuditorDashboard({
  theme,
  toggleTheme,
}: AuditorDashboardProps) {
  const navigate = useNavigate();

  const [metricsOverview, setMetricsOverview] = useState<any>(null);
  const [eventLogs, setEventLogs] = useState<any[]>([]);
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const handleLogout = () => {
    clearLoggedInUser();
    navigate("/role-selection", { replace: true });
  };

  useEffect(() => {
    async function loadDashboardData() {
      try {
        setLoading(true);
        setError("");

        const orgId = 1;

        const [metricsResponse, eventLogsResponse, anomaliesResponse] =
          await Promise.all([
            fetchMetricsOverview(orgId),
            fetchEventLogs(orgId, 10),
            fetchAnomalies(orgId, 10),
          ]);

        setMetricsOverview(metricsResponse?.data || null);
        setEventLogs(
          Array.isArray(eventLogsResponse?.items) ? eventLogsResponse.items : []
        );
        setAnomalies(
          Array.isArray(anomaliesResponse?.items) ? anomaliesResponse.items : []
        );
      } catch (err: any) {
        setError(
          err?.response?.data?.error || "Failed to load dashboard data."
        );
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  const statCards = useMemo(() => {
    const counts = metricsOverview?.counts || {};
    const totalReviewed = (counts.handshakes ?? 0) + eventLogs.length;
    const pendingReviews = anomalies.filter((item) =>
      ["open", "investigating", "medium"].includes(
        String(item?.status || item?.severity || "").toLowerCase()
      )
    ).length;
    const flaggedFindings = anomalies.filter((item) =>
      ["high", "critical"].includes(String(item?.severity || "").toLowerCase())
    ).length;

    const complianceRate =
      totalReviewed > 0
        ? `${Math.max(
            0,
            Math.min(
              100,
              Math.round(((totalReviewed - flaggedFindings) / totalReviewed) * 100)
            )
          )}%`
        : "100%";

    return [
      { title: "Audits Completed", value: String(totalReviewed) },
      { title: "Pending Reviews", value: String(pendingReviews) },
      { title: "Flagged Findings", value: String(flaggedFindings) },
      { title: "Compliance Rate", value: complianceRate },
    ];
  }, [metricsOverview, eventLogs, anomalies]);

  const recentAuditEntries: AuditEntry[] = useMemo(() => {
    if (anomalies.length > 0) {
      return anomalies.slice(0, 3).map((item, index) => ({
        id: Number(item?.anomaly_id ?? index + 1),
        message:
          item?.anomaly_type ||
          item?.description ||
          item?.status ||
          "Security finding detected",
        status: mapAuditStatus(item?.status || item?.severity),
        time: formatRelativeTime(item?.detected_at),
      }));
    }

    return eventLogs.slice(0, 3).map((item, index) => ({
      id: Number(item?.event_log_id ?? item?.id ?? index + 1),
      message:
        item?.event_type ||
        item?.details?.message ||
        item?.log_level ||
        "Verification log reviewed",
      status: "review",
      time: formatRelativeTime(item?.event_time),
    }));
  }, [anomalies, eventLogs]);

  const auditSummary = useMemo(() => {
    const totalEvents = eventLogs.length;
    const totalAnomalies = anomalies.length;
    const criticalFindings = anomalies.filter((item) =>
      ["critical", "high"].includes(String(item?.severity || "").toLowerCase())
    ).length;

    return [
      `Verification records reviewed: ${totalEvents}.`,
      `Open anomaly findings currently under review: ${totalAnomalies}.`,
      `Critical or high-risk findings identified: ${criticalFindings}.`,
      "Management-ready reporting remains available for compliance review.",
    ];
  }, [eventLogs, anomalies]);

  return (
    <div className={`auditor-dashboard-page ${theme}`}>
      <nav className="auditor-dashboard-navbar">
        <Link to="/" className="auditor-dashboard-logo-container">
          <img
            src={logo}
            alt="BlockShield Logo"
            className="auditor-dashboard-logo"
          />
          <h2>BlockShield</h2>
        </Link>

        <div className="auditor-dashboard-navbar-actions">
          <button
            type="button"
            className="auditor-dashboard-logout-link"
            onClick={handleLogout}
          >
            <FaSignOutAlt />
            <span>Logout</span>
          </button>

          <button
            type="button"
            className="auditor-dashboard-theme-toggle"
            onClick={toggleTheme}
          >
            <span className="auditor-dashboard-theme-toggle-left">
              {theme === "light" ? (
                <>
                  <FaSun className="auditor-dashboard-theme-icon" />
                  DayShield
                </>
              ) : (
                <>
                  <FaMoon className="auditor-dashboard-theme-icon" />
                  NightShield
                </>
              )}
            </span>
            <span className="auditor-dashboard-theme-toggle-right">›</span>
          </button>
        </div>
      </nav>

      <main className="auditor-main">
        <aside className="auditor-sidebar">
          <div className="auditor-sidebar-top">
            <h3>Auditor Panel</h3>

            <ul className="auditor-sidebar-menu">
              {sidebarItems.map((item) => (
                <li key={item.label}>
                  <button type="button" className="auditor-sidebar-link">
                    <span className="auditor-sidebar-icon">{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <section className="auditor-content">
          <div className="auditor-dashboard-watermark">BlockShield</div>

          <div className="auditor-hero">
            <p className="auditor-role-pill">Security Auditor</p>
            <h1>Auditor Dashboard</h1>
          </div>

          {loading && <p>Loading dashboard data...</p>}
          {error && <p style={{ color: "red" }}>{error}</p>}

          {!loading && !error && (
            <>
              <section className="auditor-stats-grid">
                {statCards.map((card) => (
                  <article
                    key={card.title}
                    className="auditor-dashboard-card auditor-stat-card"
                  >
                    <h3>{card.title}</h3>
                    <p>{card.value}</p>
                  </article>
                ))}
              </section>

              <section className="auditor-dashboard-grid auditor-dashboard-grid-two">
                <article className="auditor-dashboard-card auditor-info-card">
                  <h3>Recent Audit Activity</h3>

                  <div className="audit-list">
                    {recentAuditEntries.length > 0 ? (
                      recentAuditEntries.map((entry) => (
                        <div key={entry.id} className={`audit-item ${entry.status}`}>
                          <div className="audit-content">
                            <p className="audit-message">{entry.message}</p>
                            <span className="audit-time">{entry.time}</span>
                          </div>

                          <span className="audit-badge">
                            {entry.status.toUpperCase()}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p>No recent audit activity found.</p>
                    )}
                  </div>
                </article>

                <article className="auditor-dashboard-card auditor-info-card">
                  <h3>Audit Summary</h3>

                  <ul className="audit-summary-list">
                    {auditSummary.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </article>
              </section>
            </>
          )}
        </section>
      </main>

      <footer className="auditor-dashboard-footer">
        <div className="auditor-dashboard-footer-overlay">
          <div>
            <p>© 2026 BlockShield. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default AuditorDashboard;