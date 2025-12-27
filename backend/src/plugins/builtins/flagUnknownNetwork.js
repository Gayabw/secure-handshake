// src/plugins/builtins/flagUnknownNetwork.js
import { PluginDecision } from "../pluginTypes.js";

/**
 * Non-blocking plugin: FLAGS unknown blockchain networks.
 * Never DENY, never throws.
 */
export const flagUnknownNetworkPlugin = {
  name: "flagUnknownNetwork",
  async run(context = {}) {
    const allowed = new Set([
      "ethereum-testnet",
      "bitcoin-testnet",
      "sepolia",
      "goerli",
    ]);

    // Your contexts: pre/post include request metadata, but the actual network
    // is inside the original request body (safe to read).
    const network =
      context?.blockchain_network ||
      context?.body?.blockchain_network ||
      null;

    if (!network) {
      return {
        decision: PluginDecision.FLAG,
        reason: "MISSING_BLOCKCHAIN_NETWORK",
        details: { observed: null, allowed: Array.from(allowed) },
      };
    }

    const normalized = String(network).toLowerCase();

    if (!allowed.has(normalized)) {
      return {
        decision: PluginDecision.FLAG,
        reason: "UNKNOWN_BLOCKCHAIN_NETWORK",
        details: { observed: network, allowed: Array.from(allowed) },
      };
    }

    return {
      decision: PluginDecision.ALLOW,
      reason: "NETWORK_OK",
      details: { observed: normalized },
    };
  },
};
