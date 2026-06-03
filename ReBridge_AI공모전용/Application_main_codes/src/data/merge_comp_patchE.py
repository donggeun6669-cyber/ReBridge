"""Merge comparative patch E into comparative_2028.json.

Patch E is comparative-only. It never fabricates empty lookup rows and never
changes admissions_2028.json. Run without --write for a dry-run.
"""
import argparse
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PATCH_PATH = ROOT / "admissions_2028_patch_E_comp.json"
COMP_PATH = ROOT / "comparative_2028.json"
UNIVERSITIES_PATH = ROOT / "universities.json"
REPORT_PATH = ROOT / "reports" / "comparative_patchE_report.md"

PRIORITY = {
    "numeric_table": 5,
    "comparative_prose": 4,
    "deferred": 3,
    "eligibility_prose": 2,
    "ged_block": 1,
    "none": 0,
    None: -1,
}


def load(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def usable(value):
    return value not in (None, "")


def type_counts(comp):
    return Counter(v.get("comparativeGradeType") for v in comp.values())


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()

    comp = load(COMP_PATH)
    patch = load(PATCH_PATH)
    universities = load(UNIVERSITIES_PATH)
    known_uids = {u["univId"] for u in universities}

    before_len = len(comp)
    before_counts = type_counts(comp)

    added = []
    upgraded = []
    skipped_lower = []
    skipped_empty = []
    skipped_unknown = []

    for uid, entry in patch.items():
        if uid not in known_uids:
            skipped_unknown.append(uid)
            continue

        grade = entry.get("comparativeGrade")
        gtype = entry.get("comparativeGradeType")
        if not usable(grade):
            skipped_empty.append(uid)
            continue

        clean_entry = {
            "comparativeGrade": grade,
            "comparativeGradeType": gtype,
            "source": entry.get("source"),
        }
        if uid not in comp:
            comp[uid] = clean_entry
            added.append(uid)
            continue

        old_priority = PRIORITY.get(comp[uid].get("comparativeGradeType"), -1)
        new_priority = PRIORITY.get(gtype, -1)
        if new_priority >= old_priority:
            comp[uid] = clean_entry
            upgraded.append(uid)
        else:
            skipped_lower.append(uid)

    after_counts = type_counts(comp)
    report = {
        "comparative_before": before_len,
        "comparative_after": len(comp),
        "numeric_table_before": before_counts.get("numeric_table", 0),
        "numeric_table_after": after_counts.get("numeric_table", 0),
        "added": sorted(added),
        "upgraded": sorted(upgraded),
        "skipped_lower_priority": sorted(skipped_lower),
        "skipped_empty_grade": sorted(skipped_empty),
        "skipped_unknown_univ": sorted(skipped_unknown),
        "comparative_type_dist": dict(after_counts),
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))

    md = [
        "# Comparative Patch E Report",
        "",
        f"- comparative before: {before_len}",
        f"- comparative after: {len(comp)}",
        f"- numeric_table before: {before_counts.get('numeric_table', 0)}",
        f"- numeric_table after: {after_counts.get('numeric_table', 0)}",
        "",
        "## Added",
    ]
    if added:
        for uid in sorted(added):
            e = comp[uid]
            md.append(f"- {uid}: {e.get('comparativeGradeType')} / {e.get('source')}")
    else:
        md.append("- none")

    md.extend(
        [
            "",
            "## Audited But Not Added",
            "- uA0000070 고려대학교(세종): 검정고시 지원/비교내신 대상자 문구는 확인했으나, 검정고시 점수별 환산표나 산출식이 없어 보강 제외.",
            "- uA0000163 이화여자대학교: 키워드 발견 위치가 외국인 특별전형 학력 조건이며, 검정고시 비교내신 환산 근거가 아니므로 제외.",
            "",
        ]
    )

    if args.write:
        COMP_PATH.write_text(
            json.dumps(comp, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
        REPORT_PATH.write_text("\n".join(md), encoding="utf-8")
        print("\nWROTE comparative_2028.json + reports/comparative_patchE_report.md")
    else:
        print("\nDRY-RUN (no files written). Re-run with --write to persist.")


if __name__ == "__main__":
    main()
