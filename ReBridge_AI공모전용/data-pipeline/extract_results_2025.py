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

# ⚠️ 2026-09-03 — 연도·경로 하드코딩을 걷어냈다.
# 이전에는 파일 이름(results_2025.json)과 행의 "year": 2025 가 코드에 박혀 있어서
# 2026 전형결과 PDF를 받아도 2025로 적재됐다. 이제 --year / --src 로 받는다.
ROOT = Path(__file__).resolve().parent
APP_DATA = ROOT.parent / "Application_main_codes" / "src" / "data"
DEFAULT_YEAR = 2025
REPORT_DIR = ROOT / "reports"


def default_pdf_dir(year):
    """--src 를 안 주면 여기를 본다. results_{year}/ 를 먼저, 없으면 {year}/."""
    for cand in (APP_DATA / "pdf_sources" / f"results_{year}",
                 APP_DATA / "pdf_sources" / str(year),
                 ROOT / "pdf_sources"):
        if cand.is_dir():
            return cand
    return APP_DATA / "pdf_sources" / f"results_{year}"


def find_master(name):
    """universities.json / admissions.json 은 앱 쪽이 정본이다."""
    for cand in (APP_DATA / name, ROOT / name):
        if cand.exists():
            return cand
    raise SystemExit(f"{name} 을 찾을 수 없습니다: {APP_DATA} / {ROOT}")

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


RE_CUT_PCT = re.compile(r"(50|70|80)\s*(?:%|％)")
# % 없이 '50 cut' / '70컷' / '50 CUT' 로만 적힌 표가 있다
RE_CUT_BARE = re.compile(r"(?<![\d.])(50|70|80)\s*(?:컷|cut|CUT|Cut)?(?![\d.%％])")


def infer_cut_type(header, row_text, use_bare=True):
    """컷 종류를 판정한다. **판단 기준은 그 열의 헤더다.**

    ⚠️ 2026-09-03 수정.
    이전에는 header 와 row_text 를 통째로 이어 붙인 뒤 '50%'/'70%' 를 찾았다.
    대교협 전형결과 PDF에는 % 없이 '50 cut', '70 cut' 으로만 적힌 표가 있고,
    그런 열은 % 검사를 전부 빠져나가 맨 마지막 '최종등록' 으로 잘못 붙었다.
    (헤더 어딘가에 '최종등록' 이라는 다른 열이 있으면 그 단어가 row_text 에 섞여 들어온다)

    → 헤더에서 먼저 찾고, 헤더에 단서가 없을 때만 행 텍스트를 본다.
      use_bare=False 는 헤더가 아니라 문장 한 줄을 넘길 때 쓴다(문장 속 50/70은 컷이 아니다).
    """
    h = clean(header)
    m = RE_CUT_PCT.search(h) or (RE_CUT_BARE.search(h) if use_bare else None)
    if m:
        return f"{m.group(1)}%컷"
    if "평균" in h:
        return "평균"
    if "최종등록" in h or "최종 등록" in h:
        return "최종등록"
    if "최저" in h:
        return "최저"

    text = clean(row_text)
    m = RE_CUT_PCT.search(text)
    if m:
        return f"{m.group(1)}%컷"
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
        elif (any(key in cell for key in
                  ["50%", "70%", "80%", "평균", "최종", "최저", "등급", "환산", "백분위"])
              or RE_CUT_BARE.search(cell)):
            # '50%' 가 이전 목록에 빠져 있어서 50%컷 열이 아예 잡히지도 않았다.
            # % 없이 '50 cut' 으로만 쓴 열도 여기서 받는다.
            indexes["cutColumns"].append(index)
    if "cut" not in indexes and any(key in joined for key in ["합격", "입시결과", "등록"]):
        for index, cell in enumerate(header):
            if parse_number(cell) is None and cell:
                continue
            indexes["cutColumns"].append(index)
    return indexes


