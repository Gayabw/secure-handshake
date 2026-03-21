import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { TABLES } from "../lib/tables.js";
import { parsePositiveInt } from "../lib/query.js";
import { checkRole } from "../middleware/checkRole.js";
import { ROLE_ACCESS } from "../config/rbac.js";

const router = Router();

router.get("/overview", checkRole(ROLE_ACCESS.METRICS), async (req, res) => {
  try {
    const org_id = parsePositiveInt(req.query.org_id, "org_id");
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

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
        results.map((result) => {
          if (result.error) {
            throw new Error(result.error.message);
          }
          return result;
        })
      );

    const { data: lastEvents, error: lastErr } = await supabase
      .from(TABLES.EVENT_LOGS)
      .select("*")
      .eq("org_id", org_id)
      .order("event_time", { ascending: false })
      .limit(5);

    if (lastErr) {
      throw new Error(lastErr.message);
    }

    return res.json({
      ok: true,
      data: {
        org_id,
        counts: {
          handshakes: handshakes24h ?? 0,
          replay_attacks: replays24h ?? 0,
          anomalies: openAnoms ?? 0,
        },
        last_events: lastEvents ?? [],
        updated_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      ok: false,
      error: error.message,
    });
  }
});

export default router;