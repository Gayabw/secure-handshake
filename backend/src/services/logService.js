import { supabase } from "../lib/supabase.js";
import { TABLES } from "../lib/tables.js";

export async function writeLog({
  event_source = "backend",
  event_type,
  log_level = "INFO",
  subject_user_id = null,
  subject_user_key_id = null,
  handshake_id = null,
  ip_address = null,
  details = null,
}) {
  const now = new Date().toISOString();

  const payload = {
    event_time: now,
    event_source,
    event_type,
    log_level,
    subject_user_id,
    subject_user_key_id,
    handshake_id,
    ip_address,
    details,     // jsonb
    created_at: now,
  };

  const { data, error } = await supabase
    .from(TABLES.LOGS)
    .insert(payload)
    .select()
    .single();

  if (error) throw new Error(`Event log insert failed: ${error.message}`);
  return data;
}
