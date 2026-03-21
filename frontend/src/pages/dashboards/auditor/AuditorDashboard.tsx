import "./AuditorDashboard.css";
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

const sidebarItems = [
  { label: "Overview", icon: <MdDashboard /> },
  { label: "Audit Trails", icon: <FaHistory /> },
  { label: "Compliance Checks", icon: <FaClipboardCheck /> },
  { label: "Verification Logs", icon: <MdOutlineVerifiedUser /> },
  { label: "Security Findings", icon: <FaShieldAlt /> },
  { label: "Reports", icon: <FaFileAlt /> },
  { label: "Event Records", icon: <FaListAlt /> },
];

const statCards = [
  { title: "Audits Completed", value: "156" },
  { title: "Pending Reviews", value: "09" },
  { title: "Flagged Findings", value: "03" },
  { title: "Compliance Rate", value: "97%" },
];

const recentAuditEntries: AuditEntry[] = [
  {
    id: 1,
    message: "Node authentication audit completed successfully",
    status: "passed",
    time: "5 mins ago",
  },
  {
    id: 2,
    message: "Handshake log set requires manual compliance review",
    status: "review",
    time: "18 mins ago",
  },
  {
    id: 3,
    message: "Signature mismatch found in verification history",
    status: "flagged",
    time: "32 mins ago",
  },
];

function AuditorDashboard({
  theme,
  toggleTheme,
}: AuditorDashboardProps) {
  const navigate = useNavigate();

  const handleLogout = () => {
    navigate("/roles");
  };

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
                {recentAuditEntries.map((entry) => (
                  <div key={entry.id} className={`audit-item ${entry.status}`}>
                    <div className="audit-content">
                      <p className="audit-message">{entry.message}</p>
                      <span className="audit-time">{entry.time}</span>
                    </div>

                    <span className="audit-badge">
                      {entry.status.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            </article>

            <article className="auditor-dashboard-card auditor-info-card">
              <h3>Audit Summary</h3>

              <ul className="audit-summary-list">
                <li>Verification logs are being retained for policy review.</li>
                <li>Most handshake events passed the compliance checks.</li>
                <li>Three records are flagged for deeper manual inspection.</li>
                <li>Report exports are ready for management-level review.</li>
              </ul>
            </article>
          </section>
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