def table_to_candidates(table, meta, page_no, year=DEFAULT_YEAR):
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
            # ⚠️ 2026-09-03 — 여기 있던 `if cut_type == "50%컷": continue` 를 뺐다.
            # 50%컷은 '절반은 이 점수 아래에서도 붙었다'는 뜻이라 검정고시생에게
            # 오히려 가장 필요한 숫자다. 버리지 않고 라벨 그대로 보존한다.
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
                    "year": year,
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


def text_to_candidates(text, meta, page_no, year=DEFAULT_YEAR):
    rows = []
    for line in re.split(r"[\n\r]+", text):
        line = clean(line)
        if not line or not any(anchor in line for anchor in ANCHORS):
            continue
        if not re.search(r"\d+(?:\.\d+)?", line):
            continue
        unit_match = re.search(r"([가-힣A-Za-z0-9·ㆍ\-\s]{2,40}(?:학과|학부|전공|계열))", line)
        cut_type = infer_cut_type(line, line, use_bare=False)
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
                "year": year,
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


# 대교협 전형결과 PDF에서 실제로 쓰이는 컷 라벨 전부.
# 이전에는 70/80/평균만 '구조가 분명한 행'으로 쳤다. 50%컷·최종등록도 똑같이 분명한 숫자다.
STRUCTURED_CUT_TYPES = {"50%컷", "70%컷", "80%컷", "평균", "최종등록"}


def improve_confidence(row, admissions_by_univ, units_available=True):
    """confidence 를 매긴다.

    ⚠️ 2026-09-03 수정 — unit 유사도가 없다고 low 로 떨어뜨리지 않는다.
    이 함수는 admissions.json 의 `unit`(모집단위)과 비교해 신뢰도를 올리도록 짜여 있는데,
    실제 admissions.json 1,007행 중 unit 이 채워진 행은 **7행뿐**이다.
    그래서 best_unit 이 사실상 항상 0이 되어, 표에서 멀쩡히 뽑은 행까지 전부 low 가 됐다.
    → 비교할 unit 자체가 없으면 그 축은 쓰지 않는다(있는 대학에서만 가점으로 쓴다).
    """
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
    comparable = [item for item in (same_name or same_type or admissions) if clean(item.get("unit"))]
    unit_scores = [unit_similarity(row["unit"], item.get("unit", "")) for item in comparable]
    best_unit = max(unit_scores) if unit_scores else None      # None = 비교 대상이 없음

    has_value = row.get("cutGrade") is not None or row.get("cutScore") is not None
    structurally_clear = (
        row.get("admissionName")
        and row.get("admissionType")
        and row.get("unit")
        and row.get("recruitCount")
        and row.get("competition") is not None
        and row.get("cutType") in STRUCTURED_CUT_TYPES
        and has_value
    )
    if best_unit is not None and same_name and best_unit >= 0.9:
        row["confidence"] = "high"
    elif structurally_clear:
        row["confidence"] = "high"
    elif best_unit is not None and (same_name or same_type) and best_unit >= 0.75:
        row["confidence"] = "mid"
    elif row.get("admissionName") and row.get("admissionType") and row.get("cutType") in STRUCTURED_CUT_TYPES:
        row["confidence"] = "mid"
    elif row.get("admissionType") and row.get("unit") and has_value and row.get("cutType"):
        # 전형명이 표에 안 적혀 있을 뿐, 학과·전형유형·컷종류·숫자가 다 있는 행.
        # unit 비교 상대가 없다는 이유만으로 low 로 내리지 않는다.
        row["confidence"] = "mid" if best_unit is None else ("mid" if best_unit >= 0.55 else "low")
    elif not row.get("admissionType") or (best_unit is not None and best_unit < 0.55):
        row["confidence"] = "low"
    return row


def is_usable(row):
    if not row.get("univId") or not row.get("unit") or not row.get("cutType"):
        return False
    if row.get("cutGrade") is None and row.get("cutScore") is None:
        return False
    # ⚠️ 2026-09-03 — 여기 있던 `if row["cutType"] == "50%컷": return False` 를 뺐다.
    # 50%컷을 통째로 버리고 있었다. 검정고시생에게는 '절반은 이 아래에서도 붙었다'가
    # 70%컷보다 더 필요한 숫자다. 라벨을 정확히 붙여 보존한다.
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


