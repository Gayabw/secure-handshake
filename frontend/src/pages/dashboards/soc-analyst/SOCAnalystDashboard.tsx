import "./SOCAnalystDashboard.css";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  FaSun,
  FaMoon,
  FaBell,
  FaShieldAlt,
  FaNetworkWired,
  FaPlug,
  FaFileAlt,
  FaListAlt,
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

type SOCAnalystDashboardProps = {
  theme: "light" | "dark";
  toggleTheme: () => void;
};

type AlertSeverity = "critical" | "high" | "medium";

type RecentAlert = {
  id: number;
  message: string;
  severity: AlertSeverity;
  time: string;
};

type SidebarItem = {
  label: string;
  icon: ReactNode;
};

const sidebarItems: SidebarItem[] = [
  { label: "Overview", icon: <MdDashboard /> },
  { label: "Handshakes", icon: <FaNetworkWired /> },
  { label: "Alerts", icon: <FaBell /> },
  { label: "Anomalies", icon: <FaShieldAlt /> },
  { label: "Event Logs", icon: <FaListAlt /> },
  { label: "Access Lists", icon: <MdOutlineVerifiedUser /> },
  { label: "Plugins", icon: <FaPlug /> },
  { label: "Reports", icon: <FaFileAlt /> },
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

function mapSeverity(value: string | null | undefined): AlertSeverity {
  const normalized = String(value || "").toLowerCase();

  if (normalized === "critical") return "critical";
  if (normalized === "high") return "high";
  return "medium";
}

function SOCAnalystDashboard({
  theme,
  toggleTheme,
}: SOCAnalystDashboardProps) {
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

    return [
      { title: "24h Handshakes", value: String(counts.handshakes ?? 0) },
      { title: "Replay Attacks", value: String(counts.replay_attacks ?? 0) },
      { title: "Open Anomalies", value: String(counts.anomalies ?? 0) },
      { title: "Recent Event Logs", value: String(eventLogs.length) },
    ];
  }, [metricsOverview, eventLogs]);

  const recentAlerts: RecentAlert[] = useMemo(() => {
    if (anomalies.length > 0) {
      return anomalies.slice(0, 3).map((item, index) => ({
        id: Number(item?.anomaly_id ?? index + 1),
        message:
          item?.anomaly_type ||
          item?.description ||
          item?.status ||
          "Security anomaly detected",
        severity: mapSeverity(item?.severity),
        time: formatRelativeTime(item?.detected_at),
      }));
    }

    return eventLogs.slice(0, 3).map((item, index) => ({
      id: Number(item?.event_log_id ?? item?.id ?? index + 1),
      message:
        item?.event_type ||
        item?.details?.message ||
        item?.log_level ||
        "New security event recorded",
      severity: "medium",
      time: formatRelativeTime(item?.event_time),
    }));
  }, [anomalies, eventLogs]);

  return (
    <div className={`admin-dashboard-page ${theme}`}>
      <nav className="dashboard-navbar">
        <Link to="/" className="dashboard-logo-container">
          <img src={logo} alt="BlockShield Logo" className="dashboard-logo" />
          <h2>BlockShield</h2>
        </Link>

        <div className="dashboard-navbar-actions">
          <button
            type="button"
            className="dashboard-logout-link"
            onClick={handleLogout}
          >
            <FaSignOutAlt />
            <span>Logout</span>
          </button>

          <button
            type="button"
            className="dashboard-theme-toggle"
            onClick={toggleTheme}
          >
            <span className="dashboard-theme-toggle-left">
              {theme === "light" ? (
                <>
                  <FaSun className="dashboard-theme-icon" />
                  DayShield
                </>
              ) : (
                <>
                  <FaMoon className="dashboard-theme-icon" />
                  NightShield
                </>
              )}
            </span>
            <span className="dashboard-theme-toggle-right">›</span>
          </button>
        </div>
      </nav>

      <main className="network-admin-main">
        <aside className="network-admin-sidebar">
          <div className="sidebar-top">
            <h3>SOC Panel</h3>

            <ul className="sidebar-menu">
              {sidebarItems.map((item) => (
                <li key={item.label}>
                  <button type="button" className="sidebar-link">
                    <span className="sidebar-icon">{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <section className="network-admin-content">
          <div className="dashboard-watermark">BlockShield</div>

          <div className="dashboard-hero">
            <p className="dashboard-role-pill">SOC Analyst</p>
            <h1>SOC Analyst Dashboard</h1>
          </div>

          {loading && <p>Loading dashboard data...</p>}
          {error && <p style={{ color: "red" }}>{error}</p>}

          {!loading && !error && (
            <>
              <section className="stats-grid">
                {statCards.map((card) => (
                  <article key={card.title} className="dashboard-card stat-card">
                    <h3>{card.title}</h3>
                    <p>{card.value}</p>
                  </article>
                ))}
              </section>

              <section className="dashboard-grid dashboard-grid-two">
                <article className="dashboard-card info-card">
                  <h3>Recent Alerts</h3>

                  <div className="alerts-list">
                    {recentAlerts.length > 0 ? (
                      recentAlerts.map((alert) => (
                        <div
                          key={alert.id}
                          className={`alert-item ${alert.severity}`}
                        >
                          <div className="alert-content">
                            <p className="alert-message">{alert.message}</p>
                            <span className="alert-time">{alert.time}</span>
                          </div>

                          <span className="alert-badge">
                            {alert.severity.toUpperCase()}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p>No recent alerts found.</p>
                    )}
                  </div>
                </article>
              </section>
            </>
          )}
        </section>
      </main>

      <footer className="dashboard-footer">
        <div className="dashboard-footer-overlay">
          <div>
            <p>© 2026 BlockShield. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default SOCAnalystDashboard;