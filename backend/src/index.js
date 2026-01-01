import "dotenv/config";
import express from "express";
import cors from "cors";
import db from "./routes/db.js";
import handshake from "./routes/handshake.js";
import anomalyRoutes from "./routes/anomaly.js";
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
app.set("supabase", supabase);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
