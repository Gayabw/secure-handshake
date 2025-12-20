import "dotenv/config";
import express from "express";
import cors from "cors";
import db from "./routes/db.js";
import handshake from "./routes/handshake.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "OK", service: "Secure Handshake Backend" });
});

app.use("/db", db);
app.use("/handshake", handshake);


const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
