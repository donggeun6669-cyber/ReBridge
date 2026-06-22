import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent
REPORT_DIR = ROOT / "reports"

EXCLUDED_NAMES = {
    "농어촌(교과)",
    "특성화고교",
    "농어촌(종합)",
    "특성화고졸재직자",
    "교육기회균형",
    "조기취업형계약학과",
}


def normalize_method(value):
    return (value or "").replace("·", "").strip()


def ged_for(row):
    name = row.get("admissionName", "")
    admission_type = row.get("admissionType", "")
    if name in EXCLUDED_NAMES:
        return "조건부", "정원외/특별전형은 세부 지원자격을 확인해야 해요"
    if "지역" in name and "의사" not in name:
        return "조건부", "지역 또는 추천 요건을 확인해야 해요"
    if admission_type == "수능위주":
        return "가능", ""
    return "가능", ""


def keep_for_app(row):
    # Keep the main undergraduate admissions routes. Very specialized rows remain in reports only.
    if row.get("admissionType") == "실기":
        return False
    if row.get("phase") == "정시" and row.get("admissionName") in {"가군", "나군", "다군"}:
        return row.get("evalMethod") or row.get("recruitCount")
    return True


def display_name(row):
    name = row.get("admissionName", "")
    if row.get("phase") == "정시" and row.get("admissionType") == "수능위주":
        count = row.get("recruitCount")
        if count in {321, 358, 363}:
            return f"일반전형1({name})"
        if count in {84, 73}:
            return f"일반전형2({name})"
    return name


def main():
    admissions_path = ROOT / "admissions.json"
    admissions = json.loads(admissions_path.read_text(encoding="utf-8"))
    detail_rows = json.loads((REPORT_DIR / "core_summary_table_rows.json").read_text(encoding="utf-8"))

    promoted = []
    for row in detail_rows:
        if row.get("univId") != "gachon" or not keep_for_app(row):
            continue
        eligible, reason = ged_for(row)
        promoted.append(
            {
                "univId": "gachon",
                "phase": row.get("phase", ""),
                "admissionType": row.get("admissionType", ""),
                "admissionName": display_name(row),
                "gedEligible": eligible,
                "gedIneligibleReason": reason,
                "gedReflection": row.get("gedReflection", ""),
                "comparativeGrade": "",
                "evalMethod": normalize_method(row.get("evalMethod", "")),
                "interview": bool(row.get("interview")),
                "csatMinimum": row.get("csatMinimum") or ("해당없음(정시)" if row.get("phase") == "정시" else "미확인"),
                "recruitCount": row.get("recruitCount"),
                "unit": "",
                "note": row.get("note", ""),
                "source": row.get("source", ""),
                "status": "confirmed_detail",
            }
        )

    new_admissions = [row for row in admissions if row.get("univId") != "gachon"]
    new_admissions.extend(promoted)

    admissions_path.write_text(
        json.dumps(new_admissions, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    report = {
        "removedBaselineRows": len(admissions) - len([row for row in admissions if row.get("univId") != "gachon"]),
        "promotedRows": len(promoted),
        "totalAdmissions": len(new_admissions),
        "promotedNames": [row["admissionName"] for row in promoted],
    }
    (REPORT_DIR / "gachon_promotion_report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
