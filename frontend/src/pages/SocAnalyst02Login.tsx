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
      roleTitle="SOC Analyst"
      roleDescription="Investigate alerts, validate suspicious patterns, and support continuous security monitoring operations."
    />
  );
}

export default SocAnalyst02Login;