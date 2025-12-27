// src/plugins/builtins/alwaysAllow.js
import { PluginDecision } from "../pluginTypes.js";

export const alwaysAllowPlugin = {
  name: "builtin_always_allow",
  stage: "pre_handshake",
  run: async (context) => {
    return {
      decision: PluginDecision.ALLOW,
      reason: "OK",
      details: {
        note: "Baseline plugin - always allows",
        context_keys: Object.keys(context || {}),
      },
    };
  },
};
