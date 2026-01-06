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

/* ---------- helpers ---------- */

function isPositiveInt(v) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0;
}

async function getOrgIdForNodeUser(user_id) {
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
  const org_id = await getOrgIdForNodeUser(subject_user_id);

  const payload = {
    subject_user_id,
    subject_user_key_id,
    handshake_id: handshake_id ?? null,
    replay_nonce,
    original_timestamp: original_timestamp ?? null,
    detected_timestamp: detected_timestamp ?? now,
    detection_reason: reason,
    severity: severity ?? "MEDIUM",
    created_at: now,
    org_id,
  };

  const { error } = await supabase.from(TABLES.REPLAY_ATTACKS).insert(payload);
  if (error) throw new Error(`Replay attack log failed: ${error.message}`);
}

/* ---------- initiate ---------- */

export async function initiateHandshake({
  initiator_user_id,
  initiator_user_key_id,
  responder_user_id,
  responder_user_key_id,
  blockchain_network,
  nonce_initiator = null,
}) {
  const now = new Date().toISOString();

  const ids = [
    initiator_user_id,
    initiator_user_key_id,
    responder_user_id,
    responder_user_key_id,
  ];

  if (ids.some((v) => typeof v !== "number" || Number.isNaN(v))) {
    throw new Error("IDs must be numeric (bigint).");
  }

  if (!blockchain_network) throw new Error("blockchain_network is required.");

  const org_id = await getOrgIdForNodeUser(initiator_user_id);

  // POLICY (initiator)
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
      org_id,
      details: {
        stage: "INITIATE",
        reason: initiatorPolicy.reason,
        source: initiatorPolicy.source,
      },
    });

    await behaviorOnPolicyBlocked({
      subject_user_id: initiator_user_id,
      subject_user_key_id: initiator_user_key_id,
      handshake_id: null,
    });

    throw new Error(`Policy blocked initiator: ${initiatorPolicy.reason}`);
  }

  // POLICY (responder)
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
      org_id: await getOrgIdForNodeUser(responder_user_id),
      details: {
        stage: "INITIATE",
        reason: responderPolicy.reason,
        source: responderPolicy.source,
      },
    });

    await behaviorOnPolicyBlocked({
      subject_user_id: responder_user_id,
      subject_user_key_id: responder_user_key_id,
      handshake_id: null,
    });

    throw new Error(`Policy blocked responder: ${responderPolicy.reason}`);
  }

  // NONCE (initiator)
  const nonce = nonce_initiator || crypto.randomBytes(16).toString("hex");

  const ttl = Number(process.env.REPLAY_TTL_SECONDS || 300);
  const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

  // Pass org_id explicitly (trigger is still a safety net)
  const resolvedOrgId = org_id;

  const nonceResult = await reserveNonce({
    nonce,
    first_seen_at: now,
    expires_at: expiresAt,
    handshake_id: null,
    subject_user_id: initiator_user_id,
    subject_user_key_id: initiator_user_key_id,
    org_id: resolvedOrgId, // ✅ explicit write for nonce_cache
  });

  // Replay attempt (initiate)
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
      org_id,
      details: { nonce, stage: "INITIATE" },
    });

    await behaviorOnReplayDetected({
      subject_user_id: initiator_user_id,
      subject_user_key_id: initiator_user_key_id,
      handshake_id: null,
    });

    return { ok: false, code: "REPLAY_NONCE_REUSED" };
  }

  if (!nonceResult.ok) throw new Error("Nonce reserve failed.");

  // HANDSHAKE INSERT
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
    org_id,
  };

  const { data: handshake, error } = await supabase
    .from(TABLES.HANDSHAKES)
    .insert(handshakePayload)
    .select("*")
    .single();

  if (error) throw new Error(`Handshake insert failed: ${error.message}`);

  // Link nonce evidence to handshake
  if (nonceResult?.nonce_row?.nonce_id) {
    await linkNonceToHandshake({
      nonce_id: nonceResult.nonce_row.nonce_id,
      handshake_id: handshake.handshake_id,
    });
  }

  await writeLog({
    event_source: "handshakeService",
    event_type: "HANDSHAKE_INITIATED",
    log_level: "INFO",
    subject_user_id: initiator_user_id,
    subject_user_key_id: initiator_user_key_id,
    handshake_id: handshake.handshake_id,
    org_id,
    details: {
      blockchain_network,
      responder_user_id,
      responder_user_key_id,
      nonce,
      nonce_expires_at: expiresAt,
    },
  });

  await behaviorOnHandshakeInitiated({
    subject_user_id: initiator_user_id,
    subject_user_key_id: initiator_user_key_id,
    handshake_id: handshake.handshake_id,
  });

  return { ok: true, handshake };
}

