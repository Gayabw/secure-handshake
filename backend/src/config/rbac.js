export const STAFF_ROLES = Object.freeze({
  ADMIN: "ADMIN",
  SOC: "SOC",
  ENGINEER: "ENGINEER",
  IR: "IR",
  AUDITOR: "AUDITOR",
});

export const ALL_STAFF_ROLES = Object.freeze(Object.values(STAFF_ROLES));

export function normalizeStaffRole(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  return ALL_STAFF_ROLES.includes(normalized) ? normalized : null;
}

export const ROLE_ACCESS = Object.freeze({
  ALERTS: Object.freeze([
    STAFF_ROLES.ADMIN,
    STAFF_ROLES.SOC,
    STAFF_ROLES.ENGINEER,
    STAFF_ROLES.IR,
    STAFF_ROLES.AUDITOR,
  ]),
  METRICS: Object.freeze([
    STAFF_ROLES.ADMIN,
    STAFF_ROLES.SOC,
    STAFF_ROLES.ENGINEER,
    STAFF_ROLES.AUDITOR,
  ]),
  HANDSHAKES: Object.freeze([
    STAFF_ROLES.ADMIN,
    STAFF_ROLES.SOC,
    STAFF_ROLES.ENGINEER,
    STAFF_ROLES.AUDITOR,
  ]),
  EVENT_LOGS: Object.freeze([
    STAFF_ROLES.ADMIN,
    STAFF_ROLES.SOC,
    STAFF_ROLES.AUDITOR,
  ]),
  ANOMALIES: Object.freeze([
    STAFF_ROLES.ADMIN,
    STAFF_ROLES.SOC,
    STAFF_ROLES.ENGINEER,
    STAFF_ROLES.IR,
    STAFF_ROLES.AUDITOR,
  ]),
  REPLAY_ATTACKS: Object.freeze([
    STAFF_ROLES.ADMIN,
    STAFF_ROLES.SOC,
    STAFF_ROLES.ENGINEER,
    STAFF_ROLES.IR,
    STAFF_ROLES.AUDITOR,
  ]),
  HANDSHAKE_READ: Object.freeze([
    STAFF_ROLES.ADMIN,
    STAFF_ROLES.SOC,
    STAFF_ROLES.ENGINEER,
    STAFF_ROLES.AUDITOR,
  ]),
});