// backend/src/services/mitigationService.js
import { supabase } from "../lib/supabase.js";
import { TABLES } from "../lib/tables.js";
import { writeLog } from "./logService.js";

/**
 * Phase H — Auto-Mitigation (Human-in-the-loop)
 * This service ONLY records mitigation decisions.
 * It does NOT enforce blocks automatically.
 */

export async function recommendMitigation({
  anomaly_id,
  subject_user_id,
  subject_user_key_id,
  severity,
}) {
  // Hard safety checks
  if (!anomaly_id || !subject_user_id || !subject_user_key_id) return;

  const now = new Date().toISOString();

  // Decide mitigation (recommendation only)
  let trigger_type = "ANOMALY_DETECTED";
  let action_taken = "NONE";
  let action_details = {
    message: "No mitigation required",
  };

  if (severity === "HIGH") {
    action_taken = "RECOMMEND_BLACKLIST";
    action_details = {
      reason: "High severity anomaly detected",
      confidence: "HIGH",
    };
  } else if (severity === "MEDIUM") {
    action_taken = "RECOMMEND_MONITOR";
    action_details = {
      reason: "Medium severity anomaly detected",
      confidence: "MEDIUM",
    };
  }

  // Insert mitigation record (MATCHES YOUR SCHEMA)
  const { data, error } = await supabase
    .from(TABLES.AUTO_MITIGATIONS)
    .insert({
      anomaly_id,
      subject_user_id,
      subject_user_key_id,

      trigger_type,
      action_taken,
      action_details,

      effective_from: now,
      effective_until: null,

      status: "PENDING",
      created_at: now,
      created_by_system: true,
      overridden_by_user_id: null,
    })
    .select("*")
    .single();

  if (error) {
    console.error("Mitigation insert failed:", error);
    return;
  }

  // Evidence log (non-blocking)
  try {
    await writeLog({
      event_source: "mitigationService",
      event_type: "AUTO_MITIGATION_RECOMMENDED",
      log_level: "WARN",
      subject_user_id,
      subject_user_key_id,
      anomaly_id,
      details: {
        trigger_type,
        action_taken,
        action_details,
      },
    });
  } catch (_) {
    // fail-safe
  }

  return data;
}
