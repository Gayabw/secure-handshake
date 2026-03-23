import { useState } from "react";
import {
  FaSun,
  FaMoon,
  FaNetworkWired,
  FaUserShield,
  FaTools,
  FaSearch,
  FaClipboardCheck,
} from "react-icons/fa";
import { MdOutlineSecurity } from "react-icons/md";
import { useNavigate, Link } from "react-router-dom";
import logo from "../assets/Logo.png";
import bgImage from "../assets/bg-image.png";

type RoleSelectionProps = {
  theme: string;
  toggleTheme: () => void;
};

type Role = {
  id: number;
  name: string;
  description: string;
  icon: React.ReactNode;
  positionClass: string;
};

function RoleSelection({ theme, toggleTheme }: RoleSelectionProps) {
  const navigate = useNavigate();

  const roles: Role[] = [
    {
      id: 1,
      name: "Network Admin",
      description: "Manage trusted network access",
      icon: <FaNetworkWired />,
      positionClass: "role-top",
    },
    {
      id: 2,
      name: "SOC Analyst 01",
      description: "Monitor alerts and events",
      icon: <FaUserShield />,
      positionClass: "role-right-top",
    },
    {
      id: 3,
      name: "SOC Analyst 02",
      description: "Investigate advanced threats",
      icon: <MdOutlineSecurity />,
      positionClass: "role-right-bottom",
    },
    {
      id: 4,
      name: "Security Engineer",
      description: "Build and improve defenses",
      icon: <FaTools />,
      positionClass: "role-bottom",
    },
    {
      id: 5,
      name: "Incident Responder",
      description: "Respond to active incidents",
      icon: <FaSearch />,
      positionClass: "role-left-bottom",
    },
    {
      id: 6,
      name: "Auditor",
      description: "Review records and audit activities",
      icon: <FaClipboardCheck />,
      positionClass: "role-left-top",
    },
  ];

  const [selectedRole, setSelectedRole] = useState<Role>(roles[0]);

  const roleRoutes: Record<string, string> = {
    "Network Admin": "/login/network-admin",
    "SOC Analyst 01": "/login/soc-analyst-01",
    "SOC Analyst 02": "/login/soc-analyst-02",
    "Security Engineer": "/login/security-engineer",
    "Incident Responder": "/login/incident-responder",
    Auditor: "/login/auditor",
  };

  const handleContinue = () => {
    const selectedRoute = roleRoutes[selectedRole.name];
    if (selectedRoute) {
      navigate(selectedRoute);
    }
  };

  return (
    <div
      className={`app ${theme}`}
      style={{ backgroundImage: `url(${bgImage})` }}
    >
      <nav>
        <Link to="/" className="logo-container">
          <img src={logo} alt="BlockShield Logo" className="logo" />
          <h2>BlockShield</h2>
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
        <section className="role-header">
          <h1>Select Your Role</h1>
          <p>
            Choose your access level to continue securely into the BlockShield
            platform.
          </p>
        </section>

        <section className="role-section compact-role-section">
          <div className="compact-role-layout">
            {roles.map((role) => (
              <button
                key={role.id}
                type="button"
                className={`compact-role-box ${role.positionClass} ${
                  selectedRole.id === role.id ? "active-role" : ""
                }`}
                onClick={() => setSelectedRole(role)}
              >
                <span className="compact-role-icon">{role.icon}</span>
                <span className="compact-role-text">{role.name}</span>
              </button>
            ))}

            <div className="compact-role-center">
              <div className="compact-center-icon">{selectedRole.icon}</div>
              <h2>{selectedRole.name}</h2>
              <p>{selectedRole.description}</p>
              <button
                type="button"
                className="role-continue-btn"
                onClick={handleContinue}
              >
                Continue
              </button>
            </div>
          </div>
        </section>

        <footer className="footer">
          <p>© 2026 BlockShield. All rights reserved.</p>
        </footer>
      </main>
    </div>
  );
}

export default RoleSelection;