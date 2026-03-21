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
<<<<<<< HEAD
      roleTitle="SOC Analyst"
      roleDescription="Monitor security events, review alerts, and analyze suspicious activity across the protected environment."
=======
      roleTitle="SOC Analyst 01"
      roleDescription="Monitor alerts, review security events, and support early-stage incident analysis."
>>>>>>> origin/main
    />
  );
}

export default SocAnalyst01Login;