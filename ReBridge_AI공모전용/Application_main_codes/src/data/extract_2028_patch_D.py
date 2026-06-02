#!/usr/bin/env python3
import json
import re
import unicodedata
from collections import Counter
from pathlib import Path

import pdfplumber


BASE = Path(__file__).resolve().parent
PDF_DIR = BASE / "pdf_sources" / "2028"
UNIVERSITIES = BASE / "universities.json"
OUT = BASE / "admissions_2028_patch_D.json"
REPORT = BASE / "reports" / "admissions_2028_patch_D_report.md"

ANCHORS = [
    "비교내신", "검정고시", "동등학력", "환산", "산출", "등급별",
    "반영점수", "환산점수", "Zone", "지원자격",
]
COMPARATIVE_ANCHORS = [
    "비교내신", "검정고시", "동등학력", "환산", "산출", "등급별",
    "반영점수", "환산점수", "Zone",
]

NEW_TARGETS = [
    "경상국립대학교", "경운대학교", "고려대학교(세종)", "고신대학교", "공주교육대학교",
    "광신대학교", "광주대학교", "광주여자대학교", "국립공주대학교", "국립목포해양대학교",
    "국립순천대학교", "국립한국교통대학교", "김천대학교", "남부대학교", "대전신학대학교",
    "동서대학교", "동신대학교", "동아대학교", "부산가톨릭대학교", "부산교육대학교",
    "부산장신대학교", "서울장신대학교", "세한대학교", "수원대학교", "신라대학교",
    "아신대학교", "연세대학교(미래)", "영남신학대학교", "예수대학교", "예원예술대학교",
    "우석대학교", "우송대학교", "울산대학교", "원광대학교", "위덕대학교",
    "을지대학교", "인제대학교", "전주교육대학교", "창신대학교", "청운대학교",
    "초당대학교", "칼빈대학교", "한서대학교", "호남대학교", "호남신학대학교",
    "화성의과학대학교",
]
RECHECK_TARGETS = [
    "대구가톨릭대학교", "대전가톨릭대학교", "서강대학교", "서울과학기술대학교",
    "서울교육대학교", "서울한영대학교", "이화여자대학교", "인하대학교",
    "제주대학교", "중앙승가대학교", "한라대학교",
]
MANUAL_TARGETS = [
    {"name": "가야대학교", "region": "경남", "campus": "본교"},
    {"name": "영산대학교", "region": "경남", "campus": "제2캠퍼스"},
    {"name": "영산대학교", "region": "부산", "campus": "본교"},
]


def nfc(value):
    return unicodedata.normalize("NFC", str(value or ""))


