import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { TABLES } from "../lib/tables.js";
import { writeLog } from "../services/logService.js";
import { checkRole } from "../middleware/checkRole.js";
import { ROLE_ACCESS } from "../config/rbac.js";

const router = Router();

/*
  POST /anomaly/resolve

  {
    "anomaly_id": 12,
    "resolved_by_staff_id": 1,
    "note": "Reviewed and accepted"
  }

  Notes:
  - Staff are stored in staff_users (not users)
  - This is human-in-the-loop evidence only (no auto blocking)
*/

function parsePositiveInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return null;
  return n;
}

router.post("/resolve", checkRole(ROLE_ACCESS.ANOMALIES), async (req, res) => {
  try {
    const anomaly_id = parsePositiveInt(req.body.anomaly_id);
    const resolved_by_staff_id = parsePositiveInt(req.body.resolved_by_staff_id);
    const note = req.body.note ?? null;

    if (!anomaly_id) {
      return res.status(400).json({ ok: false, error: "Invalid anomaly_id" });
    }

    if (!resolved_by_staff_id) {
      return res
        .status(400)
        .json({ ok: false, error: "Invalid resolved_by_staff_id" });
    }

    // 1) Load anomaly
    const { data: anomaly, error: aErr } = await supabase
      .from(TABLES.ANOMALIES)
      .select("*")
      .eq("anomaly_id", anomaly_id)
      .single();

    if (aErr || !anomaly) {
      return res.status(404).json({ ok: false, error: "Anomaly not found" });
    }

    // 2) Idempotency
    if (String(anomaly.status).toUpperCase() === "RESOLVED") {
      return res.json({ ok: true, status: "ALREADY_RESOLVED", anomaly });
    }

    const now = new Date().toISOString();

    // 3) Update anomaly -> RESOLVED (staff-owned)
    const { data: updated, error: upErr } = await supabase
      .from(TABLES.ANOMALIES)
      .update({
        status: "RESOLVED",
        resolved_at: now,
        resolved_by_staff_id,
        // keep legacy user resolver empty (staff are not in users)
        resolved_by_user_id: null,
      })
      .eq("anomaly_id", anomaly_id)
      .select("*")
      .single();

    if (upErr) {
      return res.status(500).json({ ok: false, error: upErr.message });
    }

    // 4) Audit log
    await writeLog({
      event_source: "anomalyService",
      event_type: "ANOMALY_RESOLVED",
      log_level: "INFO",
      subject_user_id: updated.subject_user_id,
      subject_user_key_id: updated.subject_user_key_id,
      anomaly_id: updated.anomaly_id,
      details: {
        anomaly_id: updated.anomaly_id,
        resolved_by_staff_id,
        resolution_note: note,
        previous_status: anomaly.status,
        new_status: "RESOLVED",
        previous_severity: anomaly.severity,
        resolved_at: now,
      },
    });

    return res.json({
      ok: true,
      anomaly_id: updated.anomaly_id,
      status: updated.status,
      resolved_at: updated.resolved_at,
    });
  } catch (e) {
    console.error("❌ /anomaly/resolve error:", e?.message || e);
    return res.status(500).json({ ok: false, error: e?.message || "Internal server error" });
  }
});

// GET /anomaly/list?limit=50&org_id=1&status=OPEN&severity=HIGH
router.get("/list", async (req, res) => {
  try {
    const limit = parsePositiveInt(req.query.limit) ?? 50;
    const org_id = parsePositiveInt(req.query.org_id);
    const status = req.query.status ? String(req.query.status).toUpperCase() : null;
    const severity = req.query.severity ? String(req.query.severity).toUpperCase() : null;

    let q = supabase
      .from(TABLES.ANOMALIES)
      .select("*")
      .order("detected_at", { ascending: false })
      .limit(limit);

    if (org_id) q = q.eq("org_id", org_id);
    if (status) q = q.eq("status", status);
    if (severity) q = q.eq("severity", severity);

    const { data, error } = await q;
    if (error) return res.status(500).json({ ok: false, error: error.message });

    return res.json({ ok: true, items: data ?? [] });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

export default router;
