import { fail, ok } from "../utils/apiResponse.js";
import { filterAlertsForRole } from "../services/alertAccessService.js";

import {
  listAlerts,
  listAnomalies,
  listHandshakes,
  listReplayAttacks,
} from "../services/monitoringService.js";

function readFilters(req) {
  return {
    org_id: req.query.org_id,
    user_id: req.query.user_id,
    user_key_id: req.query.user_key_id,
    handshake_id: req.query.handshake_id,
    blockchain_network: req.query.blockchain_network,
    status: req.query.status,
    limit: req.query.limit,
  };
}

export async function getHandshakes(req, res) {
  try {
    const filters = readFilters(req);
    const items = await listHandshakes(filters);

    return ok(res, {
      items,
      count: items.length,
      filters,
      role: req.staff?.role || null,
    });
  } catch (error) {
    return fail(res, error.message, 500);
  }
}

export async function getAnomalies(req, res) {
  try {
    const filters = readFilters(req);
    const items = await listAnomalies(filters);

    return ok(res, {
      items,
      count: items.length,
      filters,
      role: req.staff?.role || null,
    });
  } catch (error) {
    return fail(res, error.message, 500);
  }
}

export async function getReplayAttacks(req, res) {
  try {
    const filters = readFilters(req);
    const items = await listReplayAttacks(filters);

    return ok(res, {
      items,
      count: items.length,
      filters,
      role: req.staff?.role || null,
    });
  } catch (error) {
    return fail(res, error.message, 500);
  }
}

export async function getAlerts(req, res) {
  try {
    const filters = req.query || {};
    const role = req.staff?.role || null;

    const alerts = await listAlerts(filters);
    const filtered = filterAlertsForRole(alerts, role);

    return res.json({
      ok: true,
      data: {
        items: filtered,
        count: filtered.length,
        role,
      },
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
}