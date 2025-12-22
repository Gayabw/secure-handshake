import { supabase } from "../lib/supabase.js";
import { TABLES } from "../lib/tables.js";

/**
 * Check if a node (user + key) is allowed to participate in handshake
 */
export async function checkNodePolicy({
  user_id,
  user_key_id,
}) {
  const now = new Date().toISOString();

  /**
   * 1️⃣ HARD BLOCK: node_whitelist_blacklist
   */
  const { data: wbRows, error: wbErr } = await supabase
    .from("node_whitelist_blacklist")
    .select("*")
    .eq("subject_user_id", user_id)
    .eq("subject_user_key_id", user_key_id)
    .or(`expires_at.is.null,expires_at.gt.${now}`);

  if (wbErr) throw new Error(`Policy check failed (whitelist/blacklist)`);

  const activeWB = wbRows?.find(r => !r.expires_at || r.expires_at > now);

  if (activeWB) {
    if (activeWB.status === "BLACKLIST") {
      return {
        allowed: false,
        reason: "BLACKLISTED",
        source: "node_whitelist_blacklist",
      };
    }
    if (activeWB.status === "WHITELIST") {
      return {
        allowed: true,
        source: "node_whitelist_blacklist",
      };
    }
  }

  /**
   * 2️⃣ RULE-BASED BLOCK: access_list
   */
  const { data: accessRows, error: accessErr } = await supabase
    .from("access_list")
    .select("*")
    .eq("target_user_id", user_id)
    .eq("target_user_key_id", user_key_id)
    .eq("is_active", true)
    .lte("valid_from", now)
    .or(`valid_until.is.null,valid_until.gt.${now}`);

  if (accessErr) throw new Error(`Policy check failed (access_list)`);

  const denyRule = accessRows?.find(r => r.list_type === "DENY");
  if (denyRule) {
    return {
      allowed: false,
      reason: "ACCESS_DENIED",
      source: "access_list",
    };
  }

  const allowRule = accessRows?.find(r => r.list_type === "ALLOW");
  if (allowRule) {
    return {
      allowed: true,
      source: "access_list",
    };
  }

  /**
   * 3️⃣ Default allow
   */
  return { allowed: true, source: "default" };
}
