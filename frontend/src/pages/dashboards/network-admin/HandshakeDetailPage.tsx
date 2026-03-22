import "../DetailPages.css";
import { useEffect, useState } from "react";
import { FaSun, FaMoon, FaSignOutAlt } from "react-icons/fa";
import logo from "../../../assets/logo.png";
import { Link, useNavigate, useParams } from "react-router-dom";
import { fetchHandshakeById } from "../../../services/dashboardService";
import { clearLoggedInUser } from "../../../services/authService";

type NAHandshakeDetailPageProps = {
  theme: "light" | "dark";
  toggleTheme: () => void;
};

function NAHandshakeDetailPage({
  theme,
  toggleTheme,
}: NAHandshakeDetailPageProps) {
  const navigate = useNavigate();
  const { handshakeId } = useParams();

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

        if (!handshakeId) {
          setError("Handshake ID is missing.");
          return;
        }

        const response = await fetchHandshakeById(Number(handshakeId));
        setRow(response?.item || null);
      } catch (err: any) {
        setError(
          err?.response?.data?.error || "Failed to load handshake detail."
        );
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [handshakeId]);

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
            <h1>Handshake Detail</h1>
            <Link
              to="/dashboard/network-admin/handshakes"
              className="na-detail-back-link"
            >
              Back to 24H Handshakes
            </Link>
          </div>

          {loading && <p className="na-status-loading">Loading handshake detail...</p>}
          {error && <p className="na-status-error">{error}</p>}

          {!loading && !error && row && (
            <div className="na-detail-card">
              <table className="na-detail-table" style={{ minWidth: "100%" }}>
                <tbody>
                  <tr>
                    <th style={detailThStyle}>Handshake ID</th>
                    <td style={detailTdStyle}>{row.handshake_id ?? "-"}</td>
                  </tr>
                  <tr>
                    <th style={detailThStyle}>Organization ID</th>
                    <td style={detailTdStyle}>{row.org_id ?? "-"}</td>
                  </tr>
                  <tr>
                    <th style={detailThStyle}>Initiator User ID</th>
                    <td style={detailTdStyle}>{row.initiator_user_id ?? "-"}</td>
                  </tr>
                  <tr>
                    <th style={detailThStyle}>Responder User ID</th>
                    <td style={detailTdStyle}>{row.responder_user_id ?? "-"}</td>
                  </tr>
                  <tr>
                    <th style={detailThStyle}>Blockchain Network</th>
                    <td style={detailTdStyle}>{row.blockchain_network ?? "-"}</td>
                  </tr>
                  <tr>
                    <th style={detailThStyle}>Handshake Status</th>
                    <td style={detailTdStyle}>{row.handshake_status ?? "-"}</td>
                  </tr>
                  <tr>
                    <th style={detailThStyle}>Failure Reason</th>
                    <td style={detailTdStyle}>{row.failure_reason ?? "-"}</td>
                  </tr>
                  <tr>
                    <th style={detailThStyle}>Created At</th>
                    <td style={detailTdStyle}>{row.created_at ?? "-"}</td>
                  </tr>
                  <tr>
                    <th style={detailThStyle}>Completed At</th>
                    <td style={detailTdStyle}>{row.completed_at ?? "-"}</td>
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

export default NAHandshakeDetailPage;