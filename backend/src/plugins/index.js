// src/plugins/index.js
import { alwaysAllowPlugin } from "./builtins/alwaysAllow.js";

/**
 * Stage-aware plugin registry (system-side).
 * This keeps plugins independent from routes and allows safe expansion later.
 *
 * IMPORTANT: We keep `pre_handshake` and `post_handshake` explicit
 * so logs clearly show which stage executed.
 */
export const PLUGINS_BY_STAGE = {
  pre_handshake: [alwaysAllowPlugin],
  post_handshake: [alwaysAllowPlugin],
};

// Backward compatibility (if pluginRunner still imports PLUGINS)
export const PLUGINS = [
  ...PLUGINS_BY_STAGE.pre_handshake,
  ...PLUGINS_BY_STAGE.post_handshake,
];
