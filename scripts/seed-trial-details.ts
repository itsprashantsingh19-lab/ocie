import * as XLSX from "xlsx";
import { Pool } from "pg";
import { config } from "dotenv";
import path from "path";

config({ path: path.resolve(__dirname, "../.env.local") });

const XLSX_PATH = path.resolve(__dirname, "../data/Clinical_Trials_NSCLC_with_PatientPop.xlsx");
const SHEET = "Working Sheet";

interface TrialRow {
  nct_id: string;
  title: string;
  drug_name: string;
  phases: string[];
  patient_population: string;
  enrollment: number | null;
  primary_completion_date: string;
  status: string;
  inclusion_criteria: string[];
  exclusion_criteria: string[];
}

function parseDate(raw: any): string {
  if (!raw) return "";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return String(raw).trim();
  return d.toISOString().slice(0, 10);
}

function parseEnrollment(raw: any): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return isNaN(n) ? null : Math.round(n);
}

function parsePhases(raw: string): string[] {
  if (!raw) return [];
  return raw.split(/[,;/\s]+/).filter(Boolean).map((p) => {
    const u = p.trim().toUpperCase();
    if (u.includes("PHASE3") || u === "3" || u === "III") return "PHASE3";
    if (u.includes("PHASE2") || u === "2" || u === "II") return "PHASE2";
    if (u.includes("PHASE1") || u === "1" || u === "I") return "PHASE1";
    return u;
  });
}

function splitCriteria(raw: any): string[] {
  if (!raw) return [];
  const text = String(raw);
  return text
    .split(/\n|\r\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("Inclusion Criteria") && !s.startsWith("Exclusion Criteria") && s !== ":");
}

function parseXLSX(): TrialRow[] {
  const wb = XLSX.readFile(XLSX_PATH);
  const ws = wb.Sheets[SHEET];
  const rows = XLSX.utils.sheet_to_json<any>(ws, { header: 1 });

  const results: TrialRow[] = [];
  let started = false;

  for (const r of rows) {
    if (!r || !r[0]) continue;
    const cell0 = String(r[0]).trim();
    if (!started) {
      if (cell0 === "Trial ID") { started = true; }
      continue;
    }
    if (!cell0.startsWith("NCT")) continue;

    results.push({
      nct_id: cell0,
      title: String(r[1] || "").trim(),
      drug_name: String(r[4] || "").trim(),
      phases: parsePhases(String(r[8] || "")),
      patient_population: String(r[9] || "").trim(),
      enrollment: parseEnrollment(r[17]),
      primary_completion_date: parseDate(r[18]),
      status: String(r[20] || "").trim(),
      inclusion_criteria: splitCriteria(r[2]),
      exclusion_criteria: splitCriteria(r[3]),
    });
  }
  return results;
}

function firstWordDrug(drugName: string): string {
  return drugName.split(/[;+/,]/)[0].trim().toLowerCase();
}

async function seed() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) { console.error("DATABASE_URL not set."); process.exit(1); }

  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });

  // Run migration
  await pool.query(`
    ALTER TABLE trials ADD COLUMN IF NOT EXISTS patient_population TEXT;
  `);
  console.log("Migration: added patient_population to trials");

  console.log("Parsing trials xlsx...");
  const trials = parseXLSX();
  console.log(`  ${trials.length} trials parsed`);

  // Upsert trials
  console.log("Upserting trials...");
  let upserted = 0;
  for (const t of trials) {
    await pool.query(
      `INSERT INTO trials (nct_id, drug_name, title, phases, status, primary_completion_date, enrollment, patient_population)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (nct_id) DO UPDATE SET
         drug_name = EXCLUDED.drug_name,
         title = EXCLUDED.title,
         phases = EXCLUDED.phases,
         status = EXCLUDED.status,
         primary_completion_date = EXCLUDED.primary_completion_date,
         enrollment = EXCLUDED.enrollment,
         patient_population = EXCLUDED.patient_population`,
      [t.nct_id, t.drug_name, t.title, t.phases, t.status, t.primary_completion_date, t.enrollment, t.patient_population]
    );
    upserted++;
  }
  console.log(`  ${upserted} trials upserted`);

  // Upsert inclusion criteria (delete existing, insert fresh)
  console.log("Upserting inclusion criteria...");
  let incCount = 0;
  for (const t of trials) {
    await pool.query("DELETE FROM inclusion_criteria WHERE nct_id = $1", [t.nct_id]);
    if (t.inclusion_criteria.length === 0) continue;
    const values = t.inclusion_criteria.map((c, i) => `($1, $${i + 2})`).join(",");
    await pool.query(
      `INSERT INTO inclusion_criteria (nct_id, criterion) VALUES ${values}`,
      [t.nct_id, ...t.inclusion_criteria]
    );
    incCount += t.inclusion_criteria.length;
  }
  console.log(`  ${incCount} criteria inserted`);

  // Upsert exclusion criteria
  console.log("Upserting exclusion criteria...");
  let excCount = 0;
  for (const t of trials) {
    await pool.query("DELETE FROM exclusion_criteria WHERE nct_id = $1", [t.nct_id]);
    if (t.exclusion_criteria.length === 0) continue;
    const values = t.exclusion_criteria.map((c, i) => `($1, $${i + 2})`).join(",");
    await pool.query(
      `INSERT INTO exclusion_criteria (nct_id, criterion) VALUES ${values}`,
      [t.nct_id, ...t.exclusion_criteria]
    );
    excCount += t.exclusion_criteria.length;
  }
  console.log(`  ${excCount} criteria inserted`);

  // Link trials to regimens by first word of drug name
  console.log("Linking trials to regimens...");
  const regResult = await pool.query("SELECT id, drug FROM regimens");
  const regimenMap = new Map<string, number>();
  for (const r of regResult.rows) {
    regimenMap.set((r.drug as string).toLowerCase(), r.id as number);
  }

  let linkCount = 0;
  for (const t of trials) {
    const fw = firstWordDrug(t.drug_name);
    if (!fw) continue;
    for (const [regDrug, regId] of regimenMap) {
      if (regDrug.includes(fw) || fw.includes(regDrug)) {
        await pool.query(
          "INSERT INTO regimen_trials (regimen_id, nct_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [regId, t.nct_id]
        ).catch(() => {}); // ignore FK violations
        linkCount++;
      }
    }
  }
  console.log(`  ${linkCount} regimen-trial links created`);

  const s1 = await pool.query("SELECT COUNT(*) FROM trials");
  const s2 = await pool.query("SELECT COUNT(*) FROM inclusion_criteria");
  const s3 = await pool.query("SELECT COUNT(*) FROM exclusion_criteria");
  console.log(`\nDone. Trials: ${s1.rows[0].count}, Inclusion: ${s2.rows[0].count}, Exclusion: ${s3.rows[0].count}`);
  await pool.end();
}

seed().catch((err) => { console.error("Seed trials failed:", err); process.exit(1); });
