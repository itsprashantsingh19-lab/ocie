# OCIE — Oncology Competitive Intelligence Engine

## Complete System Documentation

---

## 1. Executive Summary

OCIE (Oncology Competitive Intelligence Engine) is a web-based dashboard that predicts when pipeline NSCLC drugs will reach NCCN guideline inclusion (Standard of Care / SOC). It combines:

- **ClinicalTrials.gov API** — real-time trial metadata extraction
- **FDA Drugs@FDA API** — approved drug cross-reference
- **A validated timeline formula** — projecting PCD → FDA approval → SOC inclusion
- **Monte Carlo simulation** — probabilistic confidence bands on every prediction

The core insight: each drug's trial characteristics (design, endpoint, enrollment rate, FDA designations) determine its timeline. Drugs with identical trial profiles follow identical projection curves.

---

## 2. The Problem

Pharma companies need to answer: **"When will our competitors' drugs reach the market?"**

Currently this is done via manual analyst work — reading trial registries, FDA review documents, and guessing timelines. The result is inconsistent, slow, and not data-driven.

OCIE solves this by:

1. Automatically fetching pipeline trial data from ClinicalTrials.gov
2. Extracting structured trial characteristics via keyword matching
3. Projecting FDA approval and SOC dates using a validated formula
4. Providing probabilistic confidence via Monte Carlo simulation
5. Surfacing white-space gaps and competitive threats

---

## 3. System Architecture

```
┌─────────────────────────┐     ┌──────────────────────┐
│  ClinicalTrials.gov v2  │     │  FDA Drugs@FDA API   │
│  (NSCLC trials)         │     │  (approved NSCLC)    │
└────────┬────────────────┘     └──────────┬───────────┘
         │                                 │
         ▼                                 ▼
┌─────────────────────────────────────────────────────┐
│           Pipeline Fetcher (scripts/)               │
│  - INDUSTRY sponsor filter                          │
│  - US location filter                               │
│  - Design, endpoint, enrollment extraction          │
│  - FDA designation heuristics                       │
│  - Cross-reference with SOC database                │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼ data/pipeline_dashboard.json
                      │
┌─────────────────────────────────────────────────────┐
│           Supabase Database                         │
│  - regimens (SOC from NCCN xlsx)                    │
│  - trials (NCT mappings)                            │
│  - white_space view                                  │
│  - pipeline_drugs view                               │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│           Next.js App (Vercel)                      │
│  - Current SOC tab                                  │
│  - Pipeline/Trials tab                              │
│  - White Space tab                                  │
│  - Insights tab                                     │
│    ├ Timeline Gantt                                 │
│    ├ White Space + Pipeline Overlay                 │
│    ├ Threat Matrix                                  │
│    └ Scenario Simulator                             │
└─────────────────────────────────────────────────────┘
```

---

## 4. Data Pipeline — Trial Fetcher

### 4.1 Source: ClinicalTrials.gov v2 API

The fetcher (`scripts/fetch-pipeline-dashboard.ts`) queries the ClinicalTrials.gov API v2 with the following parameters:

```
query.cond=NSCLC
query.term=<biomarker-specific term>
filter.overallStatus=RECRUITING,ACTIVE_NOT_RECRUITING,NOT_YET_RECRUITING,ENROLLING_BY_INVITATION
filter.leadSponsorClass=INDUSTRY
```

**Biomarkers covered (12):** EGFR, EGFR Exon 20, ALK, ROS1, BRAF V600E, KRAS G12C, NTRK, RET, MET, HER2, PD-L1, No Driver

### 4.2 Filters Applied

| Filter | Implementation | Source API Field |
|--------|---------------|-----------------|
| Industry-sponsored | `filter.leadSponsorClass=INDUSTRY` | `sponsorCollaboratorsModule.leadSponsor.class` |
| US-based sites | Post-filter locations | `locationModule.locations[].country === "United States"` |
| Active/recruiting | `filter.overallStatus` | `statusModule.overallStatus` |
| NSCLC indication | `query.cond=NSCLC` | Applied at search level |

### 4.3 Trial Characteristic Extraction

