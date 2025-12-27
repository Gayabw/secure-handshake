
import { PluginDecision } from "../pluginTypes.js";
import { supabase } from "../../lib/supabase.js";
import { TABLES } from "../../lib/tables.js";

/**
 * Flags if a nonce was seen recently too many times.
 * FAIL-SAFE: if DB fails, returns FLAG with PLUGIN_ERROR .
 */
export const flagRepeatNoncePlugin = {
  name: "flagRepeatNonce",
  async run(context = {}) {
    const stage = context?.stage;

    
    const nonce =
      context?.nonce ||
      context?.nonce_initiator ||
      context?.responder_nonce ||
      context?.body?.nonce_initiator ||
      context?.body?.responder_nonce ||
      null;

    if (!nonce) {
      return {
        decision: PluginDecision.ALLOW,
        reason: "NO_NONCE_IN_CONTEXT",
        details: { stage },
      };
    }

    
    const WINDOW_MINUTES = 30;
    const FLAG_THRESHOLD = 2; // seen >=2 times recently => suspicious

    const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();

    try {

      let query = supabase
        .from(TABLES.NONCE_CACHE)
        .select("nonce", { count: "exact", head: true })
        .eq("nonce", nonce)
        .gte("first_seen_at", since);

      let { count, error } = await query;

      if (error) {
        
        const fallback = await supabase
          .from(TABLES.NONCE_CACHE)
          .select("nonce", { count: "exact", head: true })
          .eq("nonce", nonce)
          .gte("created_at", since);

        count = fallback.count;
        error = fallback.error;
      }

      if (error) {
        return {
          decision: PluginDecision.FLAG,
          reason: "NONCE_LOOKUP_ERROR",
          details: { message: error.message, nonce, since, window_minutes: WINDOW_MINUTES },
        };
      }

      if ((count ?? 0) >= FLAG_THRESHOLD) {
        return {
          decision: PluginDecision.FLAG,
          reason: "NONCE_SEEN_RECENTLY_MULTIPLE_TIMES",
          details: {
            nonce,
            recent_count: count ?? 0,
            since,
            window_minutes: WINDOW_MINUTES,
            threshold: FLAG_THRESHOLD,
          },
        };
      }

      return {
        decision: PluginDecision.ALLOW,
        reason: "NONCE_OK",
        details: { nonce, recent_count: count ?? 0, since, window_minutes: WINDOW_MINUTES },
      };
    } catch (e) {
      return {
        decision: PluginDecision.FLAG,
        reason: "PLUGIN_EXCEPTION",
        details: { message: e?.message || String(e), nonce },
      };
    }
  },
};
