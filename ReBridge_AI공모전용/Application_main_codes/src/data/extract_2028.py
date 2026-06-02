import argparse
import json
import re
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

import pdfplumber


BASE = Path(__file__).resolve().parent
UNIVERSITIES = BASE / "universities.json"
PDF_ROOT = BASE / "pdf_sources" / "2028"
PATCH_C = BASE / "admissions_2028_patch_C.json"
REPORT_C = BASE / "reports" / "admissions_2028_patch_C_report.md"

TARGET_REGIONS = {"경북", "부산", "경남", "광주", "전남", "전북", "대구", "울산"}
ADMISSION_TYPES = ["학생부종합", "학생부교과", "논술", "실기/실적", "수능위주"]
BAD_ADMISSION_NAMES = {
    "모집인원", "수시", "정시", "전형명", "전형명및전형요소", "수시전형명및전형요소",
    "정시전형명및전형요소", "내용", "구분", "비고", "모집구분", "모집단위",
    "선발방법", "전형유형", "정원내", "정원외", "합계", "소계",
}


def nfc(text):
    return unicodedata.normalize("NFC", str(text or ""))


def compact(text):
    text = nfc(text).replace("\u00ad", "-")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def flat(text):
    return re.sub(r"\s+", "", nfc(text or ""))


def parse_filename(pdf_path):
    name = nfc(Path(pdf_path).name)
    match = re.match(r"(.+?)\[([^\]]+)\]\[([^\]]+)\]_", name)
    if not match:
        return {
            "univName": Path(pdf_path).stem,
            "region": "",
            "campus": "본교",
            "fileName": name,
        }
    return {
        "univName": match.group(1),
        "region": match.group(2),
        "campus": match.group(3),
        "fileName": name,
    }


def normalize_univ_name(name):
    text = flat(name)
    text = re.sub(r"\(.*?\)", "", text)
    text = text.replace("국립", "").replace("학교", "")
    return text


def load_university_index():
    universities = json.loads(UNIVERSITIES.read_text(encoding="utf-8"))
    index = {}
    for row in universities:
        index.setdefault(normalize_univ_name(row.get("name")), []).append(row)
    return universities, index


def match_univ_id(univ_name, region, serial_hint=0):
    _, index = load_university_index()
    key = normalize_univ_name(univ_name)
    candidates = index.get(key, [])
    if not candidates and key.endswith("대학"):
        candidates = index.get(key + "교", [])
    if candidates:
        same_region = [row for row in candidates if row.get("region") == region]
        row = (same_region or candidates)[0]
        return row.get("univId"), False
    return f"u2028_{serial_hint:03d}", True


def cell_text(cell):
    return compact(cell) if cell is not None else ""


def split_lines(text):
    lines = [compact(line) for line in nfc(text).split("\n")]
    return [line for line in lines if line and line not in {"-", "·"}]


def parse_int(value):
    if value is None:
        return None
    match = re.search(r"\(?\s*([0-9][0-9,]*)\s*\)?", nfc(value))
    if not match:
        return None
    return int(match.group(1).replace(",", ""))


def normalize_phase(value, current=None):
    text = flat(value)
    if "정시" in text:
        return "정시"
    if "수시" in text or "자율화" in text:
        return "수시"
    return current


def normalize_admission_type(value, admission_name="", method=""):
    text = flat(f"{value} {admission_name} {method}")
    if "수능" in text or "정시" in text:
        return "수능위주"
    if "논술" in text:
        return "논술"
    if "실기" in text or "실적" in text or "특기" in text or "예체능" in text:
        return "실기/실적"
    if "종합" in text or "서류" in text:
        return "학생부종합"
    if "교과" in text or "학생부" in text:
        return "학생부교과"
    return ""


def normalize_csat(value):
    text = compact(value)
    if not text:
        return None
    if re.fullmatch(r"[×Xx없음미적용해당사항 없음\- ]+", text):
        return "없음"
    if text in {"미적용", "해당사항없음", "해당 없음"}:
        return "없음"
    if "해당사항없음" in flat(text) or "미적용" in flat(text):
        return "없음"
    return text


def has_interview(method):
    return bool(re.search(r"면접|구술", method or ""))


