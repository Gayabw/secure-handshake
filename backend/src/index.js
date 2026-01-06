import "dotenv/config";
import express from "express";
import cors from "cors";

import db from "./routes/db.js";
import handshake from "./routes/handshake.js";
import anomalyRoutes from "./routes/anomaly.js";
import behaviourRoutes from "./routes/behaviour.js";
import eventLogsRoutes from "./routes/eventLogs.js";
import replayAttacksRoutes from "./routes/replayAttacks.js";
import devRoutes from "./routes/dev.js";

import otpRoutes from "./routes/otpRoutes.js";
import { startOtpCleanupWorker } from "./workers/otpCleanupWorker.js";

import { supabase } from "./lib/supabase.js";

const app = express();
app.use(
  cors({
    origin: "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

app.options("/", cors());

app.use(express.json());

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "Secure Handshake Backend",
    time: new Date().toISOString(),
  });
});


app.use("/db", db);
app.use("/handshake", handshake);
app.use("/anomaly", anomalyRoutes);
app.use("/behaviour", behaviourRoutes);
app.use("/event-logs", eventLogsRoutes);
app.use("/replay-attacks", replayAttacksRoutes);
app.use("/dev", devRoutes);

app.use("/otp", otpRoutes);

// Make Supabase available via req.app.get("supabase")
app.set("supabase", supabase);

// Simple 404 for unknown routes
app.use((req, res) => {
  res.status(404).json({ ok: false, error: "Route not found" });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ ok: false, error: "Internal server error" });
});

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
