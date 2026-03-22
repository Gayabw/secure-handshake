import "../DetailPages.css";
import { useEffect, useState } from "react";
import { FaSun, FaMoon, FaSignOutAlt } from "react-icons/fa";
import logo from "../../../assets/logo.png";
import { Link, useNavigate } from "react-router-dom";
import {
  fetchAnomalies,
  extractItems,
} from "../../../services/dashboardService";
import { clearLoggedInUser } from "../../../services/authService";

type NAAnomaliesPageProps = {
  theme: "light" | "dark";
  toggleTheme: () => void;
};

function NAAnomaliesPage({ theme, toggleTheme }: NAAnomaliesPageProps) {
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
        const response = await fetchAnomalies(undefined, 100);
        setRows(extractItems(response));
      } catch (err: any) {
        setError(err?.response?.data?.error || "Failed to load anomalies.");
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
            <h1>Open Anomalies</h1>
            <Link to="/dashboard/network-admin" className="na-detail-back-link">
              Back to Dashboard
            </Link>
            <p className="na-detail-refresh-note">
              Auto-refreshing every 5 seconds
            </p>
          </div>

          {loading && <p className="na-status-loading">Loading anomalies...</p>}
          {error && <p className="na-status-error">{error}</p>}

          {!loading && !error && (
            <div className="na-detail-card">
              <div className="na-detail-table-wrap">
                <table className="na-detail-table">
                  <thead>
                    <tr>
                      <th style={thStyle}>Anomaly ID</th>
                      <th style={thStyle}>Anomaly Type</th>
                      <th style={thStyle}>Anomaly Score</th>
                      <th style={thStyle}>Severity</th>
                      <th style={thStyle}>Status</th>
                      <th style={thStyle}>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length > 0 ? (
                      rows.map((row, index) => (
                        <tr key={row?.anomaly_id ?? row?.id ?? index}>
                          <td style={tdStyle}>
                            {row?.anomaly_id ?? row?.id ?? "-"}
                          </td>
                          <td style={tdStyle}>{row?.anomaly_type ?? "-"}</td>
                          <td style={tdStyle}>{row?.anomaly_score ?? "-"}</td>
                          <td style={tdStyle}>{row?.severity ?? "-"}</td>
                          <td style={tdStyle}>{row?.status ?? "-"}</td>
                          <td style={tdStyle}>
                              <button
                              type="button"
                              className="na-show-more-btn"
                              onClick={() =>
                                navigate(
                                  `/dashboard/network-admin/anomalies/${
                                    row?.anomaly_id ?? row?.id
                                  }`
                                )
                              }
                            >
                              Show More
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td style={tdStyle} colSpan={6}>
                          No anomaly records found.
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

export default NAAnomaliesPage;