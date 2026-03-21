function numEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

export const HARNESS = {
  baseUrl: process.env.HARNESS_BASE_URL || "http://localhost:4000",
  blockchain_network: process.env.HARNESS_BLOCKCHAIN_NETWORK || "sepolia",

  initiator: {
    user_id: numEnv("HARNESS_INIT_USER_ID", 1),
    user_key_id: numEnv("HARNESS_INIT_USER_KEY_ID", 1),
  },

  responder: {
    user_id: numEnv("HARNESS_RESP_USER_ID", 2),
    user_key_id: numEnv("HARNESS_RESP_USER_KEY_ID", 2),
  },

  normalCount: numEnv("HARNESS_NORMAL_COUNT", 5),
  normalDelayMs: numEnv("HARNESS_NORMAL_DELAY_MS", 800),

  replayAttempts: numEnv("HARNESS_REPLAY_ATTEMPTS", 6),

  burstCount: numEnv("HARNESS_BURST_COUNT", 15),
  burstDelayMs: numEnv("HARNESS_BURST_DELAY_MS", 600),

  maxRuntimeMs: numEnv("HARNESS_MAX_RUNTIME_MS", 10 * 60 * 1000),
};