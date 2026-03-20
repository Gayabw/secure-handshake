import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { FaSun, FaMoon } from "react-icons/fa";
import logo from "../assets/logo.png";
import footerPattern from "../assets/footer-bg.png";

type LoginFormLayoutProps = {
  theme: "light" | "dark";
  toggleTheme: () => void;
  roleTitle: string;
  roleDescription: string;
  onSubmit: (email: string) => void;
};

function LoginFormLayout({
  theme,
  toggleTheme,
  roleTitle,
  roleDescription,
  onSubmit,
}: LoginFormLayoutProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit(email);
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
        <section className="login-card">
          <div className="login-card-header">
            <p className="login-role-label">{roleTitle}</p>
            <h1>{roleTitle} Login</h1>
            <p className="login-description">{roleDescription}</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="login-actions">
              <button type="submit" className="login-submit-btn">
                Continue
              </button>

              <Link to="/roles" className="back-to-roles-link">
                Back to Roles
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

export default LoginFormLayout;