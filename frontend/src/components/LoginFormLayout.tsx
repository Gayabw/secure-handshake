import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaSun, FaMoon } from "react-icons/fa";
import { loginUser, saveLoggedInUser } from "../services/authService";
import logo from "../assets/Logo.png";

type LoginFormLayoutProps = {
  theme: "light" | "dark";
  toggleTheme: () => void;
  roleTitle: string;
  roleDescription: string;
};

function LoginFormLayout({
  theme,
  toggleTheme,
  roleTitle,
  roleDescription,
}: LoginFormLayoutProps) {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!email.trim() || !password.trim()) {
      setError("Please enter email and password.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await loginUser(email.trim(), password.trim());

      if (!response.ok || !response.user) {
        setError(response.error || "Login failed.");
        return;
      }

      saveLoggedInUser(response.user);

      navigate("/otp-verification", {
        state: {
          staff_email: response.user.staff_email,
          staff_role: response.user.staff_role,
          redirect: response.user.redirect,
        },
      });
    } catch (err: any) {
      setError(
        err?.response?.data?.error || "Unable to connect to the backend."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`app ${theme}`}>
      <nav>
        {/* ✅ FIXED: clickable logo (same as dashboard) */}
        <Link to="/" className="logo-container">
          <img src={logo} alt="BlockShield Logo" className="logo" />
          <div>
            <h2>BlockShield</h2>
          </div>
        </Link>

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
          <div className="login-card">
            <div className="login-card-header">
              <p className="login-role-label">{roleTitle}</p>
              <h1>Sign in</h1>
              <p className="login-description">{roleDescription}</p>
            </div>

            {error && <p style={{ color: "red" }}>{error}</p>}

            <form className="login-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="staff-email">Email</label>
                <input
                  id="staff-email"
                  type="email"
                  placeholder="Enter your staff email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="staff-password">Password</label>
                <input
                  id="staff-password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <div className="login-actions">
                <button
                  type="submit"
                  className="login-submit-btn"
                  disabled={loading}
                >
                  {loading ? "Signing in..." : "Continue"}
                </button>

                <Link to="/role-selection" className="back-to-roles-link">
                  Back to Role Selection
                </Link>
              </div>
            </form>
          </div>
        </section>

        <footer className="footer">
          <p>© 2026 BlockShield. All rights reserved.</p>
        </footer>
      </main>
    </div>
  );
}

export default LoginFormLayout;