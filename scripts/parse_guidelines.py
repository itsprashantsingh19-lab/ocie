"""
parse_guidelines.py

Parses Current_Treatment_mapping_NCCN_ASCO__for_NSCLC.xlsx into a normalized
JSON data model: Biomarker -> GuidelineSlot (line/track) -> Drug, with a
three-way guideline status classification (current_soc / pipeline_pending /
ambiguous) for every drug.

No probability/timeline scoring, no trial-level data, no live DB calls.
See /OCIE_Guideline_Pipeline_Mapping_Project_Brief.md for full scope.

Usage:
    python scripts/parse_guidelines.py
    -> writes data/guideline_mapping.json
"""

import json
import re
from pathlib import Path

import openpyxl

import nlp_utils as nlp

ROOT = Path(__file__).resolve().parent.parent
SOURCE_XLSX = ROOT / "data" / "Current_Treatment_mapping_NCCN_ASCO__for_NSCLC.xlsx"
OUTPUT_JSON = ROOT / "data" / "guideline_mapping.json"

# ---------------------------------------------------------------------------
# Sheet -> column role mapping. Each guideline sheet has a biomarker-ish
# column and one or more "drug list" columns that each correspond to a
# guideline line. Drug list cells are semicolon-separated free text.
# ---------------------------------------------------------------------------

GUIDELINE_SHEETS = {
    "Track C- biomarkerdriver oncoge": {
        "track": "Track C - Biomarker Driver Positive",
        "biomarker_col": "Biomarker / Mutation",
        "incidence_col": "Incidence %",
        "line_cols": {
            "1L Preferred (Frontline)": "1L Preferred",
            "1L Useful in Certain Circumstances (UICC)": "1L UICC",
            "2L+ Subsequent Options": "2L+ Subsequent",
        },
        "notes_col": "Critical Pathology / Diagnostic Rules",
    },
    "Track C- Driver negetive": {
        "track": "Track C - Driver Negative (PD-L1)",
        "biomarker_col": None,  # composite: PD-L1 expression + histology
        "composite_cols": ["PD-L1 Expression (TPS)", "Tumor Histology"],
        "incidence_col": None,
        "line_cols": {
            "1L Preferred Strategy": "1L Preferred",
            "1L UICC Options": "1L UICC",
            "2L+ Subsequent Options": "2L+ Subsequent",
        },
    },
    "Track A(localizedcurative inten": {
        "track": "Track A - Localized / Curative Intent",
        "biomarker_col": None,
        "composite_cols": ["AJCC Staging", "Biomarker Variant Profile"],
        "incidence_col": None,
        "line_cols": {
            "Frontline Pre-Op Protocol": "Pre-Op",
            "Primary Local Intervention": "Local Intervention",
            "Post-Op Adjuvant Strategy (Sequential)": "Adjuvant",
        },
        "notes_col": "Core Guideline Notes & Safety Rules",
    },
    "Track B(locally advanced Region": {
        "track": "Track B - Locally Advanced / Regional",
        "biomarker_col": None,
        "composite_cols": ["AJCC Staging", "Biomarker Variant Profile"],
        "incidence_col": None,
        "line_cols": {
            "Frontline Pre-Op Protocol": "Pre-Op",
            "Primary Local Intervention": "Local Intervention",
            "Consolidation / Adjuvant Strategy (Post-Local)": "Consolidation",
        },
        "notes_col": "Core Guideline Notes & Safety Rules",
    },
    "Uncommon NSCLC Subtypes": {
        "track": "Uncommon Subtypes",
        "biomarker_col": "NSCLC Subtype",
        "incidence_col": "Est. Incidence %",
        "line_cols": {
            "Guideline-Driven Treatment Tracking & Rules": "Guideline Treatment",
        },
    },
}

PIPELINE_SHEET = "Missing drugs"
PIPELINE_COLS = {
    "drug": "Drug/Regimen",
    "drug_class": "Drug Class",
    "mechanism": "Mechanism/Target",
    "biomarker": "Biomarker",
    "histology": "Histology/Type",
    "line_1l": "1L Preferred (Frontline)",
    "line_2l": "2L+ / Subsequent Options",
    "setting": "Setting",
    "route": "Route / Formulation Note",
    "safety": "Important Safety / Monitoring Notes",
}

DRUG_SPLIT_RE = re.compile(r"\s*;\s*")
PAREN_NOTE_RE = re.compile(r"\s*\([^)]*\)\s*$")  # trailing "(...)" note, kept separately if needed


def sheet_to_rows(ws):
    """Read a worksheet into a list of dicts keyed by header row 1."""
    rows = list(ws.iter_rows(values_only=True))
    headers = [str(h).strip() if h else "" for h in rows[0]]
    out = []
    for row in rows[1:]:
        if not any(row):
            continue
        record = {}
        for h, v in zip(headers, row):
            if h:
                record[h] = v.strip() if isinstance(v, str) else v
        if record:
            out.append(record)
    return out


