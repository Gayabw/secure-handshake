import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { TABLES } from "../lib/tables.js";
import { initiateHandshake, respondHandshake } from "../services/handshakeService.js";
import { requireFields } from "../utils/validate.js";
import { runPlugins } from "../plugins/pluginRunner.js";

const router = Router();

/* -------------------- Plugin helpers (SAFE, ADDITIVE) -------------------- */

function getClientIp(req) {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.length > 0) return xf.split(",")[0].trim();
  return req.ip || req.connection?.remoteAddress || null;
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

/* -------------------- Helpers (existing logic preserved) -------------------- */

function parsePositiveInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return null;
  return n;
}

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

/* -------------------- POST /handshake/initiate -------------------- */

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

    /* ===== Phase D Step 2: PRE-HANDSHAKE PLUGIN HOOK (NON-BLOCKING) ===== */
    const ip_address = getClientIp(req);

    const pluginContext = buildPreHandshakeContext({
      req,
      action: "initiate",
      body: req.body,
      handshake_id: null,
    });

    const pluginReport = await runPlugins({
      stage: "pre_handshake",
      context: pluginContext,
      logContext: {
        handshake_id: null,        // ✅ PRE: always NULL (FK-safe)
        anomaly_id: null,
        subject_user_id: null,     // ✅ PRE: always NULL (FK-safe)
        subject_user_key_id: null, // ✅ PRE: always NULL (FK-safe)
        ip_address,
      },
    });

    req.pluginReport = pluginReport;
    /* ================================================================ */

    const result = await initiateHandshake({
      initiator_user_id: Number(req.body.initiator_user_id),
      initiator_user_key_id: Number(req.body.initiator_user_key_id),
      responder_user_id: Number(req.body.responder_user_id),
      responder_user_key_id: Number(req.body.responder_user_key_id),
      blockchain_network: req.body.blockchain_network,
      nonce_initiator: req.body.nonce_initiator ?? null,
    });

    /* ===== Phase D Step 3: POST-HANDSHAKE PLUGIN HOOK (FAIL-SAFE) ===== */
    // Only run post plugins when the handshake was created successfully (we have a real handshake_id).
    if (result?.ok && result?.handshake_id) {
      const createdHandshakeId = Number(result.handshake_id);

      const postContext = buildPostHandshakeContext({
        req,
        action: "initiate",
        body: req.body,
        handshake_id: createdHandshakeId,
        outcome: { ok: true, status: result.status ?? "INITIATED" },
      });

      try {
        const postReport = await runPlugins({
          stage: "post_handshake",
          context: postContext,
          logContext: {
            handshake_id: createdHandshakeId, // ✅ POST: real FK-safe id
            anomaly_id: null,
            subject_user_id: null,
            subject_user_key_id: null,
            ip_address,
          },
        });
        req.postPluginReport = postReport;
      } catch (err) {
        // Fail-safe: never break handshake for plugin issues
        console.warn(
          "⚠️ post_handshake plugins failed (initiate):",
          err?.message || err
        );
      }
    }
    /* ================================================================ */

    return res.status(result.ok ? 201 : 409).json(result);
  } catch (e) {
    console.error("❌ /handshake/initiate error:", e.message);
    const mapped = mapServiceErrorToHttp(e);
    return res.status(mapped.status).json({ ok: false, error: mapped.message });
  }
});

/* -------------------- POST /handshake/respond -------------------- */

router.post("/respond", async (req, res) => {
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

    /* ===== Phase D Step 2: PRE-HANDSHAKE PLUGIN HOOK (NON-BLOCKING) ===== */
    const ip_address = getClientIp(req);
    const handshake_id = Number(req.body.handshake_id);

    const pluginContext = buildPreHandshakeContext({
      req,
      action: "respond",
      body: req.body,
      handshake_id, // keep in JSON context (forensics), but NOT in FK column
    });

    const pluginReport = await runPlugins({
      stage: "pre_handshake",
      context: pluginContext,
      logContext: {
        handshake_id: null,        // ✅ PRE: always NULL (FK-safe even if fake id)
        anomaly_id: null,
        subject_user_id: null,     // ✅ PRE: always NULL
        subject_user_key_id: null, // ✅ PRE: always NULL
        ip_address,
      },
    });

    req.pluginReport = pluginReport;
    /* ================================================================ */

    const result = await respondHandshake({
      handshake_id,
      responder_user_id: Number(req.body.responder_user_id),
      responder_user_key_id: Number(req.body.responder_user_key_id),
      responder_nonce: req.body.responder_nonce,
    });

    /* ===== Phase D Step 3: POST-HANDSHAKE PLUGIN HOOK (FAIL-SAFE) ===== */
    // Only run post plugins when respond succeeded (handshake exists + state updated).
    if (result?.ok) {
      const postContext = buildPostHandshakeContext({
        req,
        action: "respond",
        body: req.body,
        handshake_id,
        outcome: { ok: true, status: result.status ?? "COMPLETED" },
      });

      try {
        const postReport = await runPlugins({
          stage: "post_handshake",
          context: postContext,
          logContext: {
            handshake_id, // ✅ POST: FK-safe if respond succeeded
            anomaly_id: null,
            subject_user_id: null,
            subject_user_key_id: null,
            ip_address,
          },
        });
        req.postPluginReport = postReport;
      } catch (err) {
        console.warn(
          "⚠️ post_handshake plugins failed (respond):",
          err?.message || err
        );
      }
    }
    /* ================================================================ */

    return res.status(200).json(result);
  } catch (e) {
    console.error("❌ /handshake/respond error:", e.message);
    const mapped = mapServiceErrorToHttp(e);
    return res.status(mapped.status).json({ ok: false, error: mapped.message });
  }
});

/* -------------------- READ-ONLY ROUTES (UNCHANGED) -------------------- */

router.get("/:id/logs", async (req, res) => {
  try {
    const id = parsePositiveInt(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: "Invalid handshake_id" });

    const { data, error } = await supabase
      .from(TABLES.LOGS)
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

export default router;
