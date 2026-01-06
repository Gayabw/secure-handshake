import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { TABLES } from "../lib/tables.js";
import { initiateHandshake, respondHandshake } from "../services/handshakeService.js";
import { correlateAndScoreHandshake } from "../services/behaviourCorrelationService.js";
import { requireFields } from "../utils/validate.js";
import { runPlugins } from "../plugins/pluginRunner.js";

const router = Router();

/* Helpers */

function getClientIp(req) {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.length > 0) return xf.split(",")[0].trim();
  return req.ip || req.connection?.remoteAddress || null;
}

function parsePositiveInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return null;
  return n;
}

function buildPreHandshakeContext({ req, action, body, handshake_id = null }) {
  return {
    stage: "pre_handshake",
    action, // initiate | respond
    route: req.originalUrl || req.url,
    method: req.method,
    ip_address: getClientIp(req),
    body_keys: Object.keys(body || {}),
    user_id:
      body?.user_id ??
      body?.initiator_user_id ??
      body?.responder_user_id ??
      null,
    user_key_id:
      body?.user_key_id ??
      body?.initiator_user_key_id ??
      body?.responder_user_key_id ??
      null,
    handshake_id,
    timestamp: new Date().toISOString(),
  };
}

function buildPostHandshakeContext({ req, action, body, handshake_id, outcome }) {
  return {
    stage: "post_handshake",
    action, // initiate | respond
    route: req.originalUrl || req.url,
    method: req.method,
    ip_address: getClientIp(req),
    body_keys: Object.keys(body || {}),
    user_id:
      body?.user_id ??
      body?.initiator_user_id ??
      body?.responder_user_id ??
      null,
    user_key_id:
      body?.user_key_id ??
      body?.initiator_user_key_id ??
      body?.responder_user_key_id ??
      null,
    handshake_id,
    outcome, // { ok: boolean, status?: string, error?: string }
    timestamp: new Date().toISOString(),
  };
}

/*
  Map known service errors to HTTP status codes.
  Kept this strict so clients get consistent responses.
*/
function mapServiceErrorToHttp(e) {
  const message = (e?.message || "Unknown error").trim();
  const msg = message.toLowerCase();

  if (
    msg.includes("replay detected") ||
    msg.includes("nonce already used") ||
    msg.includes("nonce already exists")
  ) {
    return { status: 409, message };
  }

  if (msg.includes("policy blocked")) {
    return { status: 403, message };
  }

  if (msg.includes("not found")) {
    return { status: 404, message };
  }

  if (msg.includes("does not match handshake record") || msg.includes("does not match")) {
    return { status: 403, message };
  }

  if (
    msg.includes("required") ||
    msg.includes("missing") ||
    msg.includes("must be numbers") ||
    msg.includes("invalid")
  ) {
    return { status: 400, message };
  }

  return { status: 500, message: message || "Internal server error" };
}

/* POST /initiate */

router.post("/initiate", async (req, res) => {
  try {
    const missing = requireFields(req.body, [
      "initiator_user_id",
      "initiator_user_key_id",
      "responder_user_id",
      "responder_user_key_id",
      "blockchain_network",
    ]);

    if (missing.length) {
      return res.status(400).json({ ok: false, error: `Missing: ${missing.join(", ")}` });
    }

    const ip_address = getClientIp(req);

    // Phase D: pre-handshake plugins (FK-safe)
    const preContext = buildPreHandshakeContext({
      req,
      action: "initiate",
      body: req.body,
      handshake_id: null,
    });

    await runPlugins({
      stage: "pre_handshake",
      context: preContext,
      logContext: {
        handshake_id: null,
        anomaly_id: null,
        subject_user_id: null,
        subject_user_key_id: null,
        ip_address,
      },
    });

    // Core service call (creates handshake row)
    const result = await initiateHandshake({
      initiator_user_id: Number(req.body.initiator_user_id),
      initiator_user_key_id: Number(req.body.initiator_user_key_id),
      responder_user_id: Number(req.body.responder_user_id),
      responder_user_key_id: Number(req.body.responder_user_key_id),
      blockchain_network: req.body.blockchain_network,
      nonce_initiator: req.body.nonce_initiator ?? null,
    });

    // Handshake id lives inside result.handshake
    const createdHandshakeId = result?.ok ? Number(result?.handshake?.handshake_id) : null;

    // Phase D: post-handshake plugins (only if created)
    if (result?.ok && Number.isFinite(createdHandshakeId) && createdHandshakeId > 0) {
      const postContext = buildPostHandshakeContext({
        req,
        action: "initiate",
        body: req.body,
        handshake_id: createdHandshakeId,
        outcome: { ok: true, status: "INITIATED" },
      });

      try {
        await runPlugins({
          stage: "post_handshake",
          context: postContext,
          logContext: {
            handshake_id: createdHandshakeId,
            anomaly_id: null,
            subject_user_id: null,
            subject_user_key_id: null,
            ip_address,
          },
        });
      } catch (err) {
        // Plugins must never block handshake initiation
        console.warn("⚠️ post_handshake plugins failed (initiate):", err?.message || err);
      }

      // IMPORTANT: do not correlate on initiate (prevents double scoring).
      // Correlation happens once, after respond, when outcome is final.
    }

    return res.status(result.ok ? 201 : 409).json(result);
  } catch (e) {
    console.error("❌ /handshake/initiate error:", e.message);
    const mapped = mapServiceErrorToHttp(e);
    return res.status(mapped.status).json({ ok: false, error: mapped.message });
  }
});

