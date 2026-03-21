import "./SecurityEngineerDashboard.css";
import {
  FaSun,
  FaMoon,
  FaShieldAlt,
  FaPlug,
  FaTools,
  FaBug,
  FaFileAlt,
  FaListAlt,
  FaSignOutAlt,
} from "react-icons/fa";
import { MdDashboard, MdSecurity } from "react-icons/md";
import logo from "../../../assets/logo.png";
import { useNavigate, Link } from "react-router-dom";

type SecurityEngineerDashboardProps = {
  theme: "light" | "dark";
  toggleTheme: () => void;
};

type EngineeringStatus = "active" | "inprogress" | "completed";

type EngineeringTask = {
  id: number;
  message: string;
  status: EngineeringStatus;
  time: string;
};

const sidebarItems = [
  { label: "Overview", icon: <MdDashboard /> },
  { label: "Security Controls", icon: <FaShieldAlt /> },
  { label: "Rule Tuning", icon: <FaTools /> },
  { label: "Plugin Management", icon: <FaPlug /> },
  { label: "Vulnerability Fixes", icon: <FaBug /> },
  { label: "Verification Logs", icon: <FaListAlt /> },
  { label: "Reports", icon: <FaFileAlt /> },
  { label: "System Hardening", icon: <MdSecurity /> },
];

const statCards = [
  { title: "Active Rules", value: "42" },
  { title: "Patched Issues", value: "18" },
  { title: "Plugin Updates", value: "07" },
  { title: "Hardening Score", value: "96%" },
];

const engineeringTasks: EngineeringTask[] = [
  {
    id: 1,
    message: "New handshake validation rule deployed to secure node cluster",
    status: "active",
    time: "4 mins ago",
  },
  {
    id: 2,
    message: "Replay detection threshold tuning currently under review",
    status: "inprogress",
    time: "16 mins ago",
  },
  {
    id: 3,
    message: "Signature verification plugin integrity test completed",
    status: "completed",
    time: "38 mins ago",
  },
];

function SecurityEngineerDashboard({
  theme,
  toggleTheme,
}: SecurityEngineerDashboardProps) {
  const navigate = useNavigate();

  const handleLogout = () => {
    navigate("/roles");
  };

  return (
    <div className={`security-engineer-dashboard-page ${theme}`}>
      <nav className="security-engineer-navbar">
        <Link to="/" className="security-engineer-logo-container">
          <img
            src={logo}
            alt="BlockShield Logo"
            className="security-engineer-logo"
          />
          <h2>BlockShield</h2>
        </Link>

        <div className="security-engineer-navbar-actions">
          <button
            type="button"
            className="security-engineer-logout-link"
            onClick={handleLogout}
          >
            <FaSignOutAlt />
            <span>Logout</span>
          </button>

          <button
            type="button"
            className="security-engineer-theme-toggle"
            onClick={toggleTheme}
          >
            <span className="security-engineer-theme-toggle-left">
              {theme === "light" ? (
                <>
                  <FaSun className="security-engineer-theme-icon" />
                  DayShield
                </>
              ) : (
                <>
                  <FaMoon className="security-engineer-theme-icon" />
                  NightShield
                </>
              )}
            </span>
            <span className="security-engineer-theme-toggle-right">›</span>
          </button>
        </div>
      </nav>

      <main className="security-engineer-main">
        <aside className="security-engineer-sidebar">
          <div className="security-engineer-sidebar-top">
            <h3>Engineer Panel</h3>

            <ul className="security-engineer-sidebar-menu">
              {sidebarItems.map((item) => (
                <li key={item.label}>
                  <button type="button" className="security-engineer-sidebar-link">
                    <span className="security-engineer-sidebar-icon">
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <section className="security-engineer-content">
          <div className="security-engineer-watermark">BlockShield</div>

          <div className="security-engineer-hero">
            <p className="security-engineer-role-pill">Security Engineer</p>
            <h1>Security Engineer Dashboard</h1>
          </div>

          <section className="security-engineer-stats-grid">
            {statCards.map((card) => (
              <article
                key={card.title}
                className="security-engineer-card security-engineer-stat-card"
              >
                <h3>{card.title}</h3>
                <p>{card.value}</p>
              </article>
            ))}
          </section>

          <section className="security-engineer-grid security-engineer-grid-two">
            <article className="security-engineer-card security-engineer-info-card">
              <h3>Engineering Activity</h3>

              <div className="engineering-list">
                {engineeringTasks.map((task) => (
                  <div
                    key={task.id}
                    className={`engineering-item ${task.status}`}
                  >
                    <div className="engineering-content">
                      <p className="engineering-message">{task.message}</p>
                      <span className="engineering-time">{task.time}</span>
                    </div>

                    <span className="engineering-badge">
                      {task.status === "inprogress"
                        ? "IN PROGRESS"
                        : task.status.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            </article>

            <article className="security-engineer-card security-engineer-info-card">
              <h3>Engineering Summary</h3>

              <ul className="security-engineer-summary-list">
                <li>Security policies are being tuned for stronger detection.</li>
                <li>Validation plugins are monitored for integrity and updates.</li>
                <li>Hardening improvements are reducing node exposure risk.</li>
                <li>Completed fixes are ready for operational deployment review.</li>
              </ul>
            </article>
          </section>
        </section>
      </main>

      <footer className="security-engineer-footer">
        <div className="security-engineer-footer-overlay">
          <div>
            <p>© 2026 BlockShield. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default SecurityEngineerDashboard;