def find_column(headers, keywords, fallback=None):
    for idx, header in enumerate(headers):
        joined = flat(header)
        if all(keyword in joined for keyword in keywords):
            return idx
    return fallback


def build_headers(table):
    width = max((len(row) for row in table), default=0)
    header_rows = table[: min(4, len(table))]
    headers = []
    for col in range(width):
        pieces = []
        for row in header_rows:
            if col < len(row) and row[col] not in (None, ""):
                pieces.append(cell_text(row[col]))
        headers.append("\n".join(pieces))
    return headers


def table_has_admission_header(headers):
    joined = flat("\n".join(headers))
    return ("전형" in joined and "모집" in joined and ("인원" in joined or "명" in joined))


def align_values(values, count):
    if not values:
        return [None] * count
    if len(values) == count:
        return values
    if len(values) > 1 and len(values) < count:
        return values + [values[-1]] * (count - len(values))
    return [values[0]] * count


def make_source(file_name, page_number):
    return f"{file_name} p.{page_number}"


def make_row(meta, univ_id, needs_univ_id, phase, admission_type, admission_name,
             recruit_count, eval_method, csat_minimum, page_number, note="", unit=None):
    if not admission_name:
        return None
    if flat(admission_name) in BAD_ADMISSION_NAMES:
        return None
    normalized_type = admission_type or normalize_admission_type(admission_name, method=eval_method)
    if not normalized_type:
        return None
    row = {
        "univId": univ_id,
        "univName": meta["univName"],
        "campus": meta["campus"],
        "region": meta["region"],
        "phase": phase,
        "admissionType": normalized_type,
        "admissionName": compact(admission_name),
        "unit": unit,
        "recruitCount": recruit_count,
        "evalMethod": compact(eval_method) if eval_method else None,
        "interview": has_interview(eval_method),
        "csatMinimum": normalize_csat(csat_minimum),
        "gedEligible": None,
        "gedIneligibleReason": "",
        "gedReflection": None,
        "comparativeGrade": None,
        "note": note,
        "source": make_source(meta["fileName"], page_number),
        "status": "confirmed_detail",
        "sourceYear": 2028,
    }
    if needs_univ_id:
        row["needsUnivId"] = True
    return row


def parse_summary_table(table, page_number, meta, univ_id, needs_univ_id):
    headers = build_headers(table)
    if not table_has_admission_header(headers):
        return []

    phase_col = find_column(headers, ["모집", "시기"], 0)
    type_col = find_column(headers, ["전형", "유형"], None)
    name_col = find_column(headers, ["전형명"], None)
    if name_col is None:
        name_col = find_column(headers, ["대상", "전형"], None)
    count_col = find_column(headers, ["모집", "인원"], None)
    method_col = find_column(headers, ["전형", "요소"], None)
    if method_col is None:
        method_col = find_column(headers, ["전형", "방법"], None)
    csat_col = find_column(headers, ["수능", "최저"], None)
    unit_col = find_column(headers, ["모집", "단위"], None)

    if name_col is None or count_col is None:
        return []
    if name_col + 1 < count_col:
        probe = "\n".join(cell_text((list(row) + [""] * (len(headers) - len(row)))[name_col]) for row in table[1:6])
        next_probe = "\n".join(cell_text((list(row) + [""] * (len(headers) - len(row)))[name_col + 1]) for row in table[1:6])
        if re.search(r"학생부|수능|논술|실기|실적|소계", probe) and re.search(r"전형|일반|지역|특성|농어촌|기회|가군|나군|다군", next_probe):
            type_col = name_col
            name_col = name_col + 1

    rows = []
    current_phase = None
    current_type = None
    for raw in table[1:]:
        padded = list(raw) + [""] * (len(headers) - len(raw))
        phase = normalize_phase(padded[phase_col] if phase_col is not None else "", current_phase)
        if phase:
            current_phase = phase

        type_text = cell_text(padded[type_col]) if type_col is not None else ""
        if type_text and "소계" not in type_text:
            current_type = normalize_admission_type(type_text)

        name_cell = cell_text(padded[name_col])
        if not name_cell or "소계" in flat(name_cell) or "합계" in flat(name_cell):
            continue

        count_lines = split_lines(padded[count_col])
        name_lines = split_lines(name_cell)
        if not name_lines:
            continue

        method_text = cell_text(padded[method_col]) if method_col is not None else ""
        csat_text = cell_text(padded[csat_col]) if csat_col is not None else ""
        unit_text = cell_text(padded[unit_col]) if unit_col is not None else ""

        if len(name_lines) == 1:
            count_values = [parse_int(padded[count_col])]
        else:
            count_values = [parse_int(line) for line in count_lines]
            count_values = align_values(count_values, len(name_lines))

        method_lines = split_lines(method_text)
        method_values = method_lines if len(method_lines) == len(name_lines) else [method_text] * len(name_lines)
        csat_lines = split_lines(csat_text)
        csat_values = csat_lines if len(csat_lines) == len(name_lines) else [csat_text] * len(name_lines)
        unit_values = align_values(split_lines(unit_text), len(name_lines)) if unit_text else [None] * len(name_lines)

        for idx, admission_name in enumerate(name_lines):
            if re.search(r"^(소계|합계|구분|전형명)$", flat(admission_name)):
                continue
            count = count_values[idx] if idx < len(count_values) else None
            method = method_values[idx] if method_values and method_values[idx] else method_text
            csat = csat_values[idx] if csat_values and csat_values[idx] else csat_text
            admission_type = current_type or normalize_admission_type(type_text, admission_name, method)
            row = make_row(
                meta, univ_id, needs_univ_id, current_phase or "수시", admission_type,
                admission_name, count, method, csat, page_number, unit=unit_values[idx]
            )
            if row:
                rows.append(row)
    return rows


