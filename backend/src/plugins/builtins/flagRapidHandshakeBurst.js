
import { PluginDecision } from "../pluginTypes.js";
import { supabase } from "../../lib/supabase.js";
import { TABLES } from "../../lib/tables.js";

/*
 Flags if too many handshake requests come from the same IP in a short window.
 Uses event_logs evidence.
 FAIL-SAFE: on DB issues, returns FLAG.
 */
export const flagRapidHandshakeBurstPlugin = {
  name: "flagRapidHandshakeBurst",
  async run(context = {}) {
    const ip = context?.ip_address || null;
    const stage = context?.stage;

    if (!ip) {
      return {
        decision: PluginDecision.ALLOW,
        reason: "NO_IP_AVAILABLE",
        details: { stage },
      };
    }

    
    const WINDOW_SECONDS = 60;
    const FLAG_THRESHOLD = 10;

    const since = new Date(Date.now() - WINDOW_SECONDS * 1000).toISOString();

    try {
      // Count plugin framework executions for this IP recently
      // Avoids needing to know every handshake event_type.
      const { count, error } = await supabase
        .from(TABLES.LOGS)
        .select("event_log_id", { count: "exact", head: true })
        .eq("ip_address", ip)
        .eq("event_source", "plugin_framework")
        .gte("event_time", since);

      if (error) {
        return {
          decision: PluginDecision.FLAG,
          reason: "EVENT_LOG_LOOKUP_ERROR",
          details: { message: error.message, ip, since, window_seconds: WINDOW_SECONDS },
        };
      }

      if ((count ?? 0) >= FLAG_THRESHOLD) {
        return {
          decision: PluginDecision.FLAG,
          reason: "RAPID_HANDSHAKE_BURST_BY_IP",
          details: {
            ip,
            recent_count: count ?? 0,
            since,
            window_seconds: WINDOW_SECONDS,
            threshold: FLAG_THRESHOLD,
          },
        };
      }

      return {
        decision: PluginDecision.ALLOW,
        reason: "RATE_OK",
        details: { ip, recent_count: count ?? 0, since, window_seconds: WINDOW_SECONDS },
      };
    } catch (e) {
      return {
        decision: PluginDecision.FLAG,
        reason: "PLUGIN_EXCEPTION",
        details: { message: e?.message || String(e), ip },
      };
    }
  },
};
