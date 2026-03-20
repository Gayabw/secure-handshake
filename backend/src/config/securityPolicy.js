export const SECURITY_POLICY = Object.freeze({
  replay: {
    auto_block_threshold: Number(process.env.REPLAY_AUTO_BLOCK_THRESHOLD || 3),
    block_duration_minutes: Number(process.env.REPLAY_BLOCK_DURATION_MINUTES || 60),
  },
  anomaly: {
    auto_block_threshold: Number(process.env.ANOMALY_AUTO_BLOCK_THRESHOLD || 90),
    block_duration_minutes: Number(process.env.ANOMALY_BLOCK_DURATION_MINUTES || 30),
  },
});