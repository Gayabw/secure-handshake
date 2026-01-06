import { supabase } from "../lib/supabase.js";
import { TABLES } from "../lib/tables.js";
import { writeLog } from "./logService.js";

/*
  Behaviour Correlation & Scoring (Phase E)
  Step 3:
   - Includes replay_attacks + anomalies evidence in scoring
   - Keeps dedup guard + rolling 30-day window hygiene
   - Still additive + fail-safe (caller must catch)
*/

const TRUST_MIN = 0;
const TRUST_MAX = 100;

const SCORE_WEIGHTS = {
  allow: +1,
  flag: -3,
  deny: -10,
  plugin_error: -2,
  handshake_success: +2,
  handshake_failed: -2,
};

const WINDOW_DAYS = 30;
const STALE_RECOVERY_DAYS = 7;
const STALE_RECOVERY_BONUS = 1;

// Replay severity penalties (per evidence row)
const REPLAY_PENALTY = {
  LOW: -4,
  MEDIUM: -8,
  HIGH: -15,
  CRITICAL: -20,
};

// Anomaly severity penalties (per evidence row, base)
const ANOMALY_SEVERITY_PENALTY = {
  LOW: -1,
  MEDIUM: -3,
  HIGH: -6,
  CRITICAL: -10,
};

/**
 * Anomaly score influence.
 * Supports both scales:
 *  - 0.0..1.0   (typical ML probability)
 *  - 0..100     (your DB shows values like 99.999)
 */
