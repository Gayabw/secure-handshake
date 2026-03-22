import express from "express";
import { supabase } from "../lib/supabase.js";

const router = express.Router();

const roleRedirectMap = {
  ADMIN: "/dashboard/network-admin",
  SOC: "/dashboard/soc-analyst",
  ENGINEER: "/dashboard/security-engineer",
  IR: "/dashboard/incident-responder",
  AUDITOR: "/dashboard/auditor",
};

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        ok: false,
        error: "Email and password are required",
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const { data: staffUser, error } = await supabase
      .from("staff_users")
      .select(
        "staff_id, staff_name, staff_email, password_hash, status, staff_role"
      )
      .eq("staff_email", normalizedEmail)
      .maybeSingle();

    if (error) {
      return res.status(500).json({
        ok: false,
        error: "Failed to query staff user",
        details: error.message,
      });
    }

    if (!staffUser) {
      return res.status(401).json({
        ok: false,
        error: "Invalid email or password",
      });
    }

    if (staffUser.status !== "ACTIVE") {
      return res.status(403).json({
        ok: false,
        error: "User account is not active",
      });
    }

    if (staffUser.password_hash !== password) {
      return res.status(401).json({
        ok: false,
        error: "Invalid email or password",
      });
    }

    return res.status(200).json({
      ok: true,
      message: "Login successful",
      user: {
        staff_id: staffUser.staff_id,
        staff_name: staffUser.staff_name,
        staff_email: staffUser.staff_email,
        staff_role: staffUser.staff_role,
        status: staffUser.status,
        redirect: roleRedirectMap[staffUser.staff_role] || "/",
      },
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: "Internal server error",
      details: error.message,
    });
  }
});

export default router;