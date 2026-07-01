import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import { config } from "dotenv";
import path from "path";

config({ path: path.resolve(__dirname, "../.env.local") });

const XLSX_PATH = path.resolve(__dirname, "../data/Clinical_Trials_NSCLC_with_PatientPop.xlsx");
const SHEET = "Working Sheet";

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
  return String(raw)
    .split(/\n|\r\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("Inclusion Criteria") && !s.startsWith("Exclusion Criteria") && s !== ":");
}

function firstWordDrug(drugName: string): string {
  return drugName.split(/[;+/,]/)[0].trim().toLowerCase();
}

async function seed() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set"); process.exit(1); }

  const supabase = createClient(url, key);

  // Parse xlsx
  console.log("Parsing trials xlsx...");
  const wb = XLSX.readFile(XLSX_PATH);
  const ws = wb.Sheets[SHEET];
  const rows = XLSX.utils.sheet_to_json<any>(ws, { header: 1 });

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

  const trials: TrialRow[] = [];
  let started = false;
  for (const r of rows) {
    if (!r || !r[0]) continue;
    const cell0 = String(r[0]).trim();
    if (!started) { if (cell0 === "Trial ID") started = true; continue; }
    if (!cell0.startsWith("NCT")) continue;
    trials.push({
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
  console.log(`  ${trials.length} trials parsed`);

  // Upsert trials with patient_population
  console.log("Upserting trials...");
  let upserted = 0;
  for (const t of trials) {
    const { error } = await supabase.from("trials").upsert(
      {
        nct_id: t.nct_id,
        drug_name: t.drug_name,
        title: t.title,
        phases: t.phases,
        status: t.status,
        primary_completion_date: t.primary_completion_date || null,
        enrollment: t.enrollment,
        patient_population: t.patient_population || null,
      },
      { onConflict: "nct_id", ignoreDuplicates: false }
    );
    if (error) console.error(`  Error upserting ${t.nct_id}: ${error.message}`);
    else upserted++;
  }
  console.log(`  ${upserted} trials upserted`);

  // Upsert inclusion criteria
  console.log("Upserting inclusion criteria...");
  let incCount = 0;
  for (const t of trials) {
    if (t.inclusion_criteria.length === 0) continue;
    const { error: delErr } = await supabase.from("inclusion_criteria").delete().eq("nct_id", t.nct_id);
    if (delErr) { console.error(`  Delete inclusion error for ${t.nct_id}: ${delErr.message}`); continue; }
    const rows = t.inclusion_criteria.map((c) => ({ nct_id: t.nct_id, criterion: c }));
    const { error: insErr } = await supabase.from("inclusion_criteria").insert(rows);
    if (insErr) console.error(`  Insert inclusion error for ${t.nct_id}: ${insErr.message}`);
    else incCount += rows.length;
  }
  console.log(`  ${incCount} inclusion criteria inserted`);

  // Upsert exclusion criteria
  console.log("Upserting exclusion criteria...");
  let excCount = 0;
  for (const t of trials) {
    if (t.exclusion_criteria.length === 0) continue;
    const { error: delErr } = await supabase.from("exclusion_criteria").delete().eq("nct_id", t.nct_id);
    if (delErr) { console.error(`  Delete exclusion error for ${t.nct_id}: ${delErr.message}`); continue; }
    const rows = t.exclusion_criteria.map((c) => ({ nct_id: t.nct_id, criterion: c }));
    const { error: insErr } = await supabase.from("exclusion_criteria").insert(rows);
    if (insErr) console.error(`  Insert exclusion error for ${t.nct_id}: ${insErr.message}`);
    else excCount += rows.length;
  }
  console.log(`  ${excCount} exclusion criteria inserted`);

  // Link trials to regimens by first word of drug name
  console.log("Linking trials to regimens...");
  const { data: regs } = await supabase.from("regimens").select("id, drug");
  const regimenMap = new Map<string, number>();
  if (regs) for (const r of regs) regimenMap.set(r.drug.toLowerCase(), r.id);

  let linkCount = 0;
  for (const t of trials) {
    const fw = firstWordDrug(t.drug_name);
    if (!fw) continue;
    for (const [regDrug, regId] of regimenMap) {
      if (regDrug.includes(fw) || fw.includes(regDrug)) {
        const { error } = await supabase.from("regimen_trials").upsert(
          { regimen_id: regId, nct_id: t.nct_id },
          { onConflict: "regimen_id,nct_id", ignoreDuplicates: true }
        );
        if (!error) linkCount++;
      }
    }
  }
  console.log(`  ${linkCount} regimen-trial links created`);

  const { count: c1 } = await supabase.from("trials").select("*", { count: "exact", head: true });
  const { count: c2 } = await supabase.from("inclusion_criteria").select("*", { count: "exact", head: true });
  const { count: c3 } = await supabase.from("exclusion_criteria").select("*", { count: "exact", head: true });
  console.log(`\nDone. Trials: ${c1}, Inclusion: ${c2}, Exclusion: ${c3}`);
}

seed().catch((err) => { console.error("Seed trials failed:", err); process.exit(1); });