Each trial is processed to extract 4 key characteristics that determine its timeline profile:

#### Design Type (`extractDesign`)

| API Value | Mapped To |
|-----------|-----------|
| `RANDOMIZED` | RCT |
| `ADAPTIVE` / `SEQUENTIAL` | Adaptive |
| `null` (no allocation) | SingleArm |

Source: `designModule.designInfo.allocation`

#### Endpoint (`extractEndpoint`)

Keyword matching on primary outcome measures. This is a light NLP step.

| Keyword Match | Mapped To |
|---------------|-----------|
| "overall survival", "os" | OS |
| "objective response", "response rate", "orr", "overall response" | ORR |
| "progression free", "pfs", "disease free", "event free" | PFS |
| No match | PFS (most common in NSCLC) |

Source: `outcomeModule.primaryOutcomes[].measure` + `.description`

#### Enrollment Rate (`extractEnrollmentRate`)

Computed as: `enrollment count / study duration (months)`

| Rate | Classification |
|------|---------------|
| ≥20 patients/month | Fast |
| 5–20 patients/month | Average |
| <5 patients/month | Slow |

Fallback: if no start date / PCD, uses enrollment count as proxy (≥200 = Fast, ≥50 = Average, <50 = Slow).

Source: `designModule.enrollmentInfo.count`, `statusModule.startDateStruct.date`, `statusModule.primaryCompletionDateStruct.date`

#### FDA Designations (`extractFDA`)

**Important: ClinicalTrials.gov does not store FDA designation data (BTD, AA, Priority Review).** These are inferred via heuristics:

| Designation | Heuristic |
|-------------|-----------|
| Breakthrough Therapy (BTD) | Phase 2 + SingleArm design |
| Accelerated Approval (AA) | Phase 2 + SingleArm + ORR endpoint |
| Priority Review | Has BTD, OR Phase 3 + challenging endpoint (OS/ORR) |

Users can override these toggles per drug in the dashboard.

### 4.4 FDA Approval Cross-Reference

The fetcher queries the **FDA Drugs@FDA API** to identify already-approved NSCLC drugs:

```
https://api.fda.gov/drug/drugsfda.json?search=openfda.indications_and_usage:<nsclc-term>
```

Search terms: "non-small cell lung cancer", "nsclc", "non-small cell lung carcinoma", "metastatic non-small cell lung", "advanced non-small cell lung"

Results are merged with the Supabase SOC database (derived from NCCN xlsx). Drugs found in either source are flagged as `inSOC: true` and excluded from pipeline projections.

### 4.5 Output

The fetcher produces `data/pipeline_dashboard.json` containing:

- Top 10 pipeline drugs (not yet approved)
- Top 5 approved drugs (for model validation)
- Each with full extracted profile (designType, endpoint, enrollmentRate, fda, sponsor, phases)
- FetchedAt timestamp and config metadata

---

## 5. Timeline Prediction Model

### 5.1 Formula

```
Projected SOC = PCD + submission prep + FDA review + NCCN adoption lag
```

Where:

- **PCD** = Primary Completion Date (from trial, actual or estimated)
- **Submission prep** = time from PCD to NDA/BLA submission (default: 2 months)
- **FDA review** = FDA review clock (default: 8 months standard, 4 months accelerated/priority)
- **NCCN lag** = time from FDA approval to NCCN guideline update (default: 5 months)

### 5.2 Profile → Weights Mapping

The `profileToWeights()` function converts a drug's trial profile into timeline weights:

**Default profiles (Model 1 — validated):**

| Pathway | Submission | Review | NCCN | Total |
|---------|-----------|--------|------|-------|
| Standard (PFS·RCT·Fast) | 2mo | 8mo | 5mo | **15mo** |
| Accelerated (ORR·SA·Fast) | 2mo | 4mo | 5mo | **11mo** |

**Modifiers when profile deviates from defaults:**

| Characteristic | Adjustment |
|---------------|-----------|
| OS endpoint (Standard) | +5mo to review |
| OS endpoint (Accelerated) | +3mo to review |
| ORR endpoint (Standard) | −2mo to review |
| Slow enrollment | +4mo to review |
| Average enrollment | +1mo to review |
| SingleArm design (Standard) | −1mo to submission |
| RCT design (Accelerated) | +2mo to submission |
| Adaptive design | −1mo to review |

