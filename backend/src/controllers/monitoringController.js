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
    org_id: req.query.org_id ?? null,
    user_id: req.query.user_id ?? null,
    user_key_id: req.query.user_key_id ?? null,
    handshake_id: req.query.handshake_id ?? null,
    blockchain_network: req.query.blockchain_network ?? null,
    status: req.query.status ?? null,
    limit: req.query.limit ?? null,
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
    return fail(res, error.message, error.statusCode || 500);
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
    return fail(res, error.message, error.statusCode || 500);
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
    return fail(res, error.message, error.statusCode || 500);
  }
}

export async function getAlerts(req, res) {
  try {
    const filters = readFilters(req);
    const role = req.staff?.role || null;

    const alerts = await listAlerts(filters);
    const filtered = filterAlertsForRole(alerts, role);

    return ok(res, {
      items: filtered,
      count: filtered.length,
      filters,
      role,
    });
  } catch (error) {
    return fail(res, error.message, error.statusCode || 500);
  }
}