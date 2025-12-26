// src/plugins/pluginTypes.js

export const PluginDecision = Object.freeze({
  ALLOW: "ALLOW",
  DENY: "DENY",
  FLAG: "FLAG",
});

/**
 * Expected plugin output:
 * {
 *   decision: "ALLOW" | "DENY" | "FLAG",
 *   reason: string,
 *   details?: object
 * }
 */

/**
 * Expected plugin shape:
 * {
 *   name: string,
 *   stage: "pre_handshake" | "post_handshake",
 *   run: async (context) => PluginResult
 * }
 */
