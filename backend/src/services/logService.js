import { supabase } from "../lib/supabase.js";
import { TABLES } from "../lib/tables.js";

/*
  Centralized event logging service

  Enterprise rules:
  - event_logs.org_id is populated whenever possible
  - Resolution priority:
      1) explicit org_id (caller provides)
      2) subject_user_id -> users.org_id
      3) handshake_id -> handshakes.org_id
      4) anomaly_id -> anomalies.org_id
  - Fail-safe: logging should never crash core flows because a lookup failed
*/

function isPositiveInt(v) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0;
}

async function resolveOrgId({ org_id, subject_user_id, handshake_id, anomaly_id }) {
  // 1) Explicit org_id wins
  if (isPositiveInt(org_id)) return Number(org_id);

  // Best-effort lookups only
  try {
    // 2) Subject -> users.org_id
    if (isPositiveInt(subject_user_id)) {
      const { data, error } = await supabase
        .from(TABLES.USERS)
        .select("org_id")
        .eq("user_id", Number(subject_user_id))
        .maybeSingle();

      if (!error && isPositiveInt(data?.org_id)) return Number(data.org_id);
    }

    // 3) Handshake -> handshakes.org_id
    if (isPositiveInt(handshake_id)) {
      const { data, error } = await supabase
        .from(TABLES.HANDSHAKES)
        .select("org_id")
        .eq("handshake_id", Number(handshake_id))
        .maybeSingle();

      if (!error && isPositiveInt(data?.org_id)) return Number(data.org_id);
    }

    // 4) Anomaly -> anomalies.org_id
    if (isPositiveInt(anomaly_id)) {
      const { data, error } = await supabase
        .from(TABLES.ANOMALIES)
        .select("org_id")
        .eq("anomaly_id", Number(anomaly_id))
        .maybeSingle();

      if (!error && isPositiveInt(data?.org_id)) return Number(data.org_id);
    }
  } catch (_) {
    // swallow lookup failures (logging must remain non-blocking)
  }

  return null;
}

export async function writeLog({
  event_source = "backend",
  event_type,
  log_level = "INFO",

  subject_user_id = null,
  subject_user_key_id = null,
  handshake_id = null,
  anomaly_id = null,

  ip_address = null,
  details = null,

  org_id = null,
}) {
  if (!event_type) {
    throw new Error("event_type is required for writeLog()");
  }

  const now = new Date().toISOString();

  // Resolve org_id best-effort (never blocks)
  const resolvedOrgId = await resolveOrgId({
    org_id,
    subject_user_id,
    handshake_id,
    anomaly_id,
  });

  const payload = {
    event_time: now,
    event_source,
    event_type,
    log_level,

    subject_user_id,
    subject_user_key_id,
    handshake_id,
    anomaly_id,

    ip_address,
    details, // jsonb
    created_at: now,

    org_id: resolvedOrgId,
  };

  const { data, error } = await supabase
    .from(TABLES.EVENT_LOGS)
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Event log insert failed: ${error.message}`);
  }

  return data;
}
