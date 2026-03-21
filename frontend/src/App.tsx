import { useState } from "react";
import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import RoleSelection from "./pages/RoleSelection";
import NetworkAdminLogin from "./pages/NetworkAdminLogin";
import SocAnalyst01Login from "./pages/SocAnalyst01Login";
import SocAnalyst02Login from "./pages/SocAnalyst02Login";
import SecurityEngineerLogin from "./pages/SecurityEngineerLogin";
import IncidentResponderLogin from "./pages/IncidentResponderLogin";
import AuditorLogin from "./pages/AuditorLogin";
import OTPVerification from "./pages/OTPVerification";
import NetworkAdminDashboard from "./pages/dashboards/network-admin/NetworkAdminDashboard";
import SOCAnalystDashboard from "./pages/dashboards/soc-analyst/SOCAnalystDashboard";
import SecurityEngineerDashboard from "./pages/dashboards/security-engineer/SecurityEngineerDashboard";
import IncidentResponderDashboard from "./pages/dashboards/incident-responder/IncidentResponderDashboard";
import AuditorDashboard from "./pages/dashboards/auditor/AuditorDashboard";

function App() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === "light" ? "dark" : "light"));
  };

  return (
    <Routes>
      <Route
        path="/"
        element={<Home theme={theme} toggleTheme={toggleTheme} />}
      />
      <Route
        path="/roles"
        element={<RoleSelection theme={theme} toggleTheme={toggleTheme} />}
      />
      <Route
        path="/login/network-admin"
        element={<NetworkAdminLogin theme={theme} toggleTheme={toggleTheme} />}
      />

      <Route
        path="/login/soc-analyst-01"
        element={<SocAnalyst01Login theme={theme} toggleTheme={toggleTheme} />}
      />

      <Route
        path="/login/soc-analyst-02"
        element={<SocAnalyst02Login theme={theme} toggleTheme={toggleTheme} />}
      />

      <Route
        path="/login/security-engineer"
        element={
          <SecurityEngineerLogin theme={theme} toggleTheme={toggleTheme} />
        }
      />

      <Route
        path="/login/incident-responder"
        element={
          <IncidentResponderLogin theme={theme} toggleTheme={toggleTheme} />
        }
      />

      <Route
        path="/login/auditor"
        element={<AuditorLogin theme={theme} toggleTheme={toggleTheme} />}
      />

      <Route
        path="/otp-verification"
        element={<OTPVerification theme={theme} toggleTheme={toggleTheme} />}
      />
      <Route
        path="/dashboard/network-admin"
        element={
          <NetworkAdminDashboard theme={theme} toggleTheme={toggleTheme} />
        }
      />

      <Route
        path="/dashboard/soc-analyst"
        element={
          <SOCAnalystDashboard theme={theme} toggleTheme={toggleTheme} />
        }
      />

      <Route
        path="/dashboard/security-engineer"
        element={
          <SecurityEngineerDashboard
            theme={theme}
            toggleTheme={toggleTheme}
          />
        }
      />

      <Route
        path="/dashboard/incident-responder"
        element={
          <IncidentResponderDashboard
            theme={theme}
            toggleTheme={toggleTheme}
          />
        }
      />

      <Route
        path="/dashboard/auditor"
        element={<AuditorDashboard theme={theme} toggleTheme={toggleTheme} />}
      />
    </Routes>
  );
}

export default App;