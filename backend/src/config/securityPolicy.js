function readPositiveNumber(name, fallback) {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

export const SECURITY_POLICY = Object.freeze({
  replay: Object.freeze({
    auto_block_threshold: readPositiveNumber("REPLAY_AUTO_BLOCK_THRESHOLD", 3),
    block_duration_minutes: readPositiveNumber("REPLAY_BLOCK_DURATION_MINUTES", 60),
  }),
  anomaly: Object.freeze({
    auto_block_threshold: readPositiveNumber("ANOMALY_AUTO_BLOCK_THRESHOLD", 90),
    block_duration_minutes: readPositiveNumber("ANOMALY_BLOCK_DURATION_MINUTES", 30),
  }),
});