function anomalyScorePenalty(score) {
  const raw = Number(score);
  if (!Number.isFinite(raw)) return 0;

  // Normalize:
  // if it's > 1, treat it as 0..100 and normalize to 0..1
  const normalized = raw > 1 ? raw / 100 : raw;

  const s = Math.max(0, Math.min(1, normalized));

  // Conservative scaling: 0.0 -> 0, 0.5 -> -2, 1.0 -> -4
  return Math.round(-4 * s);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function nowISO() {
  return new Date().toISOString();
}

function daysAgoISO(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function windowStartISO() {
  return daysAgoISO(WINDOW_DAYS);
}

function normalizeSeverity(v) {
  const s = String(v || "").toUpperCase().trim();
  if (s === "LOW" || s === "MEDIUM" || s === "HIGH" || s === "CRITICAL") return s;
  return "MEDIUM";
}

/*
  Load handshake (read-only).
*/
async function fetchHandshake(handshake_id) {
  const { data, error } = await supabase
    .from(TABLES.HANDSHAKES)
    .select(
      `
      handshake_id,
      handshake_status,
      failure_reason,
      initiator_user_id,
      initiator_user_key_id,
      responder_user_id,
      responder_user_key_id,
      initiator_ip,
      responder_ip,
      created_at,
      completed_at
    `
    )
    .eq("handshake_id", handshake_id)
    .single();

  if (error) throw error;
  return data;
}

/*
  Dedup correlation: skip if already exists.
*/
async function alreadyCorrelated(handshake_id) {
  const { data, error } = await supabase
    .from(TABLES.EVENT_LOGS)
    .select("event_log_id")
    .eq("handshake_id", handshake_id)
    .eq("event_type", "BEHAVIOR_CORRELATED")
    .limit(1);

  if (error) throw error;
  return Array.isArray(data) && data.length > 0;
}

/*
  Plugin events logged in event_logs by Phase D.
*/
async function fetchPluginEvents(handshake_id) {
  const { data, error } = await supabase
    .from(TABLES.EVENT_LOGS)
    .select("event_type, details, created_at")
    .eq("handshake_id", handshake_id)
    .in("event_type", ["PLUGIN_EXECUTED", "PLUGIN_ERROR"])
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data || [];
}

/*
  ✅ Replay evidence:
  1) Try handshake_id FK match first
  2) Fallback to subject identity within ±2 minutes of handshake timestamps
  This solves your real issue: replay_attacks.handshake_id is often NULL.
*/
async function fetchReplayEvidence(handshake) {
  // 1) Strict FK match first (ideal)
  const { data: direct, error: directErr } = await supabase
    .from(TABLES.REPLAY_ATTACKS)
    .select(
      "replay_attack_id, subject_user_id, subject_user_key_id, handshake_id, replay_nonce, detected_timestamp, severity, detection_reason, created_at"
    )
    .eq("handshake_id", handshake.handshake_id)
    .order("detected_timestamp", { ascending: true });

  if (directErr) throw directErr;
  if ((direct || []).length > 0) return direct;

  // 2) Fallback: match by identity in tight time window around handshake
  const createdMs = handshake.created_at
    ? new Date(handshake.created_at).getTime()
    : Date.now();

  const completedMs = handshake.completed_at
    ? new Date(handshake.completed_at).getTime()
    : createdMs;

  const windowStart = new Date(createdMs - 2 * 60 * 1000).toISOString(); // -2 min
  const windowEnd = new Date(completedMs + 2 * 60 * 1000).toISOString(); // +2 min

  // Most replay is attributed to responder nonce reuse (your current logging logic)
  const { data: fallback, error: fbErr } = await supabase
    .from(TABLES.REPLAY_ATTACKS)
    .select(
      "replay_attack_id, subject_user_id, subject_user_key_id, handshake_id, replay_nonce, detected_timestamp, severity, detection_reason, created_at"
    )
    .eq("subject_user_id", handshake.responder_user_id)
    .eq("subject_user_key_id", handshake.responder_user_key_id)
    .gte("detected_timestamp", windowStart)
    .lte("detected_timestamp", windowEnd)
    .order("detected_timestamp", { ascending: true });

  if (fbErr) throw fbErr;

  return fallback || [];
}

/*
  Anomalies evidence linked to handshake via event_logs.anomaly_id FK.
*/
async function fetchHandshakeAnomalies(handshake_id) {
  const { data: logRows, error: logErr } = await supabase
    .from(TABLES.EVENT_LOGS)
    .select("anomaly_id, created_at")
    .eq("handshake_id", handshake_id)
    .eq("event_type", "ANOMALY_DETECTED")
    .not("anomaly_id", "is", null)
    .order("created_at", { ascending: true });

  if (logErr) throw logErr;

  const anomalyIds = Array.from(
    new Set((logRows || []).map((r) => Number(r.anomaly_id)).filter((n) => Number.isFinite(n)))
  );

  if (anomalyIds.length === 0) return [];

  const { data: anomalies, error: anErr } = await supabase
    .from(TABLES.ANOMALIES)
    .select("anomaly_id, anomaly_type, anomaly_score, severity, status, detected_at")
    .in("anomaly_id", anomalyIds)
    .eq("status", "OPEN")
    .order("detected_at", { ascending: true });

  if (anErr) throw anErr;
  return anomalies || [];
}

/*
  Behaviour profile baseline.
*/
async function getOrCreateProfile(user_id, user_key_id) {
  const { data, error } = await supabase
    .from(TABLES.BEHAVIOR_PROFILES)
    .select("*")
    .eq("subject_user_id", user_id)
    .eq("subject_user_key_id", user_key_id)
    .maybeSingle();

  if (error) throw error;
  if (data) return data;

  const now = nowISO();

  const seed = {
    subject_user_id: user_id,
    subject_user_key_id: user_key_id,
    time_window_start: windowStartISO(),
    time_window_end: now,

    total_handshakes: 0,
    successful_handshakes: 0,
    failed_handshakes: 0,
    replay_attempts: 0,

    profile_status: "ACTIVE",
    policy_block_count: 0,
    last_seen_at: now,

    trust_score: 50,
    created_at: now,
    updated_at: now,
  };

  const { data: inserted, error: insertError } = await supabase
    .from(TABLES.BEHAVIOR_PROFILES)
    .insert(seed)
    .select("*")
    .single();

  if (insertError) throw insertError;
  return inserted;
}

async function updateProfile(profile, patch) {
  const { data, error } = await supabase
    .from(TABLES.BEHAVIOR_PROFILES)
    .update(patch)
    .eq("behavior_profile_id", profile.behavior_profile_id)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

function extractPluginName(details) {
  if (!details || typeof details !== "object") return null;
  return (
    details.plugin_name ??
    details.plugin ??
    details.pluginId ??
    details.plugin_id ??
    details.name ??
    details.id ??
    null
  );
}

function summarizePlugins(events) {
  let allow = 0;
  let flag = 0;
  let deny = 0;
  let plugin_error = 0;

  const evidence = [];

  for (const e of events) {
    if (e.event_type === "PLUGIN_ERROR") {
      plugin_error++;
      evidence.push({
        type: "PLUGIN_ERROR",
        at: e.created_at,
        plugin: extractPluginName(e.details),
        stage: e.details?.stage ?? null,
        reasons: e.details?.reasons ?? e.details?.reason ?? null,
        error: e.details?.error ?? e.details ?? null,
      });
      continue;
    }

    const decision = e.details?.decision ?? null;
    if (decision === "ALLOW") allow++;
    if (decision === "FLAG") flag++;
    if (decision === "DENY") deny++;

    evidence.push({
      type: "PLUGIN_EXECUTED",
      at: e.created_at,
      plugin: extractPluginName(e.details),
      stage: e.details?.stage ?? null,
      decision,
      reasons: e.details?.reasons ?? e.details?.reason ?? null,
      score: e.details?.score ?? null,
    });
  }

  return { counts: { allow, flag, deny, plugin_error }, evidence };
}

function interpretHandshake(status) {
  const s = String(status || "").toUpperCase();

  const success = ["COMPLETED", "SUCCESS", "ACCEPTED"].includes(s);
  const failed = ["FAILED", "REJECTED", "DENIED", "ABORTED"].includes(s);

  let score = 0;
  if (success) score += SCORE_WEIGHTS.handshake_success;
  if (failed) score += SCORE_WEIGHTS.handshake_failed;

  return { success, failed, score };
}

function calculateTrustDelta(pluginCounts, handshakeScore) {
  return (
    pluginCounts.allow * SCORE_WEIGHTS.allow +
    pluginCounts.flag * SCORE_WEIGHTS.flag +
    pluginCounts.deny * SCORE_WEIGHTS.deny +
    pluginCounts.plugin_error * SCORE_WEIGHTS.plugin_error +
    handshakeScore
  );
}

function computeStaleRecovery(profileLastSeenAtISO, nowISOValue) {
  if (!profileLastSeenAtISO) return 0;

  const last = new Date(profileLastSeenAtISO).getTime();
  const now = new Date(nowISOValue).getTime();
  if (!Number.isFinite(last) || !Number.isFinite(now)) return 0;

  const diffDays = (now - last) / (1000 * 60 * 60 * 24);
  return diffDays >= STALE_RECOVERY_DAYS ? STALE_RECOVERY_BONUS : 0;
}

function scoreReplayPenalty(replayRows) {
  if (!Array.isArray(replayRows) || replayRows.length === 0) {
    return { delta: 0, evidence: [] };
  }

  let delta = 0;
  const evidence = [];

  for (const r of replayRows) {
    const sev = normalizeSeverity(r.severity);
    const p = REPLAY_PENALTY[sev] ?? REPLAY_PENALTY.MEDIUM;
    delta += p;

    evidence.push({
      replay_attack_id: r.replay_attack_id,
      severity: sev,
      penalty: p,
      detection_reason: r.detection_reason,
      replay_nonce: r.replay_nonce,
      detected_timestamp: r.detected_timestamp,
      handshake_id: r.handshake_id ?? null,
    });
  }

  return { delta, evidence };
}

function scoreAnomalyPenalty(anomalies) {
  if (!Array.isArray(anomalies) || anomalies.length === 0) {
    return { delta: 0, evidence: [] };
  }

  let delta = 0;
  const evidence = [];

  for (const a of anomalies) {
    const sev = normalizeSeverity(a.severity);
    const base = ANOMALY_SEVERITY_PENALTY[sev] ?? ANOMALY_SEVERITY_PENALTY.MEDIUM;
    const scorePart = anomalyScorePenalty(a.anomaly_score);

    const total = base + scorePart;
    delta += total;

    evidence.push({
      anomaly_id: a.anomaly_id,
      anomaly_type: a.anomaly_type,
      anomaly_score: a.anomaly_score,
      severity: sev,
      status: a.status,
      detected_at: a.detected_at,
      penalty: total,
    });
  }

  return { delta, evidence };
}

/*
  Public API
*/
export async function correlateAndScoreHandshake(handshake_id) {
  const computedAt = nowISO();

  if (await alreadyCorrelated(handshake_id)) {
    return { ok: true, skipped: true, reason: "ALREADY_CORRELATED" };
  }

  const handshake = await fetchHandshake(handshake_id);
  const pluginEvents = await fetchPluginEvents(handshake_id);

  // ✅ FIXED: replay evidence uses FK-first then fallback
  const replayRows = await fetchReplayEvidence(handshake);

  const anomalies = await fetchHandshakeAnomalies(handshake_id);

  const { counts, evidence: pluginEvidence } = summarizePlugins(pluginEvents);
  const outcome = interpretHandshake(handshake.handshake_status);

  const baseTrustDelta = calculateTrustDelta(counts, outcome.score);

  const replayScore = scoreReplayPenalty(replayRows);
  const anomalyScore = scoreAnomalyPenalty(anomalies);

  const wouldBlock = counts.deny > 0;
  const now = nowISO();

  const subjects = [
    {
      role: "initiator",
      user_id: handshake.initiator_user_id,
      key_id: handshake.initiator_user_key_id,
    },
    {
      role: "responder",
      user_id: handshake.responder_user_id,
      key_id: handshake.responder_user_key_id,
    },
  ];

  const updates = [];
  const scoringRules = {
    step: 3,
    window_days: WINDOW_DAYS,
    dedup_guard: true,
    stale_recovery_days: STALE_RECOVERY_DAYS,
    stale_recovery_bonus: STALE_RECOVERY_BONUS,
    replay_penalty: REPLAY_PENALTY,
    anomaly_severity_penalty: ANOMALY_SEVERITY_PENALTY,
    anomaly_score_scale: "supports 0..1 and 0..100 (auto-normalized)",
  };

  for (const s of subjects) {
    const profile = await getOrCreateProfile(s.user_id, s.key_id);

    const staleBonus = computeStaleRecovery(profile.last_seen_at, now);

    // Replay attempts counter increments if replay evidence exists for this handshake
    const replayInc = replayRows.length > 0 ? 1 : 0;

    const trustDelta =
      Number(baseTrustDelta || 0) +
      Number(replayScore.delta || 0) +
      Number(anomalyScore.delta || 0) +
      Number(staleBonus || 0);

    const nextTrust = clamp(
      Number(profile.trust_score || 50) + trustDelta,
      TRUST_MIN,
      TRUST_MAX
    );

    const patch = {
      time_window_start: windowStartISO(),
      time_window_end: now,

      total_handshakes: Number(profile.total_handshakes || 0) + 1,
      successful_handshakes:
        Number(profile.successful_handshakes || 0) + (outcome.success ? 1 : 0),
      failed_handshakes:
        Number(profile.failed_handshakes || 0) + (outcome.failed ? 1 : 0),

      replay_attempts: Number(profile.replay_attempts || 0) + replayInc,

      policy_block_count:
        Number(profile.policy_block_count || 0) + (wouldBlock ? 1 : 0),

      last_seen_at: now,
      trust_score: nextTrust,
      updated_at: now,
    };

    const updated = await updateProfile(profile, patch);

    updates.push({
      role: s.role,
      trust_before: profile.trust_score,
      trust_after: updated.trust_score,
      trust_delta: trustDelta,
      trust_delta_breakdown: {
        base: baseTrustDelta,
        replay: replayScore.delta,
        anomaly: anomalyScore.delta,
        stale_recovery_bonus: staleBonus,
      },
    });
  }

  await writeLog({
    event_source: "behaviour_correlation",
    event_type: "BEHAVIOR_CORRELATED",
    log_level: wouldBlock || outcome.failed ? "WARN" : "INFO",
    handshake_id: handshake.handshake_id,
    subject_user_id: handshake.initiator_user_id,
    subject_user_key_id: handshake.initiator_user_key_id,
    ip_address: handshake.initiator_ip,
    details: {
      phase: "E",
      step: 3,
      computed_at: computedAt,
      handshake: handshake.handshake_status,
      failure_reason: handshake.failure_reason ?? null,

      plugin_counts: counts,
      plugin_evidence: pluginEvidence,

      replay_summary: {
        count: replayRows.length,
        penalty: replayScore.delta,
        evidence: replayScore.evidence,
      },

      anomaly_summary: {
        count: anomalies.length,
        penalty: anomalyScore.delta,
        evidence: anomalyScore.evidence,
      },

      trust_delta_base: baseTrustDelta,
      applied_updates: updates,
      scoring_rules: scoringRules,
    },
  });

  return { ok: true };
}