def parse_bullet_rows(text, page_number, meta, univ_id, needs_univ_id):
    rows = []
    phase = "정시" if "정시" in text and "수시" not in text[:300] else "수시"
    for match in re.finditer(r"[-•∙]\s*([가-힣A-Za-z0-9·()\[\] ]{2,35}?전형|[가-힣A-Za-z0-9·()\[\] ]{2,20})\s*[:：]\s*([0-9,]+)\s*명", text):
        name = compact(match.group(1))
        if any(skip in name for skip in ["수시", "정시", "합계", "정원"]):
            continue
        context = text[max(0, match.start() - 250): match.end() + 350]
        admission_type = normalize_admission_type(context, name, context)
        if not admission_type:
            admission_type = "수능위주" if phase == "정시" else "학생부교과"
        method_match = re.search(r"(학생부|수능|논술|실기|서류).{0,80}", context)
        method = method_match.group(0) if method_match else None
        row = make_row(
            meta, univ_id, needs_univ_id, phase, admission_type, name,
            parse_int(match.group(2)), method, None, page_number,
            note="fallback: bullet형 전형명/모집인원 파싱"
        )
        if row:
            rows.append(row)
    return rows


def extract_candidate_sections(page_texts):
    candidate = []
    comparative = []
    eligibility = []
    for page_number, text in page_texts:
        t = compact(text)
        if not t:
            continue
        if re.search(r"지원\s*자격|지원자격|검정\s*고시|동등\s*이상|고등학교\s*졸업", t):
            eligibility.append((page_number, t))
        if re.search(r"비교\s*내신|검정\s*고시|환산|산출|동등\s*학력", t):
            comparative.append((page_number, t))
        if re.search(r"지원\s*자격|비교\s*내신|검정\s*고시|동등\s*이상|환산|산출", t):
            candidate.append((page_number, t))
    return candidate, eligibility, comparative


def snippet(text, keywords, limit=700):
    clean = compact(text)
    best = None
    for keyword in keywords:
        match = re.search(keyword, clean)
        if match:
            start = max(0, match.start() - 180)
            end = min(len(clean), match.end() + limit)
            best = clean[start:end]
            break
    if best is None:
        best = clean[:limit]
    return best


