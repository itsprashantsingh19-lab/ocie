"""
nlp_utils.py

Lightweight, rule-based NLP layer over the free-text columns in the guideline
workbook (Safety Notes, Setting, Core Guideline Notes, raw status text).

Deliberately NOT a transformer/embedding pipeline — this is a static,
offline dashboard with no model/API wired in, so honest scope here is:

  1. extract_trial_mentions(text)
     Regex + domain denylist NER. Pulls pivotal-trial-style names
     (FLAURA, MARIPOSA-2, ADAURA, "Beamion LUNG-1", ...) out of
     unstructured notes so they can be surfaced as evidence tags on a
     drug chip, the way the reference mockup annotates chips with
     trial names. This is the dataset's own text — nothing is invented.

  2. classify_signal(text)
     Keyword-pattern classifier that splits the catch-all "ambiguous"
     bucket into something closer to the mockup's 4-state model:
       - white_space_gap   : text explicitly states no guideline entry
       - pipeline_signal    : hedged, but a named trial / "pending" /
                               "maturing" language signals forward motion
       - unclear            : genuinely no signal either way

Both functions are heuristic and will have false positives/negatives on
a workbook this size (~100 free-text cells). Treat extracted trial names
and signal labels as a first pass for human review, not ground truth —
flagged the same way in the dashboard UI (every NLP-derived tag is
visually marked as derived, not authoritative).
"""

import re

# Domain acronyms/abbreviations that look like trial names under a naive
# ALL-CAPS regex but are not — biomarkers, staging systems, regulatory
# bodies, clinical shorthand. Extend this list as false positives surface.
ACRONYM_DENYLIST = {
    "NSCLC", "AJCC", "TNM", "EGFR", "ALK", "RET", "MET", "KRAS", "ROS1",
    "BRAF", "NTRK", "ERBB", "ERBB2", "HER2", "HER3", "NRG1", "HGFR", "PDL1",
    "FDA", "NCCN", "ASCO", "ESMO", "TPS", "CNS", "UICC", "SOC", "NDA", "BLA",
    "RXNORM", "ADC", "TKI", "TKIS", "ORR", "OS", "PFS", "DOR", "ECOG", "FISH",
    "IHC", "NGS", "CTDNA", "WHO", "ICI", "GI", "CR", "PR", "SD", "PD", "IV",
    "AE", "AES", "L858R", "TP53", "AMP", "EXON", "WT", "MUT", "VS", "ETC",
    "EG", "IE", "ID", "US", "EU", "USA", "NCT", "LUNG", "SABR",
    # AJCC staging codes (all-caps Roman numerals + letter suffix)
    "IA", "IB", "IIA", "IIB", "IIIA", "IIIB", "IIIC",
}

# Leading words that make a title-case match generic rather than a study
# name, e.g. "Stage IIIA", "Requires NGS", "The PACIFIC" (article, not part
# of the trial name).
GENERIC_LEAD_WORDS = {
    "the", "a", "an", "stage", "requires", "resectable", "nonsquamous",
    "targeted", "see", "per", "note", "this", "includes", "both", "all",
    "either", "with", "for", "and", "or", "in", "of", "to",
}

# All-caps single token (4+ letters), optional trailing -digits, e.g.
# FLAURA, MARIPOSA-2, ADAURA, PAPILLON, CROWN
ALLCAPS_RE = re.compile(r"\b([A-Z]{4,})(-\d+[A-Za-z]*)?\b")

# Title-case two-word study names ending in a code, e.g. "Beamion LUNG-1",
# "The PACIFIC" (article gets stripped post-match via GENERIC_LEAD_WORDS)
TITLECASE_STUDY_RE = re.compile(r"\b([A-Z][a-z]+)\s+([A-Z]{2,}-?\d*[A-Za-z]*)\b")

GAP_PATTERNS = [
    r"\bno guideline entry\b",
    r"\bnot (?:yet )?addressed\b",
    r"\bno (?:formal )?guideline (?:recommendation|listing)\b",
    r"\bnot (?:currently )?(?:listed|covered)\b",
    r"\bgap\b",
    r"\bwhite[\s-]?space\b",
]

SIGNAL_PATTERNS = [
    r"\bpending\b",
    r"\bmaturing\b",
    r"\bongoing\b",
    r"\breadout\b",
    r"\bunder (?:review|investigation)\b",
    r"\bemerging\b",
    r"\binvestigational\b",
]

GAP_RE = re.compile("|".join(GAP_PATTERNS), re.IGNORECASE)
SIGNAL_RE = re.compile("|".join(SIGNAL_PATTERNS), re.IGNORECASE)


def extract_trial_mentions(*texts):
    """
    Run trial-name NER across one or more free-text fields, dedupe, return
    a sorted list of distinct mentions found. Caller decides which fields
    to pass in (raw status text, safety notes, setting, guideline notes).
    """
    found = set()
    for text in texts:
        if not text or not isinstance(text, str):
            continue

        for m in ALLCAPS_RE.finditer(text):
            token = m.group(1)
            if token in ACRONYM_DENYLIST or token.rstrip("S") in ACRONYM_DENYLIST:
                continue
            mention = token + (m.group(2) or "")
            found.add(mention)

        for m in TITLECASE_STUDY_RE.finditer(text):
            lead, code = m.group(1), m.group(2)
            if lead.lower() in GENERIC_LEAD_WORDS:
                continue
            if code in ACRONYM_DENYLIST or code.rstrip("S") in ACRONYM_DENYLIST:
                continue
            found.add(f"{lead} {code}")

    # Drop single-token mentions that are just a fragment of a multi-word
    # mention already captured (e.g. standalone "LUNG-1" once "Beamion
    # LUNG-1" has been found).
    multi_word = {f for f in found if " " in f}
    deduped = {
        f for f in found
        if " " in f or not any(f in mw.split() for mw in multi_word)
    }
    return sorted(deduped)


def classify_signal(*texts):
    """
    Classify hedged/ambiguous guideline-status text into one of:
      'white_space_gap'  — explicit "no guideline entry" language
      'pipeline_signal'   — hedged but evidence of forward motion
                             (named trial, 'pending', 'maturing', etc.)
      'unclear'           — neither pattern found; flag for manual review
    Gap language takes priority if both patterns somehow co-occur, since
    "no current entry, but trial data maturing" is still a gap today.
    """
    combined = " ".join(t for t in texts if isinstance(t, str))
    if GAP_RE.search(combined):
        return "white_space_gap"
    if SIGNAL_RE.search(combined) or extract_trial_mentions(combined):
        return "pipeline_signal"
    return "unclear"
