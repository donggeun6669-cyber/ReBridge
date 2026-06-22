import json
from collections import Counter
from pathlib import Path


BASE = Path(__file__).resolve().parent
CLEAN = BASE / "results_2025_clean.json"
REPORT = BASE / "reports" / "fix_knu_confidence_report.md"


def is_normal_grade(value):
    return isinstance(value, (int, float)) and 1.0 <= value <= 9.0


def is_normal_score(value):
    return isinstance(value, (int, float)) and 30.0 <= value <= 1000.0


def classify(row):
    note = row.get("note") or ""
    grade = row.get("cutGrade")
    score = row.get("cutScore")
    cut_type = row.get("cutType")

    if "스케일의심" in note or "score<30 의심" in note:
        return "scale_suspect"
    if cut_type == "최저" and score is not None and score < 30:
        return "low_score_min_cut"
    if grade is not None and not is_normal_grade(grade):
        return "grade_out_of_range"
    if score is not None and not is_normal_score(score):
        return "score_out_of_range"
    if grade is None and score is None:
        return "missing_cut_value"
    if row.get("admissionType") == "":
        return "promotable_admission_type_blank"
    if "병합충돌" in note:
        return "promotable_merge_conflict_normal_value"
    return "promotable_normal_value"


def main():
    rows = json.loads(CLEAN.read_text(encoding="utf-8"))
    knu_before = [row for row in rows if row.get("univId") == "knu"]
    before_conf = Counter(row.get("confidence") for row in knu_before)
    before_low = [row for row in knu_before if row.get("confidence") == "low"]
    before_note = Counter(row.get("note", "") for row in before_low)
    before_type = Counter(row.get("admissionType", "") for row in before_low)
    before_value = Counter(
        (
            "grade" if row.get("cutGrade") is not None else "score" if row.get("cutScore") is not None else "missing"
        )
        for row in before_low
    )
    before_source = Counter((row.get("sourceFile"), row.get("sourcePage")) for row in before_low)

    reason_counter = Counter()
    promoted = 0
    blocked_samples = []

    for row in rows:
        if row.get("univId") != "knu" or row.get("confidence") != "low":
            continue
        reason = classify(row)
        reason_counter[reason] += 1
        if reason.startswith("promotable"):
            row["confidence"] = "mid"
            note = row.get("note") or ""
            marker = f"[KNU: {reason} → mid]"
            row["note"] = f"{note} {marker}".strip()
            promoted += 1
        elif len(blocked_samples) < 40:
            blocked_samples.append(row | {"knuBlockReason": reason})

    knu_after = [row for row in rows if row.get("univId") == "knu"]
    after_conf = Counter(row.get("confidence") for row in knu_after)

    CLEAN.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    REPORT.parent.mkdir(parents=True, exist_ok=True)

    lines = [
        "# KNU confidence 보정 리포트",
        "",
        "## 요약",
        "",
        f"- KNU 전체 행: {len(knu_before)}",
        f"- 보정 전 low: {before_conf.get('low', 0)}",
        f"- mid 승격: {promoted}",
        f"- 보정 후 low: {after_conf.get('low', 0)}",
        "",
        "## confidence 변화",
        "",
        "| confidence | before | after |",
        "| --- | ---: | ---: |",
    ]
    for key in ["high", "mid", "low"]:
        lines.append(f"| {key} | {before_conf.get(key, 0)} | {after_conf.get(key, 0)} |")

    lines.extend(["", "## low 행 패턴", "", "### note 분포", "", "| note | count |", "| --- | ---: |"])
    for note, count in before_note.most_common(20):
        lines.append(f"| {note or '(blank)'} | {count} |")

    lines.extend(["", "### cut 값 유형", "", "| valueType | count |", "| --- | ---: |"])
    for key, count in before_value.most_common():
        lines.append(f"| {key} | {count} |")

    lines.extend(["", "### admissionType 분포", "", "| admissionType | count |", "| --- | ---: |"])
    for key, count in before_type.most_common():
        lines.append(f"| {key or '(blank)'} | {count} |")

    lines.extend(["", "### sourceFile/sourcePage 상위", "", "| sourceFile | page | count |", "| --- | ---: | ---: |"])
    for (source_file, source_page), count in before_source.most_common(20):
        lines.append(f"| {source_file} | {source_page} | {count} |")

    lines.extend(["", "## 원인 분류 및 처리", "", "| reason | count | action |", "| --- | ---: | --- |"])
    for reason, count in reason_counter.most_common():
        action = "mid 승격" if reason.startswith("promotable") else "low 유지"
        lines.append(f"| {reason} | {count} | {action} |")

    lines.extend(["", "## 개선 불가 샘플", ""])
    if blocked_samples:
        for row in blocked_samples:
            lines.append(
                f"- {row.get('sourceFile')} p.{row.get('sourcePage')} · {row.get('unit')} · "
                f"{row.get('cutType')} · grade={row.get('cutGrade')} score={row.get('cutScore')} · "
                f"{row.get('knuBlockReason')}"
            )
    else:
        lines.append("- 없음")

    REPORT.write_text("\n".join(lines) + "\n", encoding="utf-8")

    print(f"KNU low before: {before_conf.get('low', 0)}")
    print(f"promoted: {promoted}")
    print(f"KNU low after: {after_conf.get('low', 0)}")
    print(f"report: {REPORT}")


if __name__ == "__main__":
    main()
