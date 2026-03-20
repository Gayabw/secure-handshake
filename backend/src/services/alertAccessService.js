import { STAFF_ROLES } from "../config/rbac.js";

function normalizeSeverity(value) {
  return String(value || "").trim().toUpperCase();
}

function isTechnicalAlert(alert) {
  const type = String(alert?.alert_type || "").toLowerCase();
  const title = String(alert?.title || "").toLowerCase();

  return (
    type.includes("replay") ||
    type.includes("anomaly") ||
    title.includes("replay") ||
    title.includes("handshake") ||
    title.includes("anomaly")
  );
}

export function filterAlertsForRole(alerts = [], role) {
  if (!Array.isArray(alerts)) return [];

  switch (role) {
    case STAFF_ROLES.ADMIN:
      return alerts;

    case STAFF_ROLES.SOC:
      return alerts.filter((alert) => {
        const severity = normalizeSeverity(alert?.severity);
        return severity === "MEDIUM" || severity === "HIGH" || severity === "CRITICAL";
      });

    case STAFF_ROLES.ENGINEER:
      return alerts.filter((alert) => {
        const severity = normalizeSeverity(alert?.severity);
        return severity === "HIGH" || severity === "CRITICAL" || isTechnicalAlert(alert);
      });

    case STAFF_ROLES.IR:
      return alerts.filter((alert) => {
        const severity = normalizeSeverity(alert?.severity);
        return severity === "HIGH" || severity === "CRITICAL";
      });

    case STAFF_ROLES.AUDITOR:
      return alerts.filter((alert) => {
        const severity = normalizeSeverity(alert?.severity);
        return severity === "CRITICAL";
      });

    default:
      return [];
  }
}