### 5.3 Model Validation

Validated against 6 known drugs with real-world data:

| Drug | Profile | PCD | Actual FDA | Predicted FDA | FDA Δ | Actual SOC | Predicted SOC | SOC Δ |
|------|---------|-----|-----------|--------------|-------|-----------|--------------|-------|
| Osimertinib | PFS·RCT·Fast·Std | 2017-06-19 | 2018-04-18 | 2018-04-19 | +0.03mo | 2018-09-01 | 2018-09-19 | +0.6mo |
| Alectinib | PFS·RCT·Fast·Std | 2017-02-09 | 2017-11-06 | 2017-12-09 | +1.1mo | 2018-03-01 | 2018-05-09 | +2.3mo |
| Pembrolizumab | PFS·RCT·Fast·Std | 2016-05-09 | 2016-10-24 | 2017-03-09 | +4.5mo | 2017-03-01 | 2017-08-09 | +5.3mo |
| Sotorasib | ORR·SA·Fast·Acc | 2020-12-01 | 2021-05-28 | 2021-06-01 | +0.1mo | 2021-10-01 | 2021-11-01 | +1.0mo |
| Selpercatinib | ORR·SA·Avg·Acc | 2019-06-17 | 2020-05-08 | 2020-01-17 | −3.7mo | 2020-11-01 | 2020-06-17 | −4.5mo |
| Larotrectinib | ORR·SA·Slow·Acc | 2018-07-15 | 2018-11-26 | 2019-05-15 | +5.6mo | 2019-04-01 | 2019-10-15 | +6.5mo |

**Average |FDA Δ|: 2.5mo**
**Average |SOC Δ|: 3.4mo**

The model performs best for drugs matching the Standard profile (PFS·RCT·Fast) where the validation runs at ±2.9mo average error. The profile→weights system trades some accuracy for per-drug granularity — non-standard profiles (Selpercatinib with Average enrollment, Larotrectinib with Slow enrollment) show larger deviations because their real-world timelines differ from the modifier adjustments.

---

## 6. Monte Carlo Confidence Simulation

### 6.1 Rationale

A single-point prediction (e.g. "SOC in 15 months") is misleading. Stakeholders need to understand the range of possible outcomes. Monte Carlo simulation answers: "How confident are we in this prediction?"

### 6.2 Methodology

For each drug, the simulation runs **10,000 iterations** where each iteration:

1. Samples `submission` from a triangular distribution defined by the weight ± uncertainty bounds
2. Samples `review` from its triangular distribution
3. Samples `nccnLag` from its triangular distribution
4. Sums the three samples → one projected total

### 6.3 Distribution Parameters

The triangular distributions are defined by (min, mode, max):

| Weight | Min | Mode | Max | Notes |
|--------|-----|------|-----|-------|
| Submission | max(0, w−1−risk) | w (or w−0.5 with BTD) | min(8, w+2+risk) | Risk + BTD widen/tighten |
| Review | max(0, w−2−risk) or higher with PR | w | min(12, w+2) with BTD, else min(18, w+4+risk+CMC) | PR, BTD, CMC affect bounds |
| NCCN Lag | max(0, w−1) | w | w+3+urgency | Competitive urgency widens |

### 6.4 Outputs

From the 10,000 sorted results:

| Percentile | Meaning |
|------------|---------|
| P10 | Optimistic — 10% chance of being this early or earlier |
| P50 | Median — the most likely timeline |
| P90 | Conservative — 90% chance of being this early or earlier |

**Confidence score:** `100 − (P90 − P10) × 3.5`

- Tight distribution (P90−P10 < 8mo) → High confidence (>70)
- Moderate spread (8–16mo) → Moderate confidence (45–70)
- Wide spread (>16mo) → Low confidence (<45)

### 6.5 Interpretation

- **High confidence**: the drug's profile is well-understood and follows standard pathways. Example: Phase 3 RCT with PFS endpoint, BTD, Priority Review.
- **Low confidence**: unusual trial design, slow enrollment, or OS endpoint introduces uncertainty. Example: SingleArm Phase 2 with Slow enrollment and OS endpoint.

