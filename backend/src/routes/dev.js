

import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { TABLES } from "../lib/tables.js";

const router = Router();

function isDev() {
  return process.env.NODE_ENV !== "production";
}

function parsePositiveInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return null;
  return n;
}


// GET /dev/organizations
router.get("/organizations", async (req, res) => {
  const { data, error } = await supabase
    .from(TABLES.ORGANIZATIONS)
    .select("org_id, org_name, org_code, is_active")
    .order("org_name", { ascending: true });

  if (error) return res.status(500).json({ ok: false, error: error.message });
  return res.json({ ok: true, items: data ?? [] });
});

// GET /dev/staff-users
router.get("/staff-users", async (req, res) => {
  const { data, error } = await supabase
    .from(TABLES.STAFF_USERS)
    .select("staff_id, staff_name, staff_email, staff_role, status")
    .order("staff_name", { ascending: true });

  if (error) return res.status(500).json({ ok: false, error: error.message });
  return res.json({ ok: true, items: data ?? [] });
});

// POST /dev/anomalies/create  (dev-only)
router.post("/anomalies/create", async (req, res) => {
  try {
    if (!isDev()) return res.status(404).json({ ok: false, error: "Not found" });

    const org_id = parsePositiveInt(req.body.org_id);
    const subject_user_id = parsePositiveInt(req.body.subject_user_id);
    const subject_user_key_id = parsePositiveInt(req.body.subject_user_key_id);

    if (!org_id) return res.status(400).json({ ok: false, error: "Invalid org_id" });
    if (!subject_user_id || !subject_user_key_id) {
      return res.status(400).json({ ok: false, error: "Invalid subject_user_id/subject_user_key_id" });
    }

    const now = new Date().toISOString();

    const payload = {
      org_id,
      subject_user_id,
      subject_user_key_id,
      anomaly_type: req.body.anomaly_type || "DEV_VERIFY",
      anomaly_score: Number(req.body.anomaly_score || 85),
      severity: (req.body.severity || "MEDIUM").toUpperCase(),
      status: "OPEN",
      details: req.body.details || { source: "dev" },
      detected_at: now,
    };

    const { data, error } = await supabase
      .from(TABLES.ANOMALIES)
      .insert(payload)
      .select("anomaly_id, status, detected_at, severity, anomaly_type")
      .single();

    if (error) return res.status(500).json({ ok: false, error: error.message });
    return res.status(201).json({ ok: true, item: data });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});


export default router;
