import { supabase } from "../lib/supabase.js";
import { TABLES } from "../lib/tables.js";
import { writeLog } from "./logService.js";
import { recommendMitigation } from "./mitigationService.js";

/*
  Phase G — Anomaly Detection Engine (Rule-based)
  Phase H — Mitigation Recommendation Hook (Human-in-the-loop)
*/

const DEFAULT_THRESHOLD = Number(process.env.ANOMALY_THRESHOLD ?? 70);
const DEDUPE_MINUTES = Number(process.env.ANOMALY_DEDUPE_MINUTES ?? 15);

function toIso(d = new Date()) {
  return new Date(d).toISOString();
}

function clampScore(score) {
  let s = Number(score);
  if (!Number.isFinite(s)) s = 0;
  if (s < 0) s = 0;
  if (s > 99.999) s = 99.999;
  return Number(s.toFixed(3));
}

/*
  Resolve org_id for a subject node.
  - Used for anomalies + mitigations so dashboards can filter by company.
  - Fail-safe: returns null if org can't be derived.
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
  Explainable anomaly score from behavior profile
*/
export function computeRuleScore(profile) {
  const reasons = [];
  let score = 0;

  const total = Number(profile?.total_handshakes ?? 0);
  const failed = Number(profile?.failed_handshakes ?? 0);
  const replay = Number(profile?.replay_attempts ?? 0);
  const policyBlocks = Number(profile?.policy_block_count ?? 0);
  const trust =
    profile?.trust_score === null || profile?.trust_score === undefined
      ? null
      : Number(profile.trust_score);

  // Rule 1 — Replay attempts
  if (replay >= 1) {
    score += 40;
    reasons.push({ rule: "REPLAY_ATTEMPTS", weight: 40, value: replay });
  }
  if (replay >= 3) {
    score += 20;
    reasons.push({ rule: "REPLAY_BURST", weight: 20, value: replay });
  }

  // Rule 2 — Failure rate
  if (total > 0) {
    const failRate = failed / total;
    if (failRate >= 0.5) {
      score += 40;
      reasons.push({
        rule: "FAIL_RATE_HIGH",
        weight: 40,
        value: Number(failRate.toFixed(3)),
      });
    } else if (failRate >= 0.3) {
      score += 25;
      reasons.push({
        rule: "FAIL_RATE_MEDIUM",
        weight: 25,
        value: Number(failRate.toFixed(3)),
      });
    }
  }

  // Rule 3 — Policy blocks
  if (policyBlocks >= 1) {
    score += 20;
    reasons.push({ rule: "POLICY_BLOCKED", weight: 20, value: policyBlocks });
  }
  if (policyBlocks >= 3) {
    score += 15;
    reasons.push({
      rule: "POLICY_BLOCK_BURST",
      weight: 15,
      value: policyBlocks,
    });
  }

  // Rule 4 — Trust score
  if (trust !== null && !Number.isNaN(trust)) {
    if (trust <= 15) {
      score += 40;
      reasons.push({ rule: "TRUST_VERY_LOW", weight: 40, value: trust });
    } else if (trust <= 30) {
      score += 25;
      reasons.push({ rule: "TRUST_LOW", weight: 25, value: trust });
    }
  }

  // Rule 5 — Handshake burst
  if (total >= 20) {
    score += 15;
    reasons.push({ rule: "HANDSHAKE_BURST", weight: 15, value: total });
  }

  score = clampScore(score);

  let severity = "LOW";
  if (score >= 90) severity = "HIGH";
  else if (score >= 70) severity = "MEDIUM";

  return {
    anomaly_score: score,
    severity,
    anomaly_type: "RULE_BEHAVIOR",
    reasons,
  };
}

