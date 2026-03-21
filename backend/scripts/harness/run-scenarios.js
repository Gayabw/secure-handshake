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

function shortErr(error) {
  const message =
    error?.payload?.error ||
    error?.payload?.message ||
    error?.message ||
    String(error);

  const code = error?.status ? String(error.status) : "";
  return code ? `${code} ${message}` : message;
}

async function withRetry(fn, { retries = 1, delayMs = 500 } = {}) {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === retries) break;
      await sleep(delayMs);
    }
  }

  throw lastError;
}

async function doOneHandshake({ kind, seq, tag }) {
  console.log(`[harness] ${kind} seq=${seq} initiate ->`);

  const initBody = buildInitiateBody({
    initiator: HARNESS.initiator,
    responder: HARNESS.responder,
    blockchain_network: HARNESS.blockchain_network,
    nonce_initiator: makeNonce("init"),
  });

  const initRes = await withRetry(
    () => postInitiate(HARNESS.baseUrl, initBody),
    { retries: 1, delayMs: 500 }
  );

  const handshake_id = extractHandshakeId(initRes);
  if (!handshake_id) {
    throw new Error("initiate did not return handshake.handshake_id");
  }

  console.log(`[harness] ${kind} seq=${seq} initiate <- handshake_id=${handshake_id}`);

  const respBody = buildRespondBody({
    handshake_id,
    responder: HARNESS.responder,
    responder_nonce: makeNonce("resp"),
  });

  respBody.meta = { scenario: tag, kind, seq };

  console.log(`[harness] ${kind} seq=${seq} respond -> handshake_id=${handshake_id}`);

  const respRes = await withRetry(
    () => postRespond(HARNESS.baseUrl, respBody),
    { retries: 1, delayMs: 500 }
  );

  console.log(`[harness] ${kind} seq=${seq} respond <- ok=${Boolean(respRes?.ok)}`);

  return { handshake_id };
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

    if (!handshake_id) {
      throw new Error("replay initiate missing handshake_id");
    }

    console.log(`[harness] replay seq=${i} initiate <- handshake_id=${handshake_id}`);
    console.log(`[harness] replay seq=${i} respond -> handshake_id=${handshake_id}`);

    const respBody = buildRespondBody({
      handshake_id,
      responder: HARNESS.responder,
      responder_nonce: reusedNonce,
    });

    respBody.meta = { scenario: tag, kind: "replay", seq: i };

    try {
      const out = await postRespond(HARNESS.baseUrl, respBody);
      console.log(`[harness] replay seq=${i} respond <- ok=${Boolean(out?.ok)}`);
    } catch (error) {
      console.log(`[replay] blocked seq=${i} ${shortErr(error)}`);
      if (error?.payload) {
        console.log("[replay] payload:", error.payload);
      }
    }

    await sleep(200);
  }
}

async function runBurst(tag) {
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
  if (!normal.length) {
    throw new Error("normal run produced zero handshakes");
  }

  await runReplay(tag);
  await runBurst(tag);

  const elapsed = Date.now() - started;
  console.log(`[harness] complete elapsed_ms=${elapsed}`);
  console.log(`[harness] use EXPORT_TAG=${tag} for clean dataset export`);
}

main().catch((error) => {
  console.error("[harness] failed:", error?.message || error);
  if (error?.payload) {
    console.error("[harness] payload:", error.payload);
  }
  process.exitCode = 1;
});