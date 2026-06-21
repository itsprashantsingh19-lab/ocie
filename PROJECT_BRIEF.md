# OCIE — Guideline-to-Pipeline Drug Mapping Dashboard
### Project Brief v1.0

---

## 1. Objective

Build a dashboard that maps NSCLC drugs currently in the development pipeline against the NCCN/ASCO treatment-guideline structure — by biomarker and line of therapy — so a viewer can see at a glance which pipeline drugs already occupy a guideline-preferred slot ("current SOC") and which are still pending guideline entry ("pipeline / not yet listed").

This is a **classification and visualization build, not a predictive one**. No probability scoring, no trial-volume counts, no timeline modeling. Those come in a later phase once trial-level data is joined in (out of scope here — see Section 7).

---

## 2. Source Data

Single input file: **`Current_Treatment_mapping_NCCN_ASCO__for_NSCLC.xlsx`** (9 sheets). No other data source is used for this build — no live database, no Supabase, no external API.

| Sheet | Rows | Purpose |
|---|---|---|
| `Track C- biomarkerdriver oncoge` | 12 | Biomarker-positive metastatic: 1L Preferred / 1L UICC / 2L+ drugs per mutation |
| `Track C- Driver negetive` | 6 | PD-L1 stratified metastatic, driver-negative: same line structure by PD-L1 TPS + histology |
| `Track A(localizedcurative inten` | 8 | Early-stage resectable (Stage IA–IIB): pre-op / surgery / adjuvant strategy |
| `Track B(locally advanced Region` | 6 | Stage IIIA–IIIC: pre-op, local intervention, consolidation strategy |
| `Uncommon NSCLC Subtypes` | 3 | Large cell, NOS, large cell neuroendocrine — treatment logic by exclusion |
| `Missing drugs` | 14 | **Pipeline candidates** — drug, mechanism, biomarker, and explicit 1L/2L+ guideline-status text per drug |
| `Metastatic ` | 63 | Pre-consolidated master roster: drug × biomarker × line × Preferred/UICC/Subsequent, with `Source Sheet(s)` lineage |
| `Anatomical staging` | 18 | AJCC stage → T/N/M → Track → SOC goal (reference) |
| `TNM classification` | 13 | T/N/M category definitions (reference) |

**Key fields per guideline row:** Biomarker/Mutation, Incidence %, 1L Preferred, 1L UICC, 2L+ Subsequent, Critical Pathology/Diagnostic Rules.

**Key fields per pipeline row (`Missing drugs`):** Drug/Regimen, Drug Class, Mechanism/Target, Biomarker, Histology, 1L status (text), 2L+ status (text), Setting, Route, Safety Notes.

---

## 3. Core Data Model

Three entities, normalized out of the workbook:

**Biomarker**
`name` (e.g. EGFR Classic, ALK Fusion, KRAS G12C, PD-L1 High), `incidence_pct`, `track` (A/B/C/C-driver-negative/uncommon)

**GuidelineSlot**
`biomarker_id`, `line` (1L Preferred / 1L UICC / 2L+ Subsequent / Pre-op / Adjuvant / Consolidation — varies by track), `track`

**Drug**
`name`, `drug_class`, `mechanism`, `biomarker_id` (one or many — some drugs span biomarkers), `guideline_status` — see classification logic below, `source_sheet` (lineage back to the workbook)

**Relationship:** `Drug —[OCCUPIES]→ GuidelineSlot`, many-to-many (a drug can occupy multiple line/biomarker slots; a slot can hold multiple drugs).

---

## 4. Classification Logic (no formulas — pure rule-based tagging)

For every drug in `Missing drugs`, match on `Biomarker` against the guideline sheets (`Track C-*`, `Track A`, `Track B`) and assign one of three states:

1. **`current_soc`** — drug already appears as a 1L Preferred / 1L UICC / 2L+ entry in the matching guideline sheet, OR its `Missing drugs` status text reads as an unambiguous "Yes."
2. **`pipeline_pending`** — drug's status text reads as an unambiguous "No" for both 1L and 2L+, and it does not appear in any guideline sheet row.
3. **`ambiguous`** — status text is hedged (e.g., *"Not clearly listed as 1L in extracted guideline text"*). These need a manual pass before going live — don't auto-classify as either SOC or pending. Flag them visually as a third, distinct state rather than guessing.

