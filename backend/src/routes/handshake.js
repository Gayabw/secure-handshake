import { Router } from "express";
import { initiateHandshake, respondHandshake } from "../services/handshakeService.js";
import { correlateAndScoreHandshake } from "../services/behaviourCorrelationService.js";
import { requireFields } from "../utils/validate.js";
import { runPlugins } from "../plugins/pluginRunner.js";

const router = Router();

/* HELPERS */

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

/* INITIATE HANDSHAKE
   Customer node flow
   No staff RBAC is required here
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

    await runPlugins({
      stage: "pre_handshake",
      context: { ...req.body, ip_address },
      logContext: { ip_address },
    });

    const result = await initiateHandshake({
      initiator_user_id: Number(req.body.initiator_user_id),
      initiator_user_key_id: Number(req.body.initiator_user_key_id),
      responder_user_id: Number(req.body.responder_user_id),
      responder_user_key_id: Number(req.body.responder_user_key_id),
      blockchain_network: req.body.blockchain_network,
      nonce_initiator: req.body.nonce_initiator ?? null,
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

    const result = await respondHandshake({
      handshake_id,
      responder_user_id: Number(req.body.responder_user_id),
      responder_user_key_id: Number(req.body.responder_user_key_id),
      responder_nonce: req.body.responder_nonce,
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