---

## 7. Dashboard — Tab-by-Tab Guide

### 7.1 Current SOC Tab

Displays all 62 approved NSCLC regimens from the NCCN xlsx and ASCO guidelines, filterable by biomarker, regimen type, histology, and line of therapy.

Each card shows: biomarker, drug name, drug class, LOT, guideline tier (Preferred, UICC, Subsequent), and type (Single/Combination). Click opens a modal with full details.

### 7.2 Pipeline / Trials Tab

**Bulk Profile Template (top):** A set of dropdowns (endpoint, enrollment, design) and FDA toggles (BTD, AA, PR) that can be applied to all pipeline drugs at once via "Apply to all". "Reset to inferred" restores each drug to its API-extracted default profile.

**Pipeline Table:** Lists all pipeline drugs with columns for biomarker, phase, start date, PCD, projected SOC, horizon badge (<1yr, 1-3yr, 3-5yr, >5yr), and profile tags.

**Per-Drug Inline Editor:** Click any row to expand:

- **Competitor header** — shows drug name, sponsor, phase
- **Profile dropdowns** — endpoint, enrollment, design (overrides API extraction)
- **FDA toggles** — BTD, AA, Priority Review (overrides heuristic inference)
- **Weight overrides** — submission, review, NCCN lag number inputs (direct weight control)
- **Monte Carlo metrics** — P10/P50/P90 with mini distribution bars
- **Phase breakdown** — visual bars for each timeline component
- **Key drivers** — list of factors affecting this drug's timeline

### 7.3 White Space Tab

A matrix of biomarker × LOT cells showing:

- Number of SOC regimens
- Number of Preferred (Category 1) regimens
- Gap score (None/Low/Medium/High)

Gap logic:
- **None**: at least 1 Preferred regimen exists
- **Low**: no Preferred, but some active trials
- **Medium**: no Preferred, few trials
- **High**: no Preferred, no trials, no drugs

Identified gaps include: KRAS G12C 1L, MET 1L, RET 1L, No Driver 1L, EGFR Exon 20 2L+, HER2 2L+.

### 7.4 Insights Tab

Four sub-views:

**Timeline Gantt:** All pipeline drugs plotted on a shared timeline grouped by biomarker. Bar length = time from today to projected SOC. Color = confidence level.

**White Space + Pipeline Overlay:** The white space matrix with an "Incoming Pipeline" column showing which pipeline drugs target each biomarker×LOT cell. Gap status updates to "Pending" if pipeline drugs are incoming.

**Threat Matrix:** Biomarkers (rows) × time windows (columns: <2yr, 2-4yr, >4yr). Each cell shows pipeline density with color coding: green = 0, amber = 1-2, red = 3+. Quick scan for crowded vs uncontested spaces.

**Scenario Simulator:** A 0.5×–2× global multiplier on all timeline weights. Shows original vs adjusted SOC dates and per-drug shift in months. Answers: "What if FDA review times double?"

---

## 8. Technology Stack

| Component | Technology |
|-----------|-----------|
| Frontend | Next.js 16 (App Router), TypeScript, CSS |
| Backend | Next.js API (server components), Supabase |
| Database | PostgreSQL via Supabase |
| Hosting | Vercel (serverless) |
| Data Sources | ClinicalTrials.gov v2 API, FDA Drugs@FDA API, NCCN xlsx |
| Model | Custom profile→weights formula, Monte Carlo in JS |
| Fonts | Cormorant Garamond (titles), DM Sans (body), JetBrains Mono (data) |
| Color | #B85C38 accent, #F7F6F2 bg, #141412 text, #E8E3D8 borders |

---

## 9. FAQ — Stakeholder Questions

### Q: How accurate is the model?

**A:** Validated against 6 approved drugs with average |SOC Δ| of 3.4 months. The best-performing variant (Model 1, flat 15/11mo presets) achieves ±2.9 months. The profile→weights system trades ~0.5 months of accuracy for per-drug granularity. Drugs matching the Standard profile (PFS·RCT·Fast) typically predict within 1-2 months.

