import crypto from "crypto";
import { supabase } from "../lib/supabase.js";
import { TABLES } from "../lib/tables.js";
import { reserveNonce, linkNonceToHandshake } from "./replayService.js";
import { writeLog } from "./logService.js";

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

  // Your IDs are bigint => must be numbers
  const mustBeNumbers = [
    initiator_user_id,
    initiator_user_key_id,
    responder_user_id,
    responder_user_key_id,
  ];
  if (mustBeNumbers.some((v) => typeof v !== "number")) {
    throw new Error(
      "IDs must be numbers (bigint). Example: initiator_user_id: 1 (NOT 'SID01')."
    );
  }
  if (!blockchain_network) throw new Error("blockchain_network is required.");

  const nonce = nonce_initiator || crypto.randomBytes(16).toString("hex");

  // TTL for nonce
  const ttl = Number(process.env.REPLAY_TTL_SECONDS || 300);
  const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

  // 1) Reserve nonce first (replay protection)
  const nonceResult = await reserveNonce({
    nonce,
    first_seen_at: now,
    expires_at: expiresAt,
    handshake_id: null,
    subject_user_id: initiator_user_id,
    subject_user_key_id: initiator_user_key_id,
  });

  // If nonce already exists => replay
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
      details: { nonce },
    });

    return { ok: false, code: "REPLAY_NONCE_REUSED" };
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

  // ✅ 3) Link nonce_cache row to handshake_id (THIS IS THE NEW PART)
  // We update the exact nonce row using nonce_id returned from reserveNonce.
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

  return { ok: true, handshake };
}
