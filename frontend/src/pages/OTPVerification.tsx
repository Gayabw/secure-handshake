import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FaSun, FaMoon } from "react-icons/fa";
import { getLoggedInUser } from "../services/authService";
import logo from "../assets/Logo.png";

type OTPVerificationProps = {
  theme: "light" | "dark";
  toggleTheme: () => void;
};

type OTPPageState = {
  staff_email?: string;
  staff_role?: string;
  redirect?: string;
};

function OTPVerification({ theme, toggleTheme }: OTPVerificationProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const state = (location.state || {}) as OTPPageState;
  const storedUser = getLoggedInUser();

  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!otp.trim()) {
      setError("Please enter the 6-digit OTP.");
      return;
    }

    if (!/^\d{6}$/.test(otp.trim())) {
      setError("OTP must be exactly 6 digits.");
      return;
    }

    const redirectPath = state.redirect || storedUser?.redirect;

    if (!redirectPath) {
      setError("Missing redirect path. Please login again.");
      return;
    }

    navigate(redirectPath, { replace: true });
  };

  return (
    <div className={`app ${theme}`}>
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
        <section className="login-page">
          <div className="login-card otp-card">
            <div className="login-card-header">
              <p className="login-role-label">OTP Verification</p>
              <h1>Verify Access</h1>
              <p className="login-description">
                Enter the 6-digit OTP to continue to your dashboard.
              </p>
            </div>

            <div className="otp-user-info">
              {state.staff_email || storedUser?.staff_email || "No email found"}
            </div>

            {error && <p style={{ color: "red" }}>{error}</p>}

            <form className="login-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="otp-code">OTP Code</label>
                <input
                  id="otp-code"
                  type="text"
                  maxLength={6}
                  placeholder="Enter 6-digit OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                />
              </div>

              <div className="login-actions">
                <button type="submit" className="login-submit-btn">
                  Verify OTP
                </button>
              </div>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}

export default OTPVerification;