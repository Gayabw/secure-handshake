// backend/src/services/behaviourService.js
import { supabase } from "../lib/supabase.js";
import { TABLES } from "../lib/tables.js";
import { evaluateAnomalyForSubject } from "./anomalyService.js";

/**
 * Phase G (Step 05):
 * After behavior profile upsert, evaluate anomaly (rule-based foundation).
 * Must be FAIL-SAFE: NEVER throw and NEVER break main flows.
 */

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function computeTrustScore({
  successful_handshakes,
  failed_handshakes,
  replay_attempts,
  policy_block_count,
}) {
  const trust =
    50 +
    successful_handshakes * 2 -
    failed_handshakes * 3 -
    replay_attempts * 10 -
    policy_block_count * 5;

  return clamp(Math.round(trust), 0, 100);
}

/**
 * Update / upsert behavior profile for a node (subject_user_id + subject_user_key_id)
 * - Minimal + stable
 * - Supports optional handshake_id for anomaly evidence linking (non-breaking)
 */
export async function updateBehaviorProfile({
  subject_user_id,
  subject_user_key_id,
  deltas = {},
  handshake_id = null, // OPTIONAL (Phase G integration) - does not break existing callers
}) {
  // Required identity
  if (subject_user_id == null || subject_user_key_id == null) return;

  const nowIso = new Date().toISOString();

  // 1) Read existing profile (if any)
  const { data: existing, error: readErr } = await supabase
    .from(TABLES.BEHAVIOR_PROFILES)
    .select(
      `
        behavior_profile_id,
        time_window_start,
        total_handshakes,
        successful_handshakes,
        failed_handshakes,
        replay_attempts,
        policy_block_count,
        created_at
      `
    )
    .eq("subject_user_id", subject_user_id)
    .eq("subject_user_key_id", subject_user_key_id)
    .maybeSingle();

  if (readErr) {
    console.error("Behavior profile read error:", readErr);
    return;
  }

  const current = existing || {
    total_handshakes: 0,
    successful_handshakes: 0,
    failed_handshakes: 0,
    replay_attempts: 0,
    policy_block_count: 0,
    created_at: null,
    time_window_start: null,
  };

  // 2) Compute next counters (delta-based)
  const next = {
    total_handshakes:
      (current.total_handshakes || 0) + (deltas.total_handshakes || 0),
    successful_handshakes:
      (current.successful_handshakes || 0) +
      (deltas.successful_handshakes || 0),
    failed_handshakes:
      (current.failed_handshakes || 0) + (deltas.failed_handshakes || 0),
    replay_attempts:
      (current.replay_attempts || 0) + (deltas.replay_attempts || 0),
    policy_block_count:
      (current.policy_block_count || 0) + (deltas.policy_block_count || 0),
  };

  // 3) Trust score
  const trust_score = computeTrustScore(next);

  // 4) NOT NULL columns (must always be set)
  const time_window_start =
    current.time_window_start != null ? current.time_window_start : nowIso;

  const time_window_end = nowIso;

  // 5) Upsert payload (schema-aligned)
  const payload = {
    subject_user_id,
    subject_user_key_id,

    time_window_start,
    time_window_end,

    ...next,

    last_seen_at: nowIso,
    trust_score,

    // Keep existing created_at if present (audit stability)
    created_at: current.created_at || nowIso,
    updated_at: nowIso,
    profile_status: "ACTIVE",
  };

  // 6) Upsert
  const { error: upsertErr } = await supabase
    .from(TABLES.BEHAVIOR_PROFILES)
    .upsert(payload, { onConflict: "subject_user_id,subject_user_key_id" });

  if (upsertErr) {
    console.error("Behavior profile upsert error:", upsertErr);
    return; // IMPORTANT: do not run anomaly eval if profile write failed
  }

  // ✅ Phase G Step 05: anomaly evaluation (FAIL-SAFE)
  // Must NEVER crash handshake endpoints.
  try {
    await evaluateAnomalyForSubject({
      subject_user_id,
      subject_user_key_id,
      handshake_id: handshake_id ?? null,
    });
  } catch (err) {
    // intentionally ignored
    // evidence services must never disrupt core handshake lifecycle
  }
}

// Exports must match handshakeService.js imports
export async function behaviorOnHandshakeInitiated({
  subject_user_id,
  subject_user_key_id,
  handshake_id = null, // OPTIONAL (non-breaking)
}) {
  return updateBehaviorProfile({
    subject_user_id,
    subject_user_key_id,
    handshake_id,
    deltas: { total_handshakes: 1 },
  });
}

export async function behaviorOnHandshakeCompleted({
  subject_user_id,
  subject_user_key_id,
  ok,
  handshake_id = null, // OPTIONAL (non-breaking)
}) {
  return updateBehaviorProfile({
    subject_user_id,
    subject_user_key_id,
    handshake_id,
    deltas: ok ? { successful_handshakes: 1 } : { failed_handshakes: 1 },
  });
}

export async function behaviorOnReplayDetected({
  subject_user_id,
  subject_user_key_id,
  handshake_id = null, // OPTIONAL (non-breaking)
}) {
  return updateBehaviorProfile({
    subject_user_id,
    subject_user_key_id,
    handshake_id,
    deltas: { replay_attempts: 1 },
  });
}

export async function behaviorOnPolicyBlocked({
  subject_user_id,
  subject_user_key_id,
  handshake_id = null, // OPTIONAL (non-breaking)
}) {
  return updateBehaviorProfile({
    subject_user_id,
    subject_user_key_id,
    handshake_id,
    deltas: { policy_block_count: 1 },
  });
}