This three-way split is a known data-quality reality of the current sheet — build it in from day one rather than retrofitting later.

---

## 5. Dashboard UI Spec

Follow the existing OCIE visual system: dark clinical-intelligence theme, card-based layout, same structural pattern as the existing biomarker-timeline dashboard (left-rail biomarker list driving a main-panel grid).

**Layout:**
- **Left panel — Biomarker list:** one row per biomarker, grouped by Track (A/B/C/Driver-negative/Uncommon). Show incidence % as a secondary label.
- **Main panel — Guideline grid:** selecting a biomarker shows its lines as columns (1L Preferred / 1L UICC / 2L+, or the track-appropriate equivalent for A/B). Each cell renders drug chips.
- **Chip color coding (status, not confidence — no probability data exists yet):**
  - Current SOC — solid/filled chip
  - Pipeline pending — outlined chip, distinct color
  - Ambiguous — dashed/hatched chip, distinct color, with a tooltip showing the raw source text
- **Top KPI row** (counts only, no scoring):
  - Biomarkers mapped
  - Guideline-listed drugs (current SOC count)
  - Pipeline-pending drugs
  - Ambiguous / needs-review count
- **Filters:** Track, Biomarker, Line, Status (SOC / Pending / Ambiguous)
- **Drug detail on click:** mechanism, drug class, source sheet, raw guideline text — same click-to-expand pattern as the existing dashboard's drug-chip interaction.

---

## 6. Tech Stack Options

**Option A — Neo4j graph model** (consistent with the Onco-Directory architecture already in use)
- Nodes: `(:Biomarker)`, `(:Drug)`, `(:GuidelineSlot)`, `(:Track)`
- Relationships: `(:Drug)-[:OCCUPIES {status: 'current_soc'|'pipeline_pending'|'ambiguous'}]->(:GuidelineSlot)-[:FOR]->(:Biomarker)`
- Natural fit since drugs frequently span multiple biomarkers/lines — graph traversal answers "what else does this drug touch" for free.

**Option B — Flat relational table** (fastest to stand up)
- One row per `(biomarker, line, track, drug, status)` combination, derived once at build time from the xlsx via a parsing script.
- Good enough for a static-ish guideline snapshot; revisit Option A once trial-level data gets joined in (Phase 2, see below) and the graph actually needs to grow dynamically.

**Recommendation:** start with Option B for speed; the data model above maps 1:1 onto either, so migrating later is mechanical, not a redesign.

---

## 7. Explicitly Out of Scope for This Build

- Market-pressure probability/timeline metrics (the existing `drug_results` logic: `p_arrival`, `p_timeline`, `e_i`, `d_i`, `t_i_years`)
- Any live database integration (Supabase or otherwise)
- Trial-level data (NCT IDs, phase, enrollment, sponsor) and any "X trials following this guideline" counts
- Scenario modeling (Base/Upside/Disruption projections)
- Guideline-source version splitting (NCCN v4.2025 vs ASCO 2025 vs ESMO 2024) — current sheets merge these; treat as a single combined "NCCN/ASCO" source for this build

---

## 8. Build Steps

1. Parse all 9 sheets from the xlsx; normalize into the Biomarker / GuidelineSlot / Drug entities above.
2. Run the three-way classification logic against `Missing drugs` ↔ guideline sheets.
3. Output a static dataset (JSON or seeded DB, per chosen stack) — one record per Drug-Slot pairing with its status.
4. Build the dashboard UI per Section 5.
5. Manual-review pass on all `ambiguous` records before treating the dashboard as authoritative.

---

## 9. Open Questions for the Builder

- Confirm whether Track A/B (early-stage) drugs should get the same SOC/Pending/Ambiguous treatment, or whether — since `Missing drugs` has no early-stage pipeline entries — those tracks should just render as guideline-only (no pipeline overlay) for now.
- Confirm desired output format for Option B (flat file: SQLite, JSON, or CSV) based on whatever the build environment in Antigravity expects.
