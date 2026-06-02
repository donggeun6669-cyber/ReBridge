"""Merge admissions_2028_patch_D.json into the 2028 dataset (additive, no regression).

- admissions_2028.json  : append all patch_D rows tagged _patch='D' (source-of-record).
- comparative_2028.json : add patch_D univIds that carry a usable comparativeGrade.
                          On overlap, keep the higher comparativeGradeType priority;
                          tie -> prefer patch_D (newer, main-campus extraction).

Never fabricates: rows whose comparativeGrade is empty are NOT added to the lookup.
Run with --write to persist; otherwise dry-run prints the diff only.
"""
import argparse
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent

PRIORITY = {
    "numeric_table": 5,
    "comparative_prose": 4,
    "deferred": 3,
    "eligibility_prose": 2,
    "ged_block": 1,
    "none": 0,
    None: -1,
}


def load(p):
    return json.loads(Path(p).read_text(encoding="utf-8"))


def usable(grade):
    return grade not in (None, "")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    args = ap.parse_args()

    adm = load(ROOT / "admissions_2028.json")
    comp = load(ROOT / "comparative_2028.json")
    patch = load(ROOT / "admissions_2028_patch_D.json")

    comp_before = len(comp)
    added, upgraded, skipped_lower, skipped_empty = [], [], [], []

    for row in patch:
        uid = row["univId"]
        grade = row.get("comparativeGrade")
        gtype = row.get("comparativeGradeType")
        if not usable(grade):
            skipped_empty.append(uid)
            continue
        entry = {
            "comparativeGrade": grade,
            "comparativeGradeType": gtype,
            "source": row.get("source"),
        }
        if uid not in comp:
            comp[uid] = entry
            added.append(uid)
        else:
            old_p = PRIORITY.get(comp[uid].get("comparativeGradeType"), -1)
            new_p = PRIORITY.get(gtype, -1)
            if new_p >= old_p:  # tie -> patch_D wins (newer / correct campus)
                comp[uid] = entry
                upgraded.append(uid)
            else:
                skipped_lower.append(uid)

    # append patch_D rows to source-of-record dataset, tagged _patch='D'
    adm_before = len(adm)
    for row in patch:
        r = dict(row)
        r["_patch"] = "D"
        adm.append(r)

    report = {
        "comparative_before": comp_before,
        "comparative_after": len(comp),
        "added": sorted(added),
        "upgraded": sorted(upgraded),
        "skipped_lower_priority": sorted(skipped_lower),
        "skipped_empty_grade": sorted(skipped_empty),
        "admissions_before": adm_before,
        "admissions_after": len(adm),
        "comparative_type_dist": dict(
            Counter(v.get("comparativeGradeType") for v in comp.values())
        ),
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))

    if args.write:
        (ROOT / "comparative_2028.json").write_text(
            json.dumps(comp, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        (ROOT / "admissions_2028.json").write_text(
            json.dumps(adm, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        print("\nWROTE comparative_2028.json + admissions_2028.json")
    else:
        print("\nDRY-RUN (no files written). Re-run with --write to persist.")


if __name__ == "__main__":
    main()
