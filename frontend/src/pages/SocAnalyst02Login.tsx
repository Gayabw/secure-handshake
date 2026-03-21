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
<<<<<<< HEAD
      roleTitle="SOC Analyst"
      roleDescription="Investigate alerts, validate suspicious patterns, and support continuous security monitoring operations."
=======
      roleTitle="SOC Analyst 02"
      roleDescription="Investigate advanced threats, validate suspicious behavior, and escalate critical findings."
>>>>>>> origin/main
    />
  );
}

export default SocAnalyst02Login;