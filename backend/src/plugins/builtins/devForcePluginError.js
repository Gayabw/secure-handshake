export const devForcePluginErrorPlugin = {
  name: "devForcePluginError",
  version: "1.0.0",
  description: "Dev-only plugin to prove isolation (forces PLUGIN_ERROR when requested).",
  async run(ctx) {
    if (process.env.NODE_ENV === "production") return { decision: "ALLOW", reason: "PROD_SKIP" };

    const flag = Boolean(ctx?.debug?.force_plugin_error);
    if (!flag) return { decision: "ALLOW", reason: "NO_FLAG" };

    throw new Error("DEV_FORCED_PLUGIN_ERROR");
  },
};
