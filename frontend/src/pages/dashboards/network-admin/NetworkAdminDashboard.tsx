import "./NetworkAdminDashboard.css";
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
import { MdDashboard } from "react-icons/md";
import logo from "../../../assets/logo.png";
import { useNavigate, Link, useLocation } from "react-router-dom";
import {
  fetchEventLogs,
  fetchAnomalies,
  fetchReplayAttacks,
  fetchHandshakes24h,
  fetchSecurityEvents,
  extractItems,
} from "../../../services/dashboardService";
import { clearLoggedInUser } from "../../../services/authService";

type NetworkAdminDashboardProps = {
  theme: "light" | "dark";
  toggleTheme: () => void;
};

type AlertSeverity = "critical" | "high" | "medium";

type RecentAlert = {
  id: string;
  message: string;
  severity: AlertSeverity;
  time: string;
  source: "security_event" | "anomaly" | "replay_attack" | "event_log";
};

type SidebarItem = {
  label: string;
  route: string;
  icon: ReactNode;
};

type StatCard = {
  title: string;
  value: string;
  route: string;
};

const sidebarItems: SidebarItem[] = [
  {
    label: "Overview",
    route: "/dashboard/network-admin",
    icon: <MdDashboard />,
  },
  {
    label: "Handshakes",
    route: "/dashboard/network-admin/handshakes",
    icon: <FaNetworkWired />,
  },
  {
    label: "Replay Attacks",
    route: "/dashboard/network-admin/replay-attacks",
    icon: <FaBell />,
  },
  {
    label: "Anomalies",
    route: "/dashboard/network-admin/anomalies",
    icon: <FaShieldAlt />,
  },
  {
    label: "Event Logs",
    route: "/dashboard/network-admin/event-logs",
    icon: <FaListAlt />,
  },
  {
    label: "Behavior Profiles",
    route: "/dashboard/network-admin/behavior-profiles",
    icon: <FaPlug />,
  },
  {
    label: "Security Events",
    route: "/dashboard/network-admin/security-events",
    icon: <FaFileAlt />,
  },
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

function normalizeSeverity(value: string | null | undefined): AlertSeverity {
  const normalized = String(value || "").toLowerCase();

  if (normalized === "critical") return "critical";
  if (normalized === "high") return "high";
  return "medium";
}

function NetworkAdminDashboard({
  theme,
  toggleTheme,
}: NetworkAdminDashboardProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const [handshakes, setHandshakes] = useState<any[]>([]);
  const [replayAttacks, setReplayAttacks] = useState<any[]>([]);
  const [eventLogs, setEventLogs] = useState<any[]>([]);
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [securityEvents, setSecurityEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const handleLogout = () => {
    clearLoggedInUser();
    navigate("/role-selection", { replace: true });
  };

  useEffect(() => {
    let intervalId: number;

    async function loadDashboardData() {
      try {
        setError("");

        const [
          handshakeResponse,
          replayResponse,
          eventLogsResponse,
          anomaliesResponse,
          securityEventsResponse,
        ] = await Promise.all([
          fetchHandshakes24h(undefined, 1000),
          fetchReplayAttacks(undefined, 1000),
          fetchEventLogs(undefined, 1000),
          fetchAnomalies(undefined, 1000),
          fetchSecurityEvents(100),
        ]);

        setHandshakes(extractItems(handshakeResponse));
        setReplayAttacks(extractItems(replayResponse));
        setEventLogs(extractItems(eventLogsResponse));
        setAnomalies(extractItems(anomaliesResponse));
        setSecurityEvents(extractItems(securityEventsResponse));
      } catch (err: any) {
        setError(
          err?.response?.data?.error || "Failed to load dashboard data."
        );
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
    intervalId = window.setInterval(loadDashboardData, 5000);

    return () => window.clearInterval(intervalId);
  }, []);

  const statCards: StatCard[] = useMemo(() => {
    return [
      {
        title: "24h Handshakes",
        value: String(handshakes.length),
        route: "/dashboard/network-admin/handshakes",
      },
      {
        title: "Replay Attacks",
        value: String(replayAttacks.length),
        route: "/dashboard/network-admin/replay-attacks",
      },
      {
        title: "Open Anomalies",
        value: String(anomalies.length),
        route: "/dashboard/network-admin/anomalies",
      },
      {
        title: "Recent Event Logs",
        value: String(eventLogs.length),
        route: "/dashboard/network-admin/event-logs",
      },
    ];
  }, [handshakes, replayAttacks, anomalies, eventLogs]);

  const recentAlerts: RecentAlert[] = useMemo(() => {
    const anomalyAlerts: RecentAlert[] = anomalies.map((item, index) => ({
      id: `anomaly-${item?.anomaly_id ?? index}`,
      message: item?.anomaly_type || "Security anomaly detected",
      severity: normalizeSeverity(item?.severity),
      time: item?.detected_at || "",
      source: "anomaly",
    }));

    const replayAlerts: RecentAlert[] = replayAttacks.map((item, index) => ({
      id: `replay-${item?.replay_attack_id ?? index}`,
      message: item?.detection_reason || "Replay attack detected",
      severity: normalizeSeverity(item?.severity),
      time: item?.detected_timestamp || item?.created_at || "",
      source: "replay_attack",
    }));

    const securityEventAlerts: RecentAlert[] = securityEvents.map(
      (item, index) => ({
        id: `security-${item?.security_event_id ?? index}`,
        message:
          item?.short_description || item?.event_type || "Security event",
        severity: normalizeSeverity(item?.severity),
        time: item?.created_at || "",
        source: "security_event",
      })
    );

    const eventLogAlerts: RecentAlert[] = eventLogs.map((item, index) => ({
      id: `event-${item?.event_log_id ?? item?.id ?? index}`,
      message: item?.event_type || "System event",
      severity: normalizeSeverity(item?.log_level),
      time: item?.event_time || "",
      source: "event_log",
    }));

    return [
      ...securityEventAlerts,
      ...anomalyAlerts,
      ...replayAlerts,
      ...eventLogAlerts,
    ]
      .sort((a, b) => {
        const aTime = new Date(a.time).getTime() || 0;
        const bTime = new Date(b.time).getTime() || 0;
        return bTime - aTime;
      })
      .slice(0, 5)
      .map((item) => ({
        ...item,
        time: formatRelativeTime(item.time),
      }));
  }, [anomalies, replayAttacks, securityEvents, eventLogs]);

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
            <h3>Admin Panel</h3>

            <ul className="sidebar-menu">
              {sidebarItems.map((item) => (
                <li key={item.label}>
                  <button
                    type="button"
                    className={`sidebar-link ${
                      location.pathname === item.route ? "active" : ""
                    }`}
                    onClick={() => navigate(item.route)}
                  >
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
            <p className="dashboard-role-pill">Network Administrator</p>
            <h1>Network Admin Dashboard</h1>
            <p className="dashboard-subtitle">
              Monitor handshakes, replay attacks, anomalies, event logs,
              behavior profiles, and security events in real time.
            </p>
          </div>

          {loading && <p>Loading dashboard data...</p>}
          {error && <p style={{ color: "red" }}>{error}</p>}

          {!loading && !error && (
            <>
              <section className="stats-grid">
                {statCards.map((card) => (
                  <Link
                    key={card.title}
                    to={card.route}
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    <article
                      className="dashboard-card stat-card"
                      style={{ cursor: "pointer" }}
                    >
                      <h3>{card.title}</h3>
                      <p>{card.value}</p>
                    </article>
                  </Link>
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

export default NetworkAdminDashboard;