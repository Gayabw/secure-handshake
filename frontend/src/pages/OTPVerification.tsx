import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { FaSun, FaMoon } from "react-icons/fa";
import logo from "../assets/logo.png";
import footerPattern from "../assets/footer-bg.png";

type OTPVerificationProps = {
  theme: "light" | "dark";
  toggleTheme: () => void;
};

type OTPState = {
  email?: string;
  role?: string;
};

function OTPVerification({ theme, toggleTheme }: OTPVerificationProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as OTPState) || {};

  const [otp, setOtp] = useState("");

  const email = state.email || "";
  const role = state.role || "User";

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (otp.length !== 6) return;

    const dashboardRoutes: Record<string, string> = {
      "Network Admin": "/dashboard/network-admin",
      "SOC Analyst": "/dashboard/soc-analyst",
      "Security Engineer": "/dashboard/security-engineer",
      "Incident Responder": "/dashboard/incident-responder",
      Auditor: "/dashboard/auditor",
    };

    const targetRoute = dashboardRoutes[role];

    if (targetRoute) {
      navigate(targetRoute);
    } else {
      navigate("/");
    }
  };

  return (
    <div className={`app ${theme}`}>
      <nav>
        <div className="logo-container">
          <img src={logo} alt="BlockShield Logo" className="logo" />
          <div>
            <h2>BlockShield</h2>
          </div>
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

      <main className="login-page">
        <section className="login-card otp-card">
          <div className="login-card-header">
            <p className="login-role-label">{role}</p>
            <h1>OTP Verification</h1>
            <p className="login-description">
              Enter the one-time password sent to your registered email address.
            </p>
          </div>

          <div className="otp-user-info">
            <p>
              <strong>Email:</strong> {email || "No email provided"}
            </p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="otp-code">Enter OTP</label>
              <input
                id="otp-code"
                name="otp_code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="Enter 6-digit OTP"
                value={otp}
                onChange={(e) =>
                  setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                required
              />
            </div>

            <div className="login-actions">
              <button type="submit" className="login-submit-btn">
                Verify OTP
              </button>

              <Link to="/roles" className="back-to-roles-link">
                Back to Login
              </Link>
            </div>
          </form>
        </section>
      </main>

      <footer
        className="footer"
        style={{ backgroundImage: `url(${footerPattern})` }}
      >
        <p>© 2026 BlockShield. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default OTPVerification;