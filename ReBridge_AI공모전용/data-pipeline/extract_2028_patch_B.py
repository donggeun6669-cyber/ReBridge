#!/usr/bin/env python3
"""
2028 시행계획 PDF 추출 스크립트 — Patch B (경기/충남/충북/대전)
출력: admissions_2028_patch_B.json

패턴: 각 전형이 독립 페이지로 구성됨
  Line 1: 전형유형 (예: 논술위주, 학생부(교과)위주, 수능위주)
  Line 2: 전형명 + " 전형" (예: "논술 전형", "학생부우수자 전형")
  Line 3-4: 모집인원 + 숫자
  Line 5: "전형방법"
  Line 6+: 전형방법 내용
  "지원자격" 섹션
  "수능최저학력기준" 섹션
"""

import os
import json
import unicodedata
import re
import pdfplumber
from pathlib import Path

PDF_DIR = Path("/Users/r_o_und_12/Documents/GitHub/ReBridge/ReBridge_AI공모전용/Application_main_codes/src/data/pdf_sources/2028")
DATA_DIR = Path("/Users/r_o_und_12/Documents/GitHub/ReBridge/ReBridge_AI공모전용/Application_main_codes/src/data")
UNIS_JSON = DATA_DIR / "universities.json"
OUTPUT_JSON = DATA_DIR / "admissions_2028_patch_B.json"

TARGET_REGIONS = ["경기", "충남", "충북", "대전"]


def nfc(s):
    return unicodedata.normalize("NFC", s)


def clean(s):
    """null byte 및 불필요한 공백 제거"""
    if not s:
        return s
    return s.replace("\x00", " ").replace(" ", " ").strip()


def load_universities():
    with open(UNIS_JSON, encoding="utf-8") as f:
        unis = json.load(f)
    name_to_id = {}
    for u in unis:
        name_to_id[nfc(u["name"])] = (u["univId"], u["region"])
        # 변형들
        stripped = nfc(u["name"]).replace(" ", "")
        name_to_id[stripped] = (u["univId"], u["region"])
    return unis, name_to_id


def match_univ_id(name, name_to_id, counter_ref):
    candidates = [
        name,
        name.replace(" ", ""),
        re.sub(r'^국립', '', name),
        re.sub(r'^국립', '', name).replace(" ", ""),
    ]
    for c in candidates:
        if c in name_to_id:
            return name_to_id[c][0], False
    # 부분 매칭
    for k, (uid, _) in name_to_id.items():
        if len(k) >= 4 and k in name:
            return uid, False
        if len(name) >= 4 and name in k:
            return uid, False
    uid = f"u2028_{counter_ref[0]:03d}"
    counter_ref[0] += 1
    return uid, True


def get_target_pdfs():
    result = []
    for f in sorted(os.listdir(PDF_DIR)):
        fn = nfc(f)
        for region in TARGET_REGIONS:
            if f"[{region}]" in fn:
                campus_m = re.search(r'\[(본교|제\d+캠퍼스|분교)\]', fn)
                campus = campus_m.group(1) if campus_m else "본교"
                # 대학명: 첫 번째 [ 이전
                univ_name = re.split(r'\[', fn)[0].strip()
                result.append({
                    "filename": f,
                    "filepath": PDF_DIR / f,
                    "univ_name": univ_name,
                    "region": region,
                    "campus": campus,
                })
                break
    return result


# ── 전형유형 분류
TYPE_MAP = {
    "학생부(교과)위주": "학생부교과",
    "학생부(종합)위주": "학생부종합",
    "논술위주": "논술",
    "실기/실적위주": "실기/실적",
    "수능위주": "수능위주",
    # 대안 표현
    "학생부교과": "학생부교과",
    "학생부종합": "학생부종합",
    "논술": "논술",
    "실기": "실기/실적",
    "수능": "수능위주",
}

def classify_type(raw):
    for k, v in TYPE_MAP.items():
        if k in raw:
            return v
    return "학생부종합"

JUNGSI_TYPE_KEYWORDS = ["수능위주", "수능 위주"]

def classify_phase(page_text, type_raw):
    first_line = page_text.strip().split("\n")[0] if page_text else ""
    if "수능위주" in type_raw or "정시" in first_line:
        return "정시"
    # 정시 페이지 패턴: "수능위주" 전형유형 줄
    if "수능위주" in page_text[:100]:
        return "정시"
    return "수시"


# ── 단일 페이지 파싱: 전형유형/이름/인원/전형방법/자격/수능최저 추출
SECTION_KEYWORDS = ["지원자격", "수능최저학력기준", "세부모집", "대학수학능력시험"]

