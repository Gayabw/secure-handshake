import crypto from "node:crypto";

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function makeNonce(prefix = "n") {
  return `${prefix}_${crypto.randomBytes(16).toString("hex")}`;
}

export async function httpJson(method, url, body, { timeoutMs = 8000, headers = {} } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method,
      headers: {
        "content-type": "application/json",
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const text = await response.text();
    let json = null;

    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text };
    }

    if (!response.ok) {
      const error = new Error(`HTTP ${response.status} ${response.statusText}`);
      error.status = response.status;
      error.payload = json;
      throw error;
    }

    return json;
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error(`HTTP timeout after ${timeoutMs}ms`);
      timeoutError.status = 408;
      timeoutError.payload = { url };
      throw timeoutError;
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}