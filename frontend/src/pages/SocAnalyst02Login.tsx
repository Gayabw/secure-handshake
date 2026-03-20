import LoginFormLayout from "../components/LoginFormLayout";

type SocAnalyst02LoginProps = {
  theme: "light" | "dark";
  toggleTheme: () => void;
};

function SocAnalyst02Login({
  theme,
  toggleTheme,
}: SocAnalyst02LoginProps) {
  return (
    <LoginFormLayout
      theme={theme}
      toggleTheme={toggleTheme}
      roleTitle="SOC Analyst 02"
      roleDescription="Investigate advanced threats, validate suspicious behavior, and escalate critical findings."
    />
  );
}

export default SocAnalyst02Login;