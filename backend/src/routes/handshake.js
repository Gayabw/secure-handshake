import { Router } from "express";
import { initiateHandshake, respondHandshake } from "../services/handshakeService.js";
import { correlateAndScoreHandshake } from "../services/behaviourCorrelationService.js";
import { requireFields } from "../utils/validate.js";
import { runPlugins } from "../plugins/pluginRunner.js";
import { assertNodeNotBlocked } from "../services/enforcementGateService.js";
import { writeLog } from "../services/logService.js";
import { supabase } from "../lib/supabase.js";

const router = Router();

/* HELPERS */

function getClientIp(req) {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.length > 0) {
    return xf.split(",")[0].trim();
  }

  return req.ip || req.connection?.remoteAddress || null;
}

function parsePositiveInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return null;
  return n;
}

/* LIST HANDSHAKES
   Staff dashboard flow
   Returns handshakes in the last N hours, default 24
*/

router.get("/", async (req, res) => {
  try {
    const orgId = parsePositiveInt(req.query.org_id);
    const limit = parsePositiveInt(req.query.limit) ?? 100;
    const hours = parsePositiveInt(req.query.hours) ?? 24;

    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    let query = supabase
      .from("handshakes")
      .select("*")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (orgId) {
      query = query.eq("org_id", orgId);
    }

    const { data, error } = await query;

    if (error) {
      return res.status(500).json({
        ok: false,
        error: "Failed to load handshake records",
        details: error.message,
      });
    }

    return res.status(200).json({
      ok: true,
      items: data || [],
      meta: {
        org_id: orgId ?? null,
        hours,
        limit,
      },
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e.message,
    });
  }
});

router.get("/:handshakeId", async (req, res) => {
  try {
    const handshakeId = parsePositiveInt(req.params.handshakeId);

    if (!handshakeId) {
      return res.status(400).json({
        ok: false,
        error: "Invalid handshakeId",
      });
    }

    const { data, error } = await supabase
      .from("handshakes")
      .select("*")
      .eq("handshake_id", handshakeId)
      .maybeSingle();

    if (error) {
      return res.status(500).json({
        ok: false,
        error: "Failed to load handshake detail",
        details: error.message,
      });
    }

    if (!data) {
      return res.status(404).json({
        ok: false,
        error: "Handshake record not found",
      });
    }

    return res.status(200).json({
      ok: true,
      item: data,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e.message,
    });
  }
});

/* INITIATE HANDSHAKE
   Customer node flow
   No staff RBAC.
*/

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
      return res.status(400).json({
        ok: false,
        error: `Missing: ${missing.join(", ")}`,
      });
    }

    const ip_address = getClientIp(req);

    await assertNodeNotBlocked({
      user_id: req.body.initiator_user_id,
      user_key_id: req.body.initiator_user_key_id,
    });

    const pluginResult = await runPlugins({
      stage: "pre_handshake",
      context: {
        ...req.body,
        ip_address,
        stage: "pre_handshake",
      },
      logContext: {
        ip_address,
        subject_user_id: Number(req.body.initiator_user_id),
        subject_user_key_id: Number(req.body.initiator_user_key_id),
      },
    });

    const burstFlag = pluginResult.results.find(
      (item) =>
        item.plugin_name === "flagRapidHandshakeBurst" &&
        item.decision === "FLAG"
    );

    if (burstFlag) {
      await writeLog({
        event_source: "handshakeRoute",
        event_type: "HANDSHAKE_BLOCKED",
        log_level: "WARN",
        subject_user_id: Number(req.body.initiator_user_id),
        subject_user_key_id: Number(req.body.initiator_user_key_id),
        ip_address,
        details: {
          code: "RAPID_HANDSHAKE_BURST_BLOCKED",
          stage: "pre_handshake",
          plugin: burstFlag,
        },
      });

      return res.status(429).json({
        ok: false,
        error: "Rapid handshake burst detected. Request blocked by enforcement policy.",
        code: "RAPID_HANDSHAKE_BURST_BLOCKED",
        plugin: burstFlag,
      });
    }

    const denyResult = pluginResult.results.find(
      (item) => item.decision === "DENY"
    );

    if (denyResult) {
      await writeLog({
        event_source: "handshakeRoute",
        event_type: "HANDSHAKE_BLOCKED",
        log_level: "WARN",
        subject_user_id: Number(req.body.initiator_user_id),
        subject_user_key_id: Number(req.body.initiator_user_key_id),
        ip_address,
        details: {
          code: "PLUGIN_DENIED",
          stage: "pre_handshake",
          plugin: denyResult,
        },
      });

      return res.status(403).json({
        ok: false,
        error: "Request denied by plugin enforcement policy.",
        code: "PLUGIN_DENIED",
        plugin: denyResult,
      });
    }

    const result = await initiateHandshake({
      initiator_user_id: Number(req.body.initiator_user_id),
      initiator_user_key_id: Number(req.body.initiator_user_key_id),
      responder_user_id: Number(req.body.responder_user_id),
      responder_user_key_id: Number(req.body.responder_user_key_id),
      blockchain_network: req.body.blockchain_network,
      nonce_initiator: req.body.nonce_initiator ?? null,
      ip_address,
    });

    return res.status(result.ok ? 201 : 409).json(result);
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e.message,
    });
  }
});

/* RESPOND HANDSHAKE
   Customer node flow
   No staff RBAC is required here
*/

router.post("/respond", async (req, res) => {
  const handshake_id = parsePositiveInt(req.body?.handshake_id);

  try {
    const missing = requireFields(req.body, [
      "handshake_id",
      "responder_user_id",
      "responder_user_key_id",
      "responder_nonce",
    ]);

    if (missing.length) {
      return res.status(400).json({
        ok: false,
        error: `Missing: ${missing.join(", ")}`,
      });
    }

    if (!handshake_id) {
      return res.status(400).json({
        ok: false,
        error: "Invalid handshake_id",
      });
    }

    await assertNodeNotBlocked({
      user_id: req.body.responder_user_id,
      user_key_id: req.body.responder_user_key_id,
    });

    const ip_address = getClientIp(req);

    const result = await respondHandshake({
      handshake_id,
      responder_user_id: Number(req.body.responder_user_id),
      responder_user_key_id: Number(req.body.responder_user_key_id),
      responder_nonce: req.body.responder_nonce,
      ip_address,
    });

    if (result?.ok) {
      await correlateAndScoreHandshake(handshake_id);
    }

    return res.status(200).json(result);
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e.message,
    });
  }
});

export default router;