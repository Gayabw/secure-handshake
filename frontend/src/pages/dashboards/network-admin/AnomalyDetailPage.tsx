import "../DetailPages.css";
import { useEffect, useState } from "react";
import { FaSun, FaMoon, FaSignOutAlt } from "react-icons/fa";
import logo from "../../../assets/logo.png";
import { Link, useNavigate, useParams } from "react-router-dom";
import { clearLoggedInUser } from "../../../services/authService";
import { fetchAnomalyById } from "../../../services/dashboardService";

type AnomalyDetailPageProps = {
  theme: "light" | "dark";
  toggleTheme: () => void;
};

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "-";
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function AnomalyDetailPage({
  theme,
  toggleTheme,
}: AnomalyDetailPageProps) {
  const navigate = useNavigate();
  const { anomalyId } = useParams();

  const [row, setRow] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const handleLogout = () => {
    clearLoggedInUser();
    navigate("/role-selection", { replace: true });
  };

  useEffect(() => {
    async function loadData() {
      try {
        setError("");

        if (!anomalyId) {
          setError("Anomaly ID is missing.");
          return;
        }

        const response = await fetchAnomalyById(anomalyId);
        setRow(response?.item || null);
      } catch (err: any) {
        setError(
          err?.response?.data?.error || "Failed to load anomaly detail."
        );
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [anomalyId]);

  return (
    <div className={`app ${theme} na-detail-page`}>
      <nav>
        <div className="logo-container">
          <img src={logo} alt="BlockShield Logo" className="logo" />
          <h2>BlockShield</h2>
        </div>

        <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
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
            className="theme-toggle"
            onClick={toggleTheme}
          >
            <span className="theme-toggle-left">
              {theme === "light" ? (
                <>
                  <FaSun className="theme-icon" />
                  DayShield
                </>
              ) : (
                <>
                  <FaMoon className="theme-icon" />
                  NightShield
                </>
              )}
            </span>
            <span className="theme-toggle-right">›</span>
          </button>
        </div>
      </nav>

      <main className="na-detail-main">
        <div className="na-detail-container">
          <div className="na-detail-header">
            <p className="na-detail-role-pill">Network Administrator</p>
            <h1>Anomaly Detail</h1>
            <Link
              to="/dashboard/network-admin/anomalies"
              className="na-detail-back-link"
            >
              Back to Open Anomalies
            </Link>
          </div>

          {loading && <p className="na-status-loading">Loading anomaly detail...</p>}
          {error && <p className="na-status-error">{error}</p>}

          {!loading && !error && row && (
            <div className="na-detail-card">
              <table className="na-detail-table" style={{ minWidth: "100%" }}>
                <tbody>
                  <tr>
                    <th style={detailThStyle}>Anomaly ID</th>
                    <td style={detailTdStyle}>{row.anomaly_id ?? "-"}</td>
                  </tr>
                  <tr>
                    <th style={detailThStyle}>Organization ID</th>
                    <td style={detailTdStyle}>{row.org_id ?? "-"}</td>
                  </tr>
                  <tr>
                    <th style={detailThStyle}>Subject User ID</th>
                    <td style={detailTdStyle}>{row.subject_user_id ?? "-"}</td>
                  </tr>
                  <tr>
                    <th style={detailThStyle}>Subject User Key ID</th>
                    <td style={detailTdStyle}>{row.subject_user_key_id ?? "-"}</td>
                  </tr>
                  <tr>
                    <th style={detailThStyle}>Anomaly Type</th>
                    <td style={detailTdStyle}>{row.anomaly_type ?? "-"}</td>
                  </tr>
                  <tr>
                    <th style={detailThStyle}>Source Behavior Profile</th>
                    <td style={detailTdStyle}>
                      {row.source_behavior_profile ?? "-"}
                    </td>
                  </tr>
                  <tr>
                    <th style={detailThStyle}>Anomaly Score</th>
                    <td style={detailTdStyle}>{row.anomaly_score ?? "-"}</td>
                  </tr>
                  <tr>
                    <th style={detailThStyle}>Severity</th>
                    <td style={detailTdStyle}>{row.severity ?? "-"}</td>
                  </tr>
                  <tr>
                    <th style={detailThStyle}>Status</th>
                    <td style={detailTdStyle}>{row.status ?? "-"}</td>
                  </tr>
                  <tr>
                    <th style={detailThStyle}>Detected At</th>
                    <td style={detailTdStyle}>{row.detected_at ?? "-"}</td>
                  </tr>
                  <tr>
                    <th style={detailThStyle}>Resolved At</th>
                    <td style={detailTdStyle}>{row.resolved_at ?? "-"}</td>
                  </tr>
                  <tr>
                    <th style={detailThStyle}>Resolved By User ID</th>
                    <td style={detailTdStyle}>{row.resolved_by_user_id ?? "-"}</td>
                  </tr>
                  <tr>
                    <th style={detailThStyle}>Resolved By Staff ID</th>
                    <td style={detailTdStyle}>{row.resolved_by_staff_id ?? "-"}</td>
                  </tr>
                  <tr>
                    <th style={detailThStyle}>Details</th>
                    <td style={detailTdStyle}>
                      <pre className="na-raw-pre">
                        {formatValue(row.details)}
                      </pre>
                    </td>
                  </tr>
                  <tr>
                    <th style={detailThStyle}>Raw JSON</th>
                    <td style={detailTdStyle}>
                      <pre className="na-raw-pre">
                        {JSON.stringify(row, null, 2)}
                      </pre>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

const detailThStyle = {
  width: "240px",
  textAlign: "left" as const,
  padding: "14px 16px",
  borderBottom: "1px solid #cbd5e1",
};

const detailTdStyle = {
  padding: "14px 16px",
  borderBottom: "1px solid #e2e8f0",
  verticalAlign: "top" as const,
};

export default AnomalyDetailPage;