

import { supabase } from "../lib/supabase.js";
import { TABLES } from "../lib/tables.js";

/*
  Centralized event logging service

  Enterprise rules:
  - event_logs.org_id is always populated when possible
  - Resolution priority:
      1) explicit org_id (if caller provides)
      2) subject_user_id -> users.org_id
      3) handshake_id -> handshakes.org_id
*/

async function resolveOrgId({ org_id, subject_user_id, handshake_id }) {
  if (org_id) return org_id;

  if (subject_user_id) {
    const { data } = await supabase
      .from(TABLES.USERS)
      .select("org_id")
      .eq("user_id", subject_user_id)
      .single();

    if (data?.org_id) return data.org_id;
  }

  if (handshake_id) {
    const { data } = await supabase
      .from(TABLES.HANDSHAKES)
      .select("org_id")
      .eq("handshake_id", handshake_id)
      .single();

    if (data?.org_id) return data.org_id;
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

  const resolvedOrgId = await resolveOrgId({
    org_id,
    subject_user_id,
    handshake_id,
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
    details,
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
