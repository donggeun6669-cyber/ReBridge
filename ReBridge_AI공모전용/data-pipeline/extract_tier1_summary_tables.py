import json
import re
import argparse
from collections import defaultdict
from pathlib import Path

import pdfplumber


ROOT = Path(__file__).resolve().parent
PDF_DIR = ROOT / "pdf_sources" / "2028"
REPORT_DIR = ROOT / "reports"
PATCH_DIR = ROOT / "patches"
EVIDENCE_DIR = ROOT / "evidence"


def clean(value):
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value).replace("\x00", " ")).strip()


def parse_int(value):
    value = clean(value)
    if not value or "정원외" in value:
        return None
    match = re.search(r"\d[\d,]*", value)
    if not match:
        return None
    return int(match.group(0).replace(",", ""))


def normalize_type(raw):
    value = clean(raw)
    if "종합" in value:
        return "학생부종합"
    if "교과" in value:
        return "학생부교과"
    if "논술" in value:
        return "논술"
    if "실기" in value or "실적" in value:
        return "실기"
    if "수능" in value or "정시" in value:
        return "수능위주"
    return value


def infer_phase(raw, admission_type):
    value = clean(raw)
    if "정시" in value:
        return "정시"
    if "수시" in value:
        return "수시"
    if admission_type == "수능위주":
        return "정시"
    return "수시"


def infer_csat(note):
    value = clean(note)
    if not value:
        return ""
    if "최저" not in value:
        return ""
    if "미적용" in value or "없음" in value:
        return "없음"
    if "적용" in value:
        return "적용(세부 기준 확인 필요)"
    return "세부 기준 확인 필요"


def infer_ged_reflection(admission_type):
    return {
        "학생부종합": "학생부 대체서식 + 검정고시 성적으로 서류 종합평가",
        "학생부교과": "비교내신 환산 또는 대학별 검정고시 성적 환산",
        "논술": "논술고사 중심, 검정고시 성적은 대학별 기준으로 반영",
        "실기": "실기고사 중심, 검정고시 성적은 대학별 기준으로 반영",
        "수능위주": "수능 점수 반영",
    }.get(admission_type, "")


def header_map(row):
    cells = [clean(cell) for cell in row]
    mapping = {}
    for index, cell in enumerate(cells):
        if not cell:
            continue
        if "모집시기" in cell:
            mapping["phase"] = index
        elif "전형유형" in cell or "전형구분" in cell:
            mapping["type"] = index
        elif "모집전형" in cell or "전형명" in cell or cell == "전형":
            mapping["name"] = index
        elif "모집인원" in cell or cell == "인원":
            mapping["count"] = index
        elif "전형방법" in cell or "반영비율" in cell:
            mapping["method"] = index
        elif "비고" in cell:
            mapping["note"] = index
    required = {"type", "name", "count", "method"}
    if required.issubset(mapping):
        return mapping
    return None


def get_cell(row, index):
    if index is None or index >= len(row):
        return ""
    return clean(row[index])


def table_rows_to_records(table, meta, page_number):
    records = []
    mapping = None
    header_index = -1
    for i, row in enumerate(table):
        mapping = header_map(row)
        if mapping:
            header_index = i
            break
    if not mapping:
        return records

    last_phase = ""
    last_type = ""
    for row in table[header_index + 1 :]:
        phase = get_cell(row, mapping.get("phase")) or last_phase
        raw_type = get_cell(row, mapping.get("type")) or last_type
        name = get_cell(row, mapping.get("name"))
        count_raw = get_cell(row, mapping.get("count"))
        method = get_cell(row, mapping.get("method"))
        note = get_cell(row, mapping.get("note"))

        if phase:
            last_phase = phase
        if raw_type:
            last_type = raw_type
        if not name or not (count_raw or method or note):
            continue
        if re.search(r"계$|합계|소계", name):
            continue

        admission_type = normalize_type(raw_type)
        record = {
            "univId": meta["univId"],
            "university": meta["university"],
            "phase": infer_phase(phase, admission_type),
            "admissionType": admission_type,
            "admissionName": name,
            "recruitCount": parse_int(count_raw),
            "evalMethod": method,
            "interview": "면접" in method,
            "csatMinimum": infer_csat(note),
            "note": note,
            "source": f"{meta['university']} 2028 시행계획 p.{page_number} ({meta['pdf']})",
            "status": "confirmed_summary",
            "pdf": meta["pdf"],
            "page": page_number,
        }
        record["gedReflection"] = infer_ged_reflection(admission_type)
        records.append(record)
    return records


