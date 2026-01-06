import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { TABLES } from "../lib/tables.js";

const router = Router();

/* Helpers */

function parsePositiveInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return null;
  return n;
}

/* ROUTES (READ ONLY)  */

/*
 GET /behaviour/profile/:user_id/:user_key_id
 Returns:
  - behaviour profile row (if exists)
  - latest anomalies (top 10)
  - latest replay attacks (top 10)
  - last correlation logs (top 5)
 */
router.get("/profile/:user_id/:user_key_id", async (req, res) => {
  try {
    const user_id = parsePositiveInt(req.params.user_id);
    const user_key_id = parsePositiveInt(req.params.user_key_id);

    if (!user_id || !user_key_id) {
      return res.status(400).json({
        ok: false,
        error: "Invalid user_id or user_key_id (must be positive integers).",
      });
    }

    // 1) Profile
    const { data: profile, error: pErr } = await supabase
      .from(TABLES.BEHAVIOR_PROFILES)
      .select("*")
      .eq("subject_user_id", user_id)
      .eq("subject_user_key_id", user_key_id)
      .maybeSingle();

    if (pErr) return res.status(500).json({ ok: false, error: pErr.message });

    // 2) Latest anomalies (top 10)
    const { data: anomalies, error: aErr } = await supabase
      .from(TABLES.ANOMALIES)
      .select(
        "anomaly_id, anomaly_type, anomaly_score, severity, status, detected_at, resolved_at, details"
      )
      .eq("subject_user_id", user_id)
      .eq("subject_user_key_id", user_key_id)
      .order("detected_at", { ascending: false })
      .limit(10);

    if (aErr) return res.status(500).json({ ok: false, error: aErr.message });

    // 3) Latest replay attacks (top 10)
    const { data: replays, error: rErr } = await supabase
      .from(TABLES.REPLAY_ATTACKS)
      .select(
        "replay_attack_id, handshake_id, replay_nonce, severity, detection_reason, detected_timestamp, created_at"
      )
      .eq("subject_user_id", user_id)
      .eq("subject_user_key_id", user_key_id)
      .order("detected_timestamp", { ascending: false })
      .limit(10);

    if (rErr) return res.status(500).json({ ok: false, error: rErr.message });

    // 4) Latest BEHAVIOR_CORRELATED logs for this subject (top 5)
    
    const { data: correlations, error: cErr } = await supabase
      .from(TABLES.EVENT_LOGS)
      .select("event_log_id, handshake_id, created_at, details")
      .eq("event_type", "BEHAVIOR_CORRELATED")
      .eq("subject_user_id", user_id)
      .eq("subject_user_key_id", user_key_id)
      .order("created_at", { ascending: false })
      .limit(5);

    if (cErr) return res.status(500).json({ ok: false, error: cErr.message });

    return res.json({
      ok: true,
      subject: { user_id, user_key_id },
      profile: profile || null,
      anomalies: anomalies || [],
      replay_attacks: replays || [],
      behaviour_correlation: correlations || [],
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

export default router;
