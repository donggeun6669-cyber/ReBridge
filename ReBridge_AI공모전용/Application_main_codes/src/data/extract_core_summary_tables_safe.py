import json
import multiprocessing as mp
import re
from collections import defaultdict
from pathlib import Path

from extract_tier1_summary_tables import table_rows_to_records


ROOT = Path(__file__).resolve().parent
PDF_DIR = ROOT / "pdf_sources" / "2028"
EVIDENCE_DIR = ROOT / "evidence"
REPORT_DIR = ROOT / "reports"
PATCH_DIR = ROOT / "patches"

CORE_UNIV_IDS = [
    "gachon",
    "kookmin",
    "uos",
    "seoultech",
    "soongsil",
    "sejong",
    "hanyang",
    "cau",
    "kyunghee",
    "inha",
    "ajou",
    "pusan",
    "knu",
    "cnu",
    "jbnu",
]


def clean(value):
    return re.sub(r"\s+", " ", (value or "").replace("\x00", " ")).strip()


def read_jsonl(path):
    with path.open(encoding="utf-8") as f:
        for line in f:
            if line.strip():
                yield json.loads(line)


def extract_page_worker(pdf_path, meta, page_number, queue):
    try:
        import pdfplumber

        rows = []
        with pdfplumber.open(pdf_path) as pdf:
            if page_number < 1 or page_number > len(pdf.pages):
                queue.put({"ok": True, "rows": []})
                return
            page = pdf.pages[page_number - 1]
            text = clean(page.extract_text() or "")
            if not (
                ("모집시기" in text or "전형유형" in text or "전형명" in text)
                and ("전형방법" in text or "반영비율" in text)
                and "모집인원" in text
            ):
                queue.put({"ok": True, "rows": []})
                return
            for table in page.extract_tables() or []:
                rows.extend(table_rows_to_records(table, meta, page_number))
        queue.put({"ok": True, "rows": rows})
    except Exception as exc:
        queue.put({"ok": False, "error": str(exc), "rows": []})


def extract_page_with_timeout(pdf_path, meta, page_number, timeout_seconds=15):
    queue = mp.Queue()
    process = mp.Process(target=extract_page_worker, args=(str(pdf_path), meta, page_number, queue))
    process.start()
    process.join(timeout_seconds)
    if process.is_alive():
        process.terminate()
        process.join()
        return {"ok": False, "timeout": True, "rows": []}
    if queue.empty():
        return {"ok": False, "error": "no result", "rows": []}
    return queue.get()


def main():
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    PATCH_DIR.mkdir(parents=True, exist_ok=True)
    manifest = json.loads((REPORT_DIR / "pdf_text_manifest.json").read_text(encoding="utf-8"))
    manifest = [row for row in manifest if row["univId"] in CORE_UNIV_IDS]
    universities = json.loads((ROOT / "universities.json").read_text(encoding="utf-8"))
    univ_by_id = {row["univId"]: row for row in universities}

    pages_by_univ_pdf = defaultdict(set)
    for univ_id in CORE_UNIV_IDS:
        evidence_path = EVIDENCE_DIR / f"{univ_id}.jsonl"
        if not evidence_path.exists():
            continue
        for row in read_jsonl(evidence_path):
            categories = set(row.get("categories", []))
            if row.get("page", 999) > 15:
                continue
            if "recruit_count" in categories and "eval_method" in categories:
                pages_by_univ_pdf[(univ_id, row.get("pdf", ""))].add(row["page"])

    extracted = []
    page_reports = []
    for meta in manifest:
        pdf_path = PDF_DIR / meta["pdf"]
        target_pages = sorted(pages_by_univ_pdf.get((meta["univId"], meta["pdf"]), set()))
        if not target_pages:
            page_reports.append(
                {
                    "univId": meta["univId"],
                    "university": meta["university"],
                    "pdf": meta["pdf"],
                    "status": "no_candidate_pages",
                }
            )
            continue
        for page_number in target_pages:
            result = extract_page_with_timeout(pdf_path, meta, page_number)
            rows = result.get("rows", [])
            extracted.extend(rows)
            page_reports.append(
                {
                    "univId": meta["univId"],
                    "university": meta["university"],
                    "pdf": meta["pdf"],
                    "page": page_number,
                    "rows": len(rows),
                    "ok": result.get("ok", False),
                    "timeout": result.get("timeout", False),
                    "error": result.get("error", ""),
                }
            )

    deduped = []
    seen = set()
    for row in extracted:
        name = row.get("admissionName", "")
        if not name or name in {"-", "소계", "합계", "계"} or re.fullmatch(r"\d+", name):
            continue
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

    (REPORT_DIR / "core_summary_table_rows.json").write_text(
        json.dumps(deduped, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (PATCH_DIR / "core_summary_table_rows.json").write_text(
        json.dumps(deduped, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (REPORT_DIR / "core_summary_page_report.json").write_text(
        json.dumps(page_reports, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    by_univ = defaultdict(int)
    for row in deduped:
        by_univ[row["university"]] += 1

    lines = [
        "# 핵심 대학 전형별 요약표 안전 추출 결과",
        "",
        "> pdfplumber를 페이지별 제한시간으로 실행했다. 느린 페이지는 건너뛰고, 표 구조가 잡힌 행만 후보로 저장했다.",
        "",
        f"- 핵심 대학 목표: {len(CORE_UNIV_IDS)}개",
        f"- 추출 성공 대학: {len(by_univ)}개",
        f"- 추출 후보 행: {len(deduped)}행",
        "",
        "| 대학 | 후보 행 |",
        "| --- | ---: |",
    ]
    for univ_id in CORE_UNIV_IDS:
        university = univ_by_id.get(univ_id, {}).get("name", univ_id)
        lines.append(f"| {university} | {by_univ.get(university, 0)} |")
    lines.extend(["", "## 후보 샘플"])
    for row in deduped[:120]:
        lines.append(
            f"- {row['university']} · {row['phase']} · {row['admissionType']} · "
            f"{row['admissionName']} · {row.get('recruitCount') or ''}명 · "
            f"{row.get('evalMethod') or ''} · {row.get('csatMinimum') or ''} · p.{row['page']}"
        )
    (REPORT_DIR / "core_summary_table_rows.md").write_text("\n".join(lines), encoding="utf-8")

    print(f"Core rows: {len(deduped)}")
    print(f"Universities with rows: {len(by_univ)}")


if __name__ == "__main__":
    mp.freeze_support()
    main()
