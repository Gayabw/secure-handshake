import { supabase } from "../lib/supabase.js";
import { TABLES } from "../lib/tables.js";
import { writeLog } from "./logService.js";

/*
  Phase H - Auto-Mitigation (Human-in-the-loop)
  Records recommended actions only.
  Does NOT enforce blocks automatically.
*/

async function resolveOrgIdForSubject(subject_user_id) {
  try {
    const { data, error } = await supabase
      .from(TABLES.USERS)
      .select("org_id")
      .eq("user_id", subject_user_id)
      .single();

    if (error) return null;
    return data?.org_id ?? null;
  } catch (_) {
    return null;
  }
}

export async function recommendMitigation({
  anomaly_id,
  subject_user_id,
  subject_user_key_id,
  severity,
}) {
  if (!anomaly_id || !subject_user_id || !subject_user_key_id) return;

  const now = new Date().toISOString();
  const org_id = await resolveOrgIdForSubject(subject_user_id);

  let trigger_type = "ANOMALY_DETECTED";
  let action_taken = "NONE";
  let action_details = { message: "No mitigation required" };

  if (severity === "HIGH") {
    action_taken = "RECOMMEND_BLACKLIST";
    action_details = { reason: "High severity anomaly detected", confidence: "HIGH" };
  } else if (severity === "MEDIUM") {
    action_taken = "RECOMMEND_MONITOR";
    action_details = { reason: "Medium severity anomaly detected", confidence: "MEDIUM" };
  }

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

      org_id: org_id ?? null,
    })
    .select("*")
    .single();

  if (error) {
    console.error("Mitigation insert failed:", error);
    return;
  }

  try {
    await writeLog({
      event_source: "mitigationService",
      event_type: "AUTO_MITIGATION_RECOMMENDED",
      log_level: "WARN",
      subject_user_id,
      subject_user_key_id,
      anomaly_id,
      details: { trigger_type, action_taken, action_details },
    });
  } catch (_) {}

  return data;
}
