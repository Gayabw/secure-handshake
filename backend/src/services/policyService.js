import { supabase } from "../lib/supabase.js";
import { TABLES } from "../lib/tables.js";

/*
  Check if a node (user + key) is allowed to participate in handshake

  Priority:
  1) node_whitelist_blacklist (hard allow/deny)
  2) access_list (rule-based allow/deny)
  3) default allow

  Standardized rule values:
  - node_whitelist_blacklist.status:
      BLACKLISTED => block
      WHITELISTED => allow

  - access_list.list_type:
      BLOCK => block
      ALLOW => allow

  Rule evaluation:
  - only active and currently valid rows are considered
  - latest rule wins
*/

function nowIso() {
  return new Date().toISOString();
}

function sortNewestFirst(rows = []) {
  return [...rows].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export async function checkNodePolicy({ user_id, user_key_id }) {
  const currentTime = nowIso();

  /*
    1) HARD POLICY: node_whitelist_blacklist
    Active row:
    - expires_at is null OR expires_at > now
    Latest active row wins
  */
  const { data: wbRows, error: wbErr } = await supabase
    .from(TABLES.NODE_WHITELIST_BLACKLIST)
    .select("*")
    .eq("subject_user_id", Number(user_id))
    .eq("subject_user_key_id", Number(user_key_id))
    .or(`expires_at.is.null,expires_at.gt.${currentTime}`);

  if (wbErr) {
    throw new Error(`Policy check failed (node_whitelist_blacklist): ${wbErr.message}`);
  }

  const activeWBRows = sortNewestFirst(
    (wbRows || []).filter((row) => {
      return !row.expires_at || row.expires_at > currentTime;
    })
  );

  const latestWB = activeWBRows[0] || null;

  if (latestWB) {
    const status = String(latestWB.status || "").toUpperCase();

    if (status === "BLACKLISTED" || status === "BLACKLIST") {
      return {
        allowed: false,
        reason: latestWB.reason || "BLACKLISTED",
        source: "node_whitelist_blacklist",
        policy: latestWB,
      };
    }

    if (status === "WHITELISTED" || status === "WHITELIST") {
      return {
        allowed: true,
        reason: latestWB.reason || null,
        source: "node_whitelist_blacklist",
        policy: latestWB,
      };
    }
  }

  /*
    2) RULE-BASED POLICY: access_list
    Active row:
    - is_active = true
    - valid_from <= now
    - valid_until is null OR valid_until > now
    Latest active row wins
  */
  const { data: accessRows, error: accessErr } = await supabase
    .from(TABLES.ACCESS_LIST)
    .select("*")
    .eq("target_user_id", Number(user_id))
    .eq("target_user_key_id", Number(user_key_id))
    .eq("is_active", true)
    .lte("valid_from", currentTime)
    .or(`valid_until.is.null,valid_until.gt.${currentTime}`);

  if (accessErr) {
    throw new Error(`Policy check failed (access_list): ${accessErr.message}`);
  }

  const activeAccessRows = sortNewestFirst(accessRows || []);
  const latestAccessRule = activeAccessRows[0] || null;

  if (latestAccessRule) {
    const listType = String(latestAccessRule.list_type || "").toUpperCase();

    if (listType === "BLOCK") {
      return {
        allowed: false,
        reason: latestAccessRule.reason || "BLOCKED_BY_ACCESS_LIST",
        source: "access_list",
        policy: latestAccessRule,
      };
    }

    if (listType === "ALLOW") {
      return {
        allowed: true,
        reason: latestAccessRule.reason || null,
        source: "access_list",
        policy: latestAccessRule,
      };
    }
  }

  /*
    3) Default allow
  */
  return {
    allowed: true,
    reason: null,
    source: "default",
    policy: null,
  };
}