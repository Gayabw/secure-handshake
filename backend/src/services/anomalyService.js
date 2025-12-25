// backend/src/services/anomalyService.js
import { supabase } from "../lib/supabase.js";
import { TABLES } from "../lib/tables.js";
import { writeLog } from "./logService.js";

/**
 * Phase G: Rule-based anomaly detection foundation (placeholder for GA/ML later)
 * - Reads latest behavior_profile for a node
 * - Computes rule-based anomaly_score
 * - If score >= threshold:
 *    1) insert into anomalies (unless deduped)
 *    2) write event_logs: ANOMALY_DETECTED (link anomaly_id)
 *
 * FAIL-SAFE: never throws to callers (returns safe result).
 */

const DEFAULT_THRESHOLD = Number(process.env.ANOMALY_THRESHOLD ?? 70);
const DEDUPE_MINUTES = Number(process.env.ANOMALY_DEDUPE_MINUTES ?? 15);

function toIso(d = new Date()) {
  return new Date(d).toISOString();
}

/**
 * Rule scoring from behavior_profiles (simple + explainable)
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

  // Rule 1: Replay attempts
  if (replay >= 1) {
    score += 40;
    reasons.push({ rule: "REPLAY_ATTEMPTS", weight: 40, value: replay });
  }
  if (replay >= 3) {
    score += 20;
    reasons.push({ rule: "REPLAY_BURST", weight: 20, value: replay });
  }

  // Rule 2: Failure rate
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

  // Rule 3: Policy blocks
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

  // Rule 4: Trust score
  if (trust !== null && !Number.isNaN(trust)) {
    if (trust <= 15) {
      score += 40;
      reasons.push({ rule: "TRUST_VERY_LOW", weight: 40, value: trust });
    } else if (trust <= 30) {
      score += 25;
      reasons.push({ rule: "TRUST_LOW", weight: 25, value: trust });
    }
  }

  // Rule 5: Burst volume
  if (total >= 20) {
    score += 15;
    reasons.push({ rule: "HANDSHAKE_BURST", weight: 15, value: total });
  }

  // DB-safe clamp for numeric(5,3)
  if (score < 0) score = 0;
  if (score > 99.999) score = 99.999;
  score = Number(score.toFixed(3));

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

/**
 * Evaluate a node (subject_user_id + subject_user_key_id).
 * - Never throws
 * - Returns { evaluated, anomaly_detected, ... }
 */
export async function evaluateAnomalyForSubject({
  subject_user_id,
  subject_user_key_id,
  handshake_id = null,
  threshold = DEFAULT_THRESHOLD,
} = {}) {
  try {
    if (!subject_user_id || !subject_user_key_id) {
      return {
        evaluated: false,
        anomaly_detected: false,
        error: "missing_subject_ids",
      };
    }

    // 1) Load latest behavior profile
    const { data: profiles, error: pErr } = await supabase
      .from(TABLES.BEHAVIOR_PROFILES)
      .select("*")
      .eq("subject_user_id", subject_user_id)
      .eq("subject_user_key_id", subject_user_key_id)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (pErr) {
      return {
        evaluated: false,
        anomaly_detected: false,
        error: "profile_read_failed",
        details: pErr,
      };
    }

    const profile = profiles?.[0];
    if (!profile) {
      return { evaluated: false, anomaly_detected: false, error: "no_profile" };
    }

    // 2) Compute score
    const computed = computeRuleScore(profile);

    // (Safe enrichment) Store anomaly_score on behavior profile (best-effort)
    try {
      await supabase
        .from(TABLES.BEHAVIOR_PROFILES)
        .update({ anomaly_score: computed.anomaly_score, updated_at: toIso() })
        .eq("behavior_profile_id", profile.behavior_profile_id);
    } catch (_) {}

    // 3) Below threshold => stop
    if (computed.anomaly_score < threshold) {
      return {
        evaluated: true,
        anomaly_detected: false,
        threshold,
        anomaly_score: computed.anomaly_score,
        severity: computed.severity,
        behavior_profile_id: profile.behavior_profile_id,
        reasons: computed.reasons,
      };
    }

    // 4) DEDUPE CHECK (must be BEFORE insert)
    const { data: existing, error: eErr } = await supabase
      .from(TABLES.ANOMALIES)
      .select("anomaly_id, detected_at")
      .eq("subject_user_id", subject_user_id)
      .eq("subject_user_key_id", subject_user_key_id)
      .eq("anomaly_type", computed.anomaly_type)
      .eq("status", "OPEN")
      .order("detected_at", { ascending: false })
      .limit(1);

    if (!eErr && existing?.length > 0) {
      const lastDetected = existing[0].detected_at;
      const minutesAgo =
        (Date.now() - new Date(lastDetected).getTime()) / (1000 * 60);

      if (minutesAgo <= DEDUPE_MINUTES) {
        // Deduped: log evidence but DO NOT insert a new anomaly
        try {
          await writeLog({
            event_source: "anomalyService",
            event_type: "ANOMALY_DETECTED",
            log_level: "WARN",
            subject_user_id,
            subject_user_key_id,
            handshake_id,
            anomaly_id: existing[0].anomaly_id,
            details: {
              deduped: true,
              anomaly_score: computed.anomaly_score,
              severity: computed.severity,
              reasons: computed.reasons,
              behavior_profile_id: profile.behavior_profile_id,
              threshold,
            },
          });
        } catch (_) {}

        return {
          evaluated: true,
          anomaly_detected: true,
          deduped: true,
          anomaly_id: existing[0].anomaly_id,
          threshold,
          anomaly_score: computed.anomaly_score,
          severity: computed.severity,
          behavior_profile_id: profile.behavior_profile_id,
          reasons: computed.reasons,
        };
      }
    }

    // 5) INSERT NEW ANOMALY (only if not deduped)
    const now = toIso();
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
          dedupe_minutes: DEDUPE_MINUTES,
          reasons: computed.reasons,
        },
        detected_at: now,
        resolved_at: null,
        resolved_by_user_id: null,
      })
      .select("anomaly_id")
      .single();

    if (aErr) {
      return {
        evaluated: true,
        anomaly_detected: false,
        error: "anomaly_insert_failed",
        details: aErr,
      };
    }

    // 6) Write event log linked to anomaly_id (best-effort)
    try {
      await writeLog({
        event_source: "anomalyService",
        event_type: "ANOMALY_DETECTED",
        log_level: "WARN",
        subject_user_id,
        subject_user_key_id,
        handshake_id,
        anomaly_id: inserted.anomaly_id,
        details: {
          deduped: false,
          anomaly_score: computed.anomaly_score,
          severity: computed.severity,
          reasons: computed.reasons,
          behavior_profile_id: profile.behavior_profile_id,
          threshold,
        },
      });
    } catch (_) {}

    return {
      evaluated: true,
      anomaly_detected: true,
      deduped: false,
      anomaly_id: inserted.anomaly_id,
      threshold,
      anomaly_score: computed.anomaly_score,
      severity: computed.severity,
      behavior_profile_id: profile.behavior_profile_id,
      reasons: computed.reasons,
    };
  } catch (err) {
    return {
      evaluated: false,
      anomaly_detected: false,
      error: "unexpected_error",
      details: String(err),
    };
  }
}
