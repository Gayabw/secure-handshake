import { supabase } from "../lib/supabase.js";

function parseLimit(limit) {
  const value = Number(limit);

  if (!Number.isFinite(value) || value <= 0) {
    return 50;
  }

  return Math.min(value, 200);
}

function applyHandshakeFilters(query, filters = {}) {
  const { blockchain_network, status, limit } = filters;

  if (blockchain_network) {
    query = query.eq("blockchain_network", blockchain_network);
  }

  if (status) {
    query = query.eq("status", status);
  }

  return query.limit(parseLimit(limit));
}

function applyAnomalyFilters(query, filters = {}) {
  const { org_id, user_id, user_key_id, handshake_id, status, severity, limit } = filters;

  if (org_id !== undefined && org_id !== "") {
    query = query.eq("org_id", Number(org_id));
  }

  if (user_id !== undefined && user_id !== "") {
    query = query.eq("subject_user_id", Number(user_id));
  }

  if (user_key_id !== undefined && user_key_id !== "") {
    query = query.eq("subject_user_key_id", Number(user_key_id));
  }

  if (handshake_id !== undefined && handshake_id !== "") {
    query = query.contains("details", { handshake_id: Number(handshake_id) });
  }

  if (status) {
    query = query.eq("status", status);
  }

  if (severity) {
    query = query.eq("severity", severity);
  }

  return query.limit(parseLimit(limit));
}

function applyReplayFilters(query, filters = {}) {
  const { org_id, handshake_id, limit } = filters;

  if (org_id !== undefined && org_id !== "") {
    query = query.eq("org_id", Number(org_id));
  }

  if (handshake_id !== undefined && handshake_id !== "") {
    query = query.eq("handshake_id", Number(handshake_id));
  }

  return query.limit(parseLimit(limit));
}

export async function listHandshakes(filters = {}) {
  let query = supabase
    .from("handshakes")
    .select("*")
    .order("handshake_id", { ascending: false });

  query = applyHandshakeFilters(query, filters);

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch handshakes: ${error.message}`);
  }

  return data || [];
}

export async function listAnomalies(filters = {}) {
  let query = supabase
    .from("anomalies")
    .select("*")
    .order("detected_at", { ascending: false });

  query = applyAnomalyFilters(query, filters);

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch anomalies: ${error.message}`);
  }

  return data || [];
}

export async function listReplayAttacks(filters = {}) {
  let query = supabase
    .from("replay_attacks")
    .select("*")
    .order("replay_attack_id", { ascending: false });

  query = applyReplayFilters(query, filters);

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch replay attacks: ${error.message}`);
  }

  return data || [];
}

export async function listAlerts(filters = {}) {
  const [anomalies, replayAttacks] = await Promise.all([
    listAnomalies(filters),
    listReplayAttacks(filters),
  ]);

  const anomalyAlerts = anomalies.map((item) => ({
    alert_type: "anomaly",
    source_table: "anomalies",
    source_id: item.anomaly_id ?? null,
    created_at: item.detected_at ?? null,
    severity: item.severity ?? "medium",
    handshake_id: item.details?.handshake_id ?? null,
    org_id: item.org_id ?? null,
    user_id: item.subject_user_id ?? null,
    user_key_id: item.subject_user_key_id ?? null,
    title: "Anomaly detected",
    raw: item,
  }));

  const replayAlerts = replayAttacks.map((item) => ({
    alert_type: "replay_attack",
    source_table: "replay_attacks",
    source_id: item.replay_attack_id ?? item.id ?? null,
    created_at: item.created_at ?? item.detected_at ?? item.event_time ?? null,
    severity: item.severity ?? "high",
    handshake_id: item.handshake_id ?? null,
    org_id: item.org_id ?? null,
    user_id: item.user_id ?? null,
    user_key_id: item.user_key_id ?? null,
    title: "Replay attack detected",
    raw: item,
  }));

  return [...anomalyAlerts, ...replayAlerts].sort((a, b) => {
    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;

    if (aTime !== bTime) {
      return bTime - aTime;
    }

    const aId = Number(a.source_id) || 0;
    const bId = Number(b.source_id) || 0;
    return bId - aId;
  });
}