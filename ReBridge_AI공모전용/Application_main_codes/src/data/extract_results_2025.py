import argparse
import json
import logging
import re
import warnings
from collections import Counter, defaultdict
from difflib import SequenceMatcher
from pathlib import Path


warnings.filterwarnings("ignore")
logging.getLogger("pdfminer").setLevel(logging.ERROR)
logging.getLogger("pdfplumber").setLevel(logging.ERROR)

ROOT = Path(__file__).resolve().parent
PDF_DIR = ROOT / "pdf_sources"
REPORT_DIR = ROOT / "reports"
RESULTS_PATH = ROOT / "results_2025.json"
REPORT_PATH = REPORT_DIR / "results_2025_report.md"
UNMATCHED_PATH = REPORT_DIR / "results_2025_unmatched.json"

ANCHORS = [
    "입시결과",
    "합격",
    "최종",
    "등록",
    "충원",
    "70%",
    "80%",
    "평균",
    "등급",
    "환산",
    "경쟁률",
    "모집",
    "수시",
    "정시",
]

ADMISSION_TYPE_RULES = [
    ("학생부종합", ["종합", "학종", "서류"]),
    ("학생부교과", ["교과", "학생부교과", "지역인재", "학교장"]),
    ("수능위주", ["수능", "정시", "일반전형 가", "일반전형 나", "일반전형 다"]),
    ("논술", ["논술"]),
    ("실기", ["실기", "실적", "예체능"]),
    ("일반(서류)", ["일반(서류)"]),
]


def clean(value):
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value).replace("\x00", " ")).strip()


def norm(value):
    return re.sub(r"[\s\[\]\(\)_\-·ㆍ,./]", "", value or "")


def load_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def try_import_pdf_libs():
    pdfplumber = None
    fitz = None
    errors = []
    try:
        import pdfplumber as imported_pdfplumber

        pdfplumber = imported_pdfplumber
    except Exception as exc:
        errors.append(f"pdfplumber: {exc}")
    try:
        import fitz as imported_fitz

        fitz = imported_fitz
    except Exception as exc:
        errors.append(f"fitz(PyMuPDF): {exc}")
    return pdfplumber, fitz, errors


def list_pdfs(pdf_dir):
    return sorted(path for path in pdf_dir.rglob("*.pdf") if path.is_file())


def guess_region_from_name(filename, universities):
    stem = Path(filename).stem
    regions = sorted({row.get("region", "") for row in universities if row.get("region")}, key=len, reverse=True)
    for region in regions:
        if region and region in stem:
            return region
    return ""


def build_university_indexes(universities):
    by_norm_name = defaultdict(list)
    for university in universities:
        by_norm_name[norm(university["name"])].append(university)
    return by_norm_name


def guess_university_from_file(filename, universities, by_norm_name):
    stem_key = norm(Path(filename).stem)
    exact = []
    for name_key, rows in by_norm_name.items():
        if name_key and name_key in stem_key:
            exact.extend(rows)
    if len(exact) == 1:
        return exact[0], "file-name"
    if len(exact) > 1:
        region = guess_region_from_name(filename, universities)
        region_matches = [row for row in exact if row.get("region") == region]
        if len(region_matches) == 1:
            return region_matches[0], "file-name+region"
    return None, "unmatched"


def find_university_in_text(text, universities):
    text_key = norm(text)
    matches = []
    for university in universities:
        name_key = norm(university["name"])
        if name_key and name_key in text_key:
            matches.append(university)
    if not matches:
        return None
    return sorted(matches, key=lambda row: len(norm(row["name"])), reverse=True)[0]


def page_text_by_fitz(path, fitz):
    if fitz is None:
        return []
    pages = []
    with fitz.open(path) as doc:
        for index, page in enumerate(doc, start=1):
            pages.append({"page": index, "text": clean(page.get_text("text") or "")})
    return pages