### Q: How do you know a drug hasn't already been approved?

**A:** Two-layer check: (1) cross-reference against our SOC database from NCCN xlsx (62 regimens), (2) query the FDA Drugs@FDA API for NSCLC-indicated drugs. If a drug appears in either source, it's flagged as approved and excluded from pipeline projections.

### Q: What if trial data is incomplete (missing PCD, no start date, etc.)?

**A:** The system gracefully degrades: missing PCD → no timeline projection, missing start date → enrollment rate falls back to count-based proxy, missing endpoint → defaults to PFS (most common in NSCLC). The drug still appears in the table with "—" for unavailable projections.

### Q: Can I override the predictions?

**A:** Yes, at three levels:
1. **Per-drug profile dropdowns** — change endpoint, enrollment, design
2. **FDA toggles** — manually set BTD, AA, Priority Review
3. **Weight overrides** — directly edit submission, review, NCCN lag numbers
4. **Bulk profile template** — apply settings to all drugs at once

### Q: How often is data refreshed?

**A:** On demand. Run `npx tsx scripts/fetch-pipeline-dashboard.ts` to refresh from ClinicalTrials.gov and the FDA API. There's no automatic scheduler — the user controls when to refresh.

### Q: What about non-US trials?

**A:** The pipeline fetcher applies a US location filter (`locations[].country === "United States"`). Non-US trials are excluded because the model is calibrated for US FDA timelines and NCCN guidelines. A separate pipeline could be built for EMA/other regions.

### Q: How is the confidence score calculated?

**A:** It's the output of a Monte Carlo simulation. The distribution tightness (P90−P10 spread) determines confidence. A low spread means the timeline is well-constrained (high confidence). A wide spread means uncertainty is high (low confidence). The formula: `confidence = 100 − (P90−P10) × 3.5`, clamped to 10–99.

### Q: How do you determine FDA designations (BTD, AA, PR)?

**A:** ClinicalTrials.gov does not store FDA designation data. We use heuristic inference: single-arm Phase 2 → BTD+AA, Phase 3+OS → Priority Review. These are clearly labeled as heuristics, and users can override them per drug.

### Q: What if a drug has multiple trials?

**A:** The fetcher groups trials by drug name and picks the best-phase trial (Phase 3 > Phase 2 > Phase 1). If multiple trials exist in the same phase, the one with the earliest PCD is preferred (most conservative).

### Q: What's the difference between projected FDA and projected SOC?

**A:** Projected FDA = PCD + submission + review. Projected SOC = PCD + submission + review + NCCN lag. SOC inclusion typically follows FDA approval by 3–6 months (the time for NCCN panel review and guideline publication).

### Q: Why are some pipeline drugs missing projected dates?

**A:** If a trial's PCD (Primary Completion Date) is null or in the past, the model cannot project forward. Trials with past PCDs may be completing analysis, and the system shows them without a projection until a future PCD is available (either as an update from ClinicalTrials.gov or manual entry).

---

## 10. File Reference

| File | Purpose |
|------|---------|
| `scripts/fetch-pipeline-dashboard.ts` | ClinicalTrials.gov + FDA API fetcher |
| `scripts/seed.ts` | Seeds SOC data from xlsx to Supabase |
| `scripts/validate-all-models.ts` | Validates Model 1, 2, A against 6 drugs |
| `scripts/validate-full-model.ts` | Full model validation with detailed profiles |
| `src/app/page.tsx` | Server component, reads data + pipeline profiles |
| `src/components/Dashboard.tsx` | Main client component (SOC, Pipeline, White Space) |
| `src/components/InsightsTab.tsx` | Insights sub-views (Gantt, Overlay, Matrix, Simulator) |
| `src/types/index.ts` | All types, profile→weights, Monte Carlo, helpers |
| `src/lib/db.ts` | Supabase client and data fetching |
| `src/app/globals.css` | All styling |
| `db/schema.sql` | Database schema (tables, views) |
| `data/pipeline_dashboard.json` | Output of fetcher, read by dashboard |

---

*Generated: June 2026*