def parse_single_page(page_num, txt, univ_name, filename):
    """한 페이지 텍스트에서 전형 1개 정보 추출. 실패 시 None 반환."""
    lines = [clean(l) for l in txt.split("\n") if clean(l)]
    if len(lines) < 3:
        return None

    # 전형유형 (첫 줄에서)
    type_raw = lines[0] if lines else ""

    # "전형" 단어가 포함된 전형명 찾기
    adm_name = None
    for i, l in enumerate(lines[:5]):
        if "전형" in l and l != "전형방법" and l != "수능최저학력기준":
            # "논술 전형" → "논술", "학생부우수자 전형" → "학생부우수자"
            nm = re.sub(r'\s*전형$', '', l).strip()
            nm = re.sub(r'\s*전형\s*\[.*\]$', '', nm).strip()
            if nm and nm not in ["전형유형", "모집전형", "전형방법"]:
                adm_name = nm
                break

    if not adm_name:
        return None

    # 모집인원
    recruit_count = None
    for i, l in enumerate(lines):
        if l == "모집인원" and i + 1 < len(lines):
            m = re.search(r'[\d,]+', lines[i + 1])
            if m:
                recruit_count = int(m.group().replace(",", ""))
            break
        # "1,054" 숫자만 있는 줄
        m = re.match(r'^([\d,]+)$', l)
        if m and i > 0 and "인원" in lines[i-1]:
            recruit_count = int(m.group().replace(",", ""))

    # 전형방법
    eval_method = None
    for i, l in enumerate(lines):
        if l == "전형방법" and i + 1 < len(lines):
            eval_lines = []
            j = i + 1
            while j < len(lines) and lines[j] not in SECTION_KEYWORDS:
                eval_lines.append(lines[j])
                j += 1
                if j - i > 8:
                    break
            eval_method = " ".join(eval_lines).strip()
            break

    # 지원자격
    qual_text = None
    for i, l in enumerate(lines):
        if l == "지원자격" and i + 1 < len(lines):
            qual_lines = []
            j = i + 1
            while j < len(lines) and lines[j] not in SECTION_KEYWORDS:
                qual_lines.append(lines[j])
                j += 1
            qual_text = " ".join(qual_lines).strip()
            break

    # 수능최저
    csat_text = None
    for i, l in enumerate(lines):
        if l == "수능최저학력기준" and i + 1 < len(lines):
            csat_lines = []
            j = i + 1
            while j < len(lines) and lines[j] not in ["세부모집", "모집단위", "- "]:
                csat_lines.append(lines[j])
                j += 1
                if j - i > 20:
                    break
            val = " ".join(csat_lines).strip()
            if val.startswith("없음"):
                csat_text = "없음"
            elif val:
                csat_text = val[:300]
            break

    # 면접 여부
    interview = False
    if eval_method and "면접" in eval_method:
        interview = True

    adm_type = classify_type(type_raw)
    phase = classify_phase(txt, type_raw)

    return {
        "type_raw": type_raw,
        "adm_name": adm_name,
        "adm_type": adm_type,
        "phase": phase,
        "recruit_count": recruit_count,
        "eval_method": eval_method,
        "qual_text": qual_text,
        "csat_text": csat_text,
        "interview": interview,
        "page_num": page_num,
    }


# ── gedEligible 판정
def judge_ged(qual_text, adm_type, adm_name, phase):
    if not qual_text:
        if phase == "정시":
            return "가능", "", "수능"
        return "조건부", "지원자격 정보 없음", ""

    qt = qual_text

    # 명백한 불가
    if "검정고시 출신자 및" in qt and "제외" in qt:
        return "불가", "검정고시 출신자 제외 명시", ""
    if re.search(r'검정고시\s*출신자[는은]\s*지원\s*(할\s*수\s*없|불가)', qt):
        return "불가", "검정고시 출신자 지원 불가 명시", ""
    if "학교생활기록부가 없는 자는 지원할 수 없" in qt:
        return "불가", "학생부 없는 자 지원 불가", ""
    if "학생부가 없는 자는 지원할 수 없" in qt:
        return "불가", "학생부 없는 자 지원 불가", ""
    if re.search(r'고등학교장의?\s*추천', qt):
        return "불가", "학교장 추천 필수 전형", ""
    if "재학생에 한" in qt or "재학 중인 자" in qt:
        return "불가", "재학생 한정 전형", ""

    # 명백한 가능
    eligible_phrases = [
        "검정고시 합격자", "검정고시합격자",
        "동등 이상의 학력", "동등이상의 학력",
        "이와 같은 수준 이상의 학력",
        "법령에 따라 이와 같은",
        "이에 준하는 학력",
        "이와 동등 이상",
    ]
    for p in eligible_phrases:
        if p in qt:
            if phase == "정시":
                return "가능", "", "수능"
            if "교과" in adm_type:
                return "조건부", "비교내신 또는 동등 학력 환산 적용", "비교내신 환산"
            if "종합" in adm_type:
                return "가능", "", "서류평가"
            if "논술" in adm_type:
                return "가능", "", "논술+(최저)"
            if "실기" in adm_type:
                return "가능", "", "실기"
            if "수능" in adm_type:
                return "가능", "", "수능"
            return "가능", "", ""

    # "국내 고등학교 졸업(예정)자" 단독 — 검정고시 미언급 → 불가
    if re.search(r'국내\s*고등학교\s*졸업\(예정\)자$', qt.strip()):
        return "불가", "국내 고교 졸업(예정)자만 명시, 검정고시 미언급", ""
    if re.search(r'국내\s*고등학교\s*졸업\(예정\)자\s*$', qt.strip()):
        return "불가", "국내 고교 졸업(예정)자만 명시, 검정고시 미언급", ""

    # 정시 기본 가능
    if phase == "정시":
        return "가능", "", "수능"

    return "조건부", "지원자격 추가확인 필요", ""