def extract_tables_by_pdfplumber(path, pdfplumber, target_pages):
    if pdfplumber is None:
        return {}
    tables_by_page = defaultdict(list)
    with pdfplumber.open(path) as pdf:
        for page_no in target_pages:
            if page_no < 1 or page_no > len(pdf.pages):
                continue
            page = pdf.pages[page_no - 1]
            for table in page.extract_tables() or []:
                normalized = [[clean(cell) for cell in row] for row in table if any(clean(cell) for cell in row)]
                if normalized:
                    tables_by_page[page_no].append(normalized)
    return tables_by_page


def anchored_pages(pages):
    targets = []
    for row in pages:
        text = row.get("text", "")
        hit = [anchor for anchor in ANCHORS if anchor in text]
        if hit:
            targets.append({"page": row["page"], "anchors": hit, "text": text})
    return targets


def infer_phase(text):
    if "정시" in text:
        return "정시"
    if re.search(r"[가나다]군", text) or "수능위주" in text or "총점 (수능)" in text or "총점\n(수능)" in text:
        return "정시"
    return "수시"


def infer_admission_type(text):
    for admission_type, keys in ADMISSION_TYPE_RULES:
        if any(key in text for key in keys):
            return admission_type
    return ""


def clean_admission_name(value):
    value = clean(value)
    value = re.sub(r"^(모집단위|구분|전형)\s+", "", value)
    value = re.sub(r"^[가나다]군\s*", "", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value


def looks_like_admission_name(value):
    value = clean(value)
    return bool(value) and any(key in value for key in ["전형", "학생부교과", "학생부종합", "논술", "실기", "수능"])


def infer_cut_type(header, row_text):
    text = f"{header} {row_text}"
    if "50%" in text or "50％" in text:
        return "50%컷"
    if "70%" in text or "70％" in text:
        return "70%컷"
    if "80%" in text or "80％" in text:
        return "80%컷"
    if "평균" in text:
        return "평균"
    if "최종등록" in text or "최종 등록" in text:
        return "최종등록"
    if "최저" in text:
        return "최저"
    return ""


def parse_number(value):
    value = clean(value).replace(",", "")
    if not value or value in {"-", "―", "·"}:
        return None
    match = re.search(r"\d+(?:\.\d+)?", value)
    if not match:
        return None
    return float(match.group(0))


def parse_int(value):
    value = clean(value).replace(",", "")
    match = re.search(r"\d+", value)
    return int(match.group(0)) if match else None


def parse_competition(value):
    value = clean(value).replace(",", "")
    match = re.search(r"(\d+(?:\.\d+)?)\s*(?::|대)", value)
    if match:
        return float(match.group(1))
    number = parse_number(value)
    return number if number and 0 <= number <= 300 else None


def classify_cut_value(number, header, row_text):
    if number is None:
        return None, None, ""
    text = f"{header} {row_text}"
    if "등급" in text and 0 <= number <= 9:
        return number, None, "등급"
    if any(key in text for key in ["백분위", "환산", "점수", "표준"]):
        return None, number, "점수/백분위/환산점수"
    if 0 <= number <= 9:
        return number, None, "등급(헤더 추정)"
    if 9 < number <= 1000:
        return None, number, "점수(헤더 추정)"
    return None, None, ""


def header_indexes(header):
    joined = " ".join(header)
    indexes = {"cutColumns": []}
    for index, cell in enumerate(header):
        if any(key in cell for key in ["학과", "모집단위", "모집 단위", "계열"]):
            indexes["unit"] = index
        elif "모집 전형" in cell or "전형명" in cell or cell in {"전형", "모집전형"}:
            indexes["admissionName"] = index
        elif "모집" in cell and ("인원" in cell or "명" in cell):
            indexes["recruitCount"] = index
        elif "경쟁률" in cell:
            indexes["competition"] = index
        elif any(key in cell for key in ["70%", "80%", "평균", "최종", "최저", "등급", "환산", "백분위"]):
            indexes["cutColumns"].append(index)
    if "cut" not in indexes and any(key in joined for key in ["합격", "입시결과", "등록"]):
        for index, cell in enumerate(header):
            if parse_number(cell) is None and cell:
                continue
            indexes["cutColumns"].append(index)
    return indexes


def table_to_candidates(table, meta, page_no):
    rows = []
    if not table:
        return rows
    header_start = None
    for index, row in enumerate(table[:8]):
        if any("모집단위" in clean(cell) or "학과" in clean(cell) for cell in row):
            header_start = index
            break
    if header_start is None:
        return rows

    header_end = header_start
    for index in range(header_start + 1, min(len(table), header_start + 5)):
        first = clean(table[index][0] if table[index] else "")
        if first and not any(key in first for key in ["모집", "학생부", "대학별", "최종", "환산", "50%", "70%"]):
            break
        header_end = index

    width = max(len(row) for row in table)
    header = []
    for col in range(width):
        parts = []
        for row in table[header_start : header_end + 1]:
            if col < len(row):
                value = clean(row[col])
                if value and value not in parts:
                    parts.append(value)
        header.append(" ".join(parts))
    header_text = " ".join(header)
    indexes = header_indexes(header)
    if "unit" not in indexes or not indexes.get("cutColumns"):
        return rows

    last_unit = ""
    last_admission_name = ""
    fallback_admission_name = ""
    angle = re.search(r"<([^>]+전형)>", meta.get("pageText", ""))
    if angle:
        fallback_admission_name = angle.group(1)
    else:
        header_match = re.search(r"([가-힣A-Za-z0-9·ㆍ\-\s()]+전형)", header_text)
        fallback_admission_name = clean_admission_name(header_match.group(1)) if header_match else ""
        if not fallback_admission_name:
            for cell in header:
                if looks_like_admission_name(cell) and "모집단위" not in cell:
                    fallback_admission_name = clean_admission_name(cell)
                    break

    for row in table[header_end + 1 :]:
        row = [clean(cell) for cell in row]
        if not any(row):
            continue
        row_text = " ".join(row)
        unit = row[indexes["unit"]] if indexes.get("unit", 999) < len(row) else ""
        if unit:
            last_unit = unit
        unit = unit or last_unit
        if not unit or re.search(r"합계|소계|계$", unit):
            continue
        admission_name = row[indexes["admissionName"]] if indexes.get("admissionName", 999) < len(row) else ""
        if not admission_name and row and looks_like_admission_name(row[0]):
            admission_name = row[0]
        if admission_name:
            last_admission_name = admission_name
        admission_name = clean_admission_name(admission_name or last_admission_name or fallback_admission_name)
        recruit_count = (
            parse_int(row[indexes["recruitCount"]]) if indexes.get("recruitCount", 999) < len(row) else None
        )
        competition = (
            parse_competition(row[indexes["competition"]]) if indexes.get("competition", 999) < len(row) else None
        )
        for cut_index in indexes.get("cutColumns", []):
            if cut_index >= len(row):
                continue
            cut_raw = row[cut_index]
            cut_number = parse_number(cut_raw)
            cut_header = header[cut_index]
            cut_type = infer_cut_type(cut_header, row_text)
            if cut_type == "50%컷":
                continue
            cut_grade, cut_score, unit_note = classify_cut_value(cut_number, cut_header, row_text)
            if not cut_type or (cut_grade is None and cut_score is None):
                continue
            rows.append(
                {
                    "univId": meta["univId"],
                    "univName": meta["univName"],
                    "phase": infer_phase(f"{admission_name} {header_text} {row_text} {meta.get('phase', '')}"),
                    "admissionType": infer_admission_type(f"{admission_name} {header_text} {row_text}"),
                    "admissionName": admission_name,
                    "unit": unit,
                    "year": 2025,
                    "cutType": cut_type,
                    "cutGrade": cut_grade,
                    "cutScore": cut_score,
                    "recruitCount": recruit_count,
                    "competition": competition,
                    "region": meta["region"],
                    "sourceFile": meta["sourceFile"],
                    "sourcePage": page_no,
                    "confidence": "mid",
                    "note": unit_note,
                }
            )
    return rows


def text_to_candidates(text, meta, page_no):
    rows = []
    for line in re.split(r"[\n\r]+", text):
        line = clean(line)
        if not line or not any(anchor in line for anchor in ANCHORS):
            continue
        if not re.search(r"\d+(?:\.\d+)?", line):
            continue
        unit_match = re.search(r"([가-힣A-Za-z0-9·ㆍ\-\s]{2,40}(?:학과|학부|전공|계열))", line)
        cut_type = infer_cut_type(line, line)
        if not unit_match or not cut_type:
            continue
        numbers = [float(match.group(0)) for match in re.finditer(r"\d+(?:\.\d+)?", line.replace(",", ""))]
        cut_number = next((number for number in numbers if 0 <= number <= 1000), None)
        cut_grade, cut_score, unit_note = classify_cut_value(cut_number, line, line)
        if cut_grade is None and cut_score is None:
            continue
        rows.append(
            {
                "univId": meta["univId"],
                "univName": meta["univName"],
                "phase": infer_phase(line),
                "admissionType": infer_admission_type(line),
                "admissionName": "",
                "unit": clean(unit_match.group(1)),
                "year": 2025,
                "cutType": cut_type,
                "cutGrade": cut_grade,
                "cutScore": cut_score,
                "recruitCount": None,
                "competition": parse_competition(line),
                "region": meta["region"],
                "sourceFile": meta["sourceFile"],
                "sourcePage": page_no,
                "confidence": "low",
                "note": unit_note,
            }
        )
    return rows


def unit_similarity(a, b):
    return SequenceMatcher(None, norm(a), norm(b)).ratio()


def improve_confidence(row, admissions_by_univ):
    admissions = admissions_by_univ.get(row["univId"], [])
    same_type = [item for item in admissions if item.get("admissionType") == row.get("admissionType")]
    if row.get("admissionName"):
        same_name = [
            item
            for item in same_type or admissions
            if norm(row["admissionName"]) and norm(row["admissionName"]) in norm(item.get("admissionName", ""))
        ]
    else:
        same_name = []
    unit_scores = [unit_similarity(row["unit"], item.get("unit", "")) for item in same_name or same_type or admissions]
    best_unit = max(unit_scores) if unit_scores else 0
    structurally_clear = (
        row.get("admissionName")
        and row.get("admissionType")
        and row.get("unit")
        and row.get("recruitCount")
        and row.get("competition") is not None
        and row.get("cutType") in {"70%컷", "80%컷", "평균"}
        and (row.get("cutGrade") is not None or row.get("cutScore") is not None)
    )
    if same_name and best_unit >= 0.9:
        row["confidence"] = "high"
    elif structurally_clear:
        row["confidence"] = "high"
    elif (same_name or same_type) and best_unit >= 0.75:
        row["confidence"] = "mid"
    elif row.get("admissionName") and row.get("admissionType") and row.get("cutType") in {"70%컷", "80%컷", "평균"}:
        row["confidence"] = "mid"
    elif not row.get("admissionType") or best_unit < 0.55:
        row["confidence"] = "low"
    return row


def is_usable(row):
    if not row.get("univId") or not row.get("unit") or not row.get("cutType"):
        return False
    if row.get("cutGrade") is None and row.get("cutScore") is None:
        return False
    if row.get("cutType") == "50%컷":
        return False
    if row.get("cutGrade") is not None and not (0 < row["cutGrade"] <= 9):
        return False
    if row.get("cutScore") is not None and row["cutScore"] <= 0:
        return False
    if row.get("recruitCount") == 0:
        return False
    return True


def dedupe(rows):
    seen = set()
    out = []
    for row in rows:
        key = (
            row["univId"],
            row["phase"],
            row["admissionType"],
            row["admissionName"],
            row["unit"],
            row["cutType"],
            row["cutGrade"],
            row["cutScore"],
            row["sourceFile"],
            row["sourcePage"],
        )
        if key in seen:
            continue
        seen.add(key)
        out.append(row)
    return out


def write_report(report_path, report, rows, unmatched, dependency_errors):
    by_pdf = Counter(row["sourceFile"] for row in rows)
    conf = Counter(row["confidence"] for row in rows)
    lines = [
        "# 2025 입시결과 합격선 추출 리포트",
        "",
        "## 실행 요약",
        "",
        f"- PDF 파일 수: {report['pdfCount']}",
        f"- 전체 페이지 수: {report['pageCount']}",
        f"- 앵커 페이지 수: {report['anchorPageCount']}",
        f"- OCR 필요 추정 페이지 수: {report.get('ocrPageCount', 0)}",
        f"- 추출 결과 행: {len(rows)}",
        f"- unmatched 행/사유: {len(unmatched)}",
        f"- high: {conf.get('high', 0)}, mid: {conf.get('mid', 0)}, low: {conf.get('low', 0)}",
        "",
    ]
    if dependency_errors:
        lines.extend(["## 의존성 확인", ""])
        for error in dependency_errors:
            lines.append(f"- {error}")
        lines.append("")
    lines.extend(["## PDF별 처리 결과", "", "| PDF | 추정 대학 | 페이지 | 앵커 페이지 | OCR 필요 | 추출 행 | 상태 |", "| --- | --- | ---: | ---: | ---: | ---: | --- |"])
    for item in report["pdfs"]:
        lines.append(
            f"| {item['file']} | {item.get('univName') or '-'} | {item.get('pages', 0)} | "
            f"{item.get('anchorPages', 0)} | {item.get('ocrPages', 0)} | {by_pdf.get(item['file'], 0)} | {item['status']} |"
        )
    lines.extend(["", "## confidence 분포", "", "| confidence | 행 수 |", "| --- | ---: |"])
    for key in ["high", "mid", "low"]:
        lines.append(f"| {key} | {conf.get(key, 0)} |")
    lines.extend(["", "## 정규화 규칙", ""])
    lines.extend(
        [
            "- 대학명: 파일명에 포함된 대학명을 `universities.json`의 정규화 이름과 매칭한다.",
            "- 전형유형: 전형명/행 텍스트 키워드로 학생부종합, 학생부교과, 수능위주, 논술, 실기, 일반(서류)을 결정한다.",
            "- 모집단위: 학과, 학부, 전공, 계열 패턴을 우선 사용한다.",
            "- 컷 구분: 70%, 80%, 평균, 최종등록, 최저 키워드가 있을 때만 `cutType`을 기록한다.",
            "- 등급/점수: 헤더 또는 행에 등급이 있으면 0.0~9.0을 `cutGrade`로, 백분위/환산/표준/점수 키워드가 있으면 `cutScore`로 둔다.",
            "- 모호한 행은 results_2025.json에 넣지 않고 `reports/results_2025_unmatched.json`에 남긴다.",
        ]
    )
    lines.extend(["", "## unmatched 샘플", ""])
    if unmatched:
        for item in unmatched[:80]:
            lines.append(f"- {item.get('sourceFile', item.get('file', '-'))} p.{item.get('sourcePage', '-')} · {item.get('reason', '-')}")
    else:
        lines.append("- 없음")
    report_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description="Extract 2025 admission result cut lines from regional PDFs.")
    parser.add_argument("--pdf-dir", default=str(PDF_DIR))
    parser.add_argument("--out", default=str(RESULTS_PATH))
    parser.add_argument("--report", default=str(REPORT_PATH))
    args = parser.parse_args()

    pdf_dir = Path(args.pdf_dir)
    results_path = Path(args.out)
    report_path = Path(args.report)
    REPORT_DIR.mkdir(parents=True, exist_ok=True)

    universities = load_json(ROOT / "universities.json")
    admissions = load_json(ROOT / "admissions.json")
    by_norm_name = build_university_indexes(universities)
    admissions_by_univ = defaultdict(list)
    for row in admissions:
        admissions_by_univ[row["univId"]].append(row)

    pdfplumber, fitz, dependency_errors = try_import_pdf_libs()
    pdfs = list_pdfs(pdf_dir)
    rows = []
    unmatched = []
    report = {"pdfCount": len(pdfs), "pageCount": 0, "anchorPageCount": 0, "ocrPageCount": 0, "pdfs": []}

    for pdf in pdfs:
        pages = page_text_by_fitz(pdf, fitz)
        page_context = {}
        current_university = None
        current_phase = ""
        for page in pages:
            detected = find_university_in_text(page.get("text", ""), universities)
            if detected:
                current_university = detected
            text = page.get("text", "")
            if "수시모집" in text or "[수시]" in text or " 수시 " in text:
                current_phase = "수시"
            elif "정시모집" in text or "[정시]" in text or " 정시 " in text:
                current_phase = "정시"
            if current_university:
                page_context[page["page"]] = {"university": current_university, "phase": current_phase}
        ocr_pages = [page["page"] for page in pages if page["page"] in page_context and len(page.get("text", "")) < 20]
        anchors = [row for row in anchored_pages(pages) if row["page"] in page_context]
        report["pageCount"] += len(pages)
        report["anchorPageCount"] += len(anchors)
        report["ocrPageCount"] += len(ocr_pages)
        pdf_status = "processed"
        if not pages and dependency_errors:
            pdf_status = "dependency-missing"
        tables_by_page = extract_tables_by_pdfplumber(pdf, pdfplumber, [item["page"] for item in anchors])
        for anchor in anchors:
            page_no = anchor["page"]
            context = page_context.get(page_no)
            if not context:
                unmatched.append({"sourceFile": pdf.name, "sourcePage": page_no, "reason": "페이지 대학명 컨텍스트 없음"})
                continue
            university = context["university"]
            meta = {
                "univId": university["univId"],
                "univName": university["name"],
                "region": university.get("region", ""),
                "sourceFile": pdf.name,
                "phase": context.get("phase", ""),
                "pageText": anchor.get("text", ""),
            }
            page_rows = []
            for table in tables_by_page.get(page_no, []):
                page_rows.extend(table_to_candidates(table, meta, page_no))
            if not page_rows:
                page_rows.extend(text_to_candidates(anchor["text"], meta, page_no))
            for row in page_rows:
                row = improve_confidence(row, admissions_by_univ)
                if is_usable(row):
                    rows.append(row)
                else:
                    unmatched.append(
                        {
                            "sourceFile": pdf.name,
                            "sourcePage": page_no,
                            "reason": "필수 필드 또는 컷 단위가 모호함",
                            "raw": row,
                        }
                    )
        report["pdfs"].append(
            {
                "file": pdf.name,
                "univId": "",
                "univName": f"{len({ctx['university']['univId'] for ctx in page_context.values()})}개 대학",
                "match": "page-text",
                "pages": len(pages),
                "anchorPages": len(anchors),
                "ocrPages": len(ocr_pages),
                "status": pdf_status,
            }
        )

    rows = dedupe(rows)
    rows.sort(key=lambda row: (row["region"], row["univName"], row["phase"], row["admissionType"], row["unit"]))
    results_path.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    UNMATCHED_PATH.write_text(json.dumps(unmatched, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    write_report(report_path, report, rows, unmatched, dependency_errors)

    print(f"PDFs: {report['pdfCount']}")
    print(f"Pages: {report['pageCount']}")
    print(f"Anchor pages: {report['anchorPageCount']}")
    print(f"Rows: {len(rows)}")
    print(f"Unmatched: {len(unmatched)}")


if __name__ == "__main__":
    main()
