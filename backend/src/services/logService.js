// backend/src/services/logService.js
import { supabase } from "../lib/supabase.js";
import { TABLES } from "../lib/tables.js";

/**
 * Centralized event logging service
 * - Schema-aligned with event_logs table
 * - Supports optional anomaly_id (Phase G)
 * - Backward compatible with all existing calls
 */
export async function writeLog({
  event_source = "backend",
  event_type,
  log_level = "INFO",
  subject_user_id = null,
  subject_user_key_id = null,
  handshake_id = null,
  anomaly_id = null,          // ✅ Phase G support
  ip_address = null,
  details = null,
}) {
  if (!event_type) {
    throw new Error("event_type is required for writeLog()");
  }

  const now = new Date().toISOString();

  const payload = {
    event_time: now,
    event_source,
    event_type,
    log_level,

    subject_user_id,
    subject_user_key_id,
    handshake_id,
    anomaly_id,               // ✅ stored if provided

    ip_address,
    details,                  // jsonb
    created_at: now,
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
