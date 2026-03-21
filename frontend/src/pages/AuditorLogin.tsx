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
<<<<<<< HEAD
      roleDescription="Review audit trails, compliance records, and verification activity across the protected platform."
=======
      roleDescription="Review logs, verify compliance evidence, and inspect authentication and activity records."
>>>>>>> origin/main
    />
  );
}

export default AuditorLogin;