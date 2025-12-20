import { Router } from "express";
import { initiateHandshake } from "../services/handshakeService.js";
import { requireFields } from "../utils/validate.js";

const router = Router();

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

    const result = await initiateHandshake(req.body);
    return res.status(result.ok ? 201 : 409).json(result);
  } catch (e) {
    console.error("❌ /handshake/initiate error:", e.message);
    return res.status(500).json({ ok: false, error: e.message });
  }
});

router.post("/respond", (req, res) => {
  res.json({ ok: true, step: "respond placeholder", body: req.body });
});

export default router;
