export const HARNESS = {
  baseUrl: process.env.HARNESS_BASE_URL || "http://localhost:4000",
  blockchain_network: process.env.HARNESS_BLOCKCHAIN_NETWORK || "sepolia",

  initiator: {
    user_id: Number(process.env.HARNESS_INIT_USER_ID || 1),
    user_key_id: Number(process.env.HARNESS_INIT_USER_KEY_ID || 1),
  },

  responder: {
    user_id: Number(process.env.HARNESS_RESP_USER_ID || 2),
    user_key_id: Number(process.env.HARNESS_RESP_USER_KEY_ID || 2),
  },

  normalCount: Number(process.env.HARNESS_NORMAL_COUNT || 5),
  normalDelayMs: Number(process.env.HARNESS_NORMAL_DELAY_MS || 800),

  replayAttempts: Number(process.env.HARNESS_REPLAY_ATTEMPTS || 6),

  burstCount: Number(process.env.HARNESS_BURST_COUNT || 15),
  burstDelayMs: Number(process.env.HARNESS_BURST_DELAY_MS || 600),

  maxRuntimeMs: Number(process.env.HARNESS_MAX_RUNTIME_MS || 10 * 60 * 1000),
};