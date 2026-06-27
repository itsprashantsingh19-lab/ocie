# Prompt for Claude Sonnet — OCIE PowerPoint

Use this prompt with a multimodal model (Claude Sonnet, GPT-4o) to generate a PPTX file.

---

## Instructions

Create a professional PowerPoint presentation about **OCIE (Oncology Competitive Intelligence Engine)**. Use the following design constraints:

**Color Palette:**
- Background: #F7F6F2 (warm off-white)
- Text: #141412 (near-black)
- Accent / Headers: #B85C38 (terracotta/rust)
- Borders / Dividers: #E8E3D8 (warm grey)
- Secondary bg: #EFEDE8
- White sections: #FFFFFF
- Green (positive): #2d6a4f
- Amber (warning): #e09f3e
- Red (danger): #d00000

**Typography:**
- Slide titles: Cormorant Garamond, serif, 36-44pt, #141412
- Section headers: JetBrains Mono, monospace, 10-12pt, #B85C38, ALL CAPS, letter-spacing 0.1em
- Body text: DM Sans, sans-serif, 14-16pt, #141412
- Data/code: JetBrains Mono, monospace, 10-11pt, #888
- Subtitle/accent: Cormorant Garamond italic, #B85C38

**Style:**
- Clean, minimal, lots of whitespace
- Thin borders on boxes (1px #E8E3D8)
- Rounded corners (4-6px radius)
- Subtle dividers between sections
- No heavy shadows or gradients
- Data tables: light header row (#EFEDE8 bg, #888 text, 9pt uppercase monospace)
- Icons: simple emoji or thin line icons only (✓ ⚠ █ →)

---

## Slide Structure

### Slide 1 — Title Slide
- Title: **OCIE**
- Subtitle: Oncology Competitive Intelligence Engine
- Bottom: "Predicting Competitive Timelines in NSCLC"
- Color: dark background (#141412), title in #F7F6F2, O in OCIE in #B85C38
- Date: June 2026

### Slide 2 — The Problem
- Title: "The Competitive Intelligence Dilemma"
- Two-column layout:
  - Left: Bullet points
    - Pharma companies spend millions on competitive intelligence analysts
    - Manual trial tracking across ClinicalTrials.gov, FDA, conferences
    - Inconsistent timelines — every analyst estimates differently
    - No data-driven standard for "when will competitor X launch?"
  - Right: Simple diagram showing scattered question marks around a timeline
- Bottom callout box (#FDF5F1, border #F0C4A8): "The average NSCLC drug takes **12-18 months** from PCD to SOC — but every drug is different."

### Slide 3 — What is OCIE?
- Title: "OCIE: Data-Driven Competitive Timeline Predictions"
- Three-column feature boxes:
  - Box 1 (Icon: ▤): **Real Trial Data** — Live extraction from ClinicalTrials.gov API. Industry-sponsored, US-based trials only. Per-drug characteristic profiling.
  - Box 2 (Icon: ▦): **Validated Formula** — Profile→weights→timeline projection. Validated against 6 approved drugs. Avg |SOC Δ|: 3.4 months.
  - Box 3 (Icon: ▥): **Probabilistic Confidence** — Monte Carlo simulation (10,000 iterations). P10/P50/P90 percentiles per drug. High/Moderate/Low confidence labels.
- Bottom: "Not a black box — every parameter is inspectable and overridable."

### Slide 4 — System Architecture
- Title: "Architecture"
- Full-width flowchart showing:
  ```
  ClinicalTrials.gov API  ──→  Pipeline Fetcher  ──→  pipeline_dashboard.json
       FDA Drugs@FDA API  ──→        │
                                      ▼
  NCCN xlsx (SOC)  ──→  Supabase DB  ──→  Next.js App (Vercel)
                                      │
                                      ▼
                               Dashboard Tabs:
                               SOC | Pipeline | White Space | Insights
  ```
- Use thin connector lines (#B85C38 arrows)
- Each box: white bg, thin #E8E3D8 border, rounded

### Slide 5 — Trial Data Extraction
- Title: "Pipeline Fetcher — Real Trial Metadata from ClinicalTrials.gov"
- Four extraction boxes in a 2×2 grid:
  1. **Design Type** — `designModule.designInfo.allocation` → RCT / SingleArm / Adaptive
  2. **Endpoint** — `outcomeModule.primaryOutcomes[].measure` → PFS / ORR / OS (keyword match)
  3. **Enrollment Rate** — `enrollmentInfo.count ÷ (PCD − startDate)` → Fast (≥20/mo) / Avg / Slow
  4. **FDA Designations** — Inferred from phase+design pattern (BTD/AA/PR). **User-overridable.**
- Bottom note: "Filters: INDUSTRY sponsor only, US sites only"

### Slide 6 — Approval Detection
- Title: "How We Know a Drug Isn't Approved Yet"
- Two-part detection:
  1. **SOC Database** — 62 regimens extracted from NCCN NSCLC xlsx (2025)
  2. **FDA Drugs@FDA API** — Queries indications containing "non-small cell lung cancer", "nsclc", etc.
- If a drug is found in either source → `inSOC: true` → excluded from pipeline projections
- Show simple flow: Drug name → Check SOC DB → Check FDA API → Flag as Approved or Pipeline

### Slide 7 — Timeline Formula
- Title: "The Prediction Model"
- Formula display (large, prominent):
  ```
  Projected SOC = PCD + Submission + Review + NCCN Lag
  ```
- Table below:

  | Parameter | Standard | Accelerated | Source |
  |-----------|----------|-------------|--------|
  | Submission | 2mo | 2mo | Profile default |
  | FDA Review | 8mo | 4mo | Pathway-dependent |
  | NCCN Lag | 5mo | 5mo | Fixed |

- Show modifier adjustments table (OS endpoint +5mo review, Slow enrollment +4mo, etc.)
- Callout: "Model 1 (Standard 15mo / Accelerated 11mo) validated at ±2.9mo avg error"

### Slide 8 — Model Validation
- Title: "Model Validation — 6 Approved Drugs"
- Table:

  | Drug | Actual SOC | Predicted SOC | Δ |
  |------|-----------|--------------|---|
  | Osimertinib | 2018-09-01 | 2018-09-19 | +0.6mo |
  | Alectinib | 2018-03-01 | 2018-05-09 | +2.3mo |
  | Pembrolizumab | 2017-03-01 | 2017-08-09 | +5.3mo |
  | Sotorasib | 2021-10-01 | 2021-11-01 | +1.0mo |
  | Selpercatinib | 2020-11-01 | 2020-06-17 | −4.5mo |
  | Larotrectinib | 2019-04-01 | 2019-10-15 | +6.5mo |

- Summary: Avg |FDA Δ|: 2.5mo · Avg |SOC Δ|: 3.4mo · Best: Osimertinib FDA +0.03mo
- Note: "Drugs matching Standard profile (PFS·RCT·Fast) perform best. Non-standard profiles (Slow enrollment, OS endpoint) have wider variance — this is captured by the Monte Carlo confidence score."

### Slide 9 — Monte Carlo Confidence
- Title: "Probabilistic Confidence via Monte Carlo Simulation"
- Explain with a simple diagram:
  - 3 triangular distributions (submission, review, nccn) → summed → result distribution
  - Show P10, P50, P90 markers on the output distribution curve
- Formula: `confidence = 100 − (P90−P10) × 3.5`
- Three confidence bands:

  | Range | Label | Meaning |
  |-------|-------|---------|
  | ≥70 | High | Tight distribution, well-understood pathway |
  | 45–70 | Moderate | Some uncertainty in one or more components |
  | <45 | Low | Wide distribution, unusual trial design |

- Key point: "Monte Carlo turns a single-point guess into a probabilistic range."

### Slide 10 — Dashboard: Pipeline Tab
- Title: "Pipeline Tab — Per-Drug Prediction with Full Editability"
- Show a mockup of the pipeline table with:
  - Drug, biomarker, phase, PCD, projected SOC, horizon badge
  - Profile tags column (e.g. "PFS·RCT·Fast")
  - Expand arrow ▸
- Expanded row callout showing:
  - "Competitor" badge + sponsor name
  - Profile dropdowns (endpoint, enrollment, design)
  - FDA toggles (BTD, AA, PR)
  - Weight override inputs (submission, review, NCCN)
  - Monte Carlo metrics (P10/P50/P90) with mini bars
  - Phase breakdown bars
  - Key drivers list
- Bottom: "Every parameter is extracted from real trial data AND fully overridable."

### Slide 11 — Dashboard: White Space Tab
- Title: "White Space — Unmet Need by Biomarker × Line of Therapy"
- Show matrix heatmap concept:
  - Rows: biomarkers (EGFR, ALK, KRAS G12C, etc.)
  - Columns: 1L, 2L+
  - Cells colored: Green (covered), Amber (pending pipeline), Red (gap)
- List identified gaps:
  - KRAS G12C 1L — High gap (no Preferred, pipeline incoming)
  - MET 1L — High gap
  - RET 1L — High gap
  - No Driver 1L — High gap
  - EGFR Exon 20 2L+ — Medium gap

### Slide 12 — Insights: Timeline Gantt
- Title: "Competitive Timeline Gantt"
- Description: "All pipeline drugs on a shared timeline, grouped by biomarker"
- Show a mockup:
  - Left: biomarker group labels
  - Right: horizontal bars (green/amber/red based on confidence)
  - Each bar = projected SOC date
- "Scan horizontally to see when each competitor arrives. Scan vertically to see how crowded each biomarker is."

### Slide 13 — Insights: Threat Matrix
- Title: "Competitive Threat Matrix"
- Grid: Biomarkers (rows) × Time Windows (columns: <2yr, 2-4yr, >4yr)
- Cell values: count of pipeline drugs with color:
  - Green (#2d6a4f) = 0 competitors (uncontested)
  - Amber (#e09f3e) = 1-2 competitors
  - Red (#d00000) = 3+ competitors (crowded)
- "Instantly identify which biomarker-LOT-time combinations are crowded vs open."

### Slide 14 — Insights: Scenario Simulator
- Title: "Scenario Simulator — Sensitivity Analysis"
- Description: "A global 0.5×–2× multiplier on all timeline weights."
- Show slider mockup (0.5× to 2×)
- Table showing original vs adjusted SOC per drug
- "Answer questions like: What if FDA review times double? What if NCCN adoption accelerates?"

### Slide 15 — Key Takeaways
- Title: "Key Takeaways"
- Four bullet points, large:
  - **Data-driven, not guess-driven** — Every prediction starts from real ClinicalTrials.gov and FDA data
  - **Transparent and editable** — No black box. Every parameter can be inspected and overridden.
  - **Probabilistic, not deterministic** — Monte Carlo confidence bands replace single-point guesses
  - **Competitive landscape at a glance** — Gantt, threat matrix, and white space overlay give a complete picture

### Slide 16 — Closing
- Title: "OCIE"
- Subtitle: "Oncology Competitive Intelligence Engine"
- "Built on real data. Driven by transparent models. Controlled by you."
- Contact/source: github.com/Prashantsingh-19/ocie
- Dark background (#141412), light text (#F7F6F2)

---

## Additional Guidelines

- Use the exact color hex values specified
- Keep text minimal — each slide should convey one idea
- Use tables for data-heavy slides (validation, formula, threat matrix)
- Use the fonts specified: Cormorant Garamond for titles, DM Sans for body, JetBrains Mono for data
- Number all slides bottom-right in small JetBrains Mono (#888)
- Add a thin line (#E8E3D8) at the bottom of each slide as a footer separator
- Output as editable PPTX, not images
