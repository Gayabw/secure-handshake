

import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { TABLES } from "../lib/tables.js";

const router = Router();

// GET /dev/organizations
router.get("/organizations", async (req, res) => {
  const { data, error } = await supabase
    .from(TABLES.ORGANIZATIONS)
    .select("org_id, org_name, org_code, is_active")
    .order("org_name", { ascending: true });

  if (error) return res.status(500).json({ ok: false, error: error.message });
  return res.json({ ok: true, items: data ?? [] });
});

// GET /dev/staff-users
router.get("/staff-users", async (req, res) => {
  const { data, error } = await supabase
    .from(TABLES.STAFF_USERS)
    .select("staff_id, staff_name, staff_email, staff_role, status")
    .order("staff_name", { ascending: true });

  if (error) return res.status(500).json({ ok: false, error: error.message });
  return res.json({ ok: true, items: data ?? [] });
});

export default router;
