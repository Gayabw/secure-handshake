import { useNavigate } from "react-router-dom";
import LoginFormLayout from "../components/LoginFormLayout";

type NetworkAdminLoginProps = {
  theme: "light" | "dark";
  toggleTheme: () => void;
};

function NetworkAdminLogin({
  theme,
  toggleTheme,
}: NetworkAdminLoginProps) {
  const navigate = useNavigate();

  const handleLogin = (email: string) => {
    navigate("/otp-verification", {
      state: {
        email,
        role: "Network Admin",
      },
    });
  };

  return (
    <LoginFormLayout
      theme={theme}
      toggleTheme={toggleTheme}
      roleTitle="Network Admin"
      roleDescription="Manage trusted network access and secure node communication within the BlockShield platform."
      onSubmit={handleLogin}
    />
  );
}

export default NetworkAdminLogin;