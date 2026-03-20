import crypto from "node:crypto";

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function makeNonce(prefix = "n") {
  return `${prefix}_${crypto.randomBytes(16).toString("hex")}`;
}

export async function httpJson(method, url, body, { timeoutMs = 8000 } = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text };
    }

    if (!res.ok) {
      const err = new Error(`HTTP ${res.status} ${res.statusText}`);
      err.status = res.status;
      err.payload = json;
      throw err;
    }

    return json;
  } catch (e) {
    if (e?.name === "AbortError") {
      const err = new Error(`HTTP timeout after ${timeoutMs}ms`);
      err.status = 408;
      err.payload = { url };
      throw err;
    }
    throw e;
  } finally {
    clearTimeout(t);
  }
}