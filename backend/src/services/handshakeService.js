import crypto from "crypto";
import { supabase } from "../lib/supabase.js";
import { TABLES } from "../lib/tables.js";
import { checkNodePolicy } from "./policyService.js";
import { reserveNonce, linkNonceToHandshake } from "./replayService.js";
import { writeLog } from "./logService.js";
import {
  behaviorOnHandshakeInitiated,
  behaviorOnHandshakeCompleted,
  behaviorOnReplayDetected,
  behaviorOnPolicyBlocked,
} from "./behaviourService.js";

/**
 * Internal helper: write to replay_attacks table (evidence logging)
 */
async function logReplayAttack({
  replay_nonce,
  original_timestamp,
  detected_timestamp,
  reason,
  severity,
  handshake_id,
  subject_user_id,
  subject_user_key_id,
}) {
  const now = new Date().toISOString();

  const payload = {
    subject_user_id,
    subject_user_key_id,
    handshake_id,
    replay_nonce,
    original_timestamp,
    detected_timestamp,
    detection_reason: reason,
    severity,
    created_at: now,
  };

  const { error } = await supabase.from(TABLES.REPLAY_ATTACKS).insert(payload);
  if (error) throw new Error(`Replay attack log failed: ${error.message}`);
}

/**
 * Initiate handshake using your Supabase schema (handshakes + nonce_cache + event_logs).
 */
export async function initiateHandshake({
  initiator_user_id,
  initiator_user_key_id,
  responder_user_id,
  responder_user_key_id,
  blockchain_network,
  nonce_initiator = null,
}) {
  const now = new Date().toISOString();

  // ✅ IDs are bigint -> must be numbers
  const mustBeNumbers = [
    initiator_user_id,
    initiator_user_key_id,
    responder_user_id,
    responder_user_key_id,
  ];
  if (mustBeNumbers.some((v) => typeof v !== "number" || Number.isNaN(v))) {
    throw new Error(
      "IDs must be numbers (bigint). Example: initiator_user_id: 1 (NOT 'SID01')."
    );
  }

  if (!blockchain_network) throw new Error("blockchain_network is required.");

  // 🔐 POLICY CHECK (initiator)
  const initiatorPolicy = await checkNodePolicy({
    user_id: initiator_user_id,
    user_key_id: initiator_user_key_id,
  });

  if (!initiatorPolicy.allowed) {
    await writeLog({
      event_source: "policyService",
      event_type: "POLICY_BLOCKED",
      log_level: "WARN",
      subject_user_id: initiator_user_id,
      subject_user_key_id: initiator_user_key_id,
      details: {
        stage: "INITIATE",
        reason: initiatorPolicy.reason,
        source: initiatorPolicy.source,
      },
    });

    await behaviorOnPolicyBlocked({
      subject_user_id: initiator_user_id,
      subject_user_key_id: initiator_user_key_id,
      handshake_id: null, // no handshake row yet
    });

    throw new Error(`Policy blocked initiator: ${initiatorPolicy.reason}`);
  }

  // 🔐 POLICY CHECK (responder)
  const responderPolicy = await checkNodePolicy({
    user_id: responder_user_id,
    user_key_id: responder_user_key_id,
  });

  if (!responderPolicy.allowed) {
    await writeLog({
      event_source: "policyService",
      event_type: "POLICY_BLOCKED",
      log_level: "WARN",
      subject_user_id: responder_user_id,
      subject_user_key_id: responder_user_key_id,
      details: {
        stage: "INITIATE",
        reason: responderPolicy.reason,
        source: responderPolicy.source,
      },
    });

    await behaviorOnPolicyBlocked({
      subject_user_id: responder_user_id,
      subject_user_key_id: responder_user_key_id,
      handshake_id: null, // no handshake row yet
    });

    throw new Error(`Policy blocked responder: ${responderPolicy.reason}`);
  }

  // Nonce (initiator)
  const nonce = nonce_initiator || crypto.randomBytes(16).toString("hex");

  // TTL for nonce
  const ttl = Number(process.env.REPLAY_TTL_SECONDS || 300);
  const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

  // 1) Reserve nonce first (replay prevention)
  const nonceResult = await reserveNonce({
    nonce,
    first_seen_at: now,
    expires_at: expiresAt,
    handshake_id: null,
    subject_user_id: initiator_user_id,
    subject_user_key_id: initiator_user_key_id,
  });

  // If nonce already exists => replay attempt
  if (!nonceResult.ok && nonceResult.code === "NONCE_ALREADY_USED") {
    await logReplayAttack({
      replay_nonce: nonce,
      original_timestamp: now,
      detected_timestamp: now,
      reason: "Nonce already exists in nonce_cache (replay attempt)",
      severity: "HIGH",
      handshake_id: null,
      subject_user_id: initiator_user_id,
      subject_user_key_id: initiator_user_key_id,
    });

    await writeLog({
      event_source: "handshakeService",
      event_type: "REPLAY_DETECTED",
      log_level: "WARN",
      subject_user_id: initiator_user_id,
      subject_user_key_id: initiator_user_key_id,
      details: { nonce, stage: "INITIATE" },
    });

    await behaviorOnReplayDetected({
      subject_user_id: initiator_user_id,
      subject_user_key_id: initiator_user_key_id,
      handshake_id: null, // no handshake row yet
    });

    return { ok: false, code: "REPLAY_NONCE_REUSED" };
  }

  if (!nonceResult.ok) {
    throw new Error("Nonce reserve failed during initiate.");
  }

  // 2) Insert handshake row (match your schema columns exactly)
  const handshakePayload = {
    initiator_user_id,
    initiator_user_key_id,
    responder_user_id,
    responder_user_key_id,
    initiator_proof_id: null,
    responder_proof_id: null,
    blockchain_network,
    nonce_initiator: nonce,
    timestamp_initiator: now,
    handshake_status: "INITIATED",
    failure_reason: null,
    initiator_ip: null,
    responder_ip: null,
    created_at: now,
    completed_at: null,
  };

  const { data: handshake, error: hsErr } = await supabase
    .from(TABLES.HANDSHAKES)
    .insert(handshakePayload)
    .select("*")
    .single();

  if (hsErr) throw new Error(`Handshake insert failed: ${hsErr.message}`);

  // 3) Link nonce_cache row to handshake_id (best evidence)
  if (nonceResult?.nonce_row?.nonce_id) {
    await linkNonceToHandshake({
      nonce_id: nonceResult.nonce_row.nonce_id,
      handshake_id: handshake.handshake_id,
    });
  }

  // 4) Log success event
  await writeLog({
    event_source: "handshakeService",
    event_type: "HANDSHAKE_INITIATED",
    log_level: "INFO",
    subject_user_id: initiator_user_id,
    subject_user_key_id: initiator_user_key_id,
    handshake_id: handshake.handshake_id,
    details: {
      blockchain_network,
      responder_user_id,
      responder_user_key_id,
      nonce,
      nonce_expires_at: expiresAt,
    },
  });

  // ✅ Phase G Step 05: pass handshake_id for anomaly evidence linking
  await behaviorOnHandshakeInitiated({
    subject_user_id: initiator_user_id,
    subject_user_key_id: initiator_user_key_id,
    handshake_id: handshake.handshake_id,
  });

  return { ok: true, handshake };
}

