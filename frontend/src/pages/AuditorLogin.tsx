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
      roleDescription="Review audit trails, compliance records, and verification activity across the protected platform."
    />
  );
}

export default AuditorLogin;