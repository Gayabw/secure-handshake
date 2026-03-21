import "dotenv/config";
import express from "express";
import cors from "cors";

import db from "./routes/db.js";
import handshake from "./routes/handshake.js";
import monitoring from "./routes/monitoring.js";
import anomalyRoutes from "./routes/anomaly.js";
import behaviourRoutes from "./routes/behaviour.js";
import eventLogsRoutes from "./routes/eventLogs.js";
import replayAttacksRoutes from "./routes/replayAttacks.js";
import devRoutes from "./routes/dev.js";
import otpRoutes from "./routes/otpRoutes.js";
import demoWalletRoutes from "./routes/demoWallet.js";
import aliasRoutes from "./routes/aliases.js";
import metricsRoutes from "./routes/metrics.js";

import { requestStaffContext } from "./middleware/requestStaffContext.js";
import { supabase } from "./lib/supabase.js";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      credentials: true,
    })
  );

  app.use(express.json());
  app.use(requestStaffContext);

  app.set("supabase", supabase);

  app.get("/health", (_req, res) => {
    return res.status(200).json({
      ok: true,
      service: "Secure Handshake Backend",
      time: new Date().toISOString(),
    });
  });

  app.use("/db", db);
  app.use("/handshake", handshake);
  app.use("/", monitoring);
  app.use("/anomaly", anomalyRoutes);
  app.use("/behaviour", behaviourRoutes);
  app.use("/event-logs", eventLogsRoutes);
  app.use("/replay-attacks", replayAttacksRoutes);
  app.use("/dev", devRoutes);
  app.use("/demo", demoWalletRoutes);
  app.use("/", aliasRoutes);
  app.use("/metrics", metricsRoutes);
  app.use("/otp", otpRoutes);

  app.use((_req, res) => {
    return res.status(404).json({
      ok: false,
      error: "Route not found",
    });
  });

  app.use((err, _req, res, _next) => {
    console.error("Unhandled application error:", err);

    return res.status(500).json({
      ok: false,
      error: "Internal server error",
    });
  });

  return app;
}

const app = createApp();
export default app;