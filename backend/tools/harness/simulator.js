
import { httpJson } from "./http.js";

export async function postInitiate(baseUrl, body) {
  return httpJson("POST", `${baseUrl}/handshake/initiate`, body, { timeoutMs: 25000 });
}

export async function postRespond(baseUrl, body) {
  return httpJson("POST", `${baseUrl}/handshake/respond`, body, { timeoutMs: 45000 });
}

export function buildInitiateBody({ initiator, responder, blockchain_network, nonce_initiator }) {
  return {
    initiator_user_id: initiator.user_id,
    initiator_user_key_id: initiator.user_key_id,
    responder_user_id: responder.user_id,
    responder_user_key_id: responder.user_key_id,
    blockchain_network,
    nonce_initiator: nonce_initiator ?? null,
  };
}

export function buildRespondBody({ handshake_id, responder, responder_nonce }) {
  return {
    handshake_id,
    responder_user_id: responder.user_id,
    responder_user_key_id: responder.user_key_id,
    responder_nonce,
  };
}

export function extractHandshakeId(initRes) {
  const id = Number(initRes?.handshake?.handshake_id);
  if (!Number.isFinite(id) || id <= 0) return null;
  return id;
}