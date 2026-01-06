import { supabase } from "../lib/supabase.js";
import { TABLES } from "../lib/tables.js";
import { evaluateAnomalyForSubject } from "./anomalyService.js";

/*
  Behaviour profiling (Phase E/G)
  - Upserts a rolling profile per node principal (user_id + user_key_id)
  - Persists org_id for tenant scoping (enterprise model)
  - Runs anomaly evaluation in a fail-safe way (never blocks handshake)
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
    Number(successful_handshakes || 0) * 2 -
    Number(failed_handshakes || 0) * 3 -
    Number(replay_attempts || 0) * 10 -
    Number(policy_block_count || 0) * 5;

  return clamp(Math.round(trust), 0, 100);
}

/*
  Resolve org_id for a subject node.
  - Keeps behaviour_profiles tenant-aware without requiring joins at read time.
  - Fail-safe: returns null if lookup fails.
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

/*
  Update / upsert behavior profile for a node (subject_user_id + subject_user_key_id)
  Supports optional handshake_id for anomaly evidence linking.
*/
export async function updateBehaviorProfile({
  subject_user_id,
  subject_user_key_id,
  deltas = {},
  handshake_id = null,
}) {
  if (subject_user_id == null || subject_user_key_id == null) return;

  const nowIso = new Date().toISOString();

  // Resolve org once per call (best-effort)
  const org_id = await resolveOrgIdForSubject(subject_user_id);

  // 1) Read existing profile (if any)
  const { data: existing, error: readErr } = await supabase
    .from(TABLES.BEHAVIOR_PROFILES)
    .select(
      `
        behavior_profile_id,
        org_id,
        time_window_start,
        total_handshakes,
        successful_handshakes,
        failed_handshakes,
        replay_attempts,
        policy_block_count,
        created_at,
        last_seen_at,
        trust_score
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
    org_id: null,
    total_handshakes: 0,
    successful_handshakes: 0,
    failed_handshakes: 0,
    replay_attempts: 0,
    policy_block_count: 0,
    created_at: null,
    time_window_start: null,
    last_seen_at: null,
    trust_score: 50,
  };

  // 2) Compute next counters (delta-based)
  const next = {
    total_handshakes:
      Number(current.total_handshakes || 0) + Number(deltas.total_handshakes || 0),
    successful_handshakes:
      Number(current.successful_handshakes || 0) +
      Number(deltas.successful_handshakes || 0),
    failed_handshakes:
      Number(current.failed_handshakes || 0) + Number(deltas.failed_handshakes || 0),
    replay_attempts:
      Number(current.replay_attempts || 0) + Number(deltas.replay_attempts || 0),
    policy_block_count:
      Number(current.policy_block_count || 0) + Number(deltas.policy_block_count || 0),
  };

  // 3) Trust score
  const trust_score = computeTrustScore(next);

  // 4) NOT NULL columns
  const time_window_start =
    current.time_window_start != null ? current.time_window_start : nowIso;

  const time_window_end = nowIso;

  // Prefer resolved org_id; fallback to existing stored org_id
  const effective_org_id = org_id ?? current.org_id ?? null;

  // 5) Upsert payload
  const payload = {
    subject_user_id,
    subject_user_key_id,

    // enterprise scoping
    org_id: effective_org_id,

    time_window_start,
    time_window_end,

    ...next,

    last_seen_at: nowIso,
    trust_score,

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
    return;
  }

  // 7) Phase G: anomaly evaluation (non-blocking)
  try {
    await evaluateAnomalyForSubject({
      subject_user_id,
      subject_user_key_id,
      handshake_id: handshake_id ?? null,
    });
  } catch (_) {
    // intentionally ignored
  }
}

/* Convenience wrappers (used by handshakeService.js) */

export async function behaviorOnHandshakeInitiated({
  subject_user_id,
  subject_user_key_id,
  handshake_id = null,
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
  handshake_id = null,
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
  handshake_id = null,
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
  handshake_id = null,
}) {
  return updateBehaviorProfile({
    subject_user_id,
    subject_user_key_id,
    handshake_id,
    deltas: { policy_block_count: 1 },
  });
}
