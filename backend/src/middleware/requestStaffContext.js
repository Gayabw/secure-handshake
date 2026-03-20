import { normalizeStaffRole } from "../config/rbac.js";

export function requestStaffContext(req, _res, next) {
  const role = normalizeStaffRole(req.header("x-staff-role"));
  const staffIdHeader = req.header("x-staff-id");
  const staffEmail = req.header("x-staff-email") || null;

  const staffId = staffIdHeader ? Number(staffIdHeader) : null;

  req.staff = {
    role,
    staff_id: Number.isInteger(staffId) && staffId > 0 ? staffId : null,
    staff_email: staffEmail,
    demo_mode: true,
  };

  next();
}