def write_report(report_path, report, rows, unmatched, dependency_errors,
                 year=DEFAULT_YEAR, unmatched_path=None):
    by_pdf = Counter(row["sourceFile"] for row in rows)
    conf = Counter(row["confidence"] for row in rows)
    lines = [
        f"# {year} 입시결과 합격선 추출 리포트",
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
        "## cutType 분포",
        "",
        "| cutType | 행 수 |",
        "| --- | ---: |",
        *[f"| {k} | {v} |" for k, v in Counter(r["cutType"] for r in rows).most_common()],
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
            "- 컷 구분: **열 헤더**에서 50/70/80(%, cut, 컷 표기 모두), 평균, 최종등록, 최저를 찾는다.",
            "  헤더에 단서가 없을 때만 행 텍스트를 본다. 50%컷도 버리지 않고 그대로 보존한다.",
            "- 등급/점수: 헤더 또는 행에 등급이 있으면 0.0~9.0을 `cutGrade`로, 백분위/환산/표준/점수 키워드가 있으면 `cutScore`로 둔다.",
            f"- 모호한 행은 결과 JSON에 넣지 않고 `{unmatched_path or 'reports/results_unmatched.json'}`에 남긴다.",
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
    parser = argparse.ArgumentParser(
        description="대교협 전형결과 PDF에서 합격선을 뽑는다. 연도·경로는 매개변수다.")
    parser.add_argument("--year", type=int, default=DEFAULT_YEAR,
                        help="전형결과 학년도 (예: 2026). 뽑은 모든 행의 year 가 된다")
    parser.add_argument("--src", help="원본 PDF 폴더. 기본값: src/data/pdf_sources/results_{year}")
    parser.add_argument("--pdf-dir", help="--src 의 옛 이름(호환용)")
    parser.add_argument("--out", help="결과 JSON. 기본값: results_{year}.json")
    parser.add_argument("--report", help="리포트 md. 기본값: reports/results_{year}_report.md")
    args = parser.parse_args()

    year = args.year
    pdf_dir = Path(args.src or args.pdf_dir or default_pdf_dir(year)).expanduser()
    results_path = Path(args.out) if args.out else ROOT / f"results_{year}.json"
    report_path = Path(args.report) if args.report else REPORT_DIR / f"results_{year}_report.md"
    unmatched_path = REPORT_DIR / f"results_{year}_unmatched.json"
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    if not pdf_dir.is_dir():
        raise SystemExit(f"PDF 폴더가 없습니다: {pdf_dir}\n  --src 로 지정하세요.")
    print(f"학년도 {year} / PDF 폴더 {pdf_dir}")

    universities = load_json(find_master("universities.json"))
    admissions = load_json(find_master("admissions.json"))
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
                page_rows.extend(table_to_candidates(table, meta, page_no, year))
            if not page_rows:
                page_rows.extend(text_to_candidates(anchor["text"], meta, page_no, year))
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
    unmatched_path.write_text(json.dumps(unmatched, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    write_report(report_path, report, rows, unmatched, dependency_errors,
                 year=year, unmatched_path=unmatched_path)

    print(f"PDFs: {report['pdfCount']}")
    print(f"Pages: {report['pageCount']}")
    print(f"Anchor pages: {report['anchorPageCount']}")
    print(f"Rows: {len(rows)}")
    print("cutType 분포: " + ", ".join(
        f"{k} {v:,}" for k, v in Counter(r["cutType"] for r in rows).most_common()))
    print("confidence 분포: " + ", ".join(
        f"{k} {v:,}" for k, v in Counter(r["confidence"] for r in rows).most_common()))
    print(f"OCR 필요 추정 페이지: {report['ocrPageCount']}  (이미지 페이지 — ocr_recover_b.py 참고)")
    print(f"Unmatched: {len(unmatched)}")


if __name__ == "__main__":
    main()