def judge_ged(row, eligibility_sections, comparative_sections):
    joined_elig = "\n".join(text for _, text in eligibility_sections)
    joined_comp = "\n".join(text for _, text in comparative_sections)
    text = compact(joined_elig + "\n" + joined_comp)
    row_text = f"{row.get('admissionType','')} {row.get('admissionName','')} {row.get('evalMethod','')}"
    name_key = flat(row.get("admissionName", ""))
    local_sections = []
    if name_key and len(name_key) >= 3:
        short_key = re.sub(r"전형$|모집$", "", name_key) or name_key
        keys = [name_key]
        if short_key != name_key and len(short_key) >= 3:
            keys.append(short_key)
        for page, section_text in eligibility_sections:
            section_key = flat(section_text)
            hit_key = next((key for key in keys if key in section_key), None)
            if hit_key:
                raw = compact(section_text)
                raw_flat = flat(raw)
                pos = raw_flat.find(hit_key)
                if pos >= 0:
                    ratio = len(raw) / max(1, len(raw_flat))
                    approx = int(pos * ratio)
                    local_sections.append((page, raw[max(0, approx - 250): approx + 1600]))
                else:
                    local_sections.append((page, raw[:1600]))
    local_text = compact("\n".join(section for _, section in local_sections))
    decision_text = local_text or text

    if row.get("admissionType") == "수능위주":
        row["gedEligible"] = "가능"
        row["gedReflection"] = "수능"
        return

    if local_text and re.search(r"검정\s*고시.{0,180}(지원\s*할\s*수\s*없|지원\s*불가|제외|불인정)|고교졸업\s*동등\s*학력자.{0,180}지원\s*불가", decision_text):
        row["gedEligible"] = "불가"
        row["gedIneligibleReason"] = "검정고시 출신 지원 제한 문구가 있어요"
    elif re.search(r"검정\s*고시|고등학교\s*졸업\s*학력\s*검정\s*고시|동등\s*이상\s*학력|법령.*동등|법령에\s*의하여\s*고등학교\s*졸업\s*이상의\s*학력", decision_text):
        row["gedEligible"] = "조건부" if re.search(r"학교장\s*추천|추천서|학생부\s*교과", row_text) else "가능"
        if row["gedEligible"] == "조건부":
            row["gedIneligibleReason"] = "추천·학생부 반영 조건을 추가 확인해야 해요"
    elif re.search(r"고등학교\s*졸업\s*\(예정\)\s*자|고교\s*졸업\s*\(예정\)\s*자", decision_text):
        row["gedEligible"] = "조건부"
        row["gedIneligibleReason"] = "지원자격에 검정고시가 직접 명시되지 않아 추가확인이 필요해요"
    else:
        row["gedEligible"] = "조건부"
        row["gedIneligibleReason"] = "지원자격 추가확인 필요"

    if row.get("admissionType") == "학생부종합":
        row["gedReflection"] = "서류평가"
    elif row.get("admissionType") == "학생부교과":
        row["gedReflection"] = "비교내신 환산 또는 대학별 검정고시 성적 환산"
    elif row.get("admissionType") == "논술":
        row["gedReflection"] = "논술+(학생부/대학별 환산)"
    elif row.get("admissionType") == "실기/실적":
        row["gedReflection"] = "실기/실적+(학생부/대학별 환산)"
    else:
        row["gedReflection"] = None

    if comparative_sections:
        pages = ",".join(str(page) for page, _ in comparative_sections[:5])
        comp_text = "\n".join(text for _, text in comparative_sections[:3])
        row["comparativeGrade"] = snippet(
            comp_text,
            [r"비교\s*내신", r"검정\s*고시", r"환산", r"산출"],
            limit=900,
        )
        if row.get("comparativeGrade"):
            note = row.get("note") or ""
            row["note"] = f"{note} comparativeGrade 후보 p.{pages}".strip()

    note_sections = local_sections or eligibility_sections
    if row["gedEligible"] == "조건부" and note_sections:
        pages = ",".join(str(page) for page, _ in note_sections[:3])
        quote = snippet("\n".join(text for _, text in note_sections[:2]), [r"지원\s*자격", r"검정\s*고시", r"동등"], limit=350)
        note = row.get("note") or ""
        row["note"] = f"{note} 지원자격 후보 p.{pages}: {quote[:420]}".strip()


def dedupe_rows(rows):
    result = []
    seen = set()
    for row in rows:
        key = (
            row.get("univId"), row.get("phase"), row.get("admissionType"),
            row.get("admissionName"), row.get("unit"), row.get("source")
        )
        if key in seen:
            continue
        seen.add(key)
        result.append(row)
    return result


