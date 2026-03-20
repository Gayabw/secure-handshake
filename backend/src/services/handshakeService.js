import crypto from "crypto";
import { supabase } from "../lib/supabase.js";
import { TABLES } from "../lib/tables.js";
import { checkNodePolicy } from "./policyService.js";
import { reserveNonce, linkNonceToHandshake } from "./replayService.js";
import { writeLog } from "./logService.js";
import { enforceReplayAutoBlock } from "./autoBlockService.js";
import {
  behaviorOnHandshakeInitiated,
  behaviorOnHandshakeCompleted,
  behaviorOnReplayDetected,
  behaviorOnPolicyBlocked,
} from "./behaviourService.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isRetryableLogError(error) {
  if (!error) return false;

  const message = String(
    error.message || error.details || error.hint || error.code || error
  ).toLowerCase();

  return (
    message.includes("fetch failed") ||
    message.includes("network") ||
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("socket") ||
    message.includes("econnreset") ||
    message.includes("econnrefused") ||
    message.includes("etimedout") ||
    message.includes("503") ||
    message.includes("502") ||
    message.includes("500")
  );
}

async function safeWriteLog(payload, context = "event_log") {
  let lastError = null;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      await writeLog(payload);
      return { ok: true };
    } catch (error) {
      lastError = error;

      if (attempt === 1 && isRetryableLogError(error)) {
        console.warn(`[${context}] log retry after temporary failure`);
        await sleep(300);
        continue;
      }

      break;
    }
  }

  console.warn(`[${context}] log skipped:`, lastError?.message || lastError);

  return {
    ok: false,
    skipped: true,
    error: lastError,
  };
}

function fireAndForget(task, context = "async_task") {
  Promise.resolve()
    .then(task)
    .catch((error) => {
      console.warn(`[${context}] skipped:`, error?.message || error);
    });
}

async function safeBehaviorOnHandshakeCompleted(payload, context) {
  try {
    await behaviorOnHandshakeCompleted(payload);
  } catch (error) {
    console.warn(`[${context}] skipped:`, error?.message || error);
  }
}

async function safeBehaviorOnHandshakeInitiated(payload, context) {
  try {
    await behaviorOnHandshakeInitiated(payload);
  } catch (error) {
    console.warn(`[${context}] skipped:`, error?.message || error);
  }
}

async function safeBehaviorOnReplayDetected(payload, context) {
  try {
    await behaviorOnReplayDetected(payload);
  } catch (error) {
    console.warn(`[${context}] skipped:`, error?.message || error);
  }
}

