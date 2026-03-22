import { useEffect, useState } from "react";
import { FaSun, FaMoon } from "react-icons/fa";
import { Link } from "react-router-dom";
import axios from "axios";
import logo from "../assets/Logo.png";
import bgImage from "../assets/bg-image.png";

type HomeProps = {
  theme: "light" | "dark";
  toggleTheme: () => void;
};

type HealthState = {
  ok: boolean;
  label: string;
  detail: string;
  checkedAt: string;
};

function formatCheckedTime(value: string) {
  if (!value) return "Not checked yet";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Checked recently";
  }

  return date.toLocaleTimeString();
}

function Home({ theme, toggleTheme }: HomeProps) {
  const [systemHealth, setSystemHealth] = useState<HealthState>({
    ok: false,
    label: "Checking...",
    detail: "Connecting to backend service",
    checkedAt: "",
  });

  const [databaseHealth, setDatabaseHealth] = useState<HealthState>({
    ok: false,
    label: "Checking...",
    detail: "Connecting to database service",
    checkedAt: "",
  });

  useEffect(() => {
    let intervalId: number;

    async function loadHealthStatus() {
      const checkedAt = new Date().toISOString();

      try {
        const systemResponse = await axios.get("http://localhost:4000/health");

        if (systemResponse?.data?.ok) {
          setSystemHealth({
            ok: true,
            label: "Healthy",
            detail: "Backend service online",
            checkedAt,
          });
        } else {
          setSystemHealth({
            ok: false,
            label: "Warning",
            detail: "Backend health check returned unexpected response",
            checkedAt,
          });
        }
      } catch {
        setSystemHealth({
          ok: false,
          label: "Offline",
          detail: "Backend service is unreachable",
          checkedAt,
        });
      }

      try {
        const dbResponse = await axios.get("http://localhost:4000/db/ping");

        if (dbResponse?.data?.ok) {
          setDatabaseHealth({
            ok: true,
            label: "Connected",
            detail: "Database connection is active",
            checkedAt,
          });
        } else {
          setDatabaseHealth({
            ok: false,
            label: "Warning",
            detail: dbResponse?.data?.error || "Database check returned warning",
            checkedAt,
          });
        }
      } catch {
        setDatabaseHealth({
          ok: false,
          label: "Disconnected",
          detail: "Database connection check failed",
          checkedAt,
        });
      }
    }

    loadHealthStatus();
    intervalId = window.setInterval(loadHealthStatus, 5000);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <div
      className={`app ${theme}`}
      style={{ backgroundImage: `url(${bgImage})` }}
    >
      <nav>
        <div className="logo-container">
          <img src={logo} alt="BlockShield Logo" className="logo" />
          <h2>BlockShield</h2>
        </div>

        <button type="button" className="theme-toggle" onClick={toggleTheme}>
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
      </nav>

      <main>
        <section className="hero-section">
          <div className="hero-text">
            <h1>Welcome to BlockShield</h1>
            <p>
              Secure Handshake System for monitoring blockchain node connections
              and improving trust during peer authentication.
            </p>

            <Link to="/role-selection">
              <button type="button">Select Role</button>
            </Link>
          </div>
        </section>

        <section className="cards-section">
          <div className="card">
            <h3>Secure Authentication</h3>
            <p>Verify node identity using cryptographic handshake protocols</p>
          </div>

          <div className="card">
            <h3>Replay Protection</h3>
            <p>Prevent malicious nodes from reusing handshake messages</p>
          </div>

          <div className="card">
            <h3>Connection Monitoring</h3>
            <p>Track blockchain node behaviour during peer discovery</p>
          </div>
        </section>

        <section className="health-section">
          <div className="health-card">
            <div className="health-card-top">
              <h3>System Health</h3>
             <span
                className={`health-badge ${
                  systemHealth.ok ? "healthy" : "offline"
                }`}
              >
                <span className="status-dot"></span>
                {systemHealth.label}
              </span>
            </div>

            <p className="health-detail">{systemHealth.detail}</p>
            <p className="health-time">
              Last checked: {formatCheckedTime(systemHealth.checkedAt)}
            </p>
          </div>

          <div className="health-card">
            <div className="health-card-top">
              <h3>Database Health</h3>
              <span
                  className={`health-badge ${
                    databaseHealth.ok ? "healthy" : "offline"
                  }`}
                >
                  <span className="status-dot"></span>
                  {databaseHealth.label}
                </span>
            </div>

            <p className="health-detail">{databaseHealth.detail}</p>
            <p className="health-time">
              Last checked: {formatCheckedTime(databaseHealth.checkedAt)}
            </p>
          </div>
        </section>

        <footer className="footer">
          <p>© 2026 BlockShield. All rights reserved.</p>
        </footer>
      </main>
    </div>
  );
}

export default Home;