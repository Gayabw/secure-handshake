import LoginFormLayout from "../components/LoginFormLayout";

type NetworkAdminLoginProps = {
  theme: "light" | "dark";
  toggleTheme: () => void;
};

function NetworkAdminLogin({
  theme,
  toggleTheme,
}: NetworkAdminLoginProps) {
  return (
    <LoginFormLayout
      theme={theme}
      toggleTheme={toggleTheme}
      roleTitle="Network Admin"
      roleDescription="Manage trusted network access and secure node communication within the BlockShield platform."
    />
  );
}

export default NetworkAdminLogin;