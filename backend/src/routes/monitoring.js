import express from "express";
import {
  getAlerts,
  getAnomalies,
  getHandshakes,
  getReplayAttacks,
} from "../controllers/monitoringController.js";
import { checkRole } from "../middleware/checkRole.js";
import { ROLE_ACCESS } from "../config/rbac.js";

const router = express.Router();

router.get("/handshakes", checkRole(ROLE_ACCESS.HANDSHAKES), getHandshakes);
router.get("/anomalies", checkRole(ROLE_ACCESS.ANOMALIES), getAnomalies);
router.get("/replay-attacks", checkRole(ROLE_ACCESS.REPLAY_ATTACKS), getReplayAttacks);
router.get("/alerts", checkRole(ROLE_ACCESS.ALERTS), getAlerts);

export default router;