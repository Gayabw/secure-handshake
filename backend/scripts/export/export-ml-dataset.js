import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { supabase } from "../../src/lib/supabase.js";
import { TABLES } from "../../src/lib/tables.js";

const OUT_DIR = path.resolve(process.cwd(), "exports");
fs.mkdirSync(OUT_DIR, { recursive: true });

const PAGE_SIZE = 1000;

function csvEscape(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows) {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const lines = [cols.join(",")];

  for (const r of rows) {
    lines.push(cols.map((c) => csvEscape(r[c])).join(","));
  }

  return lines.join("\n");
}

function safeTime(row) {
  return row.event_time || row.created_at || row.timestamp || null;
}

function getDetails(row) {
  return row.details && typeof row.details === "object" ? row.details : {};
}

function labelFrom(row) {
  const t = String(row.event_type || "").toUpperCase();
  const details = getDetails(row);

  if (t.includes("REPLAY")) return "attack";
  if (t.includes("ANOMALY")) return "attack";

  if (
    t.includes("PLUGIN") &&
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
      throw error;
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

async function fetchEventLogs({ org_id, since, tag, limit }) {
  return fetchPaged((from, to) => {
    let q = supabase
      .from(TABLES.EVENT_LOGS)
      .select("*")
      .order("event_time", { ascending: true });

    if (org_id) q = q.eq("org_id", org_id);
    if (since) q = q.gte("event_time", since);

    // Tag filtering disabled because scenario is not stored in logs
    // if (tag) q = q.filter("details->>scenario", "eq", tag);

    return q.range(from, to);
  }, limit);
}

async function fetchTable(table, { org_id, since, limit }) {
  return fetchPaged((from, to) => {
    let q = supabase.from(table).select("*");

    if (org_id) q = q.eq("org_id", org_id);

    if (since) {
      if (table === TABLES.ANOMALIES) {
        q = q.gte("detected_at", since);
      } else if (table === TABLES.EVENT_LOGS) {
        q = q.gte("event_time", since);
      } else {
        q = q.gte("created_at", since);
      }
    }

    return q.range(from, to);
  }, limit);
}

async function main() {
  const org_id = process.env.EXPORT_ORG_ID
  ? Number(process.env.EXPORT_ORG_ID)
  : null;
  const since = process.env.EXPORT_SINCE || null;
  const tag = process.env.EXPORT_TAG || null;
  const limit = Number(process.env.EXPORT_LIMIT || 20000);

  const [logs, profiles, anomalies, replays] = await Promise.all([
    fetchEventLogs({ org_id, since, tag, limit }),
    fetchTable(TABLES.BEHAVIOR_PROFILES, { org_id, since, limit }),
    fetchTable(TABLES.ANOMALIES, { org_id, since, limit }),
    fetchTable(TABLES.REPLAY_ATTACKS, { org_id, since, limit }),
  ]);

  const rows = logs.map((r) => {
    const details = getDetails(r);

    return {
      time: safeTime(r),
      org_id: r.org_id ?? org_id,
      handshake_id: r.handshake_id ?? null,
      event_type: r.event_type ?? null,
      user_id: r.subject_user_id ?? details.user_id ?? null,
      user_key_id: r.subject_user_key_id ?? details.user_key_id ?? null,
      plugin_name: details.plugin_name ?? null,
      plugin_outcome: details.plugin_outcome ?? details.plugin_result ?? null,
      replay_evidence: details.replay_evidence ?? null,
      anomaly_score: details.anomaly_score ?? null,
      scenario: details.scenario ?? null,
      kind: details.kind ?? null,
      seq: details.seq ?? null,
      label: labelFrom(r),
    };
  });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const base = org_id
  ? `ml_org${org_id}_${stamp}`
  : `ml_all_orgs_${stamp}`;

  fs.writeFileSync(
    path.join(OUT_DIR, `${base}.jsonl`),
    rows.map((x) => JSON.stringify(x)).join("\n")
  );

  fs.writeFileSync(path.join(OUT_DIR, `${base}.csv`), toCsv(rows));

  fs.writeFileSync(
    path.join(OUT_DIR, `${base}_event_logs.json`),
    JSON.stringify(logs, null, 2)
  );

  fs.writeFileSync(
    path.join(OUT_DIR, `${base}_behavior_profiles.json`),
    JSON.stringify(profiles, null, 2)
  );

  fs.writeFileSync(
    path.join(OUT_DIR, `${base}_anomalies.json`),
    JSON.stringify(anomalies, null, 2)
  );

  fs.writeFileSync(
    path.join(OUT_DIR, `${base}_replay_attacks.json`),
    JSON.stringify(replays, null, 2)
  );

  console.log(`[export] exports/${base}.csv`);
  console.log(`[export] exports/${base}.jsonl`);
  console.log(
    `[export] rows=${rows.length} logs=${logs.length} profiles=${profiles.length} anomalies=${anomalies.length} replays=${replays.length}`
  );
}

main().catch((e) => {
  console.error("[export] failed:", e.message);
  process.exitCode = 1;
});