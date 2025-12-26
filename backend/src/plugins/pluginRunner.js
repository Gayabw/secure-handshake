// src/plugins/pluginRunner.js
import { PLUGINS } from "./index.js";
import { PluginDecision } from "./pluginTypes.js";
import { writeLog } from "../services/logService.js";

/**
 * Runs plugins for a given stage.
 * Fail-safe: never throws.
 *
 * @param {object} params
 * @param {"pre_handshake" | "post_handshake"} params.stage
 * @param {object} params.context - plugin context (handshake/user/node metadata etc.)
 * @param {object} params.logContext - optional IDs for event_logs linkage
 * @param {number|null} params.logContext.handshake_id
 * @param {number|null} params.logContext.anomaly_id
 * @param {number|null} params.logContext.subject_user_id
 * @param {number|null} params.logContext.subject_user_key_id
 * @param {string|null} params.logContext.ip_address
 */
export async function runPlugins({
  stage,
  context = {},
  logContext = {},
}) {
  const results = [];

  const stagePlugins = PLUGINS.filter((p) => p?.stage === stage);

  for (const plugin of stagePlugins) {
    const startedAt = new Date().toISOString();

    try {
      const out = await plugin.run(context);

      const decision = out?.decision || PluginDecision.FLAG;
      const reason = out?.reason || "NO_REASON";

      const result = {
        plugin_name: plugin.name,
        stage,
        decision,
        reason,
        details: out?.details ?? null,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
      };

      results.push(result);

      // Store in event_logs (schema already exists; details is jsonb)
      await writeLog({
        event_source: "plugin_framework",
        event_type: "PLUGIN_EXECUTED",
        log_level: decision === PluginDecision.DENY ? "WARN" : "INFO",
        handshake_id: logContext.handshake_id ?? null,
        anomaly_id: logContext.anomaly_id ?? null,
        subject_user_id: logContext.subject_user_id ?? null,
        subject_user_key_id: logContext.subject_user_key_id ?? null,
        ip_address: logContext.ip_address ?? null,
        details: result,
      });
    } catch (err) {
      const result = {
        plugin_name: plugin?.name || "unknown_plugin",
        stage,
        decision: PluginDecision.FLAG, // fail-safe: do NOT deny on plugin failure
        reason: "PLUGIN_ERROR",
        details: {
          message: err?.message || String(err),
        },
        started_at: startedAt,
        finished_at: new Date().toISOString(),
      };

      results.push(result);

      await writeLog({
        event_source: "plugin_framework",
        event_type: "PLUGIN_ERROR",
        log_level: "ERROR",
        handshake_id: logContext.handshake_id ?? null,
        anomaly_id: logContext.anomaly_id ?? null,
        subject_user_id: logContext.subject_user_id ?? null,
        subject_user_key_id: logContext.subject_user_key_id ?? null,
        ip_address: logContext.ip_address ?? null,
        details: result,
      });

      // continue to next plugin (never break)
    }
  }

  // Aggregate decision (system-side policy for now):
  // - any DENY => DENY
  // - else any FLAG => FLAG
  // - else ALLOW
  const overall =
    results.some((r) => r.decision === PluginDecision.DENY)
      ? PluginDecision.DENY
      : results.some((r) => r.decision === PluginDecision.FLAG)
        ? PluginDecision.FLAG
        : PluginDecision.ALLOW;

  return {
    stage,
    overall_decision: overall,
    results,
  };
}
