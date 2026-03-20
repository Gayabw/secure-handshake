import { supabase } from "../lib/supabase.js";
import { TABLES } from "../lib/tables.js";
import { SECURITY_POLICY } from "../config/securityPolicy.js";
import { writeLog } from "./logService.js";

function toIso(date = new Date()) {
  return new Date(date).toISOString();
}

function addMinutes(minutes) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

function isPositiveInt(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0;
}

function getSystemEnforcementUserId() {
  const value = Number(process.env.SYSTEM_ENFORCEMENT_USER_ID);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error("SYSTEM_ENFORCEMENT_USER_ID must be a valid positive integer");
  }
  return value;
}

async function resolveOrgIdFromUser(user_id) {
  try {
    if (!isPositiveInt(user_id)) return null;

    const { data, error } = await supabase
      .from(TABLES.USERS)
      .select("org_id")
      .eq("user_id", Number(user_id))
      .maybeSingle();

    if (error) return null;
    return data?.org_id ?? null;
  } catch (_) {
    return null;
  }
}

export async function getReplayAttackCountForSubject({
  subject_user_id,
  subject_user_key_id,
}) {
  const { count, error } = await supabase
    .from(TABLES.REPLAY_ATTACKS)
    .select("*", { count: "exact", head: true })
    .eq("subject_user_id", Number(subject_user_id))
    .eq("subject_user_key_id", Number(subject_user_key_id));

  if (error) {
    throw new Error(`Failed to count replay attacks: ${error.message}`);
  }

  return count ?? 0;
}

export async function getActiveBlockState({
  user_id,
  user_key_id,
}) {
  const now = toIso();

  const { data, error } = await supabase
    .from(TABLES.ACCESS_LIST)
    .select("*")
    .eq("target_user_id", Number(user_id))
    .eq("target_user_key_id", Number(user_key_id))
    .eq("is_active", true)
    .eq("list_type", "BLOCK")
    .or(`valid_until.is.null,valid_until.gt.${now}`)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`Failed to check access block state: ${error.message}`);
  }

  const row = Array.isArray(data) && data.length > 0 ? data[0] : null;

  if (!row) {
    return {
      blocked: false,
      block: null,
    };
  }

  return {
    blocked: true,
    block: row,
  };
}

