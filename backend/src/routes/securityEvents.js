import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { TABLES } from "../lib/tables.js";

const router = Router();

function parsePositiveInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return null;
  return n;
}

// GET /security-events?limit=100&org_id=1
router.get("/", async (req, res) => {
  try {
    const limit = parsePositiveInt(req.query.limit) ?? 100;
    const org_id = parsePositiveInt(req.query.org_id);

    let q = supabase
      .from(TABLES.SECURITY_EVENTS)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (org_id) q = q.eq("org_id", org_id);

    const { data, error } = await q;

    if (error) {
      return res.status(500).json({ ok: false, error: error.message });
    }

    return res.json({ ok: true, items: data ?? [] });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

export default router;