/*
  Evaluate anomaly for a node
  - Never throws
  - Never blocks handshake
*/
export async function evaluateAnomalyForSubject({
  subject_user_id,
  subject_user_key_id,
  handshake_id = null,
  threshold = DEFAULT_THRESHOLD,
} = {}) {
  try {
    if (!subject_user_id || !subject_user_key_id) {
      return { evaluated: false, anomaly_detected: false, error: "missing_ids" };
    }

    const org_id = await resolveOrgIdForSubject(subject_user_id);

    // 1) Load latest behavior profile
    const { data: profiles, error: pErr } = await supabase
      .from(TABLES.BEHAVIOR_PROFILES)
      .select("*")
      .eq("subject_user_id", subject_user_id)
      .eq("subject_user_key_id", subject_user_key_id)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (pErr || !profiles?.length) {
      return { evaluated: false, anomaly_detected: false, error: "no_profile" };
    }

    const profile = profiles[0];

    // 2) Compute score
    const computed = computeRuleScore(profile);

    // Store latest anomaly_score in profile (best-effort)
    try {
      await supabase
        .from(TABLES.BEHAVIOR_PROFILES)
        .update({
          anomaly_score: computed.anomaly_score,
          updated_at: toIso(),
        })
        .eq("behavior_profile_id", profile.behavior_profile_id);
    } catch (_) {}

    // If below threshold -> no anomaly
    if (computed.anomaly_score < threshold) {
      return {
        evaluated: true,
        anomaly_detected: false,
        anomaly_score: computed.anomaly_score,
        severity: computed.severity,
      };
    }

    // 3) Check existing OPEN anomaly (dedupe)
    const { data: existing } = await supabase
      .from(TABLES.ANOMALIES)
      .select("anomaly_id, detected_at, severity, anomaly_score")
      .eq("subject_user_id", subject_user_id)
      .eq("subject_user_key_id", subject_user_key_id)
      .eq("anomaly_type", computed.anomaly_type)
      .eq("status", "OPEN")
      .order("detected_at", { ascending: false })
      .limit(1);

    // If exists -> update instead of insert
    if (existing?.length) {
      const existingRow = existing[0];
      const minsAgo =
        (Date.now() - new Date(existingRow.detected_at).getTime()) / 60000;

      const { error: updErr } = await supabase
        .from(TABLES.ANOMALIES)
        .update({
          source_behavior_profile: profile.behavior_profile_id,
          anomaly_score: computed.anomaly_score,
          severity: computed.severity,
          details: {
            threshold,
            reasons: computed.reasons,
            updated_existing: true,
            previous: {
              anomaly_score: existingRow.anomaly_score ?? null,
              severity: existingRow.severity ?? null,
              detected_at: existingRow.detected_at ?? null,
            },
            dedupe_window_minutes: DEDUPE_MINUTES,
            mins_since_last_detection: Number.isFinite(minsAgo)
              ? Number(minsAgo.toFixed(2))
              : null,
          },
          detected_at: toIso(),
          // keep org_id consistent (safe even if null)
          org_id: org_id ?? null,
        })
        .eq("anomaly_id", existingRow.anomaly_id);

      if (!updErr) {
        // Mitigation recommendation (fail-safe)
        try {
          await recommendMitigation({
            anomaly_id: existingRow.anomaly_id,
            subject_user_id,
            subject_user_key_id,
            severity: computed.severity,
          });
        } catch (_) {}

        // Evidence log (dedup/update)
        try {
          await writeLog({
            event_source: "anomalyService",
            event_type: "ANOMALY_DETECTED",
            log_level: "WARN",
            subject_user_id,
            subject_user_key_id,
            handshake_id,
            anomaly_id: existingRow.anomaly_id,
            details: {
              updated_existing: true,
              deduped: minsAgo <= DEDUPE_MINUTES,
              anomaly_score: computed.anomaly_score,
              severity: computed.severity,
              reasons: computed.reasons,
              threshold,
            },
          });
        } catch (_) {}

        return {
          evaluated: true,
          anomaly_detected: true,
          updated_existing: true,
          deduped: minsAgo <= DEDUPE_MINUTES,
          anomaly_id: existingRow.anomaly_id,
          anomaly_score: computed.anomaly_score,
          severity: computed.severity,
        };
      }
      // If update failed, fall through to insert
    }

    // 4) Insert new anomaly
    const { data: inserted, error: aErr } = await supabase
      .from(TABLES.ANOMALIES)
      .insert({
        subject_user_id,
        subject_user_key_id,
        anomaly_type: computed.anomaly_type,
        source_behavior_profile: profile.behavior_profile_id,
        anomaly_score: computed.anomaly_score,
        severity: computed.severity,
        status: "OPEN",
        details: {
          threshold,
          reasons: computed.reasons,
        },
        detected_at: toIso(),

        // enterprise scoping
        org_id: org_id ?? null,
      })
      .select("anomaly_id")
      .single();

    if (aErr || !inserted?.anomaly_id) {
      return { evaluated: true, anomaly_detected: false };
    }

    const anomaly_id = inserted.anomaly_id;

    // 5) Mitigation recommendation
    try {
      await recommendMitigation({
        anomaly_id,
        subject_user_id,
        subject_user_key_id,
        severity: computed.severity,
      });
    } catch (_) {}

    // 6) Event log
    try {
      await writeLog({
        event_source: "anomalyService",
        event_type: "ANOMALY_DETECTED",
        log_level: "WARN",
        subject_user_id,
        subject_user_key_id,
        handshake_id,
        anomaly_id,
        details: {
          anomaly_score: computed.anomaly_score,
          severity: computed.severity,
          reasons: computed.reasons,
          threshold,
          created_new: true,
        },
      });
    } catch (_) {}

    return {
      evaluated: true,
      anomaly_detected: true,
      anomaly_id,
      anomaly_score: computed.anomaly_score,
      severity: computed.severity,
    };
  } catch (_) {
    return {
      evaluated: false,
      anomaly_detected: false,
      error: "unexpected_error",
    };
  }
}
