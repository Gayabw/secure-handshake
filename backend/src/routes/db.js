import { Router } from "express";
import { supabase } from "../lib/supabase.js";

const router = Router();

// This endpoint only checks if backend can talk to Supabase
router.get("/ping", async (req, res) => {
  try {
    // Replace "users" with a table you definitely have
    const { data, error } = await supabase.from("users").select("user_id").limit(1);

    if (error) {
      return res.status(500).json({ ok: false, where: "supabase", error: error.message });
    }

    res.json({ ok: true, message: "Supabase connected", sample: data });
  } catch (e) {
    res.status(500).json({ ok: false, where: "server", error: String(e) });
  }
});

export default router;
