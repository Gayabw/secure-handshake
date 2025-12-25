// backend/src/routes/anomaly.js
import express from "express";
import { evaluateAnomalyForSubject } from "../services/anomalyService.js";

const router = express.Router();

/**
 * Manual evaluate endpoint (evidence driven)
 * POST /anomaly/evaluate
 * body: { subject_user_id, subject_user_key_id, handshake_id?, threshold? }
 */
router.post("/evaluate", async (req, res) => {
  const { subject_user_id, subject_user_key_id, handshake_id = null, threshold = undefined } = req.body || {};

  // Hard validation but never crash
  if (!subject_user_id || !subject_user_key_id) {
    return res.status(400).json({
      ok: false,
      error: "subject_user_id and subject_user_key_id are required",
    });
  }

  const result = await evaluateAnomalyForSubject({
    subject_user_id,
    subject_user_key_id,
    handshake_id,
    threshold,
  });

  return res.json({ ok: true, result });
});

export default router;