def extract_admissions(pdf_path):
    meta = parse_filename(pdf_path)
    univ_id, needs_univ_id = match_univ_id(meta["univName"], meta["region"])
    rows = []
    page_texts = []

    with pdfplumber.open(pdf_path) as pdf:
        for page_number, page in enumerate(pdf.pages, start=1):
            text = page.extract_text(layout=True) or page.extract_text() or ""
            page_texts.append((page_number, text))
            tables = page.extract_tables() or []
            page_rows = []
            for table in tables:
                if not table:
                    continue
                parsed = parse_summary_table(table, page_number, meta, univ_id, needs_univ_id)
                page_rows.extend(parsed)
            if not page_rows and re.search(r"전형명|모집인원|수시|정시", text):
                page_rows = parse_bullet_rows(text, page_number, meta, univ_id, needs_univ_id)
            rows.extend(page_rows)

    _, eligibility_sections, comparative_sections = extract_candidate_sections(page_texts)
    for row in rows:
        judge_ged(row, eligibility_sections, comparative_sections)

    return dedupe_rows(rows)


def target_pdfs():
    files = []
    for path in sorted(PDF_ROOT.glob("*.pdf"), key=lambda p: nfc(p.name)):
        meta = parse_filename(path)
        if meta["region"] in TARGET_REGIONS:
            files.append(path)
    return files


def write_report(rows, processed, failed):
    by_univ = defaultdict(int)
    for row in rows:
        by_univ[row["univName"]] += 1
    ged = Counter(row.get("gedEligible") for row in rows)
    comparative_count = sum(1 for row in rows if row.get("comparativeGrade"))
    needs_univ = sorted({row["univName"] for row in rows if row.get("needsUnivId")})

    lines = [
        "# admissions_2028_patch_C 진행보고",
        "",
        f"- 처리 PDF: {len(processed)} / {len(target_pdfs())}",
        f"- 처리 대학/캠퍼스 수: {len(processed)}",
        f"- 전형 행수: {len(rows)}",
        f"- comparativeGrade 채운 행: {comparative_count}",
        f"- univId 매칭 실패 대학: {len(needs_univ)}",
        "",
        "## gedEligible 분포",
        "",
        "| gedEligible | count |",
        "| --- | ---: |",
    ]
    for key, count in ged.most_common():
        lines.append(f"| {key or '(null)'} | {count} |")
    lines.extend(["", "## 대학별 전형 행수", "", "| 대학 | rows |", "| --- | ---: |"])
    for name, count in sorted(by_univ.items()):
        lines.append(f"| {name} | {count} |")
    lines.extend(["", "## univId 매칭 실패", ""])
    if needs_univ:
        lines.extend(f"- {name}" for name in needs_univ)
    else:
        lines.append("- 없음")
    lines.extend(["", "## 실패 PDF 목록", ""])
    if failed:
        for item in failed:
            lines.append(f"- {item['file']}: {item['reason']}")
    else:
        lines.append("- 없음")
    REPORT_C.parent.mkdir(parents=True, exist_ok=True)
    REPORT_C.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf", nargs="?", help="single PDF path")
    parser.add_argument("--all-c", action="store_true", help="process Codex C region PDFs")
    args = parser.parse_args()

    if args.pdf:
        rows = extract_admissions(Path(args.pdf))
        print(json.dumps(rows, ensure_ascii=False, indent=2))
        return

    if not args.all_c:
        parser.error("pass a PDF path or --all-c")

    all_rows = []
    processed = []
    failed = []
    for idx, path in enumerate(target_pdfs(), start=1):
        try:
            rows = extract_admissions(path)
            all_rows.extend(rows)
            processed.append(parse_filename(path)["fileName"])
            if not rows:
                failed.append({"file": parse_filename(path)["fileName"], "reason": "no admission rows extracted"})
            print(f"[{idx:02d}] {parse_filename(path)['fileName']} -> {len(rows)} rows")
        except Exception as exc:
            failed.append({"file": parse_filename(path)["fileName"], "reason": str(exc)})
            print(f"[{idx:02d}] {parse_filename(path)['fileName']} -> FAILED {exc}")

    PATCH_C.write_text(json.dumps(all_rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    write_report(all_rows, processed, failed)
    print(f"wrote {PATCH_C}: {len(all_rows)} rows")
    print(f"report {REPORT_C}")


if __name__ == "__main__":
    main()