def compact(text):
    text = nfc(text).replace("\x00", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def flat(value):
    text = nfc(value)
    text = re.sub(r"\s+", "", text)
    text = text.replace("국립", "").replace("학교", "")
    return text


def base_name(name):
    return re.sub(r"\([^)]*\)", "", nfc(name)).strip()


def norm_univ(name):
    return flat(base_name(name))


def parse_pdf_filename(path):
    fn = nfc(path.name)
    match = re.match(r"(.+?)\[([^\]]+)\]\[([^\]]+)\]_", fn)
    if not match:
        return {"name": path.stem, "region": "", "campus": "본교", "filename": fn}
    return {"name": match.group(1), "region": match.group(2), "campus": match.group(3), "filename": fn}


def load_universities():
    rows = json.loads(UNIVERSITIES.read_text(encoding="utf-8"))
    return rows


def match_university(universities, target_name, pdf_region=None):
    target_norm = norm_univ(target_name)
    exact = [u for u in universities if norm_univ(u["name"]) == target_norm]
    if not exact and "(" in target_name:
        exact = [u for u in universities if norm_univ(u["name"]) == norm_univ(base_name(target_name))]
    if not exact:
        contains = [u for u in universities if target_norm in norm_univ(u["name"]) or norm_univ(u["name"]) in target_norm]
        exact = contains
    if pdf_region:
        same_region = [u for u in exact if u.get("region") == pdf_region]
        if same_region:
            exact = same_region
    return exact[0] if exact else None


def choose_pdf(target_name, target_region=None, target_campus=None, university=None):
    candidates = []
    for path in PDF_DIR.glob("*.pdf"):
        meta = parse_pdf_filename(path)
        if norm_univ(meta["name"]) == norm_univ(target_name):
            candidates.append((path, meta))
        elif "(" in target_name and norm_univ(meta["name"]) == norm_univ(base_name(target_name)):
            candidates.append((path, meta))
    if target_region:
        candidates = [item for item in candidates if item[1]["region"] == target_region]
    if target_campus:
        candidates = [item for item in candidates if item[1]["campus"] == target_campus]
    if university and len(candidates) > 1:
        same_region = [item for item in candidates if item[1]["region"] == university.get("region")]
        if same_region:
            candidates = same_region
    return candidates[0] if candidates else (None, None)


def table_to_text(table):
    lines = []
    for row in table or []:
        cells = [compact(cell) for cell in row if cell not in (None, "")]
        if cells:
            lines.append(" ".join(cells))
    return "\n".join(lines)


def page_text(page):
    text = page.extract_text(layout=True) or page.extract_text() or ""
    table_parts = []
    try:
        for table in page.extract_tables() or []:
            rendered = table_to_text(table)
            if rendered:
                table_parts.append(rendered)
    except Exception:
        pass
    combined = compact("\n".join([text, *table_parts]))
    return combined


def relevant_excerpt(text, prefer_comparative=True, limit=2200):
    keywords = COMPARATIVE_ANCHORS if prefer_comparative else ANCHORS
    positions = [text.find(k) for k in keywords if k in text]
    if not positions:
        return text[:limit]
    start = max(0, min(positions) - 260)
    return text[start:start + limit]


def collapse_repeated_lines(text):
    seen = set()
    lines = []
    for raw in text.splitlines():
        line = compact(raw)
        if not line:
            continue
        key = re.sub(r"\s+", " ", line)
        if key in seen and len(key) > 10:
            continue
        seen.add(key)
        lines.append(line)
    return "\n".join(lines)


def classify_type(comparative_grade, note_text):
    text = compact((comparative_grade or "") + "\n" + (note_text or ""))
    if not comparative_grade:
        if re.search(r"지원\s*자격|동등\s*학력|검정\s*고시", note_text or ""):
            return "eligibility_prose"
        return "none"
    if re.search(r"\d{2,4}[\s,]+\d{2,4}[\s,]+\d{2,4}", text):
        return "numeric_table"
    if "모집요강" in text and re.search(r"공지|참고|확인", text):
        return "deferred"
    if re.search(r"지원\s*할\s*수\s*없|지원\s*불가", text):
        return "ged_block"
    if re.search(r"비교\s*내신|환산|등급별|산출", text):
        return "comparative_prose"
    if re.search(r"동등\s*학력|지원\s*자격", text):
        return "eligibility_prose"
    return "none"


def extract_comparative(path):
    anchor_pages = []
    comparative_pages = []
    text_lengths = []
    errors = []
    with pdfplumber.open(path) as pdf:
        for page_index, page in enumerate(pdf.pages, start=1):
            try:
                text = page_text(page)
            except Exception as exc:
                errors.append(f"p.{page_index}: {exc}")
                continue
            text_lengths.append(len(text))
            if any(anchor in text for anchor in ANCHORS):
                anchor_pages.append((page_index, text))
            if any(anchor in text for anchor in COMPARATIVE_ANCHORS):
                comparative_pages.append((page_index, text))

    selected = comparative_pages[:4]
    comparative_grade = None
    if selected:
        chunks = []
        for page_number, text in selected:
            excerpt = collapse_repeated_lines(relevant_excerpt(text, prefer_comparative=True))
            if excerpt:
                chunks.append(f"[p.{page_number}] {excerpt}")
        comparative_grade = "\n".join(chunks).strip()[:2200] or None

    note_parts = ["[patch_D]"]
    if comparative_grade is None:
        if anchor_pages:
            pages = ",".join(str(page) for page, _ in anchor_pages[:8])
            note_parts.append(f"확인함: 비교내신/환산문구 없음; anchor pages={pages}")
        else:
            avg_len = sum(text_lengths) / max(1, len(text_lengths))
            if avg_len < 80:
                note_parts.append("이미지PDF/OCR실패 가능성: 텍스트 레이어 부족 → 모집요강 deferred")
            else:
                note_parts.append("확인함: 환산문구 없음")
    else:
        pages = ",".join(str(page) for page, _ in selected)
        note_parts.append(f"comparativeGrade 발췌 pages={pages}")

    eligibility_pages = []
    block_signals = []
    allow_signals = []
    for page_number, text in anchor_pages:
        if re.search(r"지원\s*자격|동등\s*학력|검정\s*고시", text):
            eligibility_pages.append(page_number)
        block = re.search(r"검정\s*고시.{0,80}(지원\s*할\s*수\s*없|지원\s*불가|제외)|지원\s*불가", text)
        allow = re.search(r"검정\s*고시\s*합격자|동등\s*이상\s*학력|법령.*동등", text)
        if block and len(block_signals) < 3:
            block_signals.append(f"p{page_number}:{block.group(0)[:60]}")
        if allow and len(allow_signals) < 3:
            allow_signals.append(f"p{page_number}:{allow.group(0)[:60]}")
    if eligibility_pages:
        note_parts.append("지원자격 신호 p." + ",".join(map(str, eligibility_pages[:8])))
    if block_signals:
        note_parts.append("검정고시 지원불가 신호 " + "; ".join(block_signals))
    if allow_signals:
        note_parts.append("검정고시/동등학력 허용 신호 " + "; ".join(allow_signals))
    if errors:
        note_parts.append("추출오류 " + "; ".join(errors[:3]))

    return {
        "comparativeGrade": comparative_grade,
        "note": " ".join(note_parts).strip(),
        "anchorPages": [page for page, _ in anchor_pages],
        "comparativePages": [page for page, _ in comparative_pages],
        "avgTextLength": round(sum(text_lengths) / max(1, len(text_lengths)), 1),
        "pageCount": len(text_lengths),
    }


def make_row(target, university, pdf_path, pdf_meta, extracted, needs_univ_id=False):
    comparative_grade = extracted["comparativeGrade"]
    comp_type = classify_type(comparative_grade, extracted["note"])
    label = "비교내신/서류 환산" if comparative_grade else None
    if comp_type == "deferred":
        label = None
    if comp_type == "ged_block":
        label = None
    return {
        "univId": university["univId"] if university else f"u2028_D_{target['index']:03d}",
        "univName": university["name"] if university else target["name"],
        "campus": pdf_meta["campus"] if pdf_meta else target.get("campus") or "본교",
        "region": university["region"] if university else (pdf_meta["region"] if pdf_meta else target.get("region")),
        "phase": None,
        "admissionType": None,
        "admissionName": None,
        "unit": None,
        "recruitCount": None,
        "evalMethod": None,
        "interview": None,
        "csatMinimum": None,
        "gedEligible": None,
        "gedIneligibleReason": "",
        "gedReflection": label,
        "comparativeGrade": comparative_grade,
        "note": extracted["note"],
        "source": pdf_meta["filename"] if pdf_meta else "",
        "status": "confirmed_summary",
        "sourceYear": 2028,
        "needsUnivId": bool(needs_univ_id or not university),
        "_recordType": "univ_level",
        "comparativeGradeType": classify_type(comparative_grade, extracted["note"]),
    }


def build_targets():
    targets = []
    for name in NEW_TARGETS:
        targets.append({"name": name, "group": "new"})
    for name in RECHECK_TARGETS:
        targets.append({"name": name, "group": "recheck"})
    for item in MANUAL_TARGETS:
        targets.append({"name": item["name"], "group": "manual", "region": item["region"], "campus": item["campus"]})
    for index, target in enumerate(targets, start=1):
        target["index"] = index
    return targets


def main():
    universities = load_universities()
    rows = []
    report_items = []

    for target in build_targets():
        university = match_university(universities, target["name"], target.get("region"))
        pdf_path, pdf_meta = choose_pdf(
            target["name"],
            target_region=target.get("region"),
            target_campus=target.get("campus"),
            university=university,
        )
        if pdf_path is None:
            row = make_row(target, university, None, None, {
                "comparativeGrade": None,
                "note": "[patch_D] PDF 매칭 실패",
                "anchorPages": [],
                "comparativePages": [],
                "avgTextLength": 0,
                "pageCount": 0,
            }, needs_univ_id=not university)
            rows.append(row)
            report_items.append({**target, "pdf": "", "type": "missing_pdf", "filled": False, "needsUnivId": row["needsUnivId"]})
            print(f"{target['index']:02d} {target['name']} -> PDF missing")
            continue

        extracted = extract_comparative(pdf_path)
        row = make_row(target, university, pdf_path, pdf_meta, extracted, needs_univ_id=not university)
        rows.append(row)
        report_items.append({
            **target,
            "pdf": pdf_meta["filename"],
            "type": row["comparativeGradeType"],
            "filled": bool(row["comparativeGrade"]),
            "needsUnivId": row["needsUnivId"],
            "anchorPages": extracted["anchorPages"],
            "comparativePages": extracted["comparativePages"],
            "avgTextLength": extracted["avgTextLength"],
        })
        print(f"{target['index']:02d} {target['name']} -> {row['comparativeGradeType']} filled={bool(row['comparativeGrade'])}")

    OUT.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    write_report(rows, report_items)
    print(f"wrote {OUT} rows={len(rows)}")
    print(f"report {REPORT}")


def write_report(rows, items):
    type_counts = Counter(row["comparativeGradeType"] for row in rows)
    group_counts = Counter(item["group"] for item in items)
    filled = sum(1 for row in rows if row.get("comparativeGrade"))
    needs = sum(1 for row in rows if row.get("needsUnivId"))
    pdf_missing = [item for item in items if item["type"] == "missing_pdf"]
    low_text = [item for item in items if item.get("avgTextLength", 999) < 80]
    rechecks = [item for item in items if item["group"] == "recheck"]

    lines = [
        "# admissions_2028_patch_D 리포트",
        "",
        f"- 처리 대상: {len(rows)}",
        f"- 그룹 분포: " + ", ".join(f"{k}:{v}" for k, v in sorted(group_counts.items())),
        f"- comparativeGrade 채움: {filled}",
        f"- univId 매칭 실패: {needs}",
        f"- PDF 매칭 실패: {len(pdf_missing)}",
        "",
        "## comparativeGradeType 분포",
        "",
        "| type | count |",
        "| --- | ---: |",
    ]
    for key, count in type_counts.most_common():
        lines.append(f"| {key} | {count} |")

    lines.extend(["", "## 재확인 11개 결과", "", "| 대학 | type | filled | pdf |", "| --- | --- | ---: | --- |"])
    for item in rechecks:
        lines.append(f"| {item['name']} | {item['type']} | {str(item['filled']).lower()} | {item['pdf']} |")

    lines.extend(["", "## 이미지PDF/OCR실패 의심", ""])
    if low_text:
        for item in low_text:
            lines.append(f"- {item['name']} ({item.get('pdf','')}): avgTextLength={item.get('avgTextLength')}")
    else:
        lines.append("- 없음")

    lines.extend(["", "## PDF/매칭 실패", ""])
    if pdf_missing:
        for item in pdf_missing:
            lines.append(f"- {item['name']}: PDF 매칭 실패")
    else:
        lines.append("- 없음")

    lines.extend(["", "## 전체 처리 목록", "", "| # | group | 대학 | type | filled | anchorPages | comparativePages |", "| ---: | --- | --- | --- | ---: | --- | --- |"])
    for item in items:
        lines.append(
            f"| {item['index']} | {item['group']} | {item['name']} | {item['type']} | "
            f"{str(item.get('filled', False)).lower()} | {','.join(map(str, item.get('anchorPages', [])))[:80]} | "
            f"{','.join(map(str, item.get('comparativePages', [])))[:80]} |"
        )

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