def normalize_drug_name(name: str) -> str:
    """Lowercase, strip trailing parenthetical notes/suffixes for fuzzy matching."""
    name = PAREN_NOTE_RE.sub("", name)
    name = re.sub(r"[-\u2013].*$", "", name)  # drop " - vmjw" style suffix fragments cautiously
    return name.strip().lower()


def split_drugs(cell_value):
    """Split a semicolon-separated drug-list cell into individual drug name strings."""
    if not cell_value or not isinstance(cell_value, str):
        return []
    parts = [p.strip() for p in DRUG_SPLIT_RE.split(cell_value) if p.strip()]
    return parts


STOPWORDS = {"of", "the", "and", "or", "mutation", "mutations", "fusion", "fusions",
             "positive", "negative", "expression", "high", "low", "nsclc", "type",
             "subtype", "altered", "exon", "deletion", "insertion", "insertions",
             "skipping", "classic", "atypical"}


def tokenize(name: str):
    return {w for w in re.findall(r"[a-z0-9]+", name.lower()) if w not in STOPWORDS and len(w) > 1}


def best_biomarker_match(pipeline_name: str, biomarkers: dict):
    """
    Token-overlap fuzzy match: e.g. 'EGFR exon 19 deletion/L858R' should match
    'EGFR Classic (ex19del,L858R)' over 'EGFR Exon 20 Insertions' because shared
    tokens (egfr, l858r) outweigh the exon-20-only candidate.

    Returns the best-scoring existing guideline biomarker, or None if nothing
    clears the minimum-overlap bar (in which case the row falls into the
    'Pipeline (unmatched)' bucket for manual review — see project brief Sec. 4).
    """
    target_tokens = tokenize(pipeline_name)
    if not target_tokens:
        return None

    best, best_score = None, 0
    for b in biomarkers.values():
        if b["track"].startswith("Pipeline"):
            continue  # only match against real guideline biomarkers
        candidate_tokens = tokenize(b["name"])
        overlap = target_tokens & candidate_tokens
        score = len(overlap)
        if score > best_score:
            best, best_score = b, score

    # Require at least one substantive shared token (e.g. a gene symbol or
    # specific variant code) — a bare 'nsclc'/'mutation' overlap doesn't count
    # since those are stripped by STOPWORDS already.
    return best if best_score >= 1 else None


def classify_status_text(text: str) -> str:
    """
    Three-way classification of a Missing-drugs status cell:
      current_soc      -> text clearly starts with 'Yes'
      pipeline_pending  -> text clearly starts with 'No'
      ambiguous         -> anything hedged ('Not clearly listed...', 'Not focus...', etc.)
    """
    if not text or not isinstance(text, str):
        return "ambiguous"
    t = text.strip().lower()
    if t.startswith("yes"):
        return "current_soc"
    if t.startswith("no") and not t.startswith("not"):
        return "pipeline_pending"
    return "ambiguous"


