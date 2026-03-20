import LoginFormLayout from "../components/LoginFormLayout";

type SecurityEngineerLoginProps = {
  theme: "light" | "dark";
  toggleTheme: () => void;
};

function SecurityEngineerLogin({
  theme,
  toggleTheme,
}: SecurityEngineerLoginProps) {
  return (
    <LoginFormLayout
      theme={theme}
      toggleTheme={toggleTheme}
      roleTitle="Security Engineer"
      roleDescription="Configure defensive controls, strengthen node protection, and improve platform security posture."
    />
  );
}

export default SecurityEngineerLogin;