export async function applyAutoBlock({
  subject_user_id,
  subject_user_key_id,
  reason,
  source,
  duration_minutes,
  handshake_id = null,
  anomaly_id = null,
  severity = "HIGH",
  details = null,
}) {
  const targetUserId = Number(subject_user_id);
  const targetUserKeyId = Number(subject_user_key_id);

  if (!isPositiveInt(targetUserId) || !isPositiveInt(targetUserKeyId)) {
    throw new Error("applyAutoBlock requires valid subject_user_id and subject_user_key_id");
  }

  const existing = await getActiveBlockState({
    user_id: targetUserId,
    user_key_id: targetUserKeyId,
  });

  if (existing.blocked) {
    return {
      blocked: true,
      already_blocked: true,
      access_list_id: existing.block.access_list_id,
      reason: existing.block.reason,
      valid_until: existing.block.valid_until,
    };
  }

  const now = toIso();
  const validUntil = addMinutes(duration_minutes);
  const createdByUserId = getSystemEnforcementUserId();
  const org_id = await resolveOrgIdFromUser(targetUserId);

  const { data: accessRow, error: accessError } = await supabase
    .from(TABLES.ACCESS_LIST)
    .insert({
      target_user_id: targetUserId,
      target_user_key_id: targetUserKeyId,
      list_type: "BLOCK",
      reason,
      created_by_user_id: createdByUserId,
      valid_from: now,
      valid_until: validUntil,
      is_active: true,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();

  if (accessError) {
    throw new Error(`Failed to insert access_list block: ${accessError.message}`);
  }

  const { error: wbError } = await supabase
    .from(TABLES.NODE_WHITELIST_BLACKLIST)
    .insert({
      subject_user_id: targetUserId,
      subject_user_key_id: targetUserKeyId,
      status: "BLACKLISTED",
      reason,
      source,
      created_by_user_id: createdByUserId,
      created_at: now,
      expires_at: validUntil,
    });

  if (wbError) {
    throw new Error(`Failed to insert node whitelist/blacklist block: ${wbError.message}`);
  }

  const { data: securityEvent, error: secError } = await supabase
    .from(TABLES.SECURITY_EVENTS)
    .insert({
      event_type: "AUTO_BLOCK_APPLIED",
      subject_user_id: targetUserId,
      subject_user_key_id: targetUserKeyId,
      related_handshake_id: handshake_id,
      related_anomaly_id: anomaly_id,
      severity,
      short_description: reason,
      details: {
        source,
        valid_until: validUntil,
        enforcement_type: "AUTOMATED_BLOCK",
        ...(details || {}),
      },
      event_category: "ENFORCEMENT",
      created_at: now,
      org_id: org_id ?? null,
    })
    .select("security_event_id")
    .single();

  if (secError) {
    throw new Error(`Failed to insert security event: ${secError.message}`);
  }

  try {
    await writeLog({
      event_source: "autoBlockService",
      event_type: "AUTO_BLOCK_APPLIED",
      log_level: "WARN",
      subject_user_id: targetUserId,
      subject_user_key_id: targetUserKeyId,
      handshake_id,
      anomaly_id,
      org_id: org_id ?? null,
      details: {
        source,
        reason,
        valid_until: validUntil,
        security_event_id: securityEvent?.security_event_id ?? null,
        access_list_id: accessRow?.access_list_id ?? null,
        ...(details || {}),
      },
    });
  } catch (_) {}

  return {
    blocked: true,
    already_blocked: false,
    valid_until: validUntil,
    access_list_id: accessRow?.access_list_id ?? null,
    security_event_id: securityEvent?.security_event_id ?? null,
  };
}

export async function enforceReplayAutoBlock({
  subject_user_id,
  subject_user_key_id,
  handshake_id = null,
  replay_count = null,
}) {
  const threshold = SECURITY_POLICY.replay.auto_block_threshold;

  const count =
    replay_count ??
    (await getReplayAttackCountForSubject({
      subject_user_id,
      subject_user_key_id,
    }));

  if (count < threshold) {
    return {
      triggered: false,
      count,
      threshold,
    };
  }

  const result = await applyAutoBlock({
    subject_user_id,
    subject_user_key_id,
    reason: `Replay threshold exceeded (${count}/${threshold})`,
    source: "REPLAY_THRESHOLD",
    duration_minutes: SECURITY_POLICY.replay.block_duration_minutes,
    handshake_id,
    severity: "HIGH",
    details: {
      replay_count: count,
      replay_threshold: threshold,
    },
  });

  return {
    triggered: true,
    count,
    threshold,
    ...result,
  };
}

export async function enforceAnomalyAutoBlock({
  subject_user_id,
  subject_user_key_id,
  anomaly_id = null,
  handshake_id = null,
  anomaly_score,
  severity,
}) {
  const threshold = SECURITY_POLICY.anomaly.auto_block_threshold;
  const numericScore = Number(anomaly_score);

  if (!Number.isFinite(numericScore) || numericScore < threshold) {
    return {
      triggered: false,
      anomaly_score: numericScore,
      threshold,
    };
  }

  const result = await applyAutoBlock({
    subject_user_id,
    subject_user_key_id,
    reason: `Anomaly threshold exceeded (${numericScore}/${threshold})`,
    source: "ANOMALY_THRESHOLD",
    duration_minutes: SECURITY_POLICY.anomaly.block_duration_minutes,
    handshake_id,
    anomaly_id,
    severity: String(severity || "HIGH").toUpperCase(),
    details: {
      anomaly_score: numericScore,
      anomaly_threshold: threshold,
    },
  });

  return {
    triggered: true,
    anomaly_score: numericScore,
    threshold,
    ...result,
  };
}