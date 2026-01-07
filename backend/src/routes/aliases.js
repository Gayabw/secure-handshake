import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { TABLES } from "../lib/tables.js";
import { parseLimit, parsePositiveInt } from "../lib/query.js";

const router = Router();

/*
  Standard read-only aliases (no auth, no RBAC).
  Keep existing routes as-is:
  - /handshake/list
  - /anomaly/list
*/

router.get("/handshakes", async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit, 50, 200);
    const org_id = req.query.org_id ? parsePositiveInt(req.query.org_id, "org_id") : null;

    let q = supabase
      .from(TABLES.HANDSHAKES)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (org_id) q = q.eq("org_id", org_id);

    const { data, error } = await q;
    if (error) throw new Error(error.message);

    return res.json({ ok: true, items: data ?? [] });
  } catch (e) {
    const status = e.statusCode || 500;
    return res.status(status).json({ ok: false, error: e.message });
  }
});

router.get("/anomalies", async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit, 50, 200);
    const org_id = req.query.org_id ? parsePositiveInt(req.query.org_id, "org_id") : null;
    const statusFilter = req.query.status ? String(req.query.status).toUpperCase() : null;

    let q = supabase
      .from(TABLES.ANOMALIES)
      .select("*")
      .order("detected_at", { ascending: false })
      .limit(limit);

    if (org_id) q = q.eq("org_id", org_id);
    if (statusFilter) q = q.eq("status", statusFilter);

    const { data, error } = await q;
    if (error) throw new Error(error.message);

    return res.json({ ok: true, items: data ?? [] });
  } catch (e) {
    const status = e.statusCode || 500;
    return res.status(status).json({ ok: false, error: e.message });
  }
});

// GET /behaviour-profiles?org_id=1&limit=50
router.get("/behaviour-profiles", async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit, 50, 200);
    const org_id = parsePositiveInt(req.query.org_id, "org_id");

    const { data, error } = await supabase
      .from(TABLES.BEHAVIOR_PROFILES)
      .select("*")
      .eq("org_id", org_id)
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);

    return res.json({ ok: true, items: data ?? [] });
  } catch (e) {
    const status = e.statusCode || 500;
    return res.status(status).json({ ok: false, error: e.message });
  }
});

export default router;
