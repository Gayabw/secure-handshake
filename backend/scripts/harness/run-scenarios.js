
import { HARNESS } from "./config.js";
import { sleep, makeNonce } from "../../tools/harness/http.js";
import {
  postInitiate,
  postRespond,
  buildInitiateBody,
  buildRespondBody,
  extractHandshakeId,
} from "../../tools/harness/simulator.js";

function assertNotProd() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("harness disabled in production");
  }
}

function shortErr(e) {
  const msg = e?.payload?.error || e?.payload?.message || e?.message || String(e);
  const code = e?.status ? String(e.status) : "";
  return code ? `${code} ${msg}` : msg;
}

async function doOneHandshake({ kind, seq, tag }) {
  console.log(`[harness] ${kind} seq=${seq} initiate ->`);

  const initBody = buildInitiateBody({
    initiator: HARNESS.initiator,
    responder: HARNESS.responder,
    blockchain_network: HARNESS.blockchain_network,
    nonce_initiator: makeNonce("init"),
  });

  async function withRetry(fn, { retries = 1, delayMs = 500 } = {}) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i === retries) break;
      await sleep(delayMs);
    }
  }
  throw lastErr;
}

  // Optional: allow controlled plugin test paths if your code supports debug hooks.
  // initBody.debug = { force_plugin_error: true };

  const initRes = await postInitiate(HARNESS.baseUrl, initBody);
  const handshake_id = extractHandshakeId(initRes);

  if (!handshake_id) {
    throw new Error("initiate did not return handshake.handshake_id");
  }

  console.log(`[harness] ${kind} seq=${seq} initiate <- handshake_id=${handshake_id}`);

  const responder_nonce = makeNonce("resp");

  const respBody = buildRespondBody({
    handshake_id,
    responder: HARNESS.responder,
    responder_nonce,
  });

  // Extra field; route ignores unknown keys. Useful if plugins/loggers read body keys.
  respBody.meta = { scenario: tag, kind, seq };

  console.log(`[harness] ${kind} seq=${seq} respond -> handshake_id=${handshake_id}`);
  const respRes = await postRespond(HARNESS.baseUrl, respBody);

  console.log(`[harness] ${kind} seq=${seq} respond <- ok=${Boolean(respRes?.ok)}`);

  return { handshake_id, responder_nonce };
}

async function runNormal(tag) {
  const completed = [];

  for (let i = 1; i <= HARNESS.normalCount; i++) {
    completed.push(await doOneHandshake({ kind: "normal", seq: i, tag }));
    await sleep(HARNESS.normalDelayMs);
  }

  return completed;
}

async function runReplay(tag) {
  // Reuse a captured responder nonce across new handshakes.
  // This avoids "COMPLETED state" and hits nonce reuse detection properly.
  const reusedNonce = makeNonce("replay");

  console.log(`[harness] replay nonce=${reusedNonce}`);

  for (let i = 1; i <= HARNESS.replayAttempts; i++) {
    console.log(`[harness] replay seq=${i} initiate ->`);

    const initBody = buildInitiateBody({
      initiator: HARNESS.initiator,
      responder: HARNESS.responder,
      blockchain_network: HARNESS.blockchain_network,
      nonce_initiator: makeNonce("init"),
    });

    const initRes = await postInitiate(HARNESS.baseUrl, initBody);
    const handshake_id = extractHandshakeId(initRes);
    if (!handshake_id) throw new Error("replay initiate missing handshake_id");

    console.log(`[harness] replay seq=${i} initiate <- handshake_id=${handshake_id}`);
    console.log(`[harness] replay seq=${i} respond -> handshake_id=${handshake_id}`);

    const respBody = buildRespondBody({
      handshake_id,
      responder: HARNESS.responder,
      responder_nonce: reusedNonce, // intentional nonce reuse
    });

    respBody.meta = { scenario: tag, kind: "replay", seq: i };

    try {
      const out = await postRespond(HARNESS.baseUrl, respBody);
      console.log(`[harness] replay seq=${i} respond <- ok=${Boolean(out?.ok)}`);
    } catch (e) {
      console.log(`[replay] blocked seq=${i} ${shortErr(e)}`);
      if (e?.payload) console.log("[replay] payload:", e.payload);
    }

    await sleep(200);
  }
}

async function runBurst(tag) {
  // Burst: repeated handshakes quickly to trigger burst plugin evidence.
  for (let i = 1; i <= HARNESS.burstCount; i++) {
    await doOneHandshake({ kind: "burst", seq: i, tag });
    await sleep(HARNESS.burstDelayMs);
  }
}

async function main() {
  assertNotProd();

  const started = Date.now();
  const tag = `phaseJ_${new Date().toISOString()}`;

  console.log(`[harness] baseUrl=${HARNESS.baseUrl}`);
  console.log(`[harness] network=${HARNESS.blockchain_network}`);
  console.log(`[harness] tag=${tag}`);

  const normal = await runNormal(tag);
  if (!normal.length) throw new Error("normal run produced zero handshakes");

  await runReplay(tag);
  await runBurst(tag);

  const elapsed = Date.now() - started;
  console.log(`[harness] complete elapsed_ms=${elapsed}`);
  console.log(`[harness] use EXPORT_TAG=${tag} for clean dataset export`);
}

main().catch((e) => {
  console.error("[harness] failed:", e?.message || e);
  if (e?.payload) console.error("[harness] payload:", e.payload);
  process.exitCode = 1;
});