/*  POST /respond */

router.post("/respond", async (req, res) => {
  const ip_address = getClientIp(req);

  // We keep handshake_id visible here so even failure paths can correlate.
  const handshake_id = parsePositiveInt(req.body?.handshake_id);

  try {
    const missing = requireFields(req.body, [
      "handshake_id",
      "responder_user_id",
      "responder_user_key_id",
      "responder_nonce",
    ]);

    if (missing.length) {
      return res.status(400).json({ ok: false, error: `Missing: ${missing.join(", ")}` });
    }

    if (!handshake_id) {
      return res.status(400).json({ ok: false, error: "Invalid handshake_id" });
    }

    // Phase D: pre-handshake plugins (FK-safe: do not log handshake_id yet)
    const preContext = buildPreHandshakeContext({
      req,
      action: "respond",
      body: req.body,
      handshake_id,
    });

    await runPlugins({
      stage: "pre_handshake",
      context: preContext,
      logContext: {
        handshake_id: null,
        anomaly_id: null,
        subject_user_id: null,
        subject_user_key_id: null,
        ip_address,
      },
    });

    // Core service call (may throw on replay/policy/state errors)
    const result = await respondHandshake({
      handshake_id,
      responder_user_id: Number(req.body.responder_user_id),
      responder_user_key_id: Number(req.body.responder_user_key_id),
      responder_nonce: req.body.responder_nonce,
    });

    // Phase D: post-handshake plugins (only if respond succeeded)
    if (result?.ok) {
      const postContext = buildPostHandshakeContext({
        req,
        action: "respond",
        body: req.body,
        handshake_id,
        outcome: { ok: true, status: "COMPLETED" },
      });

      try {
        await runPlugins({
          stage: "post_handshake",
          context: postContext,
          logContext: {
            handshake_id,
            anomaly_id: null,
            subject_user_id: null,
            subject_user_key_id: null,
            ip_address,
          },
        });
      } catch (err) {
        // Plugins must never break a successful handshake
        console.warn("⚠️ post_handshake plugins failed (respond):", err?.message || err);
      }

      // Phase E: correlate after plugins (success path)
      try {
        await correlateAndScoreHandshake(handshake_id);
      } catch (err) {
        // Correlation is non-blocking by design
        console.warn("⚠️ behaviour correlation failed (success path):", err?.message || err);
      }
    }

    return res.status(200).json(result);
  } catch (e) {
    console.error("❌ /handshake/respond error:", e.message);

    // Phase E: best-effort correlation even on failure paths (replay/policy/etc.)
    // This must never change the HTTP error response.
    if (handshake_id) {
      try {
        await correlateAndScoreHandshake(handshake_id);
      } catch (corrErr) {
        console.warn("⚠️ behaviour correlation skipped on failure:", corrErr?.message || corrErr);
      }
    }

    const mapped = mapServiceErrorToHttp(e);
    return res.status(mapped.status).json({ ok: false, error: mapped.message });
  }
});

/* READ-ONLY API */

router.get("/:id/logs", async (req, res) => {
  try {
    const id = parsePositiveInt(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: "Invalid handshake_id" });

    const { data, error } = await supabase
      .from(TABLES.EVENT_LOGS)
      .select("*")
      .eq("handshake_id", id)
      .order("event_time", { ascending: true });

    if (error) return res.status(500).json({ ok: false, error: error.message });
    return res.json({ ok: true, logs: data ?? [] });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

router.get("/:id/nonces", async (req, res) => {
  try {
    const id = parsePositiveInt(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: "Invalid handshake_id" });

    const { data, error } = await supabase
      .from(TABLES.NONCE_CACHE)
      .select("*")
      .eq("handshake_id", id)
      .order("first_seen_at", { ascending: true });

    if (error) return res.status(500).json({ ok: false, error: error.message });
    return res.json({ ok: true, nonces: data ?? [] });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

router.get("/:id/replay", async (req, res) => {
  try {
    const id = parsePositiveInt(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: "Invalid handshake_id" });

    const { data, error } = await supabase
      .from(TABLES.REPLAY_ATTACKS)
      .select("*")
      .eq("handshake_id", id)
      .order("detected_timestamp", { ascending: true });

    if (error) return res.status(500).json({ ok: false, error: error.message });
    return res.json({ ok: true, replay_attacks: data ?? [] });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = parsePositiveInt(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: "Invalid handshake_id" });

    const { data, error } = await supabase
      .from(TABLES.HANDSHAKES)
      .select("*")
      .eq("handshake_id", id)
      .single();

    if (error) return res.status(404).json({ ok: false, error: error.message });
    return res.json({ ok: true, handshake: data });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// GET /handshake/list?limit=50&org_id=1&status=COMPLETED
router.get("/list", async (req, res) => {
  try {
    const limit = parsePositiveInt(req.query.limit) ?? 50;
    const org_id = parsePositiveInt(req.query.org_id);
    const status = req.query.status ? String(req.query.status).toUpperCase() : null;

    let q = supabase
      .from(TABLES.HANDSHAKES)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (org_id) q = q.eq("org_id", org_id);
    if (status) q = q.eq("handshake_status", status);

    const { data, error } = await q;
    if (error) return res.status(500).json({ ok: false, error: error.message });

    return res.json({ ok: true, items: data ?? [] });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});


export default router;