/* ---------- respond ---------- */

export async function respondHandshake({
  handshake_id,
  responder_user_id,
  responder_user_key_id,
  responder_nonce,
}) {
  const now = new Date().toISOString();

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

  // Load handshake
  const { data: hs, error: hsErr } = await supabase
    .from(TABLES.HANDSHAKES)
    .select("*")
    .eq("handshake_id", handshake_id)
    .single();

  if (hsErr || !hs) throw new Error("Handshake not found");

  const org_id = hs.org_id ?? (await getOrgIdForNodeUser(responder_user_id));

  // State guard
  if (hs.handshake_status !== "INITIATED") {
    throw new Error(
      `Handshake not in INITIATED state. Current: ${hs.handshake_status}`
    );
  }

  // Responder must match handshake record
  if (
    Number(hs.responder_user_id) !== Number(responder_user_id) ||
    Number(hs.responder_user_key_id) !== Number(responder_user_key_id)
  ) {
    throw new Error("Responder user/key does not match handshake record");
  }

  // POLICY (responder)
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
      org_id,
      details: {
        stage: "RESPOND",
        reason: responderPolicy.reason,
        source: responderPolicy.source,
      },
    });

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

    await behaviorOnHandshakeCompleted({
      subject_user_id: responder_user_id,
      subject_user_key_id: responder_user_key_id,
      ok: false,
      handshake_id,
    });

    throw new Error(`Policy blocked responder: ${responderPolicy.reason}`);
  }

  // Reserve responder nonce (replay protection)
  const ttl = Number(process.env.REPLAY_TTL_SECONDS || 300);
  const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

  // Pass org_id explicitly (trigger is still a safety net)
  const resolvedOrgId = org_id;

  const nonceResult = await reserveNonce({
    nonce: responder_nonce,
    first_seen_at: now,
    expires_at: expiresAt,
    handshake_id,
    subject_user_id: responder_user_id,
    subject_user_key_id: responder_user_key_id,
    org_id: resolvedOrgId, // ✅ explicit write for nonce_cache
  });

  // Replay detected (respond)
  if (!nonceResult.ok && nonceResult.code === "NONCE_ALREADY_USED") {
    // Evidence row in replay_attacks (with handshake_id)
    try {
      await logReplayAttack({
        replay_nonce: responder_nonce,
        original_timestamp: hs.timestamp_initiator ?? null,
        detected_timestamp: now,
        reason: "Responder nonce already exists in nonce_cache (replay attempt)",
        severity: "HIGH",
        handshake_id,
        subject_user_id: responder_user_id,
        subject_user_key_id: responder_user_key_id,
      });
    } catch (_) {}

    await writeLog({
      event_source: "handshakeService",
      event_type: "REPLAY_DETECTED",
      log_level: "WARN",
      subject_user_id: responder_user_id,
      subject_user_key_id: responder_user_key_id,
      handshake_id,
      org_id,
      details: { stage: "RESPOND", responder_nonce },
    });

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

    await behaviorOnHandshakeCompleted({
      subject_user_id: responder_user_id,
      subject_user_key_id: responder_user_key_id,
      ok: false,
      handshake_id,
    });

    throw new Error("Replay detected: responder nonce already used.");
  }

  if (!nonceResult.ok) throw new Error("Nonce reserve failed for responder nonce.");

  // Link nonce evidence to handshake
  if (nonceResult?.nonce_row?.nonce_id) {
    await linkNonceToHandshake({
      nonce_id: nonceResult.nonce_row.nonce_id,
      handshake_id,
    });
  }

  // Update handshake -> COMPLETED
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

  if (upErr || !updated) throw new Error("Handshake update failed");

  await writeLog({
    event_source: "handshakeService",
    event_type: "HANDSHAKE_COMPLETED",
    log_level: "INFO",
    subject_user_id: responder_user_id,
    subject_user_key_id: responder_user_key_id,
    handshake_id,
    org_id,
    details: {
      responder_nonce,
      responder_nonce_expires_at: expiresAt,
    },
  });

  // Behaviour updates (both sides)
  await behaviorOnHandshakeCompleted({
    subject_user_id: responder_user_id,
    subject_user_key_id: responder_user_key_id,
    ok: true,
    handshake_id,
  });

  await behaviorOnHandshakeCompleted({
    subject_user_id: hs.initiator_user_id,
    subject_user_key_id: hs.initiator_user_key_id,
    ok: true,
    handshake_id,
  });

  return { ok: true, handshake: updated };
}
