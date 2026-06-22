import json
import re
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parent
TEXT_DIR = ROOT / "text"
REPORT_DIR = ROOT / "reports"
PATCH_DIR = ROOT / "patches"


TYPE_LINES = [
    ("학생부종합", re.compile(r"학생부.*종합|종합")),
    ("학생부교과", re.compile(r"학생부.*교과|교과")),
    ("논술", re.compile(r"논술")),
    ("실기", re.compile(r"실기|실적")),
    ("수능위주", re.compile(r"수능")),
]


def clean(value):
    value = (value or "").replace("\x00", " ").replace("\x01", " ")
    return re.sub(r"\s+", " ", value).strip()


def is_count(value):
    value = clean(value)
    return bool(re.fullmatch(r"\d[\d,]*|정원외\s*\d*|약간명", value))


def parse_count(value):
    value = clean(value)
    if "정원외" in value or "약간" in value:
        return None
    return int(value.replace(",", ""))


def is_method(value):
    value = clean(value)
    return bool(re.search(r"(서류|면접|논술|학생부|교과|수능|실기|출결).{0,20}(\d+%|\d+\s*\+|\d+)", value))


def infer_type(line, current_type):
    value = clean(line)
    if "학생부위주" in value:
        return current_type
    if value in {"(교과)", "교과"}:
        return "학생부교과"
    if value in {"(종합)", "종합"}:
        return "학생부종합"
    for mapped, pattern in TYPE_LINES:
        if pattern.fullmatch(value) or pattern.search(value):
            if len(value) <= 12:
                return mapped
    return current_type


def infer_phase(line, current_phase, admission_type):
    value = clean(line)
    if value == "수시" or "수시모집" in value:
        return "수시"
    if value == "정시" or "정시모집" in value:
        return "정시"
    if admission_type == "수능위주":
        return "정시"
    return current_phase or "수시"


def infer_csat(lines):
    joined = " ".join(clean(line) for line in lines)
    if "최저" not in joined:
        return ""
    if "미적용" in joined or "없음" in joined:
        return "없음"
    if "적용" in joined:
        return "적용(세부 기준 확인 필요)"
    return "세부 기준 확인 필요"


def read_jsonl(path):
    with path.open(encoding="utf-8") as f:
        for line in f:
            if line.strip():
                yield json.loads(line)


def relevant_page(row):
    text = row.get("text", "")
    return (
        "모집시기" in text
        and "전형" in text
        and "모집인원" in text
        and ("전형방법" in text or "반영비율" in text)
    )


def parse_page(univ_id, university, row):
    lines = [clean(line) for line in row.get("text", "").splitlines()]
    lines = [line for line in lines if line]
    records = []
    current_phase = ""
    current_type = ""
    i = 0
    while i < len(lines):
        line = lines[i]
        current_type = infer_type(line, current_type)
        current_phase = infer_phase(line, current_phase, current_type)

        if i + 1 < len(lines) and is_count(lines[i + 1]):
            name = line
            # Skip obvious headers and units.
            if re.search(r"모집|전형|비고|계열|학년도|구분|합계|소계|정원내|정원외", name):
                i += 1
                continue
            count = parse_count(lines[i + 1])
            lookahead = lines[i + 2 : i + 7]
            method_lines = [item for item in lookahead if is_method(item)]
            note_lines = [item for item in lookahead if "최저" in item]
            method = " ".join(method_lines[:2])
            if count is not None or method:
                admission_type = current_type or ("수능위주" if current_phase == "정시" else "")
                records.append(
                    {
                        "univId": univ_id,
                        "university": university,
                        "phase": infer_phase("", current_phase, admission_type),
                        "admissionType": admission_type,
                        "admissionName": name,
                        "recruitCount": count,
                        "evalMethod": method,
                        "interview": "면접" in method,
                        "csatMinimum": infer_csat(note_lines),
                        "source": f"{university} 2028 시행계획 p.{row['page']} ({row.get('pdf', '')})",
                        "status": "candidate_text",
                        "pdf": row.get("pdf", ""),
                        "page": row["page"],
                    }
                )
            i += 2
            continue
        i += 1
    return records


def main():
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    PATCH_DIR.mkdir(parents=True, exist_ok=True)
    tier1 = json.loads((REPORT_DIR / "tier1_detail_candidates.json").read_text(encoding="utf-8"))
    tier1_by_id = {row["univId"]: row for row in tier1}
    records = []
    for univ_id, university in tier1_by_id.items():
        path = TEXT_DIR / f"{univ_id}.jsonl"
        if not path.exists():
            continue
        for row in read_jsonl(path):
            if row.get("page", 999) > 12:
                continue
            if relevant_page(row):
                records.extend(parse_page(univ_id, university["name"], row))

    deduped = []
    seen = set()
    for row in records:
        key = (
            row["univId"],
            row["phase"],
            row["admissionType"],
            row["admissionName"],
            row.get("recruitCount"),
            row.get("evalMethod"),
        )
        if key in seen:
            continue
        seen.add(key)
        deduped.append(row)

    out_json = REPORT_DIR / "tier1_summary_text_candidates.json"
    out_json.write_text(json.dumps(deduped, ensure_ascii=False, indent=2), encoding="utf-8")
    (PATCH_DIR / "tier1_summary_text_candidates.json").write_text(
        json.dumps(deduped, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    by_univ = defaultdict(int)
    for row in deduped:
        by_univ[row["university"]] += 1

    lines = [
        "# Tier 1 전형별 요약 후보 - 텍스트 추출",
        "",
        "> 이 결과는 빠른 텍스트 기반 후보입니다. PDF 표 원문과 대조 후 확정 병합하는 용도입니다.",
        "",
        f"- 후보 행: {len(deduped)}",
        f"- 후보가 나온 대학: {len(by_univ)}",
        "",
        "| 대학 | 후보 행 |",
        "| --- | ---: |",
    ]
    for university, count in sorted(by_univ.items()):
        lines.append(f"| {university} | {count} |")
    lines.append("")
    lines.append("## 후보 샘플")
    for row in deduped[:160]:
        lines.append(
            f"- {row['university']} · {row['phase']} · {row['admissionType']} · "
            f"{row['admissionName']} · {row.get('recruitCount') or ''}명 · "
            f"{row.get('evalMethod') or ''} · {row.get('csatMinimum') or ''} · p.{row['page']}"
        )
    (REPORT_DIR / "tier1_summary_text_candidates.md").write_text(
        "\n".join(lines), encoding="utf-8"
    )
    print(f"Text candidate rows: {len(deduped)}")
    print(f"Universities: {len(by_univ)}")


if __name__ == "__main__":
    main()
