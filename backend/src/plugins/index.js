
import { alwaysAllowPlugin } from "./builtins/alwaysAllow.js";
import { flagUnknownNetworkPlugin } from "./builtins/flagUnknownNetwork.js";
import { flagRepeatNoncePlugin } from "./builtins/flagRepeatNonce.js";
import { flagRapidHandshakeBurstPlugin } from "./builtins/flagRapidHandshakeBurst.js";
import { devForcePluginErrorPlugin } from "./builtins/devForcePluginError.js";


/*
 Stage-aware plugin registry (system-side).
 Keeps plugins independent from routes and allows safe expansion later.
 
  We keep `pre_handshake` and `post_handshake` explicit so logs clearly show which stage executed.
 */
export const PLUGINS_BY_STAGE = {
  pre_handshake: [
    alwaysAllowPlugin,
    flagUnknownNetworkPlugin,
    flagRepeatNoncePlugin,
    flagRapidHandshakeBurstPlugin,
    devForcePluginErrorPlugin,
  ],
  post_handshake: [
    alwaysAllowPlugin,
    flagUnknownNetworkPlugin,
    flagRepeatNoncePlugin,
    flagRapidHandshakeBurstPlugin,
    devForcePluginErrorPlugin,
  ],
};


/*
  Backward compatibility registry.
 */
export const PLUGINS = [
  alwaysAllowPlugin,
  flagUnknownNetworkPlugin,
  flagRepeatNoncePlugin,
  flagRapidHandshakeBurstPlugin,
  devForcePluginErrorPlugin, 
];

