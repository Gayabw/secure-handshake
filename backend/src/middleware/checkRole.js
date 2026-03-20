export function checkRole(allowedRoles = []) {
  const allowed = new Set(allowedRoles);

  return function roleGuard(req, res, next) {
    const role = req.staff?.role || null;

    if (!role) {
      return res.status(401).json({
        ok: false,
        error: "Missing or invalid x-staff-role header",
      });
    }

    if (!allowed.has(role)) {
      return res.status(403).json({
        ok: false,
        error: `Role ${role} is not permitted to access this resource`,
      });
    }

    return next();
  };
}