def main():
    wb = openpyxl.load_workbook(SOURCE_XLSX, data_only=True)

    biomarkers = {}      # key -> biomarker record
    guideline_slots = []  # list of slot records
    drugs = {}            # normalized_name -> drug record (merged across sheets)

    def get_or_create_biomarker(name, track, incidence=None):
        key = f"{track}::{name}"
        if key not in biomarkers:
            biomarkers[key] = {
                "id": key,
                "name": name,
                "track": track,
                "incidence_pct": incidence,
                "notes": None,
                "notable_trials": [],  # NLP-extracted, from guideline note fields
            }
        return biomarkers[key]

    def get_or_create_drug(name, **defaults):
        norm = normalize_drug_name(name)
        if norm not in drugs:
            drugs[norm] = {
                "id": norm,
                "display_name": name,
                "drug_class": defaults.get("drug_class"),
                "mechanism": defaults.get("mechanism"),
                "source": defaults.get("source", "guideline"),
                "occurrences": [],  # list of {biomarker_id, track, line, status, raw_text}
            }
        return drugs[norm]

    # --- Pass 1: guideline sheets -> current_soc drugs per biomarker/line ---
    for sheet_name, cfg in GUIDELINE_SHEETS.items():
        ws = wb[sheet_name]
        rows = sheet_to_rows(ws)
        track = cfg["track"]

        for row in rows:
            if cfg.get("biomarker_col"):
                biomarker_name = row.get(cfg["biomarker_col"])
            else:
                parts = [str(row.get(c, "")).strip() for c in cfg["composite_cols"]]
                biomarker_name = " | ".join(p for p in parts if p)

            if not biomarker_name:
                continue

            incidence = row.get(cfg["incidence_col"]) if cfg.get("incidence_col") else None
            biomarker = get_or_create_biomarker(biomarker_name, track, incidence)

            if cfg.get("notes_col"):
                note_text = row.get(cfg["notes_col"])
                if note_text:
                    biomarker["notes"] = note_text
                    mentions = nlp.extract_trial_mentions(note_text)
                    biomarker["notable_trials"] = sorted(set(biomarker["notable_trials"]) | set(mentions))

            for col_name, line_label in cfg["line_cols"].items():
                cell = row.get(col_name)
                drug_names = split_drugs(cell)
                slot_id = f"{biomarker['id']}::{line_label}"
                guideline_slots.append({
                    "id": slot_id,
                    "biomarker_id": biomarker["id"],
                    "track": track,
                    "line": line_label,
                    "drug_count": len(drug_names),
                })
                for dn in drug_names:
                    drug = get_or_create_drug(dn, source="guideline")
                    drug["occurrences"].append({
                        "biomarker_id": biomarker["id"],
                        "track": track,
                        "line": line_label,
                        "status": "current_soc",
                        "raw_text": dn,
                    })

    # --- Pass 2: Missing drugs sheet -> pipeline candidates, cross-referenced ---
    ws = wb[PIPELINE_SHEET]
    rows = sheet_to_rows(ws)
    for row in rows:
        name = row.get(PIPELINE_COLS["drug"])
        if not name:
            continue
        biomarker_name = row.get(PIPELINE_COLS["biomarker"]) or "Unspecified"
        matched_biomarker = best_biomarker_match(biomarker_name, biomarkers)
        biomarker = matched_biomarker or get_or_create_biomarker(biomarker_name, "Pipeline (unmatched)")

        drug = get_or_create_drug(
            name,
            drug_class=row.get(PIPELINE_COLS["drug_class"]),
            mechanism=row.get(PIPELINE_COLS["mechanism"]),
            source="missing_drugs",
        )

        for col_key, line_label in [("line_1l", "1L Preferred"), ("line_2l", "2L+ Subsequent")]:
            raw_text = row.get(PIPELINE_COLS[col_key])
            status = classify_status_text(raw_text)
            # If this drug already has a current_soc occurrence at this
            # biomarker/line from Pass 1, don't downgrade it.
            already_soc = any(
                o["biomarker_id"] == biomarker["id"] and o["line"] == line_label and o["status"] == "current_soc"
                for o in drug["occurrences"]
            )
            if already_soc:
                continue

            safety_notes = row.get(PIPELINE_COLS["safety"])
            setting = row.get(PIPELINE_COLS["setting"])
            route = row.get(PIPELINE_COLS["route"])
            evidence_trials = nlp.extract_trial_mentions(raw_text, safety_notes, setting)

            occurrence = {
                "biomarker_id": biomarker["id"],
                "track": "Pipeline",
                "line": line_label,
                "status": status,
                "raw_text": raw_text,
                "histology": row.get(PIPELINE_COLS["histology"]),
                "setting": setting,
                "route": route,
                "safety_notes": safety_notes,
                "evidence_trials": evidence_trials,
            }
            # Sub-classify the catch-all "ambiguous" bucket closer to the
            # reference mockup's 4-state model (current / 3yr / 5yr / gap):
            # white_space_gap (explicit no-guideline-entry language),
            # pipeline_signal (hedged but a named trial or "pending"/
            # "maturing" language shows forward motion), or unclear
            # (no signal either way — genuinely needs manual review).
            if status == "ambiguous":
                occurrence["status_detail"] = nlp.classify_signal(raw_text, safety_notes, setting)
            drug["occurrences"].append(occurrence)

    # --- Assemble output ---
    all_evidence_trials = set()
    for d in drugs.values():
        for o in d["occurrences"]:
            all_evidence_trials.update(o.get("evidence_trials") or [])
    for b in biomarkers.values():
        all_evidence_trials.update(b.get("notable_trials") or [])

    output = {
        "biomarkers": list(biomarkers.values()),
        "guideline_slots": guideline_slots,
        "drugs": list(drugs.values()),
        "meta": {
            "source_file": SOURCE_XLSX.name,
            "biomarker_count": len(biomarkers),
            "drug_count": len(drugs),
            "current_soc_occurrences": sum(
                1 for d in drugs.values() for o in d["occurrences"] if o["status"] == "current_soc"
            ),
            "pipeline_pending_occurrences": sum(
                1 for d in drugs.values() for o in d["occurrences"] if o["status"] == "pipeline_pending"
            ),
            "ambiguous_occurrences": sum(
                1 for d in drugs.values() for o in d["occurrences"] if o["status"] == "ambiguous"
            ),
            "status_detail_breakdown": {
                detail: sum(
                    1 for d in drugs.values() for o in d["occurrences"]
                    if o.get("status_detail") == detail
                )
                for detail in ["white_space_gap", "pipeline_signal", "unclear"]
            },
            "evidence_trial_roster": sorted(all_evidence_trials),
        },
    }

    OUTPUT_JSON.write_text(json.dumps(output, indent=2, default=str))
    print(f"Wrote {OUTPUT_JSON} — {output['meta']}")


if __name__ == "__main__":
    main()
