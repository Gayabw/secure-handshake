import "./NetworkAdminDashboard.css";
import {
  FaSun,
  FaMoon,
  FaBell,
  FaShieldAlt,
  FaNetworkWired,
  FaPlug,
  FaFileAlt,
  FaListAlt,
  FaArrowLeft,
} from "react-icons/fa";
import { MdDashboard, MdOutlineVerifiedUser } from "react-icons/md";
import { Link } from "react-router-dom";
import logo from "../../../assets/logo.png";

type NetworkAdminDashboardProps = {
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

const sidebarItems = [
  { label: "Overview", icon: <MdDashboard /> },
  { label: "Handshakes", icon: <FaNetworkWired /> },
  { label: "Alerts", icon: <FaBell /> },
  { label: "Anomalies", icon: <FaShieldAlt /> },
  { label: "Event Logs", icon: <FaListAlt /> },
  { label: "Access Lists", icon: <MdOutlineVerifiedUser /> },
  { label: "Plugins", icon: <FaPlug /> },
  { label: "Reports", icon: <FaFileAlt /> },
];

const statCards = [
  { title: "Total Handshakes", value: "12,480" },
  { title: "Active Alerts", value: "18" },
  { title: "Critical Incidents", value: "04" },
  { title: "Blocked Nodes", value: "27" },
];

const recentAlerts: RecentAlert[] = [
  {
    id: 1,
    message: "Replay attack detected on Node A12",
    severity: "critical",
    time: "2 mins ago",
  },
  {
    id: 2,
    message: "Suspicious peer discovery on Node C07",
    severity: "high",
    time: "10 mins ago",
  },
  {
    id: 3,
    message: "Unauthorized connection blocked (Node X21)",
    severity: "medium",
    time: "25 mins ago",
  },
];

function NetworkAdminDashboard({
  theme,
  toggleTheme,
}: NetworkAdminDashboardProps) {
  return (
    <div className={`admin-dashboard-page ${theme}`}>
      <nav className="dashboard-navbar">
        <div className="dashboard-logo-container">
          <img src={logo} alt="BlockShield Logo" className="dashboard-logo" />
          <h2>BlockShield</h2>
        </div>

        <div className="dashboard-navbar-actions">
          <Link to="/roles" className="dashboard-back-link">
            <FaArrowLeft />
            <span>Back to Roles</span>
          </Link>

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
            <p className="dashboard-role-pill">Network Administrator</p>
            <h1>Network Admin Dashboard</h1>
          </div>

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
                {recentAlerts.map((alert) => (
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
                ))}
              </div>
            </article>
          </section>
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