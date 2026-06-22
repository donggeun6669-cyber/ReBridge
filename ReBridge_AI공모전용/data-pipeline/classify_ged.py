import argparse
import json
import re
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parent
EVIDENCE_DIR = ROOT / "evidence"
PATCH_DIR = ROOT / "patches"
REPORT_DIR = ROOT / "reports"

STANDARD_ELIGIBILITY = re.compile(
    r"(고등학교\s*졸업|고교\s*졸업|졸업\s*\(예정\)).{0,80}"
    r"(동등\s*이상.*학력|동등.*자격|법령.*동등)",
    re.S,
)
GED_EXPLICIT = re.compile(r"검정\s*고시|고등학교\s*졸업\s*학력\s*검정\s*고시")
SCHOOL_RECOMMEND = re.compile(r"학교장\s*(추천|의\s*추천)")
GRADUATING_ONLY = re.compile(r"(졸업\s*예정자.{0,20}(에\s*한|만)|재학생.{0,20}(에\s*한|만))")
GED_INELIGIBLE = re.compile(r"검정\s*고시.{0,40}(지원\s*불가|제외|불인정|불가)")
REGULAR_SCHOOL = re.compile(r"정규\s*(고등학교|고교).{0,40}(이수|교육과정)")
REGIONAL_RECOMMEND = re.compile(r"(지역균형|지역인재).{0,80}(학교장\s*추천|추천)")


REFLECTION_BY_TYPE = {
    "학생부종합": "학생부 대체서식 + 검정고시 성적으로 서류 종합평가",
    "학생부교과": "비교내신 환산 또는 대학별 검정고시 성적 환산",
    "논술": "논술고사 중심, 검정고시 성적은 대학별 기준으로 반영",
    "실기": "실기고사 중심, 검정고시 성적은 대학별 기준으로 반영",
    "수능위주": "수능 점수 반영",
}


def read_jsonl(path):
    with path.open(encoding="utf-8") as f:
        for line in f:
            if line.strip():
                yield json.loads(line)


def compact(text):
    return re.sub(r"\s+", " ", text or "").strip()


def source_for(university_name, rows):
    pages = [row["page"] for row in rows if row.get("page")]
    if not pages:
        return ""
    pdfs = sorted({row.get("pdf", "") for row in rows if row.get("pdf")})
    pages = sorted(set(pages))
    if len(pages) == 1:
        page_text = f"p.{pages[0]}"
    else:
        preview = pages[:5]
        page_text = "p." + ",".join(str(page) for page in preview)
        if len(pages) > 5:
            page_text += "..."
    if len(pdfs) == 1 and pdfs[0]:
        return f"{university_name} 2028 시행계획 {page_text} ({pdfs[0]})"
    return f"{university_name} 2028 시행계획 {page_text}"


def classify_text(evidence_rows):
    joined = "\n".join(row.get("text", "") for row in evidence_rows)
    text = compact(joined)
    pages_by_category = defaultdict(list)
    for row in evidence_rows:
        for category in row.get("categories", []):
            pages_by_category[category].append(row["page"])

    signals = {
        "ged_ineligible": bool(GED_INELIGIBLE.search(text)),
        "school_recommend": bool(SCHOOL_RECOMMEND.search(text)),
        "graduating_only": bool(GRADUATING_ONLY.search(text)),
        "regular_school": bool(REGULAR_SCHOOL.search(text)),
        "regional_recommend": bool(REGIONAL_RECOMMEND.search(text)),
        "standard_or_ged": bool(GED_EXPLICIT.search(text) or STANDARD_ELIGIBILITY.search(text)),
    }
    status = "confirmed" if signals["standard_or_ged"] or signals["ged_ineligible"] else "baseline"
    return signals, status, pages_by_category


def classify_admission(admission, signals, default_status):
    name = f"{admission.get('admissionType', '')} {admission.get('admissionName', '')}"
    if admission.get("admissionType") == "수능위주":
        return "가능", "", "confirmed" if signals["standard_or_ged"] else default_status
    if signals["ged_ineligible"]:
        return "불가", "검정고시 출신은 지원이 제한돼요", "confirmed"
    if re.search(r"추천|지역균형|지역인재", name) and signals["school_recommend"]:
        if signals["regional_recommend"]:
            return "조건부", "지역·추천 요건을 확인해야 해요", "confirmed"
        return "불가", "학교장 추천이 필요한 전형이에요", "confirmed"
    if signals["graduating_only"] and re.search(r"졸업예정|재학생|고교\s*재학", name):
        return "불가", "재학 중인 졸업예정자만 지원할 수 있어요", "confirmed"
    if signals["regular_school"] and admission.get("admissionType") == "학생부교과":
        return "조건부", "정규 고교 이수 조건이 있어 확인이 필요해요", "confirmed"
    return "가능", "", "confirmed" if signals["standard_or_ged"] else default_status


def main():
    parser = argparse.ArgumentParser(description="Create GED eligibility patches from evidence pages.")
    parser.add_argument("--evidence-dir", default=str(EVIDENCE_DIR))
    parser.add_argument("--patch-dir", default=str(PATCH_DIR))
    args = parser.parse_args()

    evidence_dir = Path(args.evidence_dir)
    patch_dir = Path(args.patch_dir)
    patch_dir.mkdir(parents=True, exist_ok=True)
    REPORT_DIR.mkdir(parents=True, exist_ok=True)

    universities = json.loads((ROOT / "universities.json").read_text(encoding="utf-8"))
    university_by_id = {row["univId"]: row for row in universities}
    admissions = json.loads((ROOT / "admissions.json").read_text(encoding="utf-8"))
    admissions_by_id = defaultdict(list)
    for row in admissions:
        admissions_by_id[row["univId"]].append(row)

    patches = []
    summary = defaultdict(int)

    for evidence_file in sorted(evidence_dir.glob("*.jsonl")):
        univ_id = evidence_file.stem
        university = university_by_id.get(univ_id)
        if not university:
            continue
        evidence_rows = list(read_jsonl(evidence_file))
        signals, status, pages_by_category = classify_text(evidence_rows)
        eligibility_pages = set(pages_by_category.get("eligibility") or [])
        source_rows = [row for row in evidence_rows if row.get("page") in eligibility_pages]
        if not source_rows:
            source_rows = evidence_rows[:3]
        source = source_for(university["name"], source_rows)
        for admission in admissions_by_id.get(univ_id, []):
            admission_type = admission.get("admissionType", "")
            row_eligible, row_reason, row_status = classify_admission(admission, signals, status)
            patches.append(
                {
                    "univId": univ_id,
                    "phase": admission.get("phase", ""),
                    "admissionType": admission_type,
                    "admissionName": admission.get("admissionName", ""),
                    "gedEligible": row_eligible,
                    "gedIneligibleReason": row_reason,
                    "gedReflection": REFLECTION_BY_TYPE.get(
                        admission_type, admission.get("gedReflection", "")
                    ),
                    "source": source or admission.get("source", ""),
                    "status": row_status,
                }
            )
            summary[f"{row_eligible}/{row_status}"] += 1

    out_path = patch_dir / "ged_patches.json"
    out_path.write_text(json.dumps(patches, ensure_ascii=False, indent=2), encoding="utf-8")
    (REPORT_DIR / "ged_patch_summary.json").write_text(
        json.dumps(dict(sorted(summary.items())), ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"GED patches: {len(patches)}")
    print(f"summary: {dict(sorted(summary.items()))}")


if __name__ == "__main__":
    main()
