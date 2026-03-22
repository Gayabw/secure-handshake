import "./IncidentResonderDashboard.css";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  FaSun,
  FaMoon,
  FaBell,
  FaShieldAlt,
  FaFileAlt,
  FaListAlt,
  FaBolt,
  FaExclamationTriangle,
  FaSignOutAlt,
} from "react-icons/fa";
import { MdDashboard, MdOutlineSecurity } from "react-icons/md";
import logo from "../../../assets/logo.png";
import { useNavigate, Link } from "react-router-dom";
import {
  fetchMetricsOverview,
  fetchEventLogs,
  fetchAnomalies,
} from "../../../services/dashboardService";
import { clearLoggedInUser } from "../../../services/authService";

type IncidentResponderDashboardProps = {
  theme: "light" | "dark";
  toggleTheme: () => void;
};

type IncidentSeverity = "critical" | "high" | "medium";

type ActiveIncident = {
  id: number;
  message: string;
  severity: IncidentSeverity;
  time: string;
};

type SidebarItem = {
  label: string;
  icon: ReactNode;
};

const sidebarItems: SidebarItem[] = [
  { label: "Overview", icon: <MdDashboard /> },
  { label: "Active Incidents", icon: <FaBell /> },
  { label: "Threat Response", icon: <FaBolt /> },
  { label: "Containment Actions", icon: <MdOutlineSecurity /> },
  { label: "Escalations", icon: <FaExclamationTriangle /> },
  { label: "Event Logs", icon: <FaListAlt /> },
  { label: "Reports", icon: <FaFileAlt /> },
  { label: "Security Status", icon: <FaShieldAlt /> },
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

function mapIncidentSeverity(value: string | null | undefined): IncidentSeverity {
  const normalized = String(value || "").toLowerCase();

  if (normalized === "critical") return "critical";
  if (normalized === "high") return "high";
  return "medium";
}

function IncidentResponderDashboard({
  theme,
  toggleTheme,
}: IncidentResponderDashboardProps) {
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
    const openIncidents = anomalies.length;
    const criticalCases = anomalies.filter((item) =>
      ["critical", "high"].includes(String(item?.severity || "").toLowerCase())
    ).length;
    const resolvedToday = Math.max(0, (counts.handshakes ?? 0) - openIncidents);

    const containmentRate =
      counts.handshakes && counts.handshakes > 0
        ? `${Math.max(
            0,
            Math.min(
              100,
              Math.round((resolvedToday / counts.handshakes) * 100)
            )
          )}%`
        : "0%";

    return [
      { title: "Open Incidents", value: String(openIncidents) },
      { title: "Critical Cases", value: String(criticalCases) },
      { title: "Resolved Today", value: String(resolvedToday) },
      { title: "Containment Rate", value: containmentRate },
    ];
  }, [metricsOverview, anomalies]);

  const activeIncidents: ActiveIncident[] = useMemo(() => {
    if (anomalies.length > 0) {
      return anomalies.slice(0, 3).map((item, index) => ({
        id: Number(item?.anomaly_id ?? index + 1),
        message:
          item?.anomaly_type ||
          item?.description ||
          item?.status ||
          "Active security incident detected",
        severity: mapIncidentSeverity(item?.severity),
        time: formatRelativeTime(item?.detected_at),
      }));
    }

    return eventLogs.slice(0, 3).map((item, index) => ({
      id: Number(item?.event_log_id ?? item?.id ?? index + 1),
      message:
        item?.event_type ||
        item?.details?.message ||
        item?.log_level ||
        "Security response event recorded",
      severity: "medium",
      time: formatRelativeTime(item?.event_time),
    }));
  }, [anomalies, eventLogs]);

  const responseSummary = useMemo(() => {
    const criticalCases = anomalies.filter((item) =>
      ["critical", "high"].includes(String(item?.severity || "").toLowerCase())
    ).length;

    return [
      `Open anomaly cases currently tracked: ${anomalies.length}.`,
      `Critical or high-risk incidents requiring escalation: ${criticalCases}.`,
      `Recent security events available for triage review: ${eventLogs.length}.`,
      "Containment and response evidence remains available for team coordination.",
    ];
  }, [anomalies, eventLogs]);

  return (
    <div className={`incident-responder-dashboard-page ${theme}`}>
      <nav className="incident-responder-navbar">
        <Link to="/" className="incident-responder-logo-container">
          <img
            src={logo}
            alt="BlockShield Logo"
            className="incident-responder-logo"
          />
          <h2>BlockShield</h2>
        </Link>

        <div className="incident-responder-navbar-actions">
          <button
            type="button"
            className="incident-responder-logout-link"
            onClick={handleLogout}
          >
            <FaSignOutAlt />
            <span>Logout</span>
          </button>

          <button
            type="button"
            className="incident-responder-theme-toggle"
            onClick={toggleTheme}
          >
            <span className="incident-responder-theme-toggle-left">
              {theme === "light" ? (
                <>
                  <FaSun className="incident-responder-theme-icon" />
                  DayShield
                </>
              ) : (
                <>
                  <FaMoon className="incident-responder-theme-icon" />
                  NightShield
                </>
              )}
            </span>
            <span className="incident-responder-theme-toggle-right">›</span>
          </button>
        </div>
      </nav>

      <main className="incident-responder-main">
        <aside className="incident-responder-sidebar">
          <div className="incident-responder-sidebar-top">
            <h3>Responder Panel</h3>

            <ul className="incident-responder-sidebar-menu">
              {sidebarItems.map((item) => (
                <li key={item.label}>
                  <button
                    type="button"
                    className="incident-responder-sidebar-link"
                  >
                    <span className="incident-responder-sidebar-icon">
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <section className="incident-responder-content">
          <div className="incident-responder-watermark">BlockShield</div>

          <div className="incident-responder-hero">
            <p className="incident-responder-role-pill">Incident Responder</p>
            <h1>Incident Responder Dashboard</h1>
          </div>

          {loading && <p>Loading dashboard data...</p>}
          {error && <p style={{ color: "red" }}>{error}</p>}

          {!loading && !error && (
            <>
              <section className="incident-responder-stats-grid">
                {statCards.map((card) => (
                  <article
                    key={card.title}
                    className="incident-responder-card incident-responder-stat-card"
                  >
                    <h3>{card.title}</h3>
                    <p>{card.value}</p>
                  </article>
                ))}
              </section>

              <section className="incident-responder-grid incident-responder-grid-two">
                <article className="incident-responder-card incident-responder-info-card">
                  <h3>Active Incidents</h3>

                  <div className="incident-list">
                    {activeIncidents.length > 0 ? (
                      activeIncidents.map((incident) => (
                        <div
                          key={incident.id}
                          className={`incident-item ${incident.severity}`}
                        >
                          <div className="incident-content">
                            <p className="incident-message">{incident.message}</p>
                            <span className="incident-time">{incident.time}</span>
                          </div>

                          <span className="incident-badge">
                            {incident.severity.toUpperCase()}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p>No active incidents found.</p>
                    )}
                  </div>
                </article>

                <article className="incident-responder-card incident-responder-info-card">
                  <h3>Response Summary</h3>

                  <ul className="response-summary-list">
                    {responseSummary.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </article>
              </section>
            </>
          )}
        </section>
      </main>

      <footer className="incident-responder-footer">
        <div className="incident-responder-footer-overlay">
          <div>
            <p>© 2026 BlockShield. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default IncidentResponderDashboard;