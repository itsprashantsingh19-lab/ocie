import requests, json, time

corrections = {
    "Nivolumab + Ipilimumab": "checkmate nivolumab ipilimumab NSCLC phase3",
    "Nivolumab + Ipilimumab + 2 cycles platinum chemotherapy": "checkmate 9LA nivolumab ipilimumab chemotherapy NSCLC",
    "Tremelimumab + Durvalumab + Carboplatin + Paclitaxel": "POSEIDON durvalumab tremelimumab NSCLC phase3",
    "Tremelimumab + Durvalumab + Carboplatin + Pemetrexed": "POSEIDON durvalumab tremelimumab NSCLC phase3",
    "Pembrolizumab": "KEYNOTE-189 pembrolizumab NSCLC phase3",
    "Atezolizumab": "IMPOWER150 atezolizumab NSCLC phase3",
    "Docetaxel +/- Ramucirumab": "REVEL ramucirumab docetaxel NSCLC phase3",
    "Capmatinib": "GEOMETRY mono-1 capmatinib NSCLC phase2",
    "Tepotinib": "VISION tepotinib NSCLC phase2",
    "Sotorasib": "CodeBreaK sotorasib NSCLC phase3",
    "Adagrasib": "KRYSTAL adagrasib NSCLC phase3",
    "Fam-trastuzumab deruxtecan-nxki": "DESTINY-Lung trastuzumab deruxtecan NSCLC phase2",
    "Datopotamab deruxtecan-dlnk": "TROPION-Lung datopotamab deruxtecan NSCLC phase3",
}

for drug, term in corrections.items():
    encoded = requests.utils.quote(term)
    url = f"https://clinicaltrials.gov/api/v2/studies?query.term={encoded}&pageSize=3"
    print(f"  URL: {url[:120]}...")
    r = requests.get(url, verify=False, timeout=15)
    print(f"  Status: {r.status_code}")
    if r.status_code != 200:
        print(f"  Body: {r.text[:200]}")
        continue
    data = r.json()
    print(f"\n=== {drug} (search: {term}) ===")
    for s in data.get("studies", []):
        ps = s["protocolSection"]
        nct = ps["identificationModule"]["nctId"]
        title = ps["identificationModule"].get("briefTitle","")[:120]
        ph = ps.get("designModule",{}).get("phases",[])
        print(f"  {nct} | {str(ph):20s} | {title}")
    time.sleep(0.3)
