import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { supabase } from "../../src/lib/supabase.js";
import { TABLES } from "../../src/lib/tables.js";

const OUT_DIR = path.resolve(process.cwd(), "exports");
fs.mkdirSync(OUT_DIR, { recursive: true });

const PAGE_SIZE = 1000;
const DEFAULT_LIMIT = 20000;

function parsePositiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function csvEscape(value) {
  if (value === null || value === undefined) return "";

  const text = String(value);
  if (/[,"\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function toCsv(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return "";
  }

  const columns = Object.keys(rows[0]);
  const lines = [columns.join(",")];

  for (const row of rows) {
    lines.push(columns.map((column) => csvEscape(row[column])).join(","));
  }

  return lines.join("\n");
}

function safeTime(row) {
  return row.event_time || row.created_at || row.timestamp || null;
}

function getDetails(row) {
  return row?.details && typeof row.details === "object" ? row.details : {};
}

function labelFrom(row) {
  const type = String(row.event_type || "").toUpperCase();
  const details = getDetails(row);

  if (type.includes("REPLAY")) return "attack";
  if (type.includes("ANOMALY")) return "attack";

  if (
    type.includes("PLUGIN") &&
    (details.flagged === true || details.plugin_outcome === "flag")
  ) {
    return "attack";
  }

  return "normal";
}

async function fetchPaged(queryBuilder, totalLimit) {
  const rows = [];
  let from = 0;

  while (rows.length < totalLimit) {
    const to = Math.min(from + PAGE_SIZE - 1, totalLimit - 1);
    const { data, error } = await queryBuilder(from, to);

    if (error) {
      throw new Error(error.message);
    }

    const page = data || [];
    rows.push(...page);

    if (page.length < PAGE_SIZE) {
      break;
    }

    from += PAGE_SIZE;
  }

  return rows;
}

async function fetchEventLogs({ org_id, since, limit }) {
  return fetchPaged((from, to) => {
    let query = supabase
      .from(TABLES.EVENT_LOGS)
      .select("*")
      .order("event_time", { ascending: true });

    if (org_id) query = query.eq("org_id", org_id);
    if (since) query = query.gte("event_time", since);

    return query.range(from, to);
  }, limit);
}

async function fetchTable(table, { org_id, since, limit }) {
  return fetchPaged((from, to) => {
    let query = supabase.from(table).select("*");

    if (org_id) query = query.eq("org_id", org_id);

    if (since) {
      if (table === TABLES.ANOMALIES) {
        query = query.gte("detected_at", since);
      } else if (table === TABLES.EVENT_LOGS) {
        query = query.gte("event_time", since);
      } else {
        query = query.gte("created_at", since);
      }
    }

    return query.range(from, to);
  }, limit);
}

async function main() {
  const org_id = process.env.EXPORT_ORG_ID
    ? parsePositiveNumber(process.env.EXPORT_ORG_ID, null)
    : null;

  const since = process.env.EXPORT_SINCE || null;
  const limit = parsePositiveNumber(process.env.EXPORT_LIMIT, DEFAULT_LIMIT);

  const [logs, profiles, anomalies, replays] = await Promise.all([
    fetchEventLogs({ org_id, since, limit }),
    fetchTable(TABLES.BEHAVIOR_PROFILES, { org_id, since, limit }),
    fetchTable(TABLES.ANOMALIES, { org_id, since, limit }),
    fetchTable(TABLES.REPLAY_ATTACKS, { org_id, since, limit }),
  ]);

  const rows = logs.map((row) => {
    const details = getDetails(row);

    return {
      time: safeTime(row),
      org_id: row.org_id ?? org_id,
      handshake_id: row.handshake_id ?? null,
      event_type: row.event_type ?? null,
      user_id: row.subject_user_id ?? details.user_id ?? null,
      user_key_id: row.subject_user_key_id ?? details.user_key_id ?? null,
      plugin_name: details.plugin_name ?? null,
      plugin_outcome: details.plugin_outcome ?? details.plugin_result ?? null,
      replay_evidence: details.replay_evidence ?? null,
      anomaly_score: details.anomaly_score ?? null,
      scenario: details.scenario ?? null,
      kind: details.kind ?? null,
      seq: details.seq ?? null,
      label: labelFrom(row),
    };
  });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const baseName = org_id ? `ml_org${org_id}_${stamp}` : `ml_all_orgs_${stamp}`;

  fs.writeFileSync(
    path.join(OUT_DIR, `${baseName}.jsonl`),
    rows.map((item) => JSON.stringify(item)).join("\n"),
    "utf-8"
  );

  fs.writeFileSync(
    path.join(OUT_DIR, `${baseName}.csv`),
    toCsv(rows),
    "utf-8"
  );

  fs.writeFileSync(
    path.join(OUT_DIR, `${baseName}_event_logs.json`),
    JSON.stringify(logs, null, 2),
    "utf-8"
  );

  fs.writeFileSync(
    path.join(OUT_DIR, `${baseName}_behavior_profiles.json`),
    JSON.stringify(profiles, null, 2),
    "utf-8"
  );

  fs.writeFileSync(
    path.join(OUT_DIR, `${baseName}_anomalies.json`),
    JSON.stringify(anomalies, null, 2),
    "utf-8"
  );

  fs.writeFileSync(
    path.join(OUT_DIR, `${baseName}_replay_attacks.json`),
    JSON.stringify(replays, null, 2),
    "utf-8"
  );

  console.log(`[export] exports/${baseName}.csv`);
  console.log(`[export] exports/${baseName}.jsonl`);
  console.log(
    `[export] rows=${rows.length} logs=${logs.length} profiles=${profiles.length} anomalies=${anomalies.length} replays=${replays.length}`
  );
}

main().catch((error) => {
  console.error("[export] failed:", error.message);
  process.exitCode = 1;
});