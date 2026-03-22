import "../DetailPages.css";
import { useEffect, useState } from "react";
import { FaSun, FaMoon, FaSignOutAlt } from "react-icons/fa";
import logo from "../../../assets/logo.png";
import { Link, useNavigate } from "react-router-dom";
import {
  fetchHandshakes24h,
  extractItems,
} from "../../../services/dashboardService";
import { clearLoggedInUser } from "../../../services/authService";

type NAHandshakesPageProps = {
  theme: "light" | "dark";
  toggleTheme: () => void;
};

function NAHandshakesPage({ theme, toggleTheme }: NAHandshakesPageProps) {
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
        const response = await fetchHandshakes24h(undefined, 100);
        setRows(extractItems(response));
      } catch (err: any) {
        setError(err?.response?.data?.error || "Failed to load handshakes.");
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
          <button type="button" className="dashboard-logout-link" onClick={handleLogout}>
            <FaSignOutAlt />
            <span>Logout</span>
          </button>

          <button type="button" className="dashboard-theme-toggle" onClick={toggleTheme}>
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
      <h1>24H Handshakes</h1>
      <Link to="/dashboard/network-admin" className="na-detail-back-link">
        Back to Dashboard
      </Link>
      <p className="na-detail-refresh-note">Auto-refreshing every 5 seconds</p>
    </div>

    {loading && <p className="na-status-loading">Loading handshakes...</p>}
    {error && <p className="na-status-error">{error}</p>}

    {!loading && !error && (
      <div className="na-detail-card">
        <div className="na-detail-table-wrap">
          <table className="na-detail-table">
                <thead>
                  <tr>
                    <th style={thStyle}>Handshake ID</th>
                    <th style={thStyle}>Organization ID</th>
                    <th style={thStyle}>Handshake Status</th>
                    <th style={thStyle}>Failure Reason</th>
                    <th style={thStyle}>Created At</th>
                    <th style={thStyle}>Completed At</th>
                    <th style={thStyle}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length > 0 ? (
                    rows.map((row, index) => (
                      <tr key={row?.handshake_id ?? index}>
                        <td style={tdStyle}>{row?.handshake_id ?? "-"}</td>
                        <td style={tdStyle}>{row?.org_id ?? "-"}</td>
                        <td style={tdStyle}>{row?.handshake_status ?? "-"}</td>
                        <td style={tdStyle}>{row?.failure_reason ?? "-"}</td>
                        <td style={tdStyle}>{row?.created_at ?? "-"}</td>
                        <td style={tdStyle}>{row?.completed_at ?? "-"}</td>
                       <td style={tdStyle}>
                            <Link
                              to={`/dashboard/network-admin/handshakes/${row?.handshake_id}`}
                              className="detail-action-btn"
                            >
                              Show More
                            </Link>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td style={tdStyle} colSpan={7}>
                        No handshake records found in the last 24 hours.
                      </td>
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

const thStyle = {
  textAlign: "left" as const,
  padding: "12px",
  borderBottom: "1px solid #cbd5e1",
};

const tdStyle = {
  padding: "12px",
  borderBottom: "1px solid #e2e8f0",
  verticalAlign: "top" as const,
};

export default NAHandshakesPage;