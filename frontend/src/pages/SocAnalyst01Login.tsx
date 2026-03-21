import LoginFormLayout from "../components/LoginFormLayout";

type SocAnalyst01LoginProps = {
  theme: "light" | "dark";
  toggleTheme: () => void;
};

function SocAnalyst01Login({
  theme,
  toggleTheme,
}: SocAnalyst01LoginProps) {
  return (
    <LoginFormLayout
      theme={theme}
      toggleTheme={toggleTheme}
      roleTitle="SOC Analyst"
      roleDescription="Monitor security events, review alerts, and analyze suspicious activity across the protected environment."
    />
  );
}

export default SocAnalyst01Login;