/* Respond to an existing handshake. */
export async function respondHandshake({
  handshake_id,
  responder_user_id,
  responder_user_key_id,
  responder_nonce,
}) {
  const now = new Date().toISOString();

  // IDs must be numbers (bigint)
  if (
    typeof handshake_id !== "number" ||
    typeof responder_user_id !== "number" ||
    typeof responder_user_key_id !== "number"
  ) {
    throw new Error(
      "handshake_id, responder_user_id, responder_user_key_id must be numbers."
    );
  }

  if (!responder_nonce) throw new Error("responder_nonce is required.");

  // 1) Load handshake
  const { data: hs, error: hsErr } = await supabase
    .from(TABLES.HANDSHAKES)
    .select("*")
    .eq("handshake_id", handshake_id)
    .single();

  if (hsErr) throw new Error(`Handshake not found: ${hsErr.message}`);

  // 2) Must be INITIATED to respond
  if (hs.handshake_status !== "INITIATED") {
    throw new Error(
      `Handshake not in INITIATED state. Current: ${hs.handshake_status}`
    );
  }

  // 3) Validate responder matches record
  if (
    Number(hs.responder_user_id) !== Number(responder_user_id) ||
    Number(hs.responder_user_key_id) !== Number(responder_user_key_id)
  ) {
    throw new Error("Responder user/key does not match handshake record.");
  }

  // 🔐 POLICY CHECK (responder)
  const responderPolicy = await checkNodePolicy({
    user_id: responder_user_id,
    user_key_id: responder_user_key_id,
  });

  if (!responderPolicy.allowed) {
    await writeLog({
      event_source: "policyService",
      event_type: "POLICY_BLOCKED",
      log_level: "WARN",
      subject_user_id: responder_user_id,
      subject_user_key_id: responder_user_key_id,
      handshake_id,
      details: {
        stage: "RESPOND",
        reason: responderPolicy.reason,
        source: responderPolicy.source,
      },
    });

    // Mark handshake failed (evidence)
    await supabase
      .from(TABLES.HANDSHAKES)
      .update({
        handshake_status: "FAILED",
        failure_reason: "POLICY_BLOCKED",
        completed_at: now,
      })
      .eq("handshake_id", handshake_id);

    await behaviorOnPolicyBlocked({
      subject_user_id: responder_user_id,
      subject_user_key_id: responder_user_key_id,
      handshake_id,
    });

    // handshake failed because of policy
    await behaviorOnHandshakeCompleted({
      subject_user_id: responder_user_id,
      subject_user_key_id: responder_user_key_id,
      ok: false,
      handshake_id,
    });

    throw new Error(`Policy blocked responder: ${responderPolicy.reason}`);
  }

  // TTL for responder nonce
  const ttl = Number(process.env.REPLAY_TTL_SECONDS || 300);
  const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

  // 4) Reserve responder nonce (replay protection)
  const nonceResult = await reserveNonce({
    nonce: responder_nonce,
    first_seen_at: now,
    expires_at: expiresAt,
    handshake_id,
    subject_user_id: responder_user_id,
    subject_user_key_id: responder_user_key_id,
  });

  // If responder nonce reused => replay
  if (!nonceResult.ok && nonceResult.code === "NONCE_ALREADY_USED") {
    await writeLog({
      event_source: "handshakeService",
      event_type: "REPLAY_DETECTED",
      log_level: "WARN",
      subject_user_id: responder_user_id,
      subject_user_key_id: responder_user_key_id,
      handshake_id,
      details: { stage: "RESPOND", responder_nonce },
    });

    // Mark handshake as FAILED (evidence)
    await supabase
      .from(TABLES.HANDSHAKES)
      .update({
        handshake_status: "FAILED",
        failure_reason: "REPLAY_DETECTED_ON_RESPOND",
        completed_at: now,
      })
      .eq("handshake_id", handshake_id);

    await behaviorOnReplayDetected({
      subject_user_id: responder_user_id,
      subject_user_key_id: responder_user_key_id,
      handshake_id,
    });

    // handshake failed because of replay
    await behaviorOnHandshakeCompleted({
      subject_user_id: responder_user_id,
      subject_user_key_id: responder_user_key_id,
      ok: false,
      handshake_id,
    });

    throw new Error("Replay detected: responder nonce already used.");
  }

  if (!nonceResult.ok) {
    throw new Error("Nonce reserve failed for responder nonce.");
  }

  // 5) Link nonce_cache row to handshake_id (best evidence)
  if (nonceResult?.nonce_row?.nonce_id) {
    await linkNonceToHandshake({
      nonce_id: nonceResult.nonce_row.nonce_id,
      handshake_id,
    });
  }

  // 6) Update handshake -> COMPLETED
  const { data: updated, error: upErr } = await supabase
    .from(TABLES.HANDSHAKES)
    .update({
      handshake_status: "COMPLETED",
      completed_at: now,
      failure_reason: null,
    })
    .eq("handshake_id", handshake_id)
    .select("*")
    .single();

  if (upErr) throw new Error(`Handshake update failed: ${upErr.message}`);

  // 7) Log completion
  await writeLog({
    event_source: "handshakeService",
    event_type: "HANDSHAKE_COMPLETED",
    log_level: "INFO",
    subject_user_id: responder_user_id,
    subject_user_key_id: responder_user_key_id,
    handshake_id,
    details: {
      responder_nonce,
      responder_nonce_expires_at: expiresAt,
    },
  });

  // Responder completed successfully
  await behaviorOnHandshakeCompleted({
    subject_user_id: responder_user_id,
    subject_user_key_id: responder_user_key_id,
    ok: true,
    handshake_id,
  });

  // Initiator also counts as successful handshake partner
  await behaviorOnHandshakeCompleted({
    subject_user_id: hs.initiator_user_id,
    subject_user_key_id: hs.initiator_user_key_id,
    ok: true,
    handshake_id,
  });

  return { ok: true, handshake: updated };
}
