import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { TABLES } from "../lib/tables.js";
import { parsePositiveInt } from "../lib/query.js";
import { checkRole } from "../middleware/checkRole.js";
import { ROLE_ACCESS } from "../config/rbac.js";

const router = Router();

// GET /metrics/overview?org_id=1
router.get("/overview", checkRole(ROLE_ACCESS.METRICS), async (req, res) => {
  try {
    const org_id = parsePositiveInt(req.query.org_id, "org_id");

    const now = Date.now();
    const since24h = new Date(now - 24 * 60 * 60 * 1000).toISOString();

    const [{ count: handshakes24h }, { count: replays24h }, { count: openAnoms }] =
      await Promise.all([
        supabase
          .from(TABLES.HANDSHAKES)
          .select("*", { count: "exact", head: true })
          .eq("org_id", org_id)
          .gte("created_at", since24h),
        supabase
          .from(TABLES.REPLAY_ATTACKS)
          .select("*", { count: "exact", head: true })
          .eq("org_id", org_id)
          .gte("created_at", since24h),
        supabase
          .from(TABLES.ANOMALIES)
          .select("*", { count: "exact", head: true })
          .eq("org_id", org_id)
          .eq("status", "OPEN"),
      ]).then((results) =>
        results.map((r) => {
          if (r.error) throw new Error(r.error.message);
          return r;
        })
      );

    const { data: last_events, error: lastErr } = await supabase
      .from(TABLES.EVENT_LOGS)
      .select("*")
      .eq("org_id", org_id)
      .order("event_time", { ascending: false })
      .limit(5);

    if (lastErr) throw new Error(lastErr.message);

    return res.json({
      ok: true,
      data: {
        org_id,
        window: { since_24h: since24h },
        counts: {
          handshakes_24h: handshakes24h ?? 0,
          replay_attacks_24h: replays24h ?? 0,
          anomalies_open: openAnoms ?? 0,
        },
        last_events: last_events ?? [],
      },
    });
  } catch (e) {
    const status = e.statusCode || 500;
    return res.status(status).json({ ok: false, error: e.message });
  }
});

export default router;