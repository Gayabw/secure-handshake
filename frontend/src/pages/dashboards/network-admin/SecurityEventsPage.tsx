import "../DetailPages.css";
import { useEffect, useState } from "react";
import { FaSun, FaMoon, FaSignOutAlt } from "react-icons/fa";
import logo from "../../../assets/logo.png";
import { Link, useNavigate } from "react-router-dom";
import {
  fetchSecurityEvents,
  extractItems,
} from "../../../services/dashboardService";
import { clearLoggedInUser } from "../../../services/authService";

type SecurityEventsPageProps = {
  theme: "light" | "dark";
  toggleTheme: () => void;
};

function SecurityEventsPage({
  theme,
  toggleTheme,
}: SecurityEventsPageProps) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const handleLogout = () => {
    clearLoggedInUser();
    navigate("/role-selection", { replace: true });
  };

  useEffect(() => {
    let intervalId: number;

    async function loadData() {
      try {
        setError("");
        const response = await fetchSecurityEvents(100);
        setRows(extractItems(response));
      } catch (err: any) {
        setError(
          err?.response?.data?.error || "Failed to load security events."
        );
      } finally {
        setLoading(false);
      }
    }

    loadData();
    intervalId = window.setInterval(loadData, 5000);

    return () => window.clearInterval(intervalId);
  }, []);

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

      <main className="na-detail-main">
        <div className="na-detail-container">
          <div className="na-detail-header">
            <p className="na-detail-role-pill">Network Administrator</p>
            <h1>Security Events</h1>
            <Link to="/dashboard/network-admin" className="na-detail-back-link">
              Back to Dashboard
            </Link>
            <p className="na-detail-refresh-note">
              Auto-refreshing every 5 seconds
            </p>
          </div>

          {loading && (
            <p className="na-status-loading">Loading security events...</p>
          )}
          {error && <p className="na-status-error">{error}</p>}

          {!loading && !error && (
            <div className="na-detail-card">
              <div className="na-detail-table-wrap">
                <table className="na-detail-table">
                  <thead>
                    <tr>
                      <th>Security Event ID</th>
                      <th>Event Type</th>
                      <th>Severity</th>
                      <th>Category</th>
                      <th>Description</th>
                      <th>Created At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length > 0 ? (
                      rows.map((row, index) => (
                        <tr key={row?.security_event_id ?? row?.id ?? index}>
                          <td>{row?.security_event_id ?? "-"}</td>
                          <td>{row?.event_type ?? "-"}</td>
                          <td>{row?.severity ?? "-"}</td>
                          <td>{row?.event_category ?? "-"}</td>
                          <td>{row?.short_description ?? "-"}</td>
                          <td>{row?.created_at ?? "-"}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6}>No security event records found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default SecurityEventsPage;