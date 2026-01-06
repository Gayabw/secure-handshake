
import crypto from "crypto";
import { supabase } from "../lib/supabase.js";
import { TABLES } from "../lib/tables.js";

const DEFAULT_TTL_SECONDS = Number(process.env.OTP_DEFAULT_TTL_SECONDS || 300);
const DEFAULT_MAX_ATTEMPTS = Number(process.env.OTP_DEFAULT_MAX_ATTEMPTS || 5);

function mustPepper() {
  const p = process.env.OTP_PEPPER;
  if (!p || p.length < 16) throw new Error("OTP_PEPPER is missing/weak");
  return p;
}

function randomOtp6() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}

function randomSalt() {
  return crypto.randomBytes(16).toString("hex");
}

function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function otpHash(otp, salt) {
  const pepper = mustPepper();
  return sha256(`${otp}:${salt}:${pepper}`);
}

function nowIso() {
  return new Date().toISOString();
}

export async function createOtpSession({
  org_id,
  staff_id,
  purpose = "OTP_APPROVAL",
  user_id = null,
  user_key_id = null,
  handshake_id = null,
  ttl_seconds = DEFAULT_TTL_SECONDS,
  max_attempts = DEFAULT_MAX_ATTEMPTS,
  created_ip = null,
  created_user_agent = null,
}) {
  if (!org_id) throw new Error("org_id is required");
  if (!staff_id) throw new Error("staff_id is required");

  const otp = randomOtp6();
  const salt = randomSalt();
  const hash = otpHash(otp, salt);

  const expires_at = new Date(Date.now() + Number(ttl_seconds) * 1000).toISOString();

  const insertPayload = {
    org_id: Number(org_id),
    staff_id: Number(staff_id),
    purpose,
    user_id: user_id ? Number(user_id) : null,
    user_key_id: user_key_id ? Number(user_key_id) : null,
    handshake_id: handshake_id ? Number(handshake_id) : null,
    otp_hash: hash,
    otp_salt: salt,
    status: "PENDING",
    max_attempts: Number(max_attempts),
    attempt_count: 0,
    expires_at,
    created_ip,
    created_user_agent,
  };

  const { data, error } = await supabase
    .from(TABLES.OTP_SESSIONS)
    .insert(insertPayload)
    .select("*")
    .single();

  if (error) throw new Error(`otp_sessions insert failed: ${error.message}`);

  const devEcho = String(process.env.DEV_OTP_ECHO || "false") === "true";

  return {
    otp_session_id: data.otp_session_id,
    created_at: data.created_at || nowIso(),
    expires_at: data.expires_at,
    max_attempts: data.max_attempts,
    purpose: data.purpose,
    otp: devEcho ? otp : undefined,
  };
}

export async function verifyOtp({
  org_id,
  staff_id,
  otp_session_id,
  otp_code,
  verified_ip = null,
  verified_user_agent = null,
}) {
  if (!org_id) throw new Error("org_id is required");
  if (!staff_id) throw new Error("staff_id is required");
  if (!otp_session_id) throw new Error("otp_session_id is required");
  if (!otp_code) throw new Error("otp_code is required");

  const { data: session, error: fetchErr } = await supabase
    .from(TABLES.OTP_SESSIONS)
    .select("*")
    .eq("otp_session_id", otp_session_id)
    .single();

  if (fetchErr || !session) return { ok: false, reason: "NOT_FOUND" };

  if (Number(session.org_id) !== Number(org_id)) return { ok: false, reason: "ORG_MISMATCH" };
  if (Number(session.staff_id) !== Number(staff_id)) return { ok: false, reason: "STAFF_MISMATCH" };

  if (session.status === "VERIFIED") return { ok: true, reason: "ALREADY_VERIFIED", session };
  if (session.status === "LOCKED") return { ok: false, reason: "LOCKED", session };
  if (session.status === "CANCELLED") return { ok: false, reason: "CANCELLED", session };

  const isExpired = new Date(session.expires_at).getTime() < Date.now();
  if (isExpired) {
    await supabase
      .from(TABLES.OTP_SESSIONS)
      .update({ status: "EXPIRED" })
      .eq("otp_session_id", otp_session_id);

    return { ok: false, reason: "EXPIRED", session: { ...session, status: "EXPIRED" } };
  }

  if (session.attempt_count >= session.max_attempts) {
    await supabase
      .from(TABLES.OTP_SESSIONS)
      .update({ status: "LOCKED" })
      .eq("otp_session_id", otp_session_id);

    return { ok: false, reason: "TOO_MANY_ATTEMPTS", session: { ...session, status: "LOCKED" } };
  }

  const nextAttempt = Number(session.attempt_count) + 1;
  const match = otpHash(String(otp_code), session.otp_salt) === session.otp_hash;

  if (!match) {
    const nextStatus = nextAttempt >= session.max_attempts ? "LOCKED" : "PENDING";

    await supabase
      .from(TABLES.OTP_SESSIONS)
      .update({
        attempt_count: nextAttempt,
        status: nextStatus,
        verified_ip,
        verified_user_agent,
      })
      .eq("otp_session_id", otp_session_id);

    return {
      ok: false,
      reason: "INVALID_OTP",
      attempt_count: nextAttempt,
      locked: nextStatus === "LOCKED",
      session: { ...session, attempt_count: nextAttempt, status: nextStatus },
    };
  }

  const verified_at = nowIso();

  const { data: updated, error: updErr } = await supabase
    .from(TABLES.OTP_SESSIONS)
    .update({
      status: "VERIFIED",
      verified_at,
      verified_ip,
      verified_user_agent,
      attempt_count: nextAttempt,
    })
    .eq("otp_session_id", otp_session_id)
    .select("*")
    .single();

  if (updErr) throw new Error(`otp_sessions verify update failed: ${updErr.message}`);

  return { ok: true, reason: "VERIFIED", verified_at, session: updated };
}

export async function cleanupExpiredOtpSessions() {
  

  const { error } = await supabase
    .from(TABLES.OTP_SESSIONS)
    .delete()
    .lt("expires_at", nowIso())
    .in("status", ["PENDING", "EXPIRED", "LOCKED", "CANCELLED"]);

  if (error) throw new Error(`otp_sessions cleanup failed: ${error.message}`);
}
