import json, requests, time

with open(r"C:\Users\ipras\AppData\Local\Temp\opencode\ocie\data\nct_mapping.json") as f:
    mapping = json.load(f)

def replace_trials(drug_name, nct_ids, phases_map=None):
    """Replace trials for a drug with specific NCT IDs fetched from API."""
    if drug_name not in mapping:
        print(f"  WARN: '{drug_name}' not in mapping")
        return
    trials = []
    for nct in nct_ids:
        url = f"https://clinicaltrials.gov/api/v2/studies/{nct}"
        r = requests.get(url, verify=False, timeout=15)
        if r.status_code != 200:
            print(f"  WARN: {nct} returned {r.status_code}")
            continue
        s = r.json()
        ps = s["protocolSection"]
        title = ps["identificationModule"].get("briefTitle", "")
        phases = ps.get("designModule", {}).get("phases", phases_map.get(nct, []) if phases_map else [])
        status = ps.get("statusModule", {}).get("overallStatus", "")
        start = ps.get("statusModule", {}).get("startDateStruct", {}).get("date", "")
        comp = ps.get("statusModule", {}).get("primaryCompletionDateStruct", {}).get("date", "")
        enrollment = ps.get("designModule", {}).get("enrollmentInfo", {}).get("count")
        trials.append({
            "nctId": nct, "title": title, "phases": phases,
            "status": status, "startDate": start,
            "primaryCompletionDate": comp, "enrollment": enrollment
        })
        time.sleep(0.15)
    if trials:
        mapping[drug_name]["trials"] = trials
        mapping[drug_name]["note"] = "Refined — pivotal trial"
        print(f"  {drug_name}: replaced with {len(trials)} trial(s): {nct_ids}")
    else:
        print(f"  FAILED: {drug_name} — no trials fetched")

# --- Corrections ---

# Nivolumab + Ipilimumab combos
replace_trials("Nivolumab + Ipilimumab",
    ["NCT02477826"], {"NCT02477826": ["PHASE3"]})

replace_trials("Nivolumab + Ipilimumab + 2 cycles platinum chemotherapy",
    ["NCT03215706"], {"NCT03215706": ["PHASE3"]})

# Tremelimumab + Durvalumab combos
replace_trials("Tremelimumab + Durvalumab + Carboplatin + Paclitaxel",
    ["NCT03164616"], {"NCT03164616": ["PHASE3"]})

replace_trials("Tremelimumab + Durvalumab + Carboplatin + Pemetrexed",
    ["NCT03164616"], {"NCT03164616": ["PHASE3"]})

# Atezolizumab
replace_trials("Atezolizumab",
    ["NCT02366143"], {"NCT02366143": ["PHASE3"]})

# Docetaxel +/- Ramucirumab
replace_trials("Docetaxel +/- Ramucirumab",
    ["NCT01168973"], {"NCT01168973": ["PHASE3"]})

# Capmatinib - GEOMETRY mono-1
replace_trials("Capmatinib",
    ["NCT02414139"], {"NCT02414139": ["PHASE2"]})

# Tepotinib - VISION
replace_trials("Tepotinib",
    ["NCT02864992"], {"NCT02864992": ["PHASE2"]})

# Sotorasib - CodeBreaK 200
replace_trials("Sotorasib",
    ["NCT04303780"], {"NCT04303780": ["PHASE3"]})

# Adagrasib - KRYSTAL-12
replace_trials("Adagrasib",
    ["NCT04685135"], {"NCT04685135": ["PHASE3"]})

# Fam-trastuzumab deruxtecan - DESTINY-Lung
replace_trials("Fam-trastuzumab deruxtecan-nxki",
    ["NCT03505710", "NCT04644237"],
    {"NCT03505710": ["PHASE2"], "NCT04644237": ["PHASE2"]})

# Datopotamab deruxtecan - TROPION-Lung01
replace_trials("Datopotamab deruxtecan-dlnk",
    ["NCT04656652", "NCT05555732"],
    {"NCT04656652": ["PHASE3"], "NCT05555732": ["PHASE3"]})

# Save
with open(r"C:\Users\ipras\AppData\Local\Temp\opencode\ocie\data\nct_mapping.json", "w") as f:
    json.dump(mapping, f, indent=2, default=str)

print("\nDone! Refined mapping saved.")
