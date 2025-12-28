import { supabase } from "../lib/supabase.js";
import { TABLES } from "../lib/tables.js";

/*
  Check if a node (user + key) is allowed to participate in handshake
 
  Priority:
  1) node_whitelist_blacklist (hard allow/deny)
  2) access_list (rule-based allow/deny)
  3) default allow
 */
export async function checkNodePolicy({ user_id, user_key_id }) {
  const nowIso = new Date().toISOString();

  /*
    1️ HARD POLICY: node_whitelist_blacklist
    - Use latest ACTIVE rule (latest rule wins)
    - Active = expires_at is null OR expires_at > now
    - Status:
      - BLACKLIST => block
      - WHITELIST => allow
   */
  const { data: wbRows, error: wbErr } = await supabase
    .from(TABLES.NODE_WHITELIST_BLACKLIST)
    .select("*")
    .eq("subject_user_id", user_id)
    .eq("subject_user_key_id", user_key_id)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`);

  if (wbErr) throw new Error("Policy check failed (node_whitelist_blacklist).");

  // Latest active rule wins (deterministic)
  const activeWB = wbRows
    ?.filter((r) => !r.expires_at || r.expires_at > nowIso)
    ?.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];

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
    // If status is unknown, do NOT block by default; continue to access_list
  }

  /*
   2️ RULE-BASED POLICY: access_list
    Active rule = is_active=true AND valid_from <= now AND (valid_until is null OR > now)
    list_type:
    - DENY => block
    - ALLOW => allow
   */
  const { data: accessRows, error: accessErr } = await supabase
    .from(TABLES.ACCESS_LIST)
    .select("*")
    .eq("target_user_id", user_id)
    .eq("target_user_key_id", user_key_id)
    .eq("is_active", true)
    .lte("valid_from", nowIso)
    .or(`valid_until.is.null,valid_until.gt.${nowIso}`);

  if (accessErr) throw new Error("Policy check failed (access_list).");

  const denyRule = accessRows?.find((r) => r.list_type === "DENY");
  if (denyRule) {
    return {
      allowed: false,
      reason: "ACCESS_DENIED",
      source: "access_list",
    };
  }

  const allowRule = accessRows?.find((r) => r.list_type === "ALLOW");
  if (allowRule) {
    return {
      allowed: true,
      source: "access_list",
    };
  }

  /*
    3️ Default allow
   */
  return { allowed: true, source: "default" };
}
