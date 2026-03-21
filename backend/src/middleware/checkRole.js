export function checkRole(allowedRoles = []) {
  const allowed = new Set(
    Array.isArray(allowedRoles) ? allowedRoles.filter(Boolean) : []
  );

  return function roleGuard(req, res, next) {
    const role = req.staff?.role || null;

    if (!role) {
      return res.status(401).json({
        ok: false,
        error: "Authentication required or staff role is invalid",
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