import "./IncidentResonderDashboard.css";
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

const sidebarItems = [
  { label: "Overview", icon: <MdDashboard /> },
  { label: "Active Incidents", icon: <FaBell /> },
  { label: "Threat Response", icon: <FaBolt /> },
  { label: "Containment Actions", icon: <MdOutlineSecurity /> },
  { label: "Escalations", icon: <FaExclamationTriangle /> },
  { label: "Event Logs", icon: <FaListAlt /> },
  { label: "Reports", icon: <FaFileAlt /> },
  { label: "Security Status", icon: <FaShieldAlt /> },
];

const statCards = [
  { title: "Open Incidents", value: "11" },
  { title: "Critical Cases", value: "03" },
  { title: "Resolved Today", value: "14" },
  { title: "Containment Rate", value: "94%" },
];

const activeIncidents: ActiveIncident[] = [
  {
    id: 1,
    message: "Replay-based intrusion pattern detected on Node H14",
    severity: "critical",
    time: "3 mins ago",
  },
  {
    id: 2,
    message: "Multiple failed handshake attempts from external peer",
    severity: "high",
    time: "9 mins ago",
  },
  {
    id: 3,
    message: "Suspicious verification delay reported in node cluster",
    severity: "medium",
    time: "21 mins ago",
  },
];

function IncidentResponderDashboard({
  theme,
  toggleTheme,
}: IncidentResponderDashboardProps) {
  const navigate = useNavigate();

  const handleLogout = () => {
    navigate("/roles");
  };

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
                  <button type="button" className="incident-responder-sidebar-link">
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
                {activeIncidents.map((incident) => (
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
                ))}
              </div>
            </article>

            <article className="incident-responder-card incident-responder-info-card">
              <h3>Response Summary</h3>

              <ul className="response-summary-list">
                <li>Critical alerts are prioritized for rapid containment.</li>
                <li>Incident evidence is being preserved for investigation.</li>
                <li>Escalation paths are active for high-risk node activity.</li>
                <li>Response reports are prepared for security review teams.</li>
              </ul>
            </article>
          </section>
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