
import { supabase } from "../lib/supabase.js";
import { TABLES } from "../lib/tables.js";

export async function logEvent({
  org_id,
  event_type,
  event_source = "backend",
  log_level = "INFO",
  ip_address = null,
  subject_user_id = null,
  subject_user_key_id = null,
  handshake_id = null,
  auth_id = null,
  security_event_id = null,
  anomaly_id = null,
  mitigation_id = null,
  details = {},
}) {
  const payload = {
    event_time: new Date().toISOString(),
    event_source,
    event_type,
    subject_user_id,
    subject_user_key_id,
    handshake_id,
    auth_id,
    security_event_id,
    anomaly_id,
    mitigation_id,
    ip_address,
    details,
    log_level,
    org_id, // your trigger will also fill; explicit is fine
  };

  const { error } = await supabase.from(TABLES.EVENT_LOGS).insert(payload);
  if (error) throw new Error(`event_logs insert failed: ${error.message}`);
}

export async function logSecurityEvent({
  org_id,
  event_type,
  severity = "LOW",
  event_category = "OTP",
  short_description = "",
  subject_user_id = null,
  subject_user_key_id = null,
  related_auth_id = null,
  related_handshake_id = null,
  related_anomaly_id = null,
  related_mitigation_id = null,
  details = {},
}) {
  const payload = {
    org_id,
    event_type,
    subject_user_id,
    subject_user_key_id,
    related_auth_id,
    related_handshake_id,
    related_anomaly_id,
    related_mitigation_id,
    severity,
    short_description,
    details,
    event_category,
  };

  const { data, error } = await supabase
    .from(TABLES.SECURITY_EVENTS)
    .insert(payload)
    .select("security_event_id")
    .single();

  if (error) throw new Error(`security_events insert failed: ${error.message}`);

  return data?.security_event_id || null;
}

export async function insertAuthAudit({
  auth_type,
  user_id = null,
  user_key_id = null,
  handshake_id = null,
  success,
  failure_reason = null,
  client_ip = null,
  user_agent = null,
}) {
  const { data, error } = await supabase
    .from(TABLES.AUTHENTICATIONS)
    .insert({
      auth_type,
      user_id,
      user_key_id,
      handshake_id,
      success: Boolean(success),
      failure_reason,
      client_ip,
      user_agent,
    })
    .select("auth_id")
    .single();

  if (error) throw new Error(`authentications insert failed: ${error.message}`);
  return data?.auth_id || null;
}
