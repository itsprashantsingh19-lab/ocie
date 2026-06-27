/**
 * OCIE Pipeline Dashboard Fetcher v2
 * ─────────────────────────────────────
 * Fetches pipeline NSCLC drugs from ClinicalTrials.gov, extracts real trial
 * characteristics (design, endpoint via keyword matching, enrollment rate,
 * FDA designations), maps to TrialProfile, and projects timelines via
 * profileToWeights.
 *
 * This is a SEPARATE pipeline from the SOC xlsx extraction. It reads live
 * trial metadata, not guideline data.
 *
 * Usage:
 *   npx tsx scripts/fetch-pipeline-dashboard.ts
 *
 * Output: data/pipeline_dashboard.json
 */

import { config } from "dotenv";
import { writeFileSync } from "fs";
import path from "path";

config({ path: path.resolve(__dirname, "../.env.local") });

const BASE = "https://clinicaltrials.gov/api/v2/studies";

// ─────────────────────────────────────────
// 1. Biomarker search terms
// ─────────────────────────────────────────
const BIOMARKER_TERMS: Record<string, string> = {
  EGFR: "EGFR mutation NSCLC", "EGFR Exon 20": "EGFR exon 20 NSCLC",
  ALK: "ALK fusion NSCLC", ROS1: "ROS1 fusion NSCLC",
  "BRAF V600E": "BRAF V600E NSCLC", "KRAS G12C": "KRAS G12C NSCLC",
  NTRK: "NTRK fusion NSCLC", RET: "RET fusion NSCLC",
  MET: "MET exon 14 NSCLC", HER2: "HER2 mutation NSCLC",
  "PD-L1": "PD-L1 NSCLC", "No Driver": "non-small cell lung cancer",
};

// ─────────────────────────────────────────
// 2. Trial characteristic extractors
// ─────────────────────────────────────────

/** Extract design type from the trial's design module */
function extractDesign(allocation: string | null): "RCT" | "SingleArm" | "Adaptive" {
  if (!allocation) return "SingleArm";
  const u = allocation.toUpperCase();
  if (u.includes("ADAPTIVE") || u.includes("SEQUENTIAL")) return "Adaptive";
  if (u.includes("RANDOMIZED")) return "RCT";
  return "SingleArm";
}

/**
 * Extract endpoint via keyword matching (light NLP) on primary outcome measure.
 * Falls back to PFS if none match (most common in NSCLC).
 */
function extractEndpoint(primaryOutcomes: any[] | null): "PFS" | "ORR" | "OS" {
  if (!primaryOutcomes?.length) return "PFS";
  const text = primaryOutcomes
    .map((o: any) => `${o.measure || ""} ${o.description || ""}`)
    .join(" ")
    .toLowerCase();
  // Order matters: check OS before PFS since some trials mention both
  if (text.includes("overall survival") || text.includes("os")) return "OS";
  if (text.includes("objective response") || text.includes("response rate") ||
      text.includes("orr") || text.includes("overall response")) return "ORR";
  if (text.includes("progression free") || text.includes("pfs") ||
      text.includes("disease free") || text.includes("event free")) return "PFS";
  return "PFS";
}

/**
 * Compute enrollment rate from count and study duration.
 * Fast: >=20 pts/mo  |  Average: 5-20  |  Slow: <5
 */
function extractEnrollmentRate(
  count: number | null,
  startDate: string | null,
  pcd: string | null
): "Fast" | "Average" | "Slow" {
  if (!count || count <= 0) return "Average";
  if (!startDate || !pcd) {
    // No duration data: use count as rough proxy
    if (count >= 200) return "Fast";
    if (count >= 50) return "Average";
    return "Slow";
  }
  const start = new Date(startDate).getTime();
  const end = new Date(pcd).getTime();
  const months = Math.max(1, (end - start) / (1000 * 60 * 60 * 24 * 30.44));
  const rate = count / months;
  if (rate >= 20) return "Fast";
  if (rate >= 5) return "Average";
  return "Slow";
}

