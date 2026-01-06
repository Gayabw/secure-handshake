
import { cleanupExpiredOtpSessions } from "../services/otpService.js";

export function startOtpCleanupWorker() {
  const enabled = String(process.env.OTP_CLEANUP_ENABLED || "false") === "true";
  if (!enabled) return;

  const everySec = Number(process.env.OTP_CLEANUP_INTERVAL_SECONDS || 120);
  const everyMs = Math.max(30, everySec) * 1000;

  setInterval(async () => {
    try {
      await cleanupExpiredOtpSessions();
    } catch (_) {
      // keep quiet in demo mode
    }
  }, everyMs);
}
