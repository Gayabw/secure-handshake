import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { TABLES } from "../lib/tables.js";
import { initiateHandshake, respondHandshake } from "../services/handshakeService.js";
import { requireFields } from "../utils/validate.js";

const router = Router();

/**
 * Helper: validate positive integer id (prevents "/status" being treated as :id)
 */
function parsePositiveInt(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

/**
 * Helper: map known service errors to correct HTTP status codes
 */
function mapServiceErrorToHttp(e) {
  const msg = (e?.message || "Unknown error").trim().toLowerCase();

  // Replay / nonce reuse -> 409 Conflict
  if (msg.includes("replay detected") || msg.includes("nonce already used") || msg.includes("nonce already exists")) {
    return { status: 409, message: e.message };
  }

  // Not found -> 404
  if (msg.includes("not found")) {
    return { status: 404, message: e.message };
  }

  // Responder mismatch / forbidden -> 403
  if (msg.includes("does not match handshake record") || msg.includes("does not match")) {
    return { status: 403, message: e.message };
  }

  // Bad request -> 400
  if (msg.includes("required") || msg.includes("missing") || msg.includes("must be numbers")) {
    return { status: 400, message: e.message };
  }

  // Default -> 500
  return { status: 500, message: e.message || "Internal server error" };
}

/**
 * POST /handshake/initiate
 * Creates a new handshake (INITIATED)
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
      return res.status(400).json({ ok: false, error: `Missing: ${missing.join(", ")}` });
    }

    const result = await initiateHandshake({
      initiator_user_id: Number(req.body.initiator_user_id),
      initiator_user_key_id: Number(req.body.initiator_user_key_id),
      responder_user_id: Number(req.body.responder_user_id),
      responder_user_key_id: Number(req.body.responder_user_key_id),
      blockchain_network: req.body.blockchain_network,
      nonce_initiator: req.body.nonce_initiator ?? null,
    });

    // initiateHandshake already returns ok false for replay/non-unique situations
    return res.status(result.ok ? 201 : 409).json(result);
  } catch (e) {
    console.error("❌ /handshake/initiate error:", e.message);
    const mapped = mapServiceErrorToHttp(e);
    return res.status(mapped.status).json({ ok: false, error: mapped.message });
  }
});

/**
 * POST /handshake/respond
 * Completes an existing handshake (COMPLETED / FAILED)
 */
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

    const result = await respondHandshake({
      handshake_id: Number(req.body.handshake_id),
      responder_user_id: Number(req.body.responder_user_id),
      responder_user_key_id: Number(req.body.responder_user_key_id),
      responder_nonce: req.body.responder_nonce,
    });

    return res.status(200).json(result);
  } catch (e) {
    console.error("❌ /handshake/respond error:", e.message);
    const mapped = mapServiceErrorToHttp(e);
    return res.status(mapped.status).json({ ok: false, error: mapped.message });
  }
});

/**
 * GET /handshake/:id/logs
 * Fetch event logs for a handshake (audit trail)
 */
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
    return res.json({ ok: true, logs: data });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

/**
 * GET /handshake/:id/nonces
 * Fetch nonce_cache rows linked to handshake (replay evidence)
 */
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
    return res.json({ ok: true, nonces: data });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

/**
 * GET /handshake/:id/replay
 * Fetch replay_attacks rows linked to handshake (evidence)
 */
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
    return res.json({ ok: true, replay_attacks: data });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

/**
 * GET /handshake/:id
 * Fetch handshake by ID
 *
 * NOTE: This is placed LAST so it doesn't interfere with /:id/logs, /:id/nonces, /:id/replay.
 */
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
