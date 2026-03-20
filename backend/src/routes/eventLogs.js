import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { TABLES } from "../lib/tables.js";
import { checkRole } from "../middleware/checkRole.js";
import { ROLE_ACCESS } from "../config/rbac.js";

const router = Router();

function parsePositiveInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return null;
  return n;
}

// GET /event-logs?limit=50&org_id=1&event_type=REPLAY_DETECTED
router.get("/", checkRole(ROLE_ACCESS.EVENT_LOGS), async (req, res) => {
  try {
    const limit = parsePositiveInt(req.query.limit) ?? 50;
    const org_id = parsePositiveInt(req.query.org_id);
    const event_type = req.query.event_type ? String(req.query.event_type) : null;
    const log_level = req.query.log_level ? String(req.query.log_level).toUpperCase() : null;

    let q = supabase
      .from(TABLES.EVENT_LOGS)
      .select("*")
      .order("event_time", { ascending: false })
      .limit(limit);

    if (org_id) q = q.eq("org_id", org_id);
    if (event_type) q = q.eq("event_type", event_type);
    if (log_level) q = q.eq("log_level", log_level);

    const { data, error } = await q;
    if (error) return res.status(500).json({ ok: false, error: error.message });

    return res.json({ ok: true, items: data ?? [] });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

export default router;