import axios from "axios";

function getAuthHeaders() {
  const raw = localStorage.getItem("authUser");
  const user = raw ? JSON.parse(raw) : null;

  return {
    "Content-Type": "application/json",
    "x-staff-id": user?.staff_id?.toString() || "",
    "x-staff-role": user?.staff_role || "",
    "x-staff-email": user?.staff_email || "",
  };
}

const dashboardApi = axios.create({
  baseURL: "http://localhost:4000",
});

export function extractItems(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  if (Array.isArray(payload?.rows)) return payload.rows;
  return [];
}

export async function fetchMetricsOverview(orgId?: number) {
  const params: Record<string, number> = {};

  if (orgId) {
    params.org_id = orgId;
  }

  const response = await dashboardApi.get("/metrics/overview", {
    params,
    headers: getAuthHeaders(),
  });

  return response.data;
}

export async function fetchEventLogs(orgId?: number, limit = 50) {
  const params: Record<string, number> = { limit };

  if (orgId) {
    params.org_id = orgId;
  }

  const response = await dashboardApi.get("/event-logs", {
    params,
    headers: getAuthHeaders(),
  });

  return response.data;
}

export async function fetchAnomalies(orgId?: number, limit = 50) {
  const params: Record<string, number> = { limit };

  if (orgId) {
    params.org_id = orgId;
  }

  const response = await dashboardApi.get("/anomaly/list", {
    params,
    headers: getAuthHeaders(),
  });

  return response.data;
}

export async function fetchReplayAttacks(orgId?: number, limit = 50) {
  const params: Record<string, number> = { limit };

  if (orgId) {
    params.org_id = orgId;
  }

  const response = await dashboardApi.get("/replay-attacks", {
    params,
    headers: getAuthHeaders(),
  });

  return response.data;
}

export async function fetchHandshakes24h(orgId?: number, limit = 50) {
  const params: Record<string, number> = {
    limit,
    hours: 24,
  };

  if (orgId) {
    params.org_id = orgId;
  }

  const response = await dashboardApi.get("/handshake", {
    params,
    headers: getAuthHeaders(),
  });

  return response.data;
}

export async function fetchHandshakeById(handshakeId: number) {
  const response = await dashboardApi.get(`/handshake/${handshakeId}`, {
    headers: getAuthHeaders(),
  });

  return response.data;
}

export async function fetchAnomalyById(anomalyId: string | number) {
  const response = await dashboardApi.get(`/anomaly/${anomalyId}`, {
    headers: getAuthHeaders(),
  });

  return response.data;
}

export async function fetchBehaviorProfiles(limit = 100) {
  const response = await dashboardApi.get("/behaviour/profiles", {
    params: { limit },
    headers: getAuthHeaders(),
  });

  return response.data;
}

export async function fetchSecurityEvents(limit = 100) {
  const response = await dashboardApi.get("/security-events", {
    params: { limit },
    headers: getAuthHeaders(),
  });

  return response.data;
}