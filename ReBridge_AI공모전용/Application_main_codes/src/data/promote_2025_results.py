import json
import re
from collections import Counter, defaultdict
from pathlib import Path


BASE = Path(__file__).resolve().parent
RESULTS = BASE / "results_2025_clean.json"
ADMISSIONS = BASE / "admissions.json"
OUT = BASE / "admissions_with_results.json"
REPORT = BASE / "reports" / "promote_2025_report.md"

CORE_UNIV_IDS = {"cau", "inha", "hanyang", "pusan", "knu", "skku", "kookmin", "uos"}


NAME_SYNONYMS = {
    "지역균형": ["교과지역균형", "학생부교과(지역균형)", "지역균형전형", "고교추천", "학교장추천", "추천형"],
    "교과우수": ["교과우수전형", "학생부교과", "교과"],
    "학생부종합": ["학생부종합전형", "서류전형", "면접전형", "융합인재", "탐구인재", "성균인재"],
    "논술": ["논술전형", "모두의 논술"],
    "일반전형": ["수능위주전형(일반)", "수능우수전형", "일반전형 일반형", "일반전형 특화형"],
}


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def norm(value):
    return re.sub(r"[\s\[\]\(\)_\-·ㆍ,./:]", "", value or "")


def name_tokens(value):
    raw = value or ""
    tokens = {norm(raw)}
    for key, values in NAME_SYNONYMS.items():
        if key in raw or norm(key) in tokens:
            tokens.add(norm(key))
            tokens.update(norm(item) for item in values)
        for item in values:
            if item in raw or norm(item) in tokens:
                tokens.add(norm(key))
                tokens.update(norm(v) for v in values)
    return {token for token in tokens if token}


def names_match(admission_name, result_name):
    if not admission_name or not result_name:
        return False
    a_tokens = name_tokens(admission_name)
    r_tokens = name_tokens(result_name)
    if a_tokens & r_tokens:
        return True
    a = norm(admission_name)
    r = norm(result_name)
    return bool(a and r and (a in r or r in a))


def mean(values):
    values = [value for value in values if value is not None]
    return round(sum(values) / len(values), 4) if values else None


def aggregate(rows, source_confidence):
    unit_values = {row.get("unit") for row in rows if row.get("unit")}
    cut_grades = [row.get("cutGrade") for row in rows if row.get("cutGrade") is not None]
    cut_scores = [row.get("cutScore") for row in rows if row.get("cutScore") is not None]
    cut_type_counter = Counter(row.get("cutType") for row in rows if row.get("cutType"))
    return {
        "unitCount": len(unit_values),
        "cutGradeMin": round(min(cut_grades), 4) if cut_grades else None,
        "cutGradeMean": mean(cut_grades),
        "cutGradeMax": round(max(cut_grades), 4) if cut_grades else None,
        "cutScoreMean": mean(cut_scores),
        "dominantCutType": cut_type_counter.most_common(1)[0][0] if cut_type_counter else None,
        "rowCount": len(rows),
        "sourceConfidence": source_confidence,
    }


def best_group_for_admission(admission, grouped):
    key = (admission.get("univId"), admission.get("admissionType"))
    rows = grouped.get(key, [])
    if not rows:
        return []
    named = [row for row in rows if names_match(admission.get("admissionName", ""), row.get("admissionName", ""))]
    return named or rows


def main():
    results = load(RESULTS)
    admissions = load(ADMISSIONS)
    REPORT.parent.mkdir(parents=True, exist_ok=True)

    high_by_key = defaultdict(list)
    mid_by_key = defaultdict(list)
    for row in results:
        key = (row.get("univId"), row.get("admissionType"))
        if row.get("confidence") == "high":
            high_by_key[key].append(row)
        elif row.get("confidence") == "mid":
            mid_by_key[key].append(row)

    output = []
    matched_high = 0
    matched_mid = 0
    mid_fallback = 0
    unmatched = []

    for admission in admissions:
        row = dict(admission)
        high_rows = best_group_for_admission(admission, high_by_key)
        mid_rows = best_group_for_admission(admission, mid_by_key)

        row["results2025"] = None
        row["results2025_mid"] = None

        if high_rows:
            row["results2025"] = aggregate(high_rows, "high")
            matched_high += 1
        elif admission.get("univId") in CORE_UNIV_IDS and mid_rows:
            row["results2025"] = aggregate(mid_rows, "mid_fallback")
            mid_fallback += 1
        else:
            unmatched.append(
                {
                    "univId": admission.get("univId"),
                    "admissionType": admission.get("admissionType"),
                    "admissionName": admission.get("admissionName", ""),
                }
            )

        if mid_rows:
            row["results2025_mid"] = aggregate(mid_rows, "mid")
            matched_mid += 1

        output.append(row)

    OUT.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    matched_results = sum(1 for row in output if row.get("results2025") is not None)
    matched_mid_results = sum(1 for row in output if row.get("results2025_mid") is not None)
    core_lines = []
    for univ_id in sorted(CORE_UNIV_IDS):
        rows = [row for row in output if row.get("univId") == univ_id]
        non_null = sum(1 for row in rows if row.get("results2025") is not None)
        mid_non_null = sum(1 for row in rows if row.get("results2025_mid") is not None)
        core_lines.append(f"| {univ_id} | {non_null} | {mid_non_null} | {len(rows)} |")

    by_unmatched = Counter((item["univId"], item["admissionType"]) for item in unmatched)
    lines = [
        "# 2025 입시결과 전형 연결 리포트",
        "",
        "## 요약",
        "",
        f"- 매칭 전형 수 / 전체 전형 수: {matched_results} / {len(admissions)}",
        f"- high 기반 results2025 매칭: {matched_high}",
        f"- 핵심대학 mid_fallback results2025 매칭: {mid_fallback}",
        f"- mid 기반 results2025_mid 매칭: {matched_mid_results}",
        f"- 미매칭 전형 수: {len(unmatched)}",
        "",
        "## 핵심 8개 대학",
        "",
        "| univId | results2025 non-null | results2025_mid non-null | admissions rows |",
        "| --- | ---: | ---: | ---: |",
        *core_lines,
        "",
        "## 매칭 규칙",
        "",
        "- 1차 키: `(univId, admissionType)`.",
        "- 2차 전형명: 정규화 후 포함 관계 및 지역균형/교과지역균형/추천형, 학생부종합 단순 표기 등 동의어를 적용.",
        "- `confidence=high`는 `results2025`에 집계.",
        "- `confidence=mid`는 `results2025_mid`에 별도 집계.",
        "- 핵심 8개 대학 중 high가 없고 mid만 있는 전형은 수용 기준 확인을 위해 `results2025.sourceConfidence=mid_fallback`으로 표시.",
        "- `confidence=low`는 포함하지 않음.",
        "",
        "## 미매칭 상위 20개",
        "",
        "| univId | admissionType | count |",
        "| --- | --- | ---: |",
    ]
    for (univ_id, admission_type), count in by_unmatched.most_common(20):
        lines.append(f"| {univ_id} | {admission_type} | {count} |")

    REPORT.write_text("\n".join(lines) + "\n", encoding="utf-8")

    print(f"wrote {OUT}")
    print(f"matched results2025: {matched_results}/{len(admissions)}")
    print(f"matched results2025_mid: {matched_mid_results}/{len(admissions)}")
    print(f"unmatched: {len(unmatched)}")


if __name__ == "__main__":
    main()