async function safeBehaviorOnPolicyBlocked(payload, context) {
  try {
    await behaviorOnPolicyBlocked(payload);
  } catch (error) {
    console.warn(`[${context}] skipped:`, error?.message || error);
  }
}

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

  const initiatorPolicy = await checkNodePolicy({
    user_id: initiator_user_id,
    user_key_id: initiator_user_key_id,
  });

  if (!initiatorPolicy.allowed) {
    await safeWriteLog(
      {
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
      },
      "initiate_policy_blocked_initiator"
    );

    await safeBehaviorOnPolicyBlocked(
      {
        subject_user_id: initiator_user_id,
        subject_user_key_id: initiator_user_key_id,
        handshake_id: null,
      },
      "initiate_policy_blocked_initiator_behavior"
    );

    throw new Error(`Policy blocked initiator: ${initiatorPolicy.reason}`);
  }

  const responderPolicy = await checkNodePolicy({
    user_id: responder_user_id,
    user_key_id: responder_user_key_id,
  });

  if (!responderPolicy.allowed) {
    await safeWriteLog(
      {
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
      },
      "initiate_policy_blocked_responder"
    );

    await safeBehaviorOnPolicyBlocked(
      {
        subject_user_id: responder_user_id,
        subject_user_key_id: responder_user_key_id,
        handshake_id: null,
      },
      "initiate_policy_blocked_responder_behavior"
    );

    throw new Error(`Policy blocked responder: ${responderPolicy.reason}`);
  }

  const nonce = nonce_initiator || crypto.randomBytes(16).toString("hex");

  const ttl = Number(process.env.REPLAY_TTL_SECONDS || 300);
  const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

  const resolvedOrgId = org_id;

  const nonceResult = await reserveNonce({
    nonce,
    first_seen_at: now,
    expires_at: expiresAt,
    handshake_id: null,
    subject_user_id: initiator_user_id,
    subject_user_key_id: initiator_user_key_id,
    org_id: resolvedOrgId,
  });

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

    await safeWriteLog(
      {
        event_source: "handshakeService",
        event_type: "REPLAY_DETECTED",
        log_level: "WARN",
        subject_user_id: initiator_user_id,
        subject_user_key_id: initiator_user_key_id,
        org_id,
        details: { nonce, stage: "INITIATE" },
      },
      "initiate_replay_detected"
    );

    await safeBehaviorOnReplayDetected(
      {
        subject_user_id: initiator_user_id,
        subject_user_key_id: initiator_user_key_id,
        handshake_id: null,
      },
      "initiate_replay_behavior"
    );

    try {
      await enforceReplayAutoBlock({
        subject_user_id: initiator_user_id,
        subject_user_key_id: initiator_user_key_id,
        handshake_id: null,
      });
    } catch (blockErr) {
      console.warn("[initiate_replay_autoblock] skipped:", blockErr?.message || blockErr);
    }

    return { ok: false, code: "REPLAY_NONCE_REUSED" };
  }

  if (!nonceResult.ok) throw new Error("Nonce reserve failed.");

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

  if (nonceResult?.nonce_row?.nonce_id) {
    await linkNonceToHandshake({
      nonce_id: nonceResult.nonce_row.nonce_id,
      handshake_id: handshake.handshake_id,
    });
  }

  await safeWriteLog(
    {
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
    },
    "handshake_initiated"
  );

  fireAndForget(
    () =>
      safeBehaviorOnHandshakeInitiated(
        {
          subject_user_id: initiator_user_id,
          subject_user_key_id: initiator_user_key_id,
          handshake_id: handshake.handshake_id,
        },
        "handshake_initiated_behavior"
      ),
    "handshake_initiated_behavior"
  );

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

  const { data: hs, error: hsErr } = await supabase
    .from(TABLES.HANDSHAKES)
    .select("*")
    .eq("handshake_id", handshake_id)
    .single();

  if (hsErr || !hs) throw new Error("Handshake not found");

  const org_id = hs.org_id ?? (await getOrgIdForNodeUser(responder_user_id));

  if (hs.handshake_status !== "INITIATED") {
    throw new Error(
      `Handshake not in INITIATED state. Current: ${hs.handshake_status}`
    );
  }

  if (
    Number(hs.responder_user_id) !== Number(responder_user_id) ||
    Number(hs.responder_user_key_id) !== Number(responder_user_key_id)
  ) {
    throw new Error("Responder user/key does not match handshake record");
  }

  const responderPolicy = await checkNodePolicy({
    user_id: responder_user_id,
    user_key_id: responder_user_key_id,
  });

  if (!responderPolicy.allowed) {
    await safeWriteLog(
      {
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
      },
      "respond_policy_blocked"
    );

    await supabase
      .from(TABLES.HANDSHAKES)
      .update({
        handshake_status: "FAILED",
        failure_reason: "POLICY_BLOCKED",
        completed_at: now,
      })
      .eq("handshake_id", handshake_id);

    await safeBehaviorOnPolicyBlocked(
      {
        subject_user_id: responder_user_id,
        subject_user_key_id: responder_user_key_id,
        handshake_id,
      },
      "respond_policy_blocked_behavior"
    );

    await safeBehaviorOnHandshakeCompleted(
      {
        subject_user_id: responder_user_id,
        subject_user_key_id: responder_user_key_id,
        ok: false,
        handshake_id,
      },
      "respond_policy_blocked_completed_behavior"
    );

    throw new Error(`Policy blocked responder: ${responderPolicy.reason}`);
  }

  const ttl = Number(process.env.REPLAY_TTL_SECONDS || 300);
  const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

  const resolvedOrgId = org_id;

  const nonceResult = await reserveNonce({
    nonce: responder_nonce,
    first_seen_at: now,
    expires_at: expiresAt,
    handshake_id,
    subject_user_id: responder_user_id,
    subject_user_key_id: responder_user_key_id,
    org_id: resolvedOrgId,
  });

  if (!nonceResult.ok && nonceResult.code === "NONCE_ALREADY_USED") {
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

    await safeWriteLog(
      {
        event_source: "handshakeService",
        event_type: "REPLAY_DETECTED",
        log_level: "WARN",
        subject_user_id: responder_user_id,
        subject_user_key_id: responder_user_key_id,
        handshake_id,
        org_id,
        details: { stage: "RESPOND", responder_nonce },
      },
      "respond_replay_detected"
    );

    await supabase
      .from(TABLES.HANDSHAKES)
      .update({
        handshake_status: "FAILED",
        failure_reason: "REPLAY_DETECTED_ON_RESPOND",
        completed_at: now,
      })
      .eq("handshake_id", handshake_id);

    await safeBehaviorOnReplayDetected(
      {
        subject_user_id: responder_user_id,
        subject_user_key_id: responder_user_key_id,
        handshake_id,
      },
      "respond_replay_behavior"
    );

    await safeBehaviorOnHandshakeCompleted(
      {
        subject_user_id: responder_user_id,
        subject_user_key_id: responder_user_key_id,
        ok: false,
        handshake_id,
      },
      "respond_replay_completed_behavior"
    );

    try {
      await enforceReplayAutoBlock({
        subject_user_id: responder_user_id,
        subject_user_key_id: responder_user_key_id,
        handshake_id,
      });
    } catch (blockErr) {
      console.warn("[respond_replay_autoblock] skipped:", blockErr?.message || blockErr);
    }

    throw new Error("Replay detected: responder nonce already used.");
  }

  if (!nonceResult.ok) throw new Error("Nonce reserve failed for responder nonce.");

  if (nonceResult?.nonce_row?.nonce_id) {
    await linkNonceToHandshake({
      nonce_id: nonceResult.nonce_row.nonce_id,
      handshake_id,
    });
  }

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

  await safeWriteLog(
    {
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
    },
    "handshake_completed"
  );

  fireAndForget(
    () =>
      safeBehaviorOnHandshakeCompleted(
        {
          subject_user_id: responder_user_id,
          subject_user_key_id: responder_user_key_id,
          ok: true,
          handshake_id,
        },
        "respond_completed_responder_behavior"
      ),
    "respond_completed_responder_behavior"
  );

  fireAndForget(
    () =>
      safeBehaviorOnHandshakeCompleted(
        {
          subject_user_id: hs.initiator_user_id,
          subject_user_key_id: hs.initiator_user_key_id,
          ok: true,
          handshake_id,
        },
        "respond_completed_initiator_behavior"
      ),
    "respond_completed_initiator_behavior"
  );

  return { ok: true, handshake: updated };
}