def judge_reflection(adm_type, phase, ged_eligible, hint=""):
    if hint:
        return hint
    if phase == "정시":
        return "수능"
    if ged_eligible == "불가":
        return ""
    if "교과" in adm_type:
        return "비교내신 환산"
    if "종합" in adm_type:
        return "서류평가"
    if "논술" in adm_type:
        return "논술+(최저)"
    if "실기" in adm_type:
        return "실기"
    if "수능" in adm_type:
        return "수능"
    return ""


# ── comparativeGrade 추출
COMP_KW = ["비교내신", "검정고시", "동등학력", "환산", "산출"]

def extract_comp_grade(pdf, univ_name, filename):
    """PDF 전체에서 비교내신/검정고시 환산 관련 섹션 추출"""
    best_text = None
    best_page = None
    for i, page in enumerate(pdf.pages):
        txt = page.extract_text() or ""
        txt_clean = clean(txt)
        if any(kw in txt_clean for kw in COMP_KW):
            relevant_lines = []
            for line in txt_clean.split("\n"):
                cl = clean(line)
                if any(kw in cl for kw in COMP_KW) and len(cl) > 5:
                    relevant_lines.append(cl)
            if relevant_lines:
                cg = " | ".join(relevant_lines[:15])
                # 우선순위: "비교내신" 키워드 있는 것
                if best_text is None or ("비교내신" in cg and "비교내신" not in (best_text or "")):
                    best_text = cg
                    best_page = i + 1
    return best_text, best_page


