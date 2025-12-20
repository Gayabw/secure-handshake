import { supabase } from "../lib/supabase.js";
import { TABLES } from "../lib/tables.js";

// just for auditing and the dashboard viewings.
export async function nonceExists(nonce) {
  const { data, error } = await supabase
    .from(TABLES.NONCE_CACHE)
    .select("nonce_id")
    .eq("nonce", nonce)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Nonce check failed: ${error.message}`);
  return !!data;
}

export async function reserveNonce({
  nonce,
  handshake_id = null,
  subject_user_id = null,
  subject_user_key_id = null,
  first_seen_at,
  expires_at,
}) {
  const now = new Date().toISOString();

  const payload = {
    nonce,
    handshake_id,
    subject_user_id,
    subject_user_key_id,
    first_seen_at,
    expires_at,
    created_at: now,
  };

  const { data, error } = await supabase
    .from(TABLES.NONCE_CACHE)
    .insert(payload)
    .select("nonce_id, nonce, first_seen_at, expires_at")
    .single();

  // 23505 = unique violation => nonce already exists => replay
  if (error?.code === "23505") return { ok: false, code: "NONCE_ALREADY_USED" };
  if (error) throw new Error(`Nonce reserve failed: ${error.message}`);

  return { ok: true, nonce_row: data };
}

export async function linkNonceToHandshake({ nonce, handshake_id }) {
  const { data, error } = await supabase
    .from(TABLES.NONCE_CACHE)
    .update({ handshake_id })
    .eq("nonce", nonce)
    .select("nonce_id, nonce, handshake_id")
    .maybeSingle();

  if (error) throw new Error(`Link nonce to handshake failed: ${error.message}`);
  return data;
}
