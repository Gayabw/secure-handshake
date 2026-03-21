import { normalizeStaffRole } from "../config/rbac.js";

function parsePositiveInteger(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function requestStaffContext(req, _res, next) {
  const rawRole = req.header("x-staff-role");
  const rawStaffId = req.header("x-staff-id");
  const rawStaffEmail = req.header("x-staff-email");

  const role = normalizeStaffRole(rawRole);
  const staffId = parsePositiveInteger(rawStaffId);
  const staffEmail =
    typeof rawStaffEmail === "string" && rawStaffEmail.trim()
      ? rawStaffEmail.trim().toLowerCase()
      : null;

  req.staff = {
    role,
    staff_id: staffId,
    staff_email: staffEmail,
    is_authenticated: Boolean(role && staffId),
    demo_mode: true,
  };

  return next();
}