def main():
    parser = argparse.ArgumentParser(description="Extract Tier 1 admissions summary tables.")
    parser.add_argument("--max-pages", type=int, default=12)
    parser.add_argument("--limit-universities", type=int, default=0)
    parser.add_argument("--offset-universities", type=int, default=0)
    parser.add_argument("--out-prefix", default="tier1_summary_extracted")
    parser.add_argument("--univ-id", action="append", default=[])
    args = parser.parse_args()

    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    PATCH_DIR.mkdir(parents=True, exist_ok=True)
    tier1 = json.loads((REPORT_DIR / "tier1_detail_candidates.json").read_text(encoding="utf-8"))
    tier1_ids = {row["univId"] for row in tier1}
    manifest = json.loads((REPORT_DIR / "pdf_text_manifest.json").read_text(encoding="utf-8"))
    manifest = [row for row in manifest if row["univId"] in tier1_ids]
    if args.univ_id:
        wanted = set(args.univ_id)
        manifest = [row for row in manifest if row["univId"] in wanted]
    if args.limit_universities or args.offset_universities:
        allowed = set()
        for row in manifest:
            allowed.add(row["univId"])
        ordered = sorted(allowed)
        if args.offset_universities:
            ordered = ordered[args.offset_universities :]
        if args.limit_universities:
            ordered = ordered[: args.limit_universities]
        allowed = set(ordered)
        if allowed:
            manifest = [row for row in manifest if row["univId"] in allowed]
        else:
            manifest = []

    extracted = []
    failures = []
    pages_by_univ_pdf = defaultdict(set)
    for evidence_path in EVIDENCE_DIR.glob("*.jsonl"):
        if evidence_path.stem not in tier1_ids:
            continue
        with evidence_path.open(encoding="utf-8") as f:
            for line in f:
                if not line.strip():
                    continue
                row = json.loads(line)
                categories = set(row.get("categories", []))
                if "recruit_count" in categories and "eval_method" in categories:
                    if row.get("page", 9999) <= args.max_pages:
                        pages_by_univ_pdf[(evidence_path.stem, row.get("pdf", ""))].add(row["page"])

    for meta in manifest:
        path = PDF_DIR / meta["pdf"]
        target_pages = sorted(pages_by_univ_pdf.get((meta["univId"], meta["pdf"]), set()))
        if not target_pages:
            continue
        try:
            with pdfplumber.open(path) as pdf:
                for page_index in target_pages:
                    if page_index < 1 or page_index > len(pdf.pages):
                        continue
                    page = pdf.pages[page_index - 1]
                    text = clean(page.extract_text() or "")
                    if not (
                        ("모집시기" in text or "전형유형" in text)
                        and ("전형방법" in text or "반영비율" in text)
                        and "모집인원" in text
                    ):
                        continue
                    for table in page.extract_tables() or []:
                        extracted.extend(table_rows_to_records(table, meta, page_index))
        except Exception as exc:
            failures.append({"pdf": meta["pdf"], "error": str(exc)})

    # Deduplicate exact campus/page duplicates.
    deduped = []
    seen = set()
    for row in extracted:
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

    out_json = REPORT_DIR / f"{args.out_prefix}.json"
    out_json.write_text(json.dumps(deduped, ensure_ascii=False, indent=2), encoding="utf-8")
    (PATCH_DIR / "tier1_summary_extracted.json").write_text(
        json.dumps(deduped, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (REPORT_DIR / f"{args.out_prefix}_failures.json").write_text(
        json.dumps(failures, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    by_univ = defaultdict(int)
    for row in deduped:
        by_univ[row["university"]] += 1

    lines = [
        "# Tier 1 전형별 요약표 추출 결과",
        "",
        f"- 추출 전형 행: {len(deduped)}",
        f"- 추출 대학 수: {len(by_univ)}",
        f"- 실패 PDF: {len(failures)}",
        "",
        "| 대학 | 추출 행 |",
        "| --- | ---: |",
    ]
    for university, count in sorted(by_univ.items()):
        lines.append(f"| {university} | {count} |")
    lines.append("")
    lines.append("## 샘플")
    for row in deduped[:80]:
        lines.append(
            f"- {row['university']} · {row['phase']} · {row['admissionType']} · "
            f"{row['admissionName']} · {row.get('recruitCount') or ''}명 · "
            f"{row.get('evalMethod') or ''} · {row.get('csatMinimum') or ''} · p.{row['page']}"
        )
    (REPORT_DIR / f"{args.out_prefix}.md").write_text("\n".join(lines), encoding="utf-8")

    print(f"Extracted rows: {len(deduped)}")
    print(f"Universities: {len(by_univ)}")
    print(f"Failures: {len(failures)}")


if __name__ == "__main__":
    main()
