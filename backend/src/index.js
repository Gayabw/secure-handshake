import "dotenv/config";
import app from "./app.js";
import { startOtpCleanupWorker } from "./workers/otpCleanupWorker.js";

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn("Missing Supabase env vars. DB calls will fail.");
  }
  if (!process.env.OTP_PEPPER) {
    console.warn("Missing OTP_PEPPER. OTP endpoints will fail until set.");
  }

  startOtpCleanupWorker();
  console.log(`Backend running on port ${PORT}`);
});
