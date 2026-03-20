import LoginFormLayout from "../components/LoginFormLayout";

type IncidentResponderLoginProps = {
  theme: "light" | "dark";
  toggleTheme: () => void;
};

function IncidentResponderLogin({
  theme,
  toggleTheme,
}: IncidentResponderLoginProps) {
  return (
    <LoginFormLayout
      theme={theme}
      toggleTheme={toggleTheme}
      roleTitle="Incident Responder"
      roleDescription="Respond to active incidents, coordinate containment actions, and support recovery procedures."
    />
  );
}

export default IncidentResponderLogin;