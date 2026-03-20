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
import { requestStaffContext } from "./middleware/requestStaffContext.js";

import demoWalletRoutes from "./routes/demoWallet.js";
import aliasRoutes from "./routes/aliases.js";
import metricsRoutes from "./routes/metrics.js";

import { supabase } from "./lib/supabase.js";

export function createApp() {
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
  app.use(requestStaffContext);

  app.get("/health", (req, res) => {
    res.json({
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

  return app;
}

const app = createApp();
export default app;
