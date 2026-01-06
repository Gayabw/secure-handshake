import express from "express";
import { TABLES } from "../lib/tables.js";

import { createOtpSession, verifyOtp } from "../services/otpService.js";
import { insertAuthAudit, logEvent, logSecurityEvent } from "../services/auditLogService.js";

const router = express.Router();

function clientMeta(req) {
  const ip =
    req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    null;

  return {
    ip_address: ip,
    user_agent: req.headers["user-agent"] || null,
  };
}

function ensureOtpConfigured() {
  // Clear fail-fast message instead of Supabase “Invalid relation name”
  if (!TABLES?.OTP_SESSIONS || typeof TABLES.OTP_SESSIONS !== "string" || TABLES.OTP_SESSIONS.trim() === "") {
    return { ok: false, error: "TABLES.OTP_SESSIONS is not configured (check src/lib/tables.js)" };
  }
  return null;
}

// POST /otp/sessions
router.post("/sessions", async (req, res) => {
  const meta = clientMeta(req);

  const cfgErr = ensureOtpConfigured();
  if (cfgErr) return res.status(500).json(cfgErr);

  try {
    const {
      org_id,
      staff_id,
      purpose,
      user_id,
      user_key_id,
      handshake_id,
      ttl_seconds,
      max_attempts,
    } = req.body || {};

    const session = await createOtpSession({
      org_id,
      staff_id,
      purpose,
      user_id,
      user_key_id,
      handshake_id,
      ttl_seconds,
      max_attempts,
      created_ip: meta.ip_address,
      created_user_agent: meta.user_agent,
    });

    const security_event_id = await logSecurityEvent({
      org_id: Number(org_id),
      event_type: "OTP_CREATED",
      severity: "LOW",
      event_category: "OTP",
      short_description: "OTP session created",
      subject_user_id: user_id ? Number(user_id) : null,
      subject_user_key_id: user_key_id ? Number(user_key_id) : null,
      related_handshake_id: handshake_id ? Number(handshake_id) : null,
      details: {
        otp_session_id: session.otp_session_id,
        staff_id: Number(staff_id),
        purpose: purpose || "OTP_APPROVAL",
        expires_at: session.expires_at,
      },
    });

    await logEvent({
      org_id: Number(org_id),
      event_type: "OTP_CREATED",
      ip_address: meta.ip_address,
      subject_user_id: user_id ? Number(user_id) : null,
      subject_user_key_id: user_key_id ? Number(user_key_id) : null,
      handshake_id: handshake_id ? Number(handshake_id) : null,
      security_event_id,
      details: {
        otp_session_id: session.otp_session_id,
        staff_id: Number(staff_id),
        purpose: purpose || "OTP_APPROVAL",
        expires_at: session.expires_at,
      },
      log_level: "INFO",
    });

    return res.status(201).json({ ok: true, ...session });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }
});

// POST /otp/verify
router.post("/verify", async (req, res) => {
  const meta = clientMeta(req);

  const cfgErr = ensureOtpConfigured();
  if (cfgErr) return res.status(500).json(cfgErr);

  try {
    const { org_id, staff_id, otp_session_id, otp_code } = req.body || {};

    const result = await verifyOtp({
      org_id,
      staff_id,
      otp_session_id,
      otp_code,
      verified_ip: meta.ip_address,
      verified_user_agent: meta.user_agent,
    });

    const sess = result.session || null;

    const auth_id = await insertAuthAudit({
      auth_type: "OTP_APPROVAL",
      user_id: sess?.user_id ?? null,
      user_key_id: sess?.user_key_id ?? null,
      handshake_id: sess?.handshake_id ?? null,
      success: Boolean(result.ok),
      failure_reason: result.ok ? null : result.reason,
      client_ip: meta.ip_address,
      user_agent: meta.user_agent,
    });

    const security_event_id = await logSecurityEvent({
      org_id: Number(org_id),
      event_type: result.ok ? "OTP_VERIFIED" : "OTP_VERIFY_FAILED",
      severity: result.ok ? "LOW" : "MEDIUM",
      event_category: "OTP",
      short_description: result.ok ? "OTP verified" : "OTP verification failed",
      subject_user_id: sess?.user_id ?? null,
      subject_user_key_id: sess?.user_key_id ?? null,
      related_auth_id: auth_id,
      related_handshake_id: sess?.handshake_id ?? null,
      details: {
        otp_session_id,
        staff_id: Number(staff_id),
        reason: result.reason,
        attempt_count: sess?.attempt_count ?? null,
        status: sess?.status ?? null,
      },
    });

    await logEvent({
      org_id: Number(org_id),
      event_type: result.ok ? "OTP_VERIFIED" : "OTP_VERIFY_FAILED",
      ip_address: meta.ip_address,
      subject_user_id: sess?.user_id ?? null,
      subject_user_key_id: sess?.user_key_id ?? null,
      handshake_id: sess?.handshake_id ?? null,
      auth_id,
      security_event_id,
      details: {
        otp_session_id,
        staff_id: Number(staff_id),
        reason: result.reason,
        attempt_count: sess?.attempt_count ?? null,
        status: sess?.status ?? null,
      },
      log_level: result.ok ? "INFO" : "WARN",
    });

    return res.status(result.ok ? 200 : 401).json({
      ok: Boolean(result.ok),
      reason: result.reason,
      verified_at: result.verified_at || null,
    });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }
});

export default router;
