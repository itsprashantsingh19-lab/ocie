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
        "biomarker_col": None,
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

METASTATIC_SHEET = "Metastatic "
METASTATIC_COLS = {
    "drug": "Drug / Regimen",
    "drug_class": "Drug Class / Type",
    "mechanism": "Mechanism / Target",
    "histology": "Histology / NSCLC Type",
    "setting": "Setting Focus",
    "route": "Route / Formulation",
    "safety": "Key Notes / Monitoring",
}

DRUG_SPLIT_RE = re.compile(r"\s*;\s*")
PAREN_NOTE_RE = re.compile(r"\s*\([^)]*\)\s*$")

# Suffixes stripped before fuzzy lookup against the Metastatic enrichment map
DRUG_SUFFIX_RE = re.compile(
    r"\s+(monotherapy|maintenance|therapy|treatment|option|options|regimen|"
    r"if not given in 1l|if not given in 2l|category \d+)\s*$",
    re.IGNORECASE,
)


def sheet_to_rows(ws, header_row_index=0):
    """Read a worksheet into a list of dicts keyed by the header row."""
    rows = list(ws.iter_rows(values_only=True))
    headers = [str(h).strip() if h else "" for h in rows[header_row_index]]
    out = []
    for row in rows[header_row_index + 1:]:
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
    """Lowercase, strip trailing parenthetical notes/suffixes for dedup keying."""
    name = PAREN_NOTE_RE.sub("", name)
    name = re.sub(r"[-\u2013].*$", "", name)
    return name.strip().lower()


def normalize_for_enrichment(name: str) -> str:
    """
    Broader normalization for Metastatic-sheet fuzzy lookup:
    - strip parentheticals
    - strip clinical suffixes (monotherapy, maintenance, etc.)
    - normalise separators: '/' and ' or ' -> ' + ' so combos align
    - collapse whitespace
    """
    name = PAREN_NOTE_RE.sub("", name)
    name = DRUG_SUFFIX_RE.sub("", name)
    # Normalise combo separators
    name = re.sub(r"\s*/\s*", " + ", name)          # carboplatin/osimertinib -> carboplatin + osimertinib
    name = re.sub(r"\s+or\s+\S+.*$", "", name, flags=re.IGNORECASE)  # "Sotorasib or Adagrasib..." -> "Sotorasib"
    name = re.sub(r"\s+", " ", name)
    return name.strip().lower()


def split_drugs(cell_value):
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
    target_tokens = tokenize(pipeline_name)
    if not target_tokens:
        return None
    best, best_score = None, 0
    for b in biomarkers.values():
        if b["track"].startswith("Pipeline"):
            continue
        candidate_tokens = tokenize(b["name"])
        overlap = target_tokens & candidate_tokens
        score = len(overlap)
        if score > best_score:
            best, best_score = b, score
    return best if best_score >= 1 else None


def classify_status_text(text: str) -> str:
    if not text or not isinstance(text, str):
        return "ambiguous"
    t = text.strip().lower()
    if t.startswith("yes"):
        return "current_soc"
    if t.startswith("no") and not t.startswith("not"):
        return "pipeline_pending"
    return "ambiguous"


def build_metastatic_enrichment(wb) -> dict:
    """
    Pass 0: read the Metastatic sheet (headers on row 4, data from row 5).
    Returns two lookup dicts:
      exact_map  : normalize_drug_name(name) -> enrichment fields
      fuzzy_map  : normalize_for_enrichment(name) -> enrichment fields
    Caller tries exact_map first, then fuzzy_map.
    """
    ws = wb[METASTATIC_SHEET]
    rows = sheet_to_rows(ws, header_row_index=3)
    exact_map = {}
    fuzzy_map = {}

    for row in rows:
        name = row.get(METASTATIC_COLS["drug"])
        if not name:
            continue
        fields = {
            "drug_class": row.get(METASTATIC_COLS["drug_class"]),
            "mechanism": row.get(METASTATIC_COLS["mechanism"]),
            "histology": row.get(METASTATIC_COLS["histology"]),
            "setting": row.get(METASTATIC_COLS["setting"]),
            "route": row.get(METASTATIC_COLS["route"]),
            "safety_notes": row.get(METASTATIC_COLS["safety"]),
        }

        def _store(d, key):
            if key not in d:
                d[key] = fields.copy()
            else:
                # backfill only
                for f, v in fields.items():
                    if not d[key][f] and v:
                        d[key][f] = v

        _store(exact_map, normalize_drug_name(name))
        _store(fuzzy_map, normalize_for_enrichment(name))

    return exact_map, fuzzy_map


def lookup_enrichment(name: str, exact_map: dict, fuzzy_map: dict) -> dict:
    """Try exact norm first, then fuzzy norm, return empty dict if no hit."""
    return (
        exact_map.get(normalize_drug_name(name))
        or fuzzy_map.get(normalize_for_enrichment(name))
        or {}
    )


def main():
    wb = openpyxl.load_workbook(SOURCE_XLSX, data_only=True)

    # --- Pass 0: build enrichment maps from Metastatic sheet ---
    exact_map, fuzzy_map = build_metastatic_enrichment(wb)
    print(f"Pass 0: {len(exact_map)} exact / {len(fuzzy_map)} fuzzy keys from Metastatic sheet")

    biomarkers = {}
    guideline_slots = []
    drugs = {}

    def get_or_create_biomarker(name, track, incidence=None):
        key = f"{track}::{name}"
        if key not in biomarkers:
            biomarkers[key] = {
                "id": key,
                "name": name,
                "track": track,
                "incidence_pct": incidence,
                "notes": None,
                "notable_trials": [],
            }
        return biomarkers[key]

    def get_or_create_drug(name, **defaults):
        norm = normalize_drug_name(name)
        enriched = lookup_enrichment(name, exact_map, fuzzy_map)
        if norm not in drugs:
            drugs[norm] = {
                "id": norm,
                "display_name": name,
                "drug_class": defaults.get("drug_class") or enriched.get("drug_class"),
                "mechanism": defaults.get("mechanism") or enriched.get("mechanism"),
                "source": defaults.get("source", "guideline"),
                "occurrences": [],
            }
        else:
            existing = drugs[norm]
            if not existing["drug_class"]:
                existing["drug_class"] = defaults.get("drug_class") or enriched.get("drug_class")
            if not existing["mechanism"]:
                existing["mechanism"] = defaults.get("mechanism") or enriched.get("mechanism")
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
                    enriched = lookup_enrichment(dn, exact_map, fuzzy_map)
                    drug["occurrences"].append({
                        "biomarker_id": biomarker["id"],
                        "track": track,
                        "line": line_label,
                        "status": "current_soc",
                        "raw_text": dn,
                        "histology": enriched.get("histology"),
                        "setting": enriched.get("setting"),
                        "route": enriched.get("route"),
                        "safety_notes": enriched.get("safety_notes"),
                        "evidence_trials": nlp.extract_trial_mentions(
                            enriched.get("safety_notes") or "",
                            enriched.get("setting") or "",
                        ),
                    })

    # --- Pass 2: Missing drugs sheet -> pipeline candidates ---
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

    enriched_drug_count = sum(1 for d in drugs.values() if d["drug_class"] or d["mechanism"])

    output = {
        "biomarkers": list(biomarkers.values()),
        "guideline_slots": guideline_slots,
        "drugs": list(drugs.values()),
        "meta": {
            "source_file": SOURCE_XLSX.name,
            "biomarker_count": len(biomarkers),
            "drug_count": len(drugs),
            "drugs_with_class_or_mechanism": enriched_drug_count,
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
