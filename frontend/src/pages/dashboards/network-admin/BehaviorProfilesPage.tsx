import "../DetailPages.css";
import { useEffect, useState } from "react";
import { FaSun, FaMoon, FaSignOutAlt } from "react-icons/fa";
import logo from "../../../assets/logo.png";
import { Link, useNavigate } from "react-router-dom";
import {
  fetchBehaviorProfiles,
  extractItems,
} from "../../../services/dashboardService";
import { clearLoggedInUser } from "../../../services/authService";

type BehaviorProfilesPageProps = {
  theme: "light" | "dark";
  toggleTheme: () => void;
};

function BehaviorProfilesPage({
  theme,
  toggleTheme,
}: BehaviorProfilesPageProps) {
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
        const response = await fetchBehaviorProfiles(100);
        setRows(extractItems(response));
      } catch (err: any) {
        setError(
          err?.response?.data?.error || "Failed to load behavior profiles."
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
            <h1>Behavior Profiles</h1>
            <Link to="/dashboard/network-admin" className="na-detail-back-link">
              Back to Dashboard
            </Link>
            <p className="na-detail-refresh-note">
              Auto-refreshing every 5 seconds
            </p>
          </div>

          {loading && (
            <p className="na-status-loading">Loading behavior profiles...</p>
          )}
          {error && <p className="na-status-error">{error}</p>}

          {!loading && !error && (
            <div className="na-detail-card">
              <div className="na-detail-table-wrap">
                <table className="na-detail-table">
                  <thead>
                    <tr>
                      <th>Profile ID</th>
                      <th>User ID</th>
                      <th>User Key ID</th>
                      <th>Trust Score</th>
                      <th>Total Handshakes</th>
                      <th>Replay Attempts</th>
                      <th>Status</th>
                      <th>Last Seen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length > 0 ? (
                      rows.map((row, index) => (
                        <tr
                          key={row?.behavior_profile_id ?? row?.id ?? index}
                        >
                          <td>{row?.behavior_profile_id ?? "-"}</td>
                          <td>{row?.subject_user_id ?? "-"}</td>
                          <td>{row?.subject_user_key_id ?? "-"}</td>
                          <td>{row?.trust_score ?? "-"}</td>
                          <td>{row?.total_handshakes ?? "-"}</td>
                          <td>{row?.replay_attempts ?? "-"}</td>
                          <td>{row?.profile_status ?? "-"}</td>
                          <td>{row?.last_seen_at ?? "-"}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8}>No behavior profile records found.</td>
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

export default BehaviorProfilesPage;