# ── PDF 1개 처리
def parse_pdf(pdf_info, name_to_id, fallback_counter):
    filepath = pdf_info["filepath"]
    univ_name = pdf_info["univ_name"]
    region = pdf_info["region"]
    campus = pdf_info["campus"]
    filename = pdf_info["filename"]
    fn_nfc = nfc(filename)

    univ_id, needs_id = match_univ_id(univ_name, name_to_id, fallback_counter)
    rows = []

    try:
        with pdfplumber.open(str(filepath)) as pdf:
            # 비교내신 환산 전체 추출
            comp_grade, comp_page = extract_comp_grade(pdf, univ_name, fn_nfc)

            # 각 페이지 파싱
            parsed_pages = []
            for i, page in enumerate(pdf.pages):
                txt = page.extract_text() or ""
                if not txt.strip():
                    continue
                # 전형 페이지인지 판단: "전형방법" 또는 "지원자격" 포함
                if "전형방법" not in txt and "지원자격" not in txt:
                    continue
                info = parse_single_page(i + 1, txt, univ_name, fn_nfc)
                if info:
                    parsed_pages.append(info)

            if not parsed_pages:
                # 표구조 깨짐 — 최소 placeholder 행
                rows.append({
                    "univId": univ_id,
                    "univName": univ_name,
                    "campus": campus,
                    "region": region,
                    "phase": None,
                    "admissionType": None,
                    "admissionName": None,
                    "unit": None,
                    "recruitCount": None,
                    "evalMethod": None,
                    "interview": None,
                    "csatMinimum": None,
                    "gedEligible": None,
                    "gedIneligibleReason": None,
                    "gedReflection": None,
                    "comparativeGrade": comp_grade,
                    "note": "표구조깨짐",
                    "source": f"2028 {univ_name} 시행계획 ({fn_nfc})",
                    "status": "confirmed_detail",
                    "sourceYear": 2028,
                    "needsUnivId": needs_id if needs_id else None,
                })
                return rows

            # 중복 제거 (같은 phase+type+name)
            seen = set()
            for info in parsed_pages:
                key = (info["phase"], info["adm_type"], info["adm_name"][:30])
                if key in seen:
                    continue
                seen.add(key)

                ged_eligible, ged_reason, ged_hint = judge_ged(
                    info["qual_text"], info["adm_type"], info["adm_name"], info["phase"]
                )
                ged_reflection = judge_reflection(
                    info["adm_type"], info["phase"], ged_eligible, ged_hint
                )

                # source 페이지
                src_page = comp_page if comp_page else info["page_num"]

                rows.append({
                    "univId": univ_id,
                    "univName": univ_name,
                    "campus": campus,
                    "region": region,
                    "phase": info["phase"],
                    "admissionType": info["adm_type"],
                    "admissionName": info["adm_name"],
                    "unit": None,
                    "recruitCount": info["recruit_count"],
                    "evalMethod": clean(info["eval_method"])[:300] if info["eval_method"] else None,
                    "interview": info["interview"],
                    "csatMinimum": clean(info["csat_text"])[:300] if info["csat_text"] else None,
                    "gedEligible": ged_eligible,
                    "gedIneligibleReason": ged_reason,
                    "gedReflection": ged_reflection,
                    "comparativeGrade": comp_grade,
                    "note": "",
                    "source": f"2028 {univ_name} 시행계획 p.{info['page_num']} ({fn_nfc})",
                    "status": "confirmed_detail",
                    "sourceYear": 2028,
                    "needsUnivId": needs_id if needs_id else None,
                })

    except Exception as e:
        rows.append({
            "univId": univ_id,
            "univName": univ_name,
            "campus": campus,
            "region": region,
            "phase": None,
            "admissionType": None,
            "admissionName": None,
            "unit": None,
            "recruitCount": None,
            "evalMethod": None,
            "interview": None,
            "csatMinimum": None,
            "gedEligible": None,
            "gedIneligibleReason": None,
            "gedReflection": None,
            "comparativeGrade": None,
            "note": f"파싱오류: {str(e)[:150]}",
            "source": f"2028 {univ_name} 시행계획 ({fn_nfc})",
            "status": "confirmed_detail",
            "sourceYear": 2028,
            "needsUnivId": needs_id if needs_id else None,
        })

    return rows


def main():
    print("=== 2028 Patch B 추출 시작 (v2) ===")
    unis_data, name_to_id = load_universities()
    print(f"Universities: {len(unis_data)}")

    pdfs = get_target_pdfs()
    print(f"Target PDFs: {len(pdfs)}")

    all_rows = []
    fallback_counter = [1]
    broken_pdfs = []

    for idx, pdf_info in enumerate(pdfs, 1):
        print(f"[{idx:2d}/{len(pdfs)}] {pdf_info['univ_name']} [{pdf_info['region']}] {pdf_info['campus']}", end=" ... ")
        rows = parse_pdf(pdf_info, name_to_id, fallback_counter)
        all_rows.extend(rows)
        print(f"{len(rows)}행")

        has_broken = any(
            "표구조깨짐" in (r.get("note") or "") or "파싱오류" in (r.get("note") or "")
            for r in rows
        )
        if has_broken:
            broken_pdfs.append(nfc(pdf_info["filename"]))

        if idx % 10 == 0:
            with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
                json.dump(all_rows, f, ensure_ascii=False, indent=2)
            print(f"  ↳ 중간저장: {len(all_rows)}행")

    # 최종 저장
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(all_rows, f, ensure_ascii=False, indent=2)

    # 통계
    ged_dist = {}
    for r in all_rows:
        v = r.get("gedEligible") or "미판정"
        ged_dist[v] = ged_dist.get(v, 0) + 1
    comp_filled = sum(1 for r in all_rows if r.get("comparativeGrade"))

    print(f"\n=== 완료 ===")
    print(f"처리 PDF: {len(pdfs)}")
    print(f"처리 대학(고유): {len(set(r['univName'] for r in all_rows))}")
    print(f"전체 행: {len(all_rows)}")
    print(f"gedEligible 분포: {ged_dist}")
    print(f"comparativeGrade 채운 수: {comp_filled}")
    print(f"문제 PDF ({len(broken_pdfs)}개):")
    for bp in broken_pdfs:
        print(f"  - {bp}")

    return all_rows, pdfs, ged_dist, comp_filled, broken_pdfs


if __name__ == "__main__":
    main()
