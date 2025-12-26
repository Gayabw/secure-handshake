// src/plugins/index.js
import { alwaysAllowPlugin } from "./builtins/alwaysAllow.js";

/**
 * Registry (system-side).
 * Add new plugins here later without touching handshake code.
 */
export const PLUGINS = [
  alwaysAllowPlugin,
];