/**
 * Infer FDA designations from trial characteristics.
 * ClinicalTrials.gov does NOT directly flag BTD/AA/PR, so we use best-effort
 * heuristics based on trial design and phase.
 */
function extractFDA(phases: string[], design: "RCT" | "SingleArm" | "Adaptive", endpoint: "PFS" | "ORR" | "OS"): {
  btd: boolean; aa: boolean; priorityReview: boolean;
} {
  const hasP2 = phases.some((p) => p.includes("PHASE2"));
  const hasP3 = phases.some((p) => p.includes("PHASE3"));
  const isUnmet = endpoint === "OS" || endpoint === "ORR"; // harder endpoints = unmet need

  // BTD: common for single-arm Phase 2 in high unmet need
  const btd = hasP2 && design === "SingleArm";
  // AA: almost always for single-arm Phase 2 with ORR endpoint
  const aa = hasP2 && design === "SingleArm" && endpoint === "ORR";
  // Priority Review: standard for BTD drugs, also for Phase 3 with OS endpoint
  const priorityReview = btd || (hasP3 && isUnmet);
  return { btd, aa, priorityReview };
}

/** Fetch trials for a biomarker term */
async function searchBiomarker(biomarker: string, term: string, pageSize = 40): Promise<any[]> {
  const url = `${BASE}?query.cond=NSCLC&query.term=${encodeURIComponent(term)}&filter.overallStatus=RECRUITING,ACTIVE_NOT_RECRUITING,NOT_YET_RECRUITING,ENROLLING_BY_INVITATION&pageSize=${pageSize}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.studies || []).map((s: any) => {
    const p = s.protocolSection;
    const dm = p.designModule || {};
    const sm = p.statusModule || {};
    const om = p.outcomeModule || {};
    const am = p.armsInterventionsModule || {};
    return {
      nctId: p.identificationModule.nctId,
      title: p.identificationModule.briefTitle,
      biomarker,
      phases: dm.phases || [],
      status: sm.overallStatus,
      startDate: sm.startDateStruct?.date || null,
      pcd: sm.primaryCompletionDateStruct?.date || null,
      interventions: (am.interventions || []).map((i: any) => i.name),
      // ── Real extraction fields ──
      designType: extractDesign(dm.designInfo?.allocation || null),
      endpoint: extractEndpoint(om.primaryOutcomes || null),
      enrollmentCount: dm.enrollmentInfo?.count || null,
      fda: null, // computed below
    };
  });
}

// ─────────────────────────────────────────
// 3. Timeline helpers
// ─────────────────────────────────────────

function addMonths(d: string, n: number) {
  const dt = new Date(d);
  dt.setMonth(dt.getMonth() + Math.round(n));
  return dt.toISOString().slice(0, 10);
}

function horizon(d: string) {
  const mo = (new Date(d).getTime() - Date.now()) / 2592000000;
  if (mo < 12) return "<1yr";
  if (mo < 36) return "1-3yr";
  if (mo < 60) return "3-5yr";
  return ">5yr";
}

/** Maps a TrialProfile to weights (mirrors types/index.ts profileToWeights) */
function profileToWeights(p: {
  endpoint: "PFS" | "ORR" | "OS";
  enrollment: "Fast" | "Average" | "Slow";
  design: "RCT" | "SingleArm" | "Adaptive";
  btd: boolean;
  aa: boolean;
  priorityReview: boolean;
}): { submission: number; review: number; nccnLag: number } {
  const hasAA = p.aa;
  let review = hasAA ? 4 : 8;
  let submission = 2;

  const isDefaultStd = !hasAA && p.endpoint === "PFS" && p.enrollment === "Fast" && p.design === "RCT";
  const isDefaultAcc = hasAA && p.endpoint === "ORR" && p.enrollment === "Fast" && p.design === "SingleArm";

  if (!isDefaultStd && !isDefaultAcc) {
    if (p.endpoint === "OS") review += hasAA ? 3 : 5;
    else if (p.endpoint === "ORR" && !hasAA) review -= 2;
    if (p.enrollment === "Slow") review += 4;
    else if (p.enrollment === "Average") review += 1;
    if (!hasAA && p.design === "SingleArm") submission -= 1;
    else if (hasAA && p.design === "RCT") submission += 2;
    else if (p.design === "Adaptive") review -= 1;
  }
  return { submission, review, nccnLag: 5 };
}

// ─────────────────────────────────────────
// 4. Types
// ─────────────────────────────────────────

interface ExtractedTrial {
  nctId: string;
  title: string;
  biomarker: string;
  phases: string[];
  status: string;
  startDate: string | null;
  pcd: string | null;
  interventions: string[];
  designType: "RCT" | "SingleArm" | "Adaptive";
  endpoint: "PFS" | "ORR" | "OS";
  enrollmentCount: number | null;
  fda: { btd: boolean; aa: boolean; priorityReview: boolean } | null;
  enrollmentRate: "Fast" | "Average" | "Slow";
}

interface DrugEntry {
  drug: string;
  nctId: string;
  biomarker: string;
  phases: string[];
  status: string;
  startDate: string | null;
  pcd: string | null;
  designType: "RCT" | "SingleArm" | "Adaptive";
  endpoint: "PFS" | "ORR" | "OS";
  enrollmentRate: "Fast" | "Average" | "Slow";
  fda: { btd: boolean; aa: boolean; priorityReview: boolean };
  inSOC: boolean;
  socTier: string | null;
  projectedFDA: string | null;
  projectedSOC: string | null;
  horizon: string | null;
}

// ─────────────────────────────────────────
// 5. Main
// ─────────────────────────────────────────

async function main() {
  console.log("OCIE Pipeline Dashboard Fetcher v2 — Real Trial Metadata\n");

  // 5a. Load SOC drugs
  console.log("1. Loading SOC drugs...");
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: soc } = await supabase.from("regimens").select("drug, biomarker, tier");
  const socSet = new Set((soc || []).map((r: any) => r.drug.toLowerCase()));
  const socTiers = new Map((soc || []).map((r: any) => [r.drug.toLowerCase(), r.tier]));
  console.log(`   ${socSet.size} unique SOC drugs\n`);

  // 5b. Search all biomarkers with full extraction
  console.log("2. Fetching trials with real characteristic extraction...");
  const allTrials: ExtractedTrial[] = [];
  for (const [bm, term] of Object.entries(BIOMARKER_TERMS)) {
    const raw = await searchBiomarker(bm, term);
    // Enrich with enrollment rate + FDA
    const enriched = raw.map((t) => ({
      ...t,
      fda: extractFDA(t.phases, t.designType, t.endpoint),
      enrollmentRate: extractEnrollmentRate(t.enrollmentCount, t.startDate, t.pcd),
    }));
    allTrials.push(...enriched);
    console.log(`   ${bm}: ${enriched.length} trials (${enriched.filter((t) => t.designType !== "SingleArm").length} RCT/Adapt)`);
  }

  // 5c. Group by drug name, keep best trial per drug
  console.log("\n3. Grouping by drug & picking best trial...");
  const drugMap = new Map<string, ExtractedTrial>();
  const drugBiomarker = new Map<string, string>();

  for (const t of allTrials) {
    for (const drug of t.interventions) {
      const key = drug.toLowerCase().trim();
      const existing = drugMap.get(key);
      // Replace with higher-phase or more recent PCD
      const rank = (p: string[]) =>
        p.includes("PHASE3") ? 0 : p.includes("PHASE2") ? 1 : p.includes("PHASE1") ? 2 : 3;
      if (!existing || rank(t.phases) < rank(existing.phases)) {
        drugMap.set(key, t);
        drugBiomarker.set(key, t.biomarker);
      }
    }
  }
  console.log(`   ${drugMap.size} unique drugs\n`);

  // 5d. Build entries with profile → weights → timeline
  console.log("4. Computing profiles & projections...");
  const entries: DrugEntry[] = [];
  for (const [drugName, trial] of drugMap) {
    const dl = drugName.toLowerCase();
    const inSOC = socSet.has(dl) || [...socSet].some((s) => dl.includes(s) || s.includes(dl));
    const socTier = inSOC ? socTiers.get(dl) || "Approved" : null;
    const fda = trial.fda || { btd: false, aa: false, priorityReview: false };

    // Compute weights from extracted profile
    const w = profileToWeights({
      endpoint: trial.endpoint,
      enrollment: trial.enrollmentRate,
      design: trial.designType,
      btd: fda.btd,
      aa: fda.aa,
      priorityReview: fda.priorityReview,
    });

    let pFDA: string | null = null, pSOC: string | null = null, hz: string | null = null;
    if (trial.pcd) {
      pFDA = addMonths(trial.pcd, w.submission + w.review);
      pSOC = addMonths(trial.pcd, w.submission + w.review + w.nccnLag);
      hz = horizon(pSOC);
    }

    entries.push({
      drug: drugName.charAt(0).toUpperCase() + drugName.slice(1),
      nctId: trial.nctId,
      biomarker: trial.biomarker,
      phases: trial.phases,
      status: trial.status,
      startDate: trial.startDate,
      pcd: trial.pcd,
      designType: trial.designType,
      endpoint: trial.endpoint,
      enrollmentRate: trial.enrollmentRate,
      fda,
      inSOC,
      socTier,
      projectedFDA: pFDA,
      projectedSOC: pSOC,
      horizon: hz,
    });
  }

  // 5e. Sort: pipeline first, then nearest horizon
  entries.sort((a, b) => {
    if (a.inSOC !== b.inSOC) return a.inSOC ? 1 : -1;
    if (!a.projectedSOC) return 1;
    if (!b.projectedSOC) return -1;
    return a.projectedSOC.localeCompare(b.projectedSOC);
  });

  const pipeline = entries.filter((e) => !e.inSOC).slice(0, 10);
  const approved = entries.filter((e) => e.inSOC).slice(0, 5);

  const output = {
    fetchedAt: new Date().toISOString(),
    totalTrials: allTrials.length,
    totalDrugs: drugMap.size,
    pipeline,
    approved,
  };

  // 5f. Write output
  const outPath = path.resolve(__dirname, "../data/pipeline_dashboard.json");
  writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`   Saved ${outPath}\n`);

  // 5g. Print summary
  console.log(`   Pipeline drugs: ${pipeline.length}`);
  console.log(`   Approved drugs: ${approved.length}\n`);

  const print = (list: DrugEntry[], label: string) => {
    console.log(`   ── ${label} ──`);
    for (const e of list) {
      const profileSig = `${e.endpoint}·${e.designType === "RCT" ? "RCT" : e.designType === "SingleArm" ? "SA" : "Adpt"}·${e.enrollmentRate === "Fast" ? "Fast" : e.enrollmentRate === "Average" ? "Avg" : "Slow"}${e.fda.btd ? "·BTD" : ""}${e.fda.aa ? "·AA" : ""}${e.fda.priorityReview ? "·PR" : ""}`;
      const phase = e.phases.join("/").replace(/PHASE/g, "P") || "—";
      console.log(`   ${e.drug.padEnd(20)} ${e.biomarker.padEnd(12)} ${phase.padEnd(8)} ${(e.pcd || "—").padEnd(12)} ${(e.projectedSOC || "—").padEnd(12)} ${(e.horizon || "—").padEnd(8)} ${profileSig}`);
    }
    console.log("");
  };
  print(pipeline, "Pipeline (not yet SOC)");
  print(approved, "Approved (model validation)");

  console.log("Done.");
}

main().catch(console.error);
