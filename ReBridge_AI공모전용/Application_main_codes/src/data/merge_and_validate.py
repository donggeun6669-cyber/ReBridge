import argparse
import json
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parent
PATCH_DIR = ROOT / "patches"
REPORT_DIR = ROOT / "reports"


KEYS = ("univId", "phase", "admissionType", "admissionName")
MERGE_FIELDS = (
    "gedEligible",
    "gedIneligibleReason",
    "gedReflection",
    "comparativeGrade",
    "evalMethod",
    "interview",
    "csatMinimum",
    "recruitCount",
    "unit",
    "note",
    "source",
    "status",
)


def load_json(path, default):
    path = Path(path)
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def patch_key(row):
    return tuple(row.get(key, "") for key in KEYS)


def should_update(value):
    return value not in (None, "")


def main():
    parser = argparse.ArgumentParser(description="Merge admission patches and validate data.")
    parser.add_argument("--admissions", default=str(ROOT / "admissions.json"))
    parser.add_argument("--ged-patches", default=str(PATCH_DIR / "ged_patches.json"))
    parser.add_argument("--tier1-patches", default=str(PATCH_DIR / "tier1_field_patches.json"))
    parser.add_argument("--write", action="store_true", help="Write changes to admissions.json")
    args = parser.parse_args()

    admissions_path = Path(args.admissions)
    admissions = load_json(admissions_path, [])
    patches = load_json(args.ged_patches, []) + load_json(args.tier1_patches, [])
    patch_by_key = {patch_key(row): row for row in patches}

    updated = 0
    for row in admissions:
        patch = patch_by_key.get(patch_key(row))
        if not patch:
            row.setdefault("status", "baseline")
            continue
        for field in MERGE_FIELDS:
            if field in patch and should_update(patch[field]):
                if row.get(field) != patch[field]:
                    row[field] = patch[field]
                    updated += 1
        row.setdefault("status", patch.get("status", "baseline"))

    universities = load_json(ROOT / "universities.json", [])
    uids = {row["univId"] for row in universities}
    admission_uids = {row["univId"] for row in admissions}
    report = {
        "universities": len(universities),
        "admissions": len(admissions),
        "patches": len(patches),
        "fieldUpdates": updated,
        "orphans": sorted(admission_uids - uids),
        "universityWithoutAdmission": sorted(uids - admission_uids),
        "missingGedEligible": sum(1 for row in admissions if not row.get("gedEligible")),
        "withSource": sum(1 for row in admissions if row.get("source")),
        "status": dict(Counter(row.get("status", "") for row in admissions)),
        "gedEligible": dict(Counter(row.get("gedEligible", "") for row in admissions)),
    }
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    (REPORT_DIR / "merge_validate_report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    if args.write:
        admissions_path.write_text(
            json.dumps(admissions, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )

    print(json.dumps(report, ensure_ascii=False, indent=2))
    if report["orphans"] or report["missingGedEligible"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
