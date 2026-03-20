import { FaSun, FaMoon } from "react-icons/fa";
import { Link } from "react-router-dom";
import logo from "../assets/Logo.png";
import bgImage from "../assets/bg-image.png";

type HomeProps = {
  theme: string;
  toggleTheme: () => void;
};

function Home({ theme, toggleTheme }: HomeProps) {
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

        <button className="theme-toggle" onClick={toggleTheme}>
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

            <Link to="/roles">
              <button>Select Role</button>
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

        <footer className="footer">
          <p>© 2026 BlockShield. All rights reserved.</p>
        </footer>
      </main>
    </div>
  );
}

export default Home;