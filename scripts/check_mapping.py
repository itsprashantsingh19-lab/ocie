import json

with open(r"C:\Users\ipras\AppData\Local\Temp\opencode\ocie\data\nct_mapping.json") as f:
    mapping = json.load(f)

empty = []
for drug, v in mapping.items():
    if not v["trials"]:
        empty.append(drug)

print("=== EMPTY (no trials found) ===")
for d in empty:
    print(f"  {d}: {mapping[d]['note']}")

print()
print("=== ALL DRUGS AND THEIR NCT IDs ===")
for drug, v in sorted(mapping.items()):
    trials = v["trials"]
    ncts = [t["nctId"] for t in trials[:3]]
    if ncts:
        print(f"  {drug}: {', '.join(ncts)}")
    else:
        print(f"  {drug}: NONE")
