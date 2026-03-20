import LoginFormLayout from "../components/LoginFormLayout";

type AuditorLoginProps = {
  theme: "light" | "dark";
  toggleTheme: () => void;
};

function AuditorLogin({ theme, toggleTheme }: AuditorLoginProps) {
  return (
    <LoginFormLayout
      theme={theme}
      toggleTheme={toggleTheme}
      roleTitle="Auditor"
      roleDescription="Review logs, verify compliance evidence, and inspect authentication and activity records."
    />
  